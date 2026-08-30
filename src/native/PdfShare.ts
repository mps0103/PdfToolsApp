import { NativeModules } from 'react-native';

type PdfShareNative = {
  shareFile(path: string, mimeType: string, title: string): Promise<boolean>;
};

const native = NativeModules.PdfShare as PdfShareNative | undefined;

/**
 * The picker hands back percent-encoded URIs, while Kotlin opens a plain
 * filesystem path. Without decoding, a file named "my file.pdf" arrives as
 * "my%20file.pdf" and cannot be found.
 */
const cleanPath = (p: string) => decodeURI(p.replace('file://', ''));

export const PdfShare = {
  file(path: string, mimeType: string, title = 'Share file') {
    if (!native) {
      throw new Error(
        'PdfShare native module is missing. Rebuild the app after adding the Kotlin module.',
      );
    }
    return native.shareFile(cleanPath(path), mimeType, title);
  },
};