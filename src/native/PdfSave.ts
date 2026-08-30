import { NativeModules } from 'react-native';

type PdfSaveNative = {
  saveToDownloads(srcPath: string, displayName: string, mimeType: string): Promise<string>;
};

const native = NativeModules.PdfSave as PdfSaveNative | undefined;

function required(): PdfSaveNative {
  if (!native) {
    throw new Error(
      'PdfSave native module is missing. Rebuild the app after adding the Kotlin module.',
    );
  }
  return native;
}

/**
 * The picker hands back percent-encoded URIs, while Kotlin opens a plain
 * filesystem path. Without decoding, a file named "my file.pdf" arrives as
 * "my%20file.pdf" and cannot be found.
 */
const cleanPath = (p: string) => decodeURI(p.replace('file://', ''));

const mimeFor = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase();
  switch (ext) {
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
      return 'application/octet-stream';
  }
};

export const PdfSave = {
  toDownloads(path: string) {
    const clean = cleanPath(path);
    // The display name comes from the decoded path, so the file lands in
    // Downloads as "my file.pdf" rather than "my%20file.pdf".
    const name = clean.split('/').pop() ?? 'document.pdf';
    return required().saveToDownloads(clean, name, mimeFor(name));
  },
};