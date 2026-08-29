import { PDFDocument, StandardFonts, degrees, rgb } from 'pdf-lib';
import { PickedFile } from './files';
import { baseName, readBase64, writeOutput } from './fs';

export type Point = { x: number; y: number };

export type Annotation =
  | { kind: 'ink'; page: number; points: Point[]; color: string; width: number }
  | { kind: 'highlight'; page: number; rect: Rect; color: string }
  | { kind: 'text'; page: number; at: Point; value: string; size: number; color: string }
  | { kind: 'whiteout'; page: number; rect: Rect }
  // path points at a transparent PNG in the signature library.
  // rotation is degrees clockwise about the rect's centre, as the canvas
  // rotates it.
  | { kind: 'signature'; page: number; path: string; rect: Rect; rotation: number };

export type Rect = { x: number; y: number; w: number; h: number };

export const INK_COLORS = {
  black: '#111111',
  blue: '#1E5AE8',
  red: '#D8342B',
} as const;

export const HIGHLIGHT_COLORS = {
  yellow: '#FFE14D',
  green: '#8BE86B',
  pink: '#FF9CC8',
} as const;

const toRgb = (hex: string) => {
  const h = hex.replace('#', '');
  return rgb(
    parseInt(h.slice(0, 2), 16) / 255,
    parseInt(h.slice(2, 4), 16) / 255,
    parseInt(h.slice(4, 6), 16) / 255,
  );
};

/**
 * The canvas draws at whatever width fits the screen, with y running down
 * from the top. PDF space runs up from the bottom left in points. One scale
 * factor converts both, since the canvas keeps the page aspect ratio.
 */
export type PageFrame = { widthPt: number; heightPt: number; canvasWidth: number };

export const scaleOf = (frame: PageFrame) => frame.widthPt / frame.canvasWidth;

export const canvasToPdf = (p: Point, frame: PageFrame): Point => {
  const s = scaleOf(frame);
  return { x: p.x * s, y: frame.heightPt - p.y * s };
};

/**
 * Ramer-Douglas-Peucker. A fast finger produces hundreds of points per
 * stroke; keeping them all bloats the PDF for no visible gain.
 */
export function simplify(points: Point[], tolerance = 1.2): Point[] {
  if (points.length < 3) return points;

  const first = points[0];
  const last = points[points.length - 1];
  let index = -1;
  let maxDist = 0;

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpendicular(points[i], first, last);
    if (d > maxDist) {
      maxDist = d;
      index = i;
    }
  }

  if (maxDist <= tolerance) return [first, last];

  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ];
}

function perpendicular(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq;
  const clamped = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + clamped * dx), p.y - (a.y + clamped * dy));
}

/** Builds an SVG path string in PDF points, anchored at the page top-left. */
function inkPath(points: Point[], frame: PageFrame): string {
  const s = scaleOf(frame);
  return points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${(p.x * s).toFixed(2)} ${(p.y * s).toFixed(2)}`)
    .join(' ');
}

export async function commitAnnotations(
  file: PickedFile,
  annotations: Annotation[],
  frames: Record<number, PageFrame>,
): Promise<{ path: string; note?: string }> {
  if (!annotations.length) throw new Error('Nothing to save yet.');

  const doc = await PDFDocument.load(await readBase64(file.uri));
  const font = await doc.embedFont(StandardFonts.Helvetica);

  // The same signature is often placed on several pages, so each PNG is
  // embedded once and reused rather than duplicated in the file.
  const embeddedSignatures = new Map<string, any>();

  for (const a of annotations) {
    const page = doc.getPage(a.page);
    const frame = frames[a.page];
    if (!frame) continue;
    const s = scaleOf(frame);

    switch (a.kind) {
      case 'ink':
        if (a.points.length < 2) break;
        // drawSvgPath measures y downward from the anchor, so anchor at the
        // top-left corner of the page and the canvas path maps straight over.
        page.drawSvgPath(inkPath(simplify(a.points), frame), {
          x: 0,
          y: frame.heightPt,
          borderColor: toRgb(a.color),
          borderWidth: a.width * s,
        });
        break;

      case 'highlight':
        page.drawRectangle({
          x: a.rect.x * s,
          y: frame.heightPt - (a.rect.y + a.rect.h) * s,
          width: a.rect.w * s,
          height: a.rect.h * s,
          color: toRgb(a.color),
          opacity: 0.35,
        });
        break;

      case 'whiteout':
        page.drawRectangle({
          x: a.rect.x * s,
          y: frame.heightPt - (a.rect.y + a.rect.h) * s,
          width: a.rect.w * s,
          height: a.rect.h * s,
          color: rgb(1, 1, 1),
        });
        break;

      case 'text': {
        const size = a.size * s;
        const pdfPoint = canvasToPdf(a.at, frame);
        page.drawText(a.value, {
          x: pdfPoint.x,
          y: pdfPoint.y - size, // canvas anchors text at its top edge
          size,
          font,
          color: toRgb(a.color),
        });
        break;
      }

      case 'signature': {
        let img = embeddedSignatures.get(a.path);
        if (!img) {
          // embedPng keeps the alpha channel, so the page shows through
          // around the ink instead of a white box.
          img = await doc.embedPng(await readBase64(a.path));
          embeddedSignatures.set(a.path, img);
        }

        const w = a.rect.w * s;
        const h = a.rect.h * s;
        const x = a.rect.x * s;
        const y = frame.heightPt - (a.rect.y + a.rect.h) * s;

        if (!a.rotation) {
          page.drawImage(img, { x, y, width: w, height: h });
          break;
        }

        // pdf-lib rotates about the image's bottom-left anchor, while the
        // canvas rotates about the centre. Rotating the corner offset by the
        // same angle puts the anchor where it needs to be for the two to
        // agree. The sign flips because PDF angles run anticlockwise.
        const rad = (-a.rotation * Math.PI) / 180;
        const cx = x + w / 2;
        const cy = y + h / 2;
        const ox = -w / 2;
        const oy = -h / 2;

        page.drawImage(img, {
          x: cx + ox * Math.cos(rad) - oy * Math.sin(rad),
          y: cy + ox * Math.sin(rad) + oy * Math.cos(rad),
          width: w,
          height: h,
          rotate: degrees(-a.rotation),
        });
        break;
      }
    }
  }

  return {
    path: await writeOutput(`${baseName(file.name)}-marked.pdf`, await doc.saveAsBase64()),
    note: `${annotations.length} mark${annotations.length === 1 ? '' : 's'} applied`,
  };
}

export async function pageFrames(
  file: PickedFile,
  canvasWidth: number,
): Promise<Record<number, PageFrame>> {
  const doc = await PDFDocument.load(await readBase64(file.uri));
  const frames: Record<number, PageFrame> = {};
  doc.getPages().forEach((p, i) => {
    const { width, height } = p.getSize();
    frames[i] = { widthPt: width, heightPt: height, canvasWidth };
  });
  return frames;
}