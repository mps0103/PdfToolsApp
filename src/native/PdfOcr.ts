import { NativeModules } from 'react-native';

export type OcrResult = { path: string; words: number; pages: number };

type PdfOcrNative = {
  makeSearchable(srcPath: string, destPath: string, dpi: number): Promise<OcrResult>;
  readText(srcPath: string, dpi: number): Promise<string>;
};

const native = NativeModules.PdfOcr as PdfOcrNative | undefined;

function required(): PdfOcrNative {
  if (!native) {
    throw new Error(
      'PdfOcr native module is missing. Rebuild the app after adding the Kotlin module.',
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

// 200 dpi is the sweet spot: ML Kit accuracy plateaus above it and memory
// use climbs fast on A4 scans.
export const OCR_DPI = 200;

export const PdfOcr = {
  makeSearchable: (src: string, dest: string, dpi = OCR_DPI) =>
    required().makeSearchable(cleanPath(src), cleanPath(dest), dpi),
  readText: (src: string, dpi = OCR_DPI) => required().readText(cleanPath(src), dpi),
};