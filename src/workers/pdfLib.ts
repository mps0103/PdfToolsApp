import {
  PDFDocument,
  StandardFonts,
  degrees,
  rgb,
} from 'pdf-lib';
import { PickedFile } from '../lib/files';
import { baseName, readBase64, writeOutput } from '../lib/fs';

export type WorkerResult = { path: string; note?: string };

const load = async (f: PickedFile) => PDFDocument.load(await readBase64(f.uri));

/** "1-3, 7, 10-" against a page count, returned as zero-based indices. */
export function parseRanges(input: string, pageCount: number): number[] {
  const out = new Set<number>();
  for (const part of input.split(',')) {
    const chunk = part.trim();
    if (!chunk) continue;
    const m = chunk.match(/^(\d+)?\s*-\s*(\d+)?$/);
    if (m) {
      const from = m[1] ? parseInt(m[1], 10) : 1;
      const to = m[2] ? parseInt(m[2], 10) : pageCount;
      for (let p = from; p <= Math.min(to, pageCount); p++) out.add(p - 1);
    } else if (/^\d+$/.test(chunk)) {
      const p = parseInt(chunk, 10);
      if (p >= 1 && p <= pageCount) out.add(p - 1);
    }
  }
  return [...out].sort((a, b) => a - b);
}

export async function merge(files: PickedFile[]): Promise<WorkerResult> {
  const out = await PDFDocument.create();
  for (const f of files) {
    const src = await load(f);
    const pages = await out.copyPages(src, src.getPageIndices());
    pages.forEach(p => out.addPage(p));
  }
  return { path: await writeOutput('merged.pdf', await out.saveAsBase64()) };
}

export async function imagesToPdf(files: PickedFile[]): Promise<WorkerResult> {
  const out = await PDFDocument.create();
  for (const f of files) {
    const b64 = await readBase64(f.uri);
    const isPng = (f.type ?? '').includes('png') || f.name.toLowerCase().endsWith('.png');
    const img = isPng ? await out.embedPng(b64) : await out.embedJpg(b64);

    // A4 at 72dpi, image fitted inside a 28pt margin.
    const page = out.addPage([595.28, 841.89]);
    const max = { w: 595.28 - 56, h: 841.89 - 56 };
    const scale = Math.min(max.w / img.width, max.h / img.height, 1);
    const w = img.width * scale;
    const h = img.height * scale;
    page.drawImage(img, { x: (595.28 - w) / 2, y: (841.89 - h) / 2, width: w, height: h });
  }
  return { path: await writeOutput('images.pdf', await out.saveAsBase64()) };
}

export async function extractPages(file: PickedFile, ranges: string): Promise<WorkerResult> {
  const src = await load(file);
  const idx = parseRanges(ranges, src.getPageCount());
  if (!idx.length) throw new Error('No pages matched that range.');
  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, idx);
  pages.forEach(p => out.addPage(p));
  return {
    path: await writeOutput(`${baseName(file.name)}-pages.pdf`, await out.saveAsBase64()),
    note: `${idx.length} page${idx.length === 1 ? '' : 's'} kept`,
  };
}

export async function deletePages(file: PickedFile, ranges: string): Promise<WorkerResult> {
  const doc = await load(file);
  const drop = parseRanges(ranges, doc.getPageCount());
  if (!drop.length) throw new Error('No pages matched that range.');
  if (drop.length === doc.getPageCount()) throw new Error('That would remove every page.');
  [...drop].reverse().forEach(i => doc.removePage(i));
  return {
    path: await writeOutput(`${baseName(file.name)}-trimmed.pdf`, await doc.saveAsBase64()),
    note: `${drop.length} page${drop.length === 1 ? '' : 's'} removed`,
  };
}

export async function rotate(file: PickedFile, turns: 90 | 180 | 270): Promise<WorkerResult> {
  const doc = await load(file);
  doc.getPages().forEach(p => {
    p.setRotation(degrees((p.getRotation().angle + turns) % 360));
  });
  return { path: await writeOutput(`${baseName(file.name)}-rotated.pdf`, await doc.saveAsBase64()) };
}

export type PageEdit = { order: number[]; rotation: Record<number, number> };

/**
 * Rebuilds a document from the visual page grid: `order` holds the original
 * zero-based indices in their new sequence, `rotation` extra degrees keyed by
 * original index.
 */
export async function applyPageEdits(
  file: PickedFile,
  edit: PageEdit,
): Promise<WorkerResult> {
  const src = await load(file);
  if (!edit.order.length) throw new Error('Keep at least one page.');

  const out = await PDFDocument.create();
  const pages = await out.copyPages(src, edit.order);
  pages.forEach((page, i) => {
    const original = edit.order[i];
    const extra = edit.rotation[original] ?? 0;
    if (extra) page.setRotation(degrees((page.getRotation().angle + extra) % 360));
    out.addPage(page);
  });

  const dropped = src.getPageCount() - edit.order.length;
  return {
    path: await writeOutput(`${baseName(file.name)}-edited.pdf`, await out.saveAsBase64()),
    note: dropped > 0 ? `${dropped} page${dropped === 1 ? '' : 's'} removed` : undefined,
  };
}

export async function addPageNumbers(file: PickedFile): Promise<WorkerResult> {
  const doc = await load(file);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  doc.getPages().forEach((page, i) => {
    const label = String(i + 1);
    const w = font.widthOfTextAtSize(label, 10);
    page.drawText(label, {
      x: page.getWidth() / 2 - w / 2,
      y: 20,
      size: 10,
      font,
      color: rgb(0.35, 0.35, 0.35),
    });
  });
  return { path: await writeOutput(`${baseName(file.name)}-numbered.pdf`, await doc.saveAsBase64()) };
}

export async function watermark(file: PickedFile, text: string): Promise<WorkerResult> {
  const doc = await load(file);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  doc.getPages().forEach(page => {
    const { width, height } = page.getSize();
    const size = Math.min(width, height) / 8;
    const w = font.widthOfTextAtSize(text, size);
    page.drawText(text, {
      x: width / 2 - (w / 2) * 0.7,
      y: height / 2 - size,
      size,
      font,
      color: rgb(0.6, 0.6, 0.6),
      opacity: 0.28,
      rotate: degrees(35),
    });
  });
  return { path: await writeOutput(`${baseName(file.name)}-watermarked.pdf`, await doc.saveAsBase64()) };
}
