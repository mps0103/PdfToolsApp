import { PickedFile } from '../lib/files';
import { OUT_DIR, baseName, ensureOutDir, readBinaryPath } from '../lib/fs';
import { PdfCrypto } from '../native/PdfCrypto';
import { PdfRender } from '../native/PdfRender';
import { CompressionLevel, PdfCompress } from '../native/PdfCompress';
import { PdfExtract } from '../native/PdfExtract';
import { PdfOcr } from '../native/PdfOcr';
import * as P from './pdfLib';
import * as X from './pdfLibExtra';

export type ToolOptions = {
  ranges?: string;
  text?: string;
  password?: string;
  ownerPassword?: string;
  allowPrinting?: boolean;
  allowCopy?: boolean;
  turns?: 90 | 180 | 270;
  dpi?: number;
  format?: 'png' | 'jpg';
  level?: CompressionLevel;
  axis?: 'horizontal' | 'vertical';
  perSheet?: 2 | 4;
  percent?: number;
  size?: X.PageSizeKey;
  header?: string;
  footer?: string;
  prefix?: string;
  start?: number;
  meta?: X.Metadata;
};

export type Runner = (files: PickedFile[], opts: ToolOptions) => Promise<P.WorkerResult>;

async function destFor(name: string) {
  await ensureOutDir();
  const stamp = Date.now();
  return `${OUT_DIR}/${baseName(name)}-${stamp}.pdf`;
}

const addPassword: Runner = async (files, opts) => {
  if (!opts.password) throw new Error('Enter a password first.');
  if (opts.password.length < 4) throw new Error('Use at least 4 characters.');
  const src = await readBinaryPath(files[0].uri);
  const dest = await destFor(`${baseName(files[0].name)}-locked`);
  await PdfCrypto.addPassword(src, dest, opts.password, {
    ownerPassword: opts.ownerPassword,
    allowPrinting: opts.allowPrinting ?? true,
    allowCopy: opts.allowCopy ?? false,
  });
  return { path: dest, note: 'Keep the password somewhere safe. It cannot be recovered.' };
};

const removePassword: Runner = async (files, opts) => {
  if (!opts.password) throw new Error('Enter the current password.');
  const src = await readBinaryPath(files[0].uri);
  const dest = await destFor(`${baseName(files[0].name)}-unlocked`);
  await PdfCrypto.removePassword(src, dest, opts.password);
  return { path: dest };
};

const pdfToImages: Runner = async (files, opts) => {
  const src = await readBinaryPath(files[0].uri);
  const dir = `${OUT_DIR}/${baseName(files[0].name)}-images`;
  await ensureOutDir();
  const written = await PdfRender.exportPages(
    src,
    dir,
    opts.dpi ?? 150,
    opts.format ?? 'jpg',
  );
  return {
    path: dir,
    note: `${written.length} image${written.length === 1 ? '' : 's'} saved to the output folder`,
  };
};

const readable = (bytes: number) => {
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

const compress: Runner = async (files, opts) => {
  const src = await readBinaryPath(files[0].uri);
  const dest = await destFor(`${baseName(files[0].name)}-smaller`);
  const res = await PdfCompress.compress(src, dest, opts.level ?? 'balanced');

  if (res.imagesRewritten === 0) {
    return {
      path: res.path,
      note: 'No images to shrink — this file is mostly text, so its size barely changes.',
    };
  }
  if (res.bytesAfter >= res.bytesBefore) {
    return {
      path: res.path,
      note: `Already well compressed. Kept at ${readable(res.bytesBefore)}.`,
    };
  }

  const saved = Math.round((1 - res.bytesAfter / res.bytesBefore) * 100);
  return {
    path: res.path,
    note: `${readable(res.bytesBefore)} to ${readable(res.bytesAfter)}, ${saved}% smaller`,
  };
};

const grayscale: Runner = async files => {
  const src = await readBinaryPath(files[0].uri);
  const dest = await destFor(`${baseName(files[0].name)}-gray`);
  const res = await PdfCompress.grayscale(src, dest);
  return {
    path: res.path,
    note:
      res.imagesRewritten === 0
        ? 'No images found. Text colour is not changed by this tool.'
        : `${res.imagesRewritten} image${res.imagesRewritten === 1 ? '' : 's'} converted`,
  };
};

const pdfToText: Runner = async files => {
  const src = await readBinaryPath(files[0].uri);
  const dest = `${OUT_DIR}/${baseName(files[0].name)}-${Date.now()}.txt`;
  await ensureOutDir();
  const res = await PdfExtract.text(src, dest);
  return {
    path: res.path,
    note: res.characters
      ? `${res.characters.toLocaleString()} characters`
      : 'No text layer found. This looks like a scan — use Make searchable instead.',
  };
};

const extractImages: Runner = async files => {
  const src = await readBinaryPath(files[0].uri);
  const dir = `${OUT_DIR}/${baseName(files[0].name)}-extracted`;
  await ensureOutDir();
  const written = await PdfExtract.images(src, dir);
  return {
    path: dir,
    note: written.length
      ? `${written.length} image${written.length === 1 ? '' : 's'} saved`
      : 'No embedded images in this file.',
  };
};

const ocr: Runner = async files => {
  const src = await readBinaryPath(files[0].uri);
  const dest = await destFor(`${baseName(files[0].name)}-searchable`);
  const res = await PdfOcr.makeSearchable(src, dest);
  return {
    path: res.path,
    note: res.words
      ? `${res.words.toLocaleString()} words read across ${res.pages} page${res.pages === 1 ? '' : 's'}`
      : 'No text recognised. Try a sharper scan or better lighting.',
  };
};

/** Tools that open the page grid instead of running straight away. */
export const VISUAL_TOOLS = ['organize', 'delete-pages', 'rotate'];

/** Tools that open the annotation canvas. */
export const CANVAS_TOOLS = ['annotate', 'sign'];

/** Tools that open the reader. */
export const READER_TOOLS = ['read'];

export const RUNNERS: Record<string, Runner> = {
  'pdf-to-images': pdfToImages,
  compress,
  grayscale,
  'pdf-to-text': pdfToText,
  ocr,
  scan: files => P.imagesToPdf(files),
  'extract-images': extractImages,
  flip: (files, o) => X.flip(files[0], o.axis ?? 'horizontal'),
  'split-half': (files, o) => X.splitInHalf(files[0], o.axis ?? 'vertical'),
  'n-up': (files, o) => X.nUp(files[0], o.perSheet ?? 2),
  crop: (files, o) => X.crop(files[0], o.percent ?? 5),
  resize: (files, o) => X.resize(files[0], o.size ?? 'a4'),
  metadata: (files, o) => X.setMetadata(files[0], o.meta ?? {}),
  flatten: files => X.flatten(files[0]),
  'remove-annotations': files => X.removeAnnotations(files[0]),
  'header-footer': (files, o) => X.headerFooter(files[0], o.header ?? '', o.footer ?? ''),
  bates: (files, o) => X.bates(files, o.prefix ?? '', o.start ?? 1),
  'alternate-mix': files => X.alternateMix(files),
  merge: files => P.merge(files),
  'images-to-pdf': files => P.imagesToPdf(files),
  'extract-pages': (files, o) => P.extractPages(files[0], o.ranges ?? ''),
  'delete-pages': (files, o) => P.deletePages(files[0], o.ranges ?? ''),
  split: (files, o) => P.extractPages(files[0], o.ranges ?? ''),
  rotate: (files, o) => P.rotate(files[0], o.turns ?? 90),
  'page-numbers': files => P.addPageNumbers(files[0]),
  watermark: (files, o) => P.watermark(files[0], o.text?.trim() || 'DRAFT'),
  protect: addPassword,
  unlock: removePassword,
};

export const hasRunner = (id: string) => Boolean(RUNNERS[id]);

/** Which extra inputs a tool's screen should show. */
export const optionsFor = (id: string): Array<keyof ToolOptions> => {
  switch (id) {
    case 'extract-pages':
    case 'delete-pages':
    case 'split':
      return ['ranges'];
    case 'watermark':
      return ['text'];
    case 'rotate':
      return ['turns'];
    case 'pdf-to-images':
      return ['dpi', 'format'];
    case 'compress':
      return ['level'];
    case 'flip':
    case 'split-half':
      return ['axis'];
    case 'n-up':
      return ['perSheet'];
    case 'crop':
      return ['percent'];
    case 'resize':
      return ['size'];
    case 'metadata':
      return ['meta'];
    case 'header-footer':
      return ['header', 'footer'];
    case 'bates':
      return ['prefix', 'start'];
    case 'protect':
      return ['password', 'allowPrinting', 'allowCopy'];
    case 'unlock':
      return ['password'];
    default:
      return [];
  }
};
