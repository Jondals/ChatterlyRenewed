/**
 * src/app/core/sound-library.ts
 * The library of sounds of the app: the list of every sound file (one place, with a descriptive name for what each is for),
 * the loading and decoding of the files, and the playing of one with a chosen speed and level.
 *
 * * Every sound is a FILE in `public/sounds/<folder>/` (see the README of that folder). To use another sound, replace the
 * file (or change its name/extension in `SOUNDS`): nothing is made by the code any more. Files are loaded only after the
 * first interaction of the person, once each, and the browser keeps them.
 *
 * ! Quiet on purpose: the sounds of the interface are about -38 dB before the volume of the settings (which boosts them),
 * ! so `trim` is 1 for them. A file that is louder than the others must get a smaller `trim` here, never a bigger volume.
 */

/** One sound file. */
interface SoundDef {
  /** Path inside `public/sounds`. */
  file: string;
  /** Gain that levels the file with the others (1 = as it is). */
  trim?: number;
  /** For ringtones: seconds of silence before the sound repeats. */
  gap?: number;
}

/** Every sound by the name it is used with. */
export const SOUNDS = {
  // ---- interface (ui/)
  messageReceived: { file: 'ui/message-received.wav' },
  messageSent: { file: 'ui/message-sent.wav' },
  menuOpen: { file: 'ui/menu-open.wav' },
  toggleSwitch: { file: 'ui/toggle-switch.wav' },
  noticeSuccess: { file: 'ui/notice-success.wav' },
  noticeError: { file: 'ui/notice-error.wav' },
  // ---- the sound of pressing a button, one per style (ui/)
  clickSoft: { file: 'ui/click-soft.wav' },
  clickDrop: { file: 'ui/click-drop.wav' },
  clickGlass: { file: 'ui/click-glass.wav' },
  clickTypewriter: { file: 'ui/click-typewriter.wav' },
  clickMarimba: { file: 'ui/click-marimba.wav' },
  clickKalimba: { file: 'ui/click-kalimba.wav' },
  clickTap: { file: 'ui/click-tap.ogg', trim: 0.09 },
  clickSwitch: { file: 'ui/click-switch.ogg', trim: 0.09 },
  clickPluck: { file: 'ui/click-pluck.ogg', trim: 0.1 },
  clickBubble: { file: 'ui/click-bubble.ogg', trim: 0.1 },
  // ---- calls (call/)
  youJoin: { file: 'call/you-join.wav' },
  youLeave: { file: 'call/you-leave.wav' },
  userJoined: { file: 'call/user-joined.wav' },
  userLeft: { file: 'call/user-left.wav' },
  micMute: { file: 'call/mic-mute.wav' },
  micUnmute: { file: 'call/mic-unmute.wav' },
  headphonesDeafen: { file: 'call/headphones-deafen.wav' },
  headphonesUndeafen: { file: 'call/headphones-undeafen.wav' },
  // ---- default ringtones (ringtones/)
  ringtoneClassic: { file: 'ringtones/classic.mp3', gap: 0.6 },
  ringtoneChristmas: { file: 'ringtones/christmas.mp3', gap: 0.8 },
  ringtoneHalloween: { file: 'ringtones/halloween.mp3', gap: 0.9 },
  ringtoneNewyear: { file: 'ringtones/newyear.mp3', gap: 0.8 },
  // ---- soundtracks of the animations of arriving (auth/)
  authIntro: { file: 'auth/intro.mp3' },
  authSignIn: { file: 'auth/sign-in-unlock.mp3' },
  authSignOut: { file: 'auth/sign-out-lock.mp3' },
  authSignUp: { file: 'auth/sign-up-fireworks.mp3' },
  // ---- default effects of the soundboard (soundboard/)
  chime: { file: 'soundboard/chime.mp3' },
  doorbell: { file: 'soundboard/doorbell.mp3' },
  siren: { file: 'soundboard/siren.mp3' },
  airHorn: { file: 'soundboard/air-horn.mp3' },
  boing: { file: 'soundboard/boing.mp3' },
  sadTrombone: { file: 'soundboard/sad-trombone.mp3' },
  coin: { file: 'soundboard/coin.wav' },
  taDa: { file: 'soundboard/ta-da.mp3' },
  drumRoll: { file: 'soundboard/drum-roll.mp3' },
  rimshot: { file: 'soundboard/rimshot.mp3' },
  cymbal: { file: 'soundboard/cymbal.mp3' },
  applause: { file: 'soundboard/applause.mp3' },
  wave: { file: 'soundboard/wave.mp3' },
  wind: { file: 'soundboard/wind.mp3' },
  rain: { file: 'soundboard/rain.mp3' },
  thunder: { file: 'soundboard/thunder.mp3' },
  sparkle: { file: 'soundboard/sparkle.mp3' },
  spell: { file: 'soundboard/spell.mp3' },
} as const satisfies Record<string, SoundDef>;

export type SoundId = keyof typeof SOUNDS;

/** The sounds that are loaded as soon as the audio exists: they are the ones people hear all the time. */
export const ESSENTIAL_SOUNDS: readonly SoundId[] = [
  'messageReceived',
  'messageSent',
  'menuOpen',
  'toggleSwitch',
  'noticeSuccess',
  'noticeError',
  'clickSoft',
  'clickDrop',
  'clickGlass',
  'clickTypewriter',
  'clickMarimba',
  'clickKalimba',
  'clickTap',
  'clickSwitch',
  'clickPluck',
  'clickBubble',
  'youJoin',
  'youLeave',
  'userJoined',
  'userLeft',
  'micMute',
  'micUnmute',
  'headphonesDeafen',
  'headphonesUndeafen',
  'authSignIn',
  'authSignOut',
  'authSignUp',
  'authIntro',
];

/** The decoded sounds by file. */
const buffers = new Map<string, AudioBuffer>();
/** Loads that have started, by file (also the failed ones: a file that cannot be loaded is not asked for again). */
const requested = new Map<string, Promise<void>>();

/** Downloads and decodes one file. A failure is ignored: that sound is simply silent. */
async function fetchAndDecode(context: BaseAudioContext, file: string): Promise<void> {
  try {
    const response = await fetch(new URL('sounds/' + file, document.baseURI), {
      credentials: 'omit',
    });
    if (!response.ok) {
      return;
    }
    buffers.set(file, await context.decodeAudioData(await response.arrayBuffer()));
  } catch {
    /* no file, or a format this browser cannot decode: that sound stays silent */
  }
}

/** Starts loading some sounds (each file only once). Returns when they are all ready (or failed). */
export function loadSounds(context: BaseAudioContext, ids: readonly SoundId[]): Promise<unknown> {
  const loads: Promise<void>[] = [];
  for (const id of ids) {
    const file = SOUNDS[id].file;
    let load = requested.get(file);
    if (!load) {
      load = fetchAndDecode(context, file);
      requested.set(file, load);
    }
    loads.push(load);
  }
  return Promise.all(loads);
}

/** Whether a sound is decoded and ready to play right now. */
export function soundReady(id: SoundId): boolean {
  return buffers.has(SOUNDS[id].file);
}

/** How long a sound lasts in seconds (0 until it is loaded). */
export function soundLength(id: SoundId): number {
  return buffers.get(SOUNDS[id].file)?.duration ?? 0;
}

/** The seconds of silence after a ringtone before it repeats. */
export function soundGap(id: SoundId): number {
  const def: SoundDef = SOUNDS[id];
  return def.gap ?? 0;
}

/** What a sound plays with. */
export interface PlayOptions {
  /** Playback speed: 1 is the recording, above 1 is higher and shorter. */
  rate?: number;
  /** Level before the master volume (1 is the level of the file). */
  gain?: number;
  /** Seconds from now. */
  at?: number;
  /** Play it again and again until it is stopped. */
  loop?: boolean;
}

/**
 * Plays a sound through a destination. Returns the source (to stop it), or null when the sound is not loaded yet (it
 * starts loading, and that press is silent: the next one sounds).
 */
export function playSound(
  context: BaseAudioContext,
  destination: AudioNode,
  id: SoundId,
  options: PlayOptions = {},
): AudioBufferSourceNode | null {
  const def: SoundDef = SOUNDS[id];
  const buffer = buffers.get(def.file);
  if (!buffer) {
    void loadSounds(context, [id]);
    return null;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.playbackRate.value = options.rate ?? 1;
  source.loop = options.loop ?? false;
  const level = context.createGain();
  level.gain.value = (options.gain ?? 1) * (def.trim ?? 1);
  source.connect(level).connect(destination);
  source.start(context.currentTime + (options.at ?? 0));
  return source;
}
