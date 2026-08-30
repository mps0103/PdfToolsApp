import { NativeModules } from 'react-native';

type PdfExtractNative = {
  extractText(srcPath: string, destPath: string): Promise<{ path: string; characters: number }>;
  extractImages(srcPath: string, destDir: string): Promise<string[]>;
};

const native = NativeModules.PdfExtract as PdfExtractNative | undefined;

function required(): PdfExtractNative {
  if (!native) {
    throw new Error(
      'PdfExtract native module is missing. Rebuild the app after adding the Kotlin module.',
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

export const PdfExtract = {
  text: (src: string, dest: string) => required().extractText(cleanPath(src), cleanPath(dest)),
  images: (src: string, destDir: string) =>
    required().extractImages(cleanPath(src), cleanPath(destDir)),
};