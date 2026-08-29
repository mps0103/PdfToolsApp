import RNFS from 'react-native-fs';
import { Platform, Share } from 'react-native';

export const OUT_DIR = `${RNFS.DocumentDirectoryPath}/output`;

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

export async function writeOutput(name: string, base64: string): Promise<string> {
  await ensureOutDir();
  const path = `${OUT_DIR}/${uniqueName(name)}`;
  await RNFS.writeFile(path, base64, 'base64');
  return path;
}

export async function copyToOutput(name: string, fromPath: string): Promise<string> {
  await ensureOutDir();
  const path = `${OUT_DIR}/${uniqueName(name)}`;
  await RNFS.copyFile(fromPath, path);
  return path;
}

function uniqueName(name: string) {
  const stamp = new Date().toISOString().replace(/[-:T.Z]/g, '').slice(0, 14);
  const dot = name.lastIndexOf('.');
  return dot > 0 ? `${name.slice(0, dot)}-${stamp}${name.slice(dot)}` : `${name}-${stamp}`;
}

export function baseName(name: string) {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

export async function shareFile(path: string) {
  const url = Platform.OS === 'android' ? `file://${path}` : path;
  await Share.share({ url, title: 'Save or share' });
}

export async function fileSize(path: string): Promise<number> {
  try {
    const stat = await RNFS.stat(decodeURI(path.replace('file://', '')));
    return Number(stat.size);
  } catch {
    return 0;
  }
}
