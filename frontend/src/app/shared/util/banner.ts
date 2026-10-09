/**
 * src/app/shared/util/banner.ts
 * Banner colour value stored in the profile: '' (none), '#rrggbb' (solid), 'g:#from,#to,angle,opacity[,start,end[,#mid]]'
 * (an older gradient) or 'm:angle:opacity:#color@place,...' (a gradient of two to five colors). The opacity (0-100) is
 * how strongly the colour covers the banner picture.
 */
import {
  encodeMulti,
  gradientCss,
  legacyStops,
  parseMulti,
  sortedStops,
  type Stop,
} from './gradient';

export interface BannerColor {
  /** The first and the last color of the line (or the only one when it is solid). */
  from: string;
  to: string;
  angle: number;
  opacity: number;
  stops: Stop[];
  gradient: boolean;
}

const LEGACY =
  /^g:(#[0-9a-f]{6}),(#[0-9a-f]{6}),(\d{1,3}),(\d{1,3})(?:,(\d{1,3}),(\d{1,3})(?:,(#[0-9a-f]{6}))?)?$/i;

/** The first and last colors of a list of stops. */
function ends(stops: Stop[]): { from: string; to: string } {
  const sorted = sortedStops(stops);
  return { from: sorted[0]!.color, to: sorted[sorted.length - 1]!.color };
}

/** Parses the stored string; returns null when there is no colour. */
export function parseBanner(value: string): BannerColor | null {
  const multi = parseMulti(value);
  if (multi) {
    return {
      ...ends(multi.stops),
      angle: multi.angle,
      opacity: multi.opacity,
      stops: multi.stops,
      gradient: true,
    };
  }
  const g = LEGACY.exec(value);
  if (g) {
    const stops = legacyStops(
      g[1]!,
      g[2]!,
      g[5] === undefined ? 0 : Math.min(100, +g[5]),
      g[6] === undefined ? 100 : Math.min(100, +g[6]),
      g[7] ?? '',
    );
    return {
      from: g[1]!,
      to: g[2]!,
      angle: Math.min(360, +g[3]!),
      opacity: Math.min(100, +g[4]!),
      stops,
      gradient: g[1] !== g[2] || !!g[7],
    };
  }
  if (/^#[0-9a-f]{6}$/i.test(value))
    return {
      from: value,
      to: value,
      angle: 135,
      opacity: 100,
      stops: legacyStops(value, value, 0, 100),
      gradient: false,
    };
  return null;
}

/** Writes the banner color as the text that is stored in the profile. */
export function encodeBanner(b: BannerColor): string {
  if (b.gradient) return encodeMulti(b.angle, b.opacity, b.stops);
  if (b.opacity === 100) return b.from;
  return `g:${b.from},${b.from},${Math.round(b.angle)},${Math.round(b.opacity)}`;
}

/** CSS for the colour layer that sits over the banner picture. */
export function bannerLayer(value: string): { background: string; opacity: number } | null {
  const b = parseBanner(value);
  if (!b) return null;
  return {
    background: b.gradient ? gradientCss(b) : b.from,
    opacity: b.opacity / 100,
  };
}
