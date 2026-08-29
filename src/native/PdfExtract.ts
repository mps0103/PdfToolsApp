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

export const PdfExtract = {
  text: (src: string, dest: string) => required().extractText(src, dest),
  images: (src: string, destDir: string) => required().extractImages(src, destDir),
};
