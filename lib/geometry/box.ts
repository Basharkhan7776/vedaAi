import type { BoxPct } from "@/lib/types/evaluation";

/** Gemini object-detection format: [ymin, xmin, ymax, xmax] in 0..1000. */
export type Box2d = [number, number, number, number];

export function box2dToPct(box: Box2d | number[]): BoxPct {
  const [ymin, xmin, ymax, xmax] = box;
  const y0 = clamp(ymin, 0, 1000);
  const x0 = clamp(xmin, 0, 1000);
  const y1 = clamp(ymax, 0, 1000);
  const x1 = clamp(xmax, 0, 1000);

  return {
    x: round1(x0 / 10),
    y: round1(y0 / 10),
    width: round1(Math.max(0, (x1 - x0) / 10)),
    height: round1(Math.max(0, (y1 - y0) / 10)),
  };
}

export function pctToBox2d(box: BoxPct): Box2d {
  const xmin = clamp(box.x * 10, 0, 1000);
  const ymin = clamp(box.y * 10, 0, 1000);
  const xmax = clamp((box.x + box.width) * 10, 0, 1000);
  const ymax = clamp((box.y + box.height) * 10, 0, 1000);
  return [ymin, xmin, ymax, xmax];
}

export function emptyBox(): BoxPct {
  return { x: 0, y: 0, width: 0, height: 0 };
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}
