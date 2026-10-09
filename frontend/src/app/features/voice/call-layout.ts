/**
 * src/app/features/voice/call-layout.ts
 * Where the tiles of a call go. Two layouts, both pure functions of the size of the stage: a symmetric grid in which
 * every tile has the same size (the biggest that fits, like Discord), and a focused layout in which one tile fills
 * the stage and the others shrink to a strip below it. The call screen moves every tile to the box this gives it,
 * so going from one layout to the other (or adding someone) is a smooth movement and not a jump.
 */

/** Where a tile goes: position and size in pixels, relative to the stage. */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Space between tiles. */
const GAP = 12;
/** The widest a tile of the grid gets, so a single person does not fill a huge screen. */
const MAX_TILE_WIDTH = 1040;

/** The shape of a tile: wide on a landscape stage, squarer on a portrait one (a phone). */
function ratioFor(width: number, height: number): number {
  return width >= height ? 16 / 9 : 4 / 3;
}

/** A grid in which every tile has the same size, the biggest that fits, with the last row centred. */
export function gridBoxes(count: number, width: number, height: number): Box[] {
  if (count <= 0 || width <= 0 || height <= 0) {
    return [];
  }
  const ratio = ratioFor(width, height);
  let bestColumns = 1;
  let bestWidth = 0;
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const fit = Math.min(
      (width - GAP * (columns - 1)) / columns,
      ((height - GAP * (rows - 1)) / rows) * ratio,
    );
    if (fit > bestWidth) {
      bestWidth = fit;
      bestColumns = columns;
    }
  }
  const tileWidth = Math.floor(Math.min(bestWidth, MAX_TILE_WIDTH));
  const tileHeight = Math.floor(tileWidth / ratio);
  const rows = Math.ceil(count / bestColumns);
  const top = (height - (rows * tileHeight + GAP * (rows - 1))) / 2;
  const boxes: Box[] = [];
  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / bestColumns);
    const inRow = row < rows - 1 ? bestColumns : count - bestColumns * (rows - 1);
    const rowWidth = inRow * tileWidth + GAP * (inRow - 1);
    const place = i - row * bestColumns;
    boxes.push({
      x: Math.round((width - rowWidth) / 2 + place * (tileWidth + GAP)),
      y: Math.round(top + row * (tileHeight + GAP)),
      w: tileWidth,
      h: tileHeight,
    });
  }
  return boxes;
}

/**
 * One tile fills the stage and the rest sit in a strip along the bottom. The first box is the big one; the others
 * follow in order. With nobody else, the big one takes everything.
 */
export function focusBoxes(count: number, width: number, height: number): Box[] {
  if (count <= 0 || width <= 0 || height <= 0) {
    return [];
  }
  if (count === 1) {
    return [{ x: 0, y: 0, w: width, h: height }];
  }
  const others = count - 1;
  const stripHeight = Math.round(Math.min(150, Math.max(height < 420 ? 64 : 88, height * 0.2)));
  const mainHeight = height - stripHeight - GAP;
  const boxes: Box[] = [{ x: 0, y: 0, w: width, h: Math.max(mainHeight, 60) }];
  const ratio = 16 / 9;
  const tileWidth = Math.floor(
    Math.min(stripHeight * ratio, (width - GAP * (others - 1)) / others),
  );
  const tileHeight = Math.floor(tileWidth / ratio);
  const rowWidth = others * tileWidth + GAP * (others - 1);
  const top = mainHeight + GAP + (stripHeight - tileHeight) / 2;
  for (let i = 0; i < others; i++) {
    boxes.push({
      x: Math.round((width - rowWidth) / 2 + i * (tileWidth + GAP)),
      y: Math.round(top),
      w: tileWidth,
      h: tileHeight,
    });
  }
  return boxes;
}
