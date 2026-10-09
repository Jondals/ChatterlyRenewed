/**
 * src/app/core/flag-support.ts
 * Windows draws the flag emojis as two letters. When the browser cannot draw a flag, the page adds a flag font
 * (only for the flag characters), so every flag looks right everywhere; where the system has flags nothing changes.
 */

/** True when the browser draws the flag of Switzerland (red and white) instead of the letters "CH". */
function drawsFlags(): boolean {
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return true;
    }
    context.textBaseline = 'top';
    context.font = '28px sans-serif, "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji"';
    context.fillText('\u{1F1E8}\u{1F1ED}', 0, 0);
    const data = context.getImageData(0, 0, 32, 32).data;
    for (let i = 0; i < data.length; i += 4) {
      // A reddish pixel: the flag. The letters are drawn in the (white) text color of the canvas, which is black.
      if (data[i + 3] > 200 && data[i] > 180 && data[i + 1] < 90 && data[i + 2] < 90) {
        return true;
      }
    }
    return false;
  } catch {
    return true;
  }
}

/**
 * Turns the flag font on when the system cannot draw flags. Windows never draws them, whatever the browser, so there
 * the font is always used; the pixel test is for the rest (and it can be fooled by browsers that scramble what a canvas
 * returns, which is why it does not decide on Windows).
 */
export function startFlagSupport(): void {
  if (/Windows/i.test(navigator.userAgent) || !drawsFlags()) {
    document.documentElement.classList.add('flag-polyfill');
  }
}
