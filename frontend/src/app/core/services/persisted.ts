/**
 * src/app/core/services/persisted.ts
 * An Angular signal that is saved to localStorage and restored from it, used for every per-device preference.
 */
import { effect, signal, type WritableSignal } from '@angular/core';

/** Prefix of every key this app writes in localStorage. */
const KEY_PREFIX = 'chatterly.';

/** A signal mirrored to localStorage. It must be called in an injection context. */
export function persisted<T>(key: string, initial: T): WritableSignal<T> {
  const storageKey = KEY_PREFIX + key;
  let value = initial;
  try {
    const raw = localStorage.getItem(storageKey);
    if (raw !== null) {
      value = JSON.parse(raw) as T;
    }
  } catch {
    // Damaged or blocked storage: the default value is used.
  }
  const state = signal<T>(value);
  effect(function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state()));
    } catch {
      // Storage full or disabled: the value simply is not kept.
    }
  });
  return state;
}
