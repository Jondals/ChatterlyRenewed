/**
 * src/app/shared/util/arrival-fx.ts
 * The light show behind the arrival animations, drawn on a canvas: points of light that spiral in from the edges of
 * the screen and gather into a ring (then burst outward), fireworks with gravity for the celebration, and slow dust that
 * floats and twinkles in the background all through.
 * It is plain math on a 2D canvas, with no library, and it stops by itself when the show ends.
 */

/** Which show to put on. */
export type FxMode = 'intro' | 'login' | 'register';

/** What the caller can do while the show runs. */
export interface Fx {
  /** The ring of light explodes outward. */
  explode(): void;
  /** A burst of sparks at a point of the screen (0 to 1 on each side), with gravity or without. */
  burst(x: number, y: number, count: number, gravity?: number): void;
  /** Stops the show and frees the canvas. */
  stop(): void;
}

/** One point of light. */
interface Spark {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  hue: number;
  gravity: number;
  /** While true the spark follows its path into the ring instead of flying free. */
  gathering: boolean;
  fromR: number;
  toR: number;
  angle: number;
  spin: number;
  delay: number;
}

/** Which color each light has: a position in the palette read from the theme (see `readPalette`). */
const HUES = [0, 1, 2, 3, 4, 5];

/** A color as red, green and blue. */
type Rgb = [number, number, number];

/** Reads a #rrggbb color (null when it is something else). */
function parseHex(value: string): Rgb | null {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(value.trim());
  return match ? [parseInt(match[1]!, 16), parseInt(match[2]!, 16), parseInt(match[3]!, 16)] : null;
}

/** The middle color between two. */
function mixColors(first: Rgb, second: Rgb): Rgb {
  return [
    Math.round((first[0] + second[0]) / 2),
    Math.round((first[1] + second[1]) / 2),
    Math.round((first[2] + second[2]) / 2),
  ];
}

/** A lighter version of a color (towards white). */
function lighten(color: Rgb, amount: number): Rgb {
  return [
    Math.round(color[0] + (255 - color[0]) * amount),
    Math.round(color[1] + (255 - color[1]) * amount),
    Math.round(color[2] + (255 - color[2]) * amount),
  ];
}

/** The colors of the lights, from the theme of the person: its two accents, the mix of both, lighter ones and white. */
function readPalette(element: Element): Rgb[] {
  const style = getComputedStyle(element);
  const first = parseHex(style.getPropertyValue('--accent')) ?? [46, 242, 176];
  const second = parseHex(style.getPropertyValue('--accent-2')) ?? [167, 139, 250];
  return [
    first,
    second,
    mixColors(first, second),
    lighten(first, 0.5),
    lighten(second, 0.5),
    [255, 255, 255],
  ];
}

/** Smooth start and end of a movement, from 0 to 1. */
function ease(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

/**
 * Starts the show on a canvas.
 * @param canvas Where to draw (it is sized to fill its box).
 * @param mode The show: the introduction, the sign-in or the celebration.
 */
export function startFx(canvas: HTMLCanvasElement, mode: FxMode): Fx {
  const context = canvas.getContext('2d');
  // Sharper than 1.5 pixels per pixel is not seen in glowing dots, and it costs the square of it to fill.
  const ratio = Math.min(
    window.devicePixelRatio || 1,
    document.documentElement.dataset['perf'] === 'low' ? 1 : 1.5,
  );
  const width = canvas.clientWidth || window.innerWidth;
  const height = canvas.clientHeight || window.innerHeight;
  canvas.width = Math.round(width * ratio);
  canvas.height = Math.round(height * ratio);
  const centreX = width / 2;
  const centreY = height / 2 - (mode === 'intro' ? 50 : 20);
  const ringR = mode === 'intro' ? 96 : 62;
  const sparks: Spark[] = [];
  let frame = 0;
  let last = performance.now();
  let stopped = false;
  /** A weak device (see main.ts) gets a lighter show from the start. */
  const weak = document.documentElement.dataset['perf'] === 'low';
  let slowFrames = 0;
  let sparkLimit = Infinity;

  /** A spark that flies in from far away and takes its place in the ring. */
  function gatherer(index: number, total: number): Spark {
    const angle = (index / total) * Math.PI * 2 + Math.random() * 0.4;
    return {
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      age: 0,
      life: (mode === 'intro' ? 1500 : 700) + Math.random() * 300,
      size: 1 + Math.random() * 2.2,
      hue: HUES[index % 4]!,
      gravity: 0,
      gathering: true,
      fromR: Math.max(width, height) * (0.55 + Math.random() * 0.4),
      toR: ringR + (Math.random() - 0.5) * 16,
      angle,
      spin: (Math.random() < 0.5 ? -1 : 1) * (1.6 + Math.random() * 1.4),
      delay: Math.random() * (mode === 'intro' ? 500 : 200),
    };
  }

  /** Sparks that fly free from a point. */
  function scatter(x: number, y: number, count: number, gravity: number, hues: number[]): void {
    for (let i = 0; i < count; i++) {
      const direction = Math.random() * Math.PI * 2;
      const speed = 1.2 + Math.random() * (gravity ? 6.5 : 4.5);
      sparks.push({
        x,
        y,
        vx: Math.cos(direction) * speed,
        vy: Math.sin(direction) * speed - (gravity ? 1.5 : 0),
        age: 0,
        life: 900 + Math.random() * 900,
        size: 1.2 + Math.random() * 2.4,
        hue: hues[i % hues.length]!,
        gravity,
        gathering: false,
        fromR: 0,
        toR: 0,
        angle: 0,
        spin: 0,
        delay: 0,
      });
    }
  }

  if (mode !== 'register') {
    const total = (mode === 'intro' ? 150 : 80) * (weak ? 0.35 : 1);
    for (let i = 0; i < total; i++) {
      sparks.push(gatherer(i, total));
    }
  }

  /** Slow dust that floats upward all through the show and twinkles: it fills the background with life. */
  const motes = Array.from(
    { length: (mode === 'register' ? 40 : 90) * (weak ? 0.25 : 1) },
    function mote(_, i) {
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        rise: 0.01 + Math.random() * 0.035,
        sway: Math.random() * Math.PI * 2,
        size: 0.6 + Math.random() * 1.6,
        hue: HUES[i % HUES.length]!,
      };
    },
  );

  /** One glowing dot of each color, drawn once: drawing a picture is much cheaper than making a gradient per spark per frame. */
  const palette = readPalette(canvas);
  const sprites = new Map<number, HTMLCanvasElement>();
  for (const hue of HUES) {
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 64;
    const paint = sprite.getContext('2d');
    if (paint) {
      const [red, green, blue] = palette[hue]!;
      const centre = lighten([red, green, blue], 0.55);
      const glow = paint.createRadialGradient(32, 32, 0, 32, 32, 32);
      glow.addColorStop(0, 'rgba(' + centre.join(',') + ',1)');
      glow.addColorStop(0.3, 'rgba(' + red + ',' + green + ',' + blue + ',0.5)');
      glow.addColorStop(1, 'rgba(' + red + ',' + green + ',' + blue + ',0)');
      paint.fillStyle = glow;
      paint.fillRect(0, 0, 64, 64);
    }
    sprites.set(hue, sprite);
  }

  /** Draws one spark as a small glowing dot. */
  function draw(spark: Spark, alpha: number): void {
    const sprite = sprites.get(spark.hue);
    if (!context || !sprite) {
      return;
    }
    const size = spark.size * 6.4;
    context.globalAlpha = alpha;
    context.drawImage(sprite, spark.x - size / 2, spark.y - size / 2, size, size);
  }

  /** One frame: moves every spark and draws them all. */
  function step(now: number): void {
    if (stopped || !context) {
      return;
    }
    const dt = Math.min(now - last, 40);
    // A device that cannot keep up (frames longer than 30 ms, many times) gets fewer lights from then on.
    if (now - last > 30) {
      slowFrames++;
      if (slowFrames === 12) {
        motes.length = Math.floor(motes.length / 3);
        sparkLimit = 60;
      } else if (slowFrames === 40) {
        // Still slow after all that: the whole page switches to the light mode (no blur, quick motion) for this visit.
        document.documentElement.dataset['perf'] = 'low';
      }
    }
    last = now;
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.clearRect(0, 0, width, height);
    context.globalCompositeOperation = 'lighter';
    for (const mote of motes) {
      mote.y -= mote.rise * dt;
      mote.x += Math.sin(now / 1400 + mote.sway) * 0.12;
      if (mote.y < -10) {
        mote.y = height + 10;
        mote.x = Math.random() * width;
      }
      const sprite = sprites.get(mote.hue);
      if (sprite) {
        // Near the top and bottom edges the dust fades out, so it never pops in or out when it wraps around.
        const edge = Math.min(1, Math.max(0, Math.min(mote.y, height - mote.y) / 70));
        context.globalAlpha =
          edge * (0.18 + 0.32 * (0.5 + 0.5 * Math.sin(now / 700 + mote.sway * 3)));
        context.drawImage(
          sprite,
          mote.x - mote.size * 3,
          mote.y - mote.size * 3,
          mote.size * 6,
          mote.size * 6,
        );
      }
    }
    for (let i = sparks.length - 1; i >= 0; i--) {
      const spark = sparks[i]!;
      if (spark.delay > 0) {
        spark.delay -= dt;
        continue;
      }
      spark.age += dt;
      if (spark.gathering) {
        const t = Math.min(spark.age / spark.life, 1);
        const radius = spark.fromR + (spark.toR - spark.fromR) * ease(t);
        const angle = spark.angle + spark.spin * (1 - ease(t)) + spark.age * 0.0004;
        spark.x = centreX + Math.cos(angle) * radius;
        spark.y = centreY + Math.sin(angle) * radius * 0.92;
        draw(spark, (0.25 + 0.75 * ease(t)) * Math.min(1, spark.age / 350));
        continue;
      }
      spark.vy += spark.gravity * (dt / 16);
      spark.vx *= 0.992;
      spark.x += spark.vx * (dt / 16);
      spark.y += spark.vy * (dt / 16);
      const left = 1 - spark.age / spark.life;
      if (left <= 0) {
        sparks.splice(i, 1);
        continue;
      }
      draw(spark, left * Math.min(1, spark.age / 120));
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    frame = requestAnimationFrame(step);
  }
  frame = requestAnimationFrame(step);

  return {
    explode(): void {
      for (const spark of sparks) {
        if (spark.gathering) {
          const out = spark.angle + spark.spin * 0 + spark.age * 0.0004;
          const speed = 2.5 + Math.random() * 5;
          spark.gathering = false;
          spark.delay = 0;
          spark.age = 120;
          spark.life = 820 + Math.random() * 700;
          spark.vx = Math.cos(out) * speed;
          spark.vy = Math.sin(out) * speed;
        }
      }
    },
    burst(x: number, y: number, count: number, gravity = 0): void {
      scatter(x * width, y * height, Math.min(count * (weak ? 0.4 : 1), sparkLimit), gravity, HUES);
    },
    stop(): void {
      stopped = true;
      cancelAnimationFrame(frame);
      context?.clearRect(0, 0, width, height);
    },
  };
}
