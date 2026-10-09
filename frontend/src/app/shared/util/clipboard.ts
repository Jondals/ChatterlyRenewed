/**
 * src/app/shared/util/clipboard.ts
 * Copies text to the clipboard.
 */

/** Copies text to the clipboard; falls back to a hidden text area when the async API is blocked (HTTP pages, permissions). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Falls through to the legacy way below.
  }
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(area);
  const active = document.activeElement as HTMLElement | null;
  area.select();
  let copied = false;
  try {
    copied = document.execCommand('copy');
  } catch {
    copied = false;
  }
  area.remove();
  active?.focus?.();
  return copied;
}
