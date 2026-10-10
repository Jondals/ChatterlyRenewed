/**
 * src/app/core/services/media-crypto.worker.ts
 * Worker that encrypts and decrypts the audio and video frames of calls (AES-256-GCM).
 */
/// <reference lib="webworker" />
/* eslint-disable @typescript-eslint/no-explicit-any */
import { clearHeaderBytes, MediaKeyChain, type MediaKind } from '../crypto/media-cipher';

/**
 * Runs inside a dedicated worker. Every encoded audio/video frame of every peer passes through here
 * (RTCRtpScriptTransform) and is encrypted/decrypted with that peer's ratcheting keys.
 *
 * ! FAIL CLOSED: until keys have been agreed, outgoing frames are DROPPED rather than sent in clear,
 * and incoming frames that do not authenticate are dropped instead of being handed to the decoder.
 */
interface PeerState {
  send?: MediaKeyChain;
  recv?: MediaKeyChain;
  stats: {
    encrypted: number;
    decrypted: number;
    dropped: number;
    failed: number;
    received: number;
    lastError: string;
  };
}

const scope = self as any;
const peers = new Map<string, PeerState>();

/** Returns the encryption state of one person in the call, creating it the first time. */
function peer(id: string): PeerState {
  let state = peers.get(id);
  if (!state) {
    state = {
      stats: { encrypted: 0, decrypted: 0, dropped: 0, failed: 0, received: 0, lastError: '' },
    };
    peers.set(id, state);
  }
  return state;
}

scope.onmessage = async function (event: MessageEvent) {
  const msg = event.data as
    | { type: 'keys'; peerId: string; send: ArrayBuffer; recv: ArrayBuffer }
    | { type: 'drop'; peerId: string };
  if (msg.type === 'keys') {
    const state = peer(msg.peerId);
    state.send = await MediaKeyChain.create(new Uint8Array(msg.send));
    state.recv = await MediaKeyChain.create(new Uint8Array(msg.recv));
    new Uint8Array(msg.send).fill(0);
    new Uint8Array(msg.recv).fill(0);
    scope.postMessage({ type: 'ready', peerId: msg.peerId });
  } else if (msg.type === 'drop') {
    peers.delete(msg.peerId);
  }
};

setInterval(function () {
  for (const [peerId, state] of peers)
    scope.postMessage({ type: 'stats', peerId, stats: { ...state.stats } });
}, 1500);

scope.onrtctransform = function (event: any) {
  const { readable, writable, options } = event.transformer as {
    readable: ReadableStream<any>;
    writable: WritableStream<any>;
    options: { peerId: string; role: 'send' | 'recv'; kind: MediaKind };
  };
  const { peerId, role, kind } = options;

  const transform = async function (frame: any, controller: TransformStreamDefaultController<any>) {
    const state = peer(peerId);
    const header = clearHeaderBytes(kind, kind === 'audio' || frame.type === 'key');
    try {
      if (role === 'send') {
        if (!state.send) {
          state.stats.dropped++;
          return;
        }
        await state.send.maybeRatchet();
        frame.data = await state.send.encrypt(frame.data, header);
        state.stats.encrypted++;
        controller.enqueue(frame);
      } else {
        state.stats.received++;
        // Chrome emits zero-byte frames for Opus DTX gaps without running them through the sender
        // transform. They carry no media, so they are discarded quietly instead of counted as attacks.
        if (frame.data.byteLength === 0) return;
        if (!state.recv) {
          state.stats.dropped++;
          return;
        }
        frame.data = await state.recv.decrypt(frame.data, header);
        state.stats.decrypted++;
        controller.enqueue(frame);
      }
    } catch (error) {
      state.stats.failed++;
      state.stats.lastError = String(error);
    }
  };

  readable.pipeThrough(new TransformStream({ transform })).pipeTo(writable);
};
