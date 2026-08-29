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
    const name = path.split('/').pop() ?? 'document.pdf';
    return required().saveToDownloads(path.replace('file://', ''), name, mimeFor(name));
  },
};
