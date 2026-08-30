import RNFS from 'react-native-fs';
import { PdfShare } from '../native/PdfShare';

export const OUT_DIR = `${RNFS.DocumentDirectoryPath}/output`;

/** Saved signatures live outside OUT_DIR so they never show up in Files. */
export const SIGNATURE_DIR = `${RNFS.DocumentDirectoryPath}/signatures`;

export async function ensureOutDir() {
  if (!(await RNFS.exists(OUT_DIR))) await RNFS.mkdir(OUT_DIR);
}

export async function readBase64(uri: string): Promise<string> {
  return RNFS.readFile(decodeURI(uri.replace('file://', '')), 'base64');
}

/** Native modules take plain filesystem paths, not file:// URIs. */
export async function readBinaryPath(uri: string): Promise<string> {
  return decodeURI(uri.replace('file://', ''));
}
/**
 * The timestamp is minute-precision, so two files made in the same minute
 * would land on the same name. Add a counter rather than overwrite.
 */
async function freePath(name: string): Promise<string> {
  const base = uniqueName(name);
  const dot = base.lastIndexOf('.');
  const stem = dot > 0 ? base.slice(0, dot) : base;
  const ext = dot > 0 ? base.slice(dot) : '';

  let path = `${OUT_DIR}/${base}`;
  let n = 2;
  while (await RNFS.exists(path)) {
    path = `${OUT_DIR}/${stem}_${n}${ext}`;
    n++;
  }
  return path;
}

export async function writeOutput(name: string, base64: string): Promise<string> {
  await ensureOutDir();
  const path = await freePath(name);
  await RNFS.writeFile(path, base64, 'base64');
  return path;
}

export async function copyToOutput(name: string, fromPath: string): Promise<string> {
  await ensureOutDir();
  const path = await freePath(name);
  await RNFS.copyFile(fromPath, path);
  return path;
}
/**
 * Local time, not UTC — a file saved at 4pm should read 1600, whatever the
 * device's offset. toISOString would shift it.
 */
function timestamp() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(
    d.getMinutes(),
  )}`;
}

function uniqueName(name: string) {
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  return `${stem}_${timestamp()}${ext}`;
}

export function baseName(name: string) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

/**
 * Renames a file in place, keeping its original extension. Returns the new
 * path. Illegal characters are stripped and a suffix is added rather than
 * overwriting anything already there.
 */
export async function renameFile(path: string, newName: string): Promise<string> {
  const from = decodeURI(path.replace('file://', ''));
  const dir = from.slice(0, from.lastIndexOf('/'));
  const dot = from.lastIndexOf('.');
  const slash = from.lastIndexOf('/');
  const ext = dot > slash ? from.slice(dot) : '';

  let stem = newName.trim().replace(/[\\/:*?"<>|]/g, '').trim();
  if (!stem) throw new Error('Enter a name.');
  if (ext && stem.toLowerCase().endsWith(ext.toLowerCase())) {
    stem = stem.slice(0, stem.length - ext.length);
  }

  let target = `${dir}/${stem}${ext}`;
  let n = 1;
  while (target !== from && (await RNFS.exists(target))) {
    target = `${dir}/${stem} (${n})${ext}`;
    n++;
  }

  if (target === from) return from;
  await RNFS.moveFile(from, target);
  return target;
}

const mimeFor = (name: string) => {
  switch (name.split('.').pop()?.toLowerCase()) {
    case 'pdf':
      return 'application/pdf';
    case 'txt':
      return 'text/plain';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    default:
      return '*/*';
  }
};

/**
 * Shares through our own Kotlin module. React Native's built-in Share only
 * attaches a url on iOS, and the third-party libraries handed the native
 * side a null Uri under the new architecture, so the intent is built
 * directly against the app's FileProvider instead.
 */
export async function shareFile(path: string) {
  const name = decodeURI(path).split('/').pop() ?? 'document.pdf';
  await PdfShare.file(path, mimeFor(name), 'Share file');
}

export async function fileSize(path: string): Promise<number> {
  try {
    const stat = await RNFS.stat(decodeURI(path.replace('file://', '')));
    return Number(stat.size);
  } catch {
    return 0;
  }
}

/* ---------------------------------------------------------------------- */
/* Signature library                                                      */
/* ---------------------------------------------------------------------- */

export async function ensureSignatureDir() {
  if (!(await RNFS.exists(SIGNATURE_DIR))) await RNFS.mkdir(SIGNATURE_DIR);
}

/** Saved signatures, newest first. */
export async function listSignatures(): Promise<string[]> {
  await ensureSignatureDir();
  const items = await RNFS.readDir(SIGNATURE_DIR).catch(() => []);
  return items
    .filter(i => i.isFile() && i.name.toLowerCase().endsWith('.png'))
    .sort((a, b) => (b.mtime?.getTime() ?? 0) - (a.mtime?.getTime() ?? 0))
    .map(i => i.path);
}

/**
 * Moves a freshly processed signature out of the cache and into the
 * permanent library, so it survives until the user deletes it.
 */
export async function keepSignature(tempPath: string): Promise<string> {
  await ensureSignatureDir();
  const target = `${SIGNATURE_DIR}/sig-${Date.now()}.png`;
  await RNFS.moveFile(decodeURI(tempPath.replace('file://', '')), target);
  return target;
}

export async function deleteSignature(path: string) {
  await RNFS.unlink(decodeURI(path.replace('file://', ''))).catch(() => {});
}

/**
 * Scratch path for a signature still being adjusted. Lives in the cache so
 * abandoned attempts get cleaned up by the system rather than piling up.
 */
export function signatureTempPath() {
  return `${RNFS.CachesDirectoryPath}/sig-preview-${Date.now()}.png`;
}