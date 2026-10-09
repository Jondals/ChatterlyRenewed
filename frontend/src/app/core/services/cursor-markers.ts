/**
 * src/app/core/services/cursor-markers.ts
 * The invisible cursors that tell the overlay which cursor state the page asks for, and the names of the states.
 * They are tiny and needed at once; the drawings of the cursors (cursor-shapes.ts) are loaded only when they are drawn.
 */

/** Every cursor state that has a drawing. */
export const CURSOR_STATES: string[] = [
  'default',
  'pointer',
  'text',
  'grab',
  'grabbing',
  'forbidden',
  'wait',
  'help',
  'zoom',
  'move',
  'resize-h',
  'resize-v',
  'crosshair',
];

/**
 * Value of the CSS `cursor` property that draws nothing but tells the overlay which cursor state the page wants:
 * a transparent 1 x 1 picture that carries the name of the state. The overlay reads it back from the computed style.
 */
export function markerCss(name: string): string {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"><desc>cur:' +
    name +
    '</desc></svg>';
  return 'url("data:image/svg+xml,' + encodeURIComponent(svg) + '") 0 0, none';
}

/** Name of the cursor state carried by a computed `cursor` value made by markerCss; null if there is none. */
export function markerName(computedCursor: string): string | null {
  let decoded = computedCursor;
  try {
    decoded = decodeURIComponent(computedCursor);
  } catch {
    // A cursor value that is not valid percent-encoding cannot carry a marker.
  }
  const match = /cur:([a-z-]+)/.exec(decoded);
  return match ? match[1] : null;
}
