import { PDFDocument, PDFName, StandardFonts, degrees, rgb } from 'pdf-lib';
import { PickedFile } from '../lib/files';
import { baseName, readBase64, writeOutput } from '../lib/fs';
import type { WorkerResult } from './pdfLib';

const load = async (f: PickedFile) => PDFDocument.load(await readBase64(f.uri));
const save = async (doc: PDFDocument, name: string, note?: string): Promise<WorkerResult> => ({
  path: await writeOutput(name, await doc.saveAsBase64()),
  note,
});

export const PAGE_SIZES = {
  a4: { label: 'A4', w: 595.28, h: 841.89 },
  letter: { label: 'Letter', w: 612, h: 792 },
  a5: { label: 'A5', w: 419.53, h: 595.28 },
  legal: { label: 'Legal', w: 612, h: 1008 },
} as const;
export type PageSizeKey = keyof typeof PAGE_SIZES;

/** Mirrors every page by drawing it back with a negative scale. */
export async function flip(file: PickedFile, axis: 'horizontal' | 'vertical'): Promise<WorkerResult> {
  const src = await load(file);
  const out = await PDFDocument.create();

  for (let i = 0; i < src.getPageCount(); i++) {
    const embedded = await out.embedPage(src.getPage(i));
    const { width, height } = src.getPage(i).getSize();
    const page = out.addPage([width, height]);
    page.drawPage(embedded, {
      x: axis === 'horizontal' ? width : 0,
      y: axis === 'vertical' ? height : 0,
      xScale: axis === 'horizontal' ? -1 : 1,
      yScale: axis === 'vertical' ? -1 : 1,
    });
  }
  return save(out, `${baseName(file.name)}-flipped.pdf`);
}

/** Splits each sheet down the middle — A3 scans into two A4 pages. */
export async function splitInHalf(
  file: PickedFile,
  direction: 'vertical' | 'horizontal',
): Promise<WorkerResult> {
  const src = await load(file);
  const out = await PDFDocument.create();

  for (let i = 0; i < src.getPageCount(); i++) {
    const source = src.getPage(i);
    const { width, height } = source.getSize();
    const embedded = await out.embedPage(source);

    if (direction === 'vertical') {
      const half = width / 2;
      // Left half, then right half. Content outside the page box is clipped.
      out.addPage([half, height]).drawPage(embedded, { x: 0, y: 0 });
      out.addPage([half, height]).drawPage(embedded, { x: -half, y: 0 });
    } else {
      const half = height / 2;
      out.addPage([width, half]).drawPage(embedded, { x: 0, y: -half }); // top
      out.addPage([width, half]).drawPage(embedded, { x: 0, y: 0 }); // bottom
    }
  }
  return save(out, `${baseName(file.name)}-split.pdf`, `${src.getPageCount() * 2} pages`);
}

/** Places 2 or 4 source pages on each output sheet. */
export async function nUp(file: PickedFile, perSheet: 2 | 4): Promise<WorkerResult> {
  const src = await load(file);
  const out = await PDFDocument.create();
  const sheet = PAGE_SIZES.a4;
  const cols = perSheet === 2 ? 1 : 2;
  const rows = perSheet === 2 ? 2 : 2;
  const gap = 10;
  const cellW = (sheet.w - gap * (cols + 1)) / cols;
  const cellH = (sheet.h - gap * (rows + 1)) / rows;

  for (let i = 0; i < src.getPageCount(); i += perSheet) {
    const page = out.addPage([sheet.w, sheet.h]);

    for (let slot = 0; slot < perSheet; slot++) {
      const index = i + slot;
      if (index >= src.getPageCount()) break;

      const source = src.getPage(index);
      const embedded = await out.embedPage(source);
      const { width, height } = source.getSize();
      const scale = Math.min(cellW / width, cellH / height);

      const col = slot % cols;
      const row = Math.floor(slot / cols);
      const x = gap + col * (cellW + gap) + (cellW - width * scale) / 2;
      const y = sheet.h - gap - (row + 1) * cellH - row * gap + (cellH - height * scale) / 2;

      page.drawPage(embedded, { x, y, xScale: scale, yScale: scale });
    }
  }
  return save(out, `${baseName(file.name)}-${perSheet}up.pdf`);
}

/** Trims a percentage off every edge using the crop box. */
export async function crop(file: PickedFile, percent: number): Promise<WorkerResult> {
  if (percent <= 0 || percent >= 45) throw new Error('Trim between 1 and 44 percent.');
  const doc = await load(file);
  doc.getPages().forEach(page => {
    const { width, height } = page.getSize();
    const dx = (width * percent) / 100;
    const dy = (height * percent) / 100;
    page.setCropBox(dx, dy, width - dx * 2, height - dy * 2);
  });
  return save(doc, `${baseName(file.name)}-cropped.pdf`, `${percent}% trimmed from each edge`);
}

/** Rescales every page onto a standard sheet size. */
export async function resize(file: PickedFile, size: PageSizeKey): Promise<WorkerResult> {
  const target = PAGE_SIZES[size];
  const src = await load(file);
  const out = await PDFDocument.create();

  for (let i = 0; i < src.getPageCount(); i++) {
    const source = src.getPage(i);
    const embedded = await out.embedPage(source);
    const { width, height } = source.getSize();
    const scale = Math.min(target.w / width, target.h / height);
    const page = out.addPage([target.w, target.h]);
    page.drawPage(embedded, {
      x: (target.w - width * scale) / 2,
      y: (target.h - height * scale) / 2,
      xScale: scale,
      yScale: scale,
    });
  }
  return save(out, `${baseName(file.name)}-${size}.pdf`, `Resized to ${target.label}`);
}

export type Metadata = { title?: string; author?: string; subject?: string; keywords?: string };

export async function setMetadata(file: PickedFile, meta: Metadata): Promise<WorkerResult> {
  const doc = await load(file);
  if (meta.title !== undefined) doc.setTitle(meta.title);
  if (meta.author !== undefined) doc.setAuthor(meta.author);
  if (meta.subject !== undefined) doc.setSubject(meta.subject);
  if (meta.keywords !== undefined) {
    doc.setKeywords(meta.keywords.split(',').map(k => k.trim()).filter(Boolean));
  }
  doc.setModificationDate(new Date());
  return save(doc, `${baseName(file.name)}-details.pdf`);
}

export async function readMetadata(file: PickedFile): Promise<Metadata> {
  const doc = await load(file);
  return {
    title: doc.getTitle() ?? '',
    author: doc.getAuthor() ?? '',
    subject: doc.getSubject() ?? '',
    keywords: (doc.getKeywords() ?? '').toString(),
  };
}

/** Makes form fields read-only by baking them into the page content. */
export async function flatten(file: PickedFile): Promise<WorkerResult> {
  const doc = await load(file);
  const form = doc.getForm();
  const count = form.getFields().length;
  if (count === 0) throw new Error('This file has no form fields to flatten.');
  form.flatten();
  return save(doc, `${baseName(file.name)}-flat.pdf`, `${count} field${count === 1 ? '' : 's'} flattened`);
}

export async function removeAnnotations(file: PickedFile): Promise<WorkerResult> {
  const doc = await load(file);
  let removed = 0;
  doc.getPages().forEach(page => {
    const annots = page.node.lookup(PDFName.of('Annots')) as any;
    if (annots?.size) removed += annots.size();
    page.node.set(PDFName.of('Annots'), doc.context.obj([]));
  });
  return save(
    doc,
    `${baseName(file.name)}-clean.pdf`,
    removed ? `${removed} marking${removed === 1 ? '' : 's'} removed` : 'Nothing to remove',
  );
}

export async function headerFooter(
  file: PickedFile,
  header: string,
  footer: string,
): Promise<WorkerResult> {
  if (!header && !footer) throw new Error('Enter a header or a footer.');
  const doc = await load(file);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const grey = rgb(0.4, 0.4, 0.4);

  doc.getPages().forEach(page => {
    const { width, height } = page.getSize();
    if (header) {
      const w = font.widthOfTextAtSize(header, 9);
      page.drawText(header, { x: width / 2 - w / 2, y: height - 26, size: 9, font, color: grey });
    }
    if (footer) {
      const w = font.widthOfTextAtSize(footer, 9);
      page.drawText(footer, { x: width / 2 - w / 2, y: 18, size: 9, font, color: grey });
    }
  });
  return save(doc, `${baseName(file.name)}-labelled.pdf`);
}

/** Sequential stamps across one or more files, continuing the count. */
export async function bates(
  files: PickedFile[],
  prefix: string,
  start: number,
  digits = 6,
): Promise<WorkerResult> {
  const out = await PDFDocument.create();
  const font = await out.embedFont(StandardFonts.Helvetica);
  let counter = start;

  for (const file of files) {
    const src = await load(file);
    const pages = await out.copyPages(src, src.getPageIndices());
    for (const page of pages) {
      out.addPage(page);
      const label = `${prefix}${String(counter).padStart(digits, '0')}`;
      const w = font.widthOfTextAtSize(label, 9);
      page.drawText(label, {
        x: page.getWidth() - w - 28,
        y: 20,
        size: 9,
        font,
        color: rgb(0.25, 0.25, 0.25),
      });
      counter++;
    }
  }
  return save(out, 'bates.pdf', `${counter - start} pages stamped`);
}

/** Interleaves two documents, one page at a time. */
export async function alternateMix(files: PickedFile[]): Promise<WorkerResult> {
  if (files.length < 2) throw new Error('Pick at least two files.');
  const docs = await Promise.all(files.map(load));
  const out = await PDFDocument.create();
  const longest = Math.max(...docs.map(d => d.getPageCount()));

  for (let i = 0; i < longest; i++) {
    for (const doc of docs) {
      if (i >= doc.getPageCount()) continue;
      const [page] = await out.copyPages(doc, [i]);
      out.addPage(page);
    }
  }
  return save(out, 'mixed.pdf', `${out.getPageCount()} pages`);
}

export { degrees };
