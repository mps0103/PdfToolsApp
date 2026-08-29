import { NativeModules } from 'react-native';

type PdfShareNative = {
  shareFile(path: string, mimeType: string, title: string): Promise<boolean>;
};

const native = NativeModules.PdfShare as PdfShareNative | undefined;

export const PdfShare = {
  file(path: string, mimeType: string, title = 'Share file') {
    if (!native) {
      throw new Error(
        'PdfShare native module is missing. Rebuild the app after adding the Kotlin module.',
      );
    }
    return native.shareFile(path, mimeType, title);
  },
};
