import { NativeModules } from 'react-native';

type PdfCryptoNative = {
  /** Returns true when the file needs a password to open. */
  isEncrypted(srcPath: string): Promise<boolean>;
  /** Writes an encrypted copy to destPath. ownerPassword may be ''. */
  addPassword(
    srcPath: string,
    destPath: string,
    userPassword: string,
    ownerPassword: string,
    allowPrinting: boolean,
    allowCopy: boolean,
  ): Promise<string>;
  /** Opens with the supplied password and writes an unencrypted copy. */
  removePassword(srcPath: string, destPath: string, password: string): Promise<string>;
};

const native = NativeModules.PdfCrypto as PdfCryptoNative | undefined;

function required(): PdfCryptoNative {
  if (!native) {
    throw new Error(
      'PdfCrypto native module is missing. Rebuild the app after adding the Kotlin module.',
    );
  }
  return native;
}

export const PdfCrypto = {
  isEncrypted: (src: string) => required().isEncrypted(src),

  addPassword: (
    src: string,
    dest: string,
    userPassword: string,
    opts?: { ownerPassword?: string; allowPrinting?: boolean; allowCopy?: boolean },
  ) =>
    required().addPassword(
      src,
      dest,
      userPassword,
      opts?.ownerPassword ?? userPassword,
      opts?.allowPrinting ?? true,
      opts?.allowCopy ?? false,
    ),

  removePassword: (src: string, dest: string, password: string) =>
    required().removePassword(src, dest, password),
};

/** Native error codes, so the UI can say something useful. */
export const CRYPTO_ERRORS = {
  WRONG_PASSWORD: 'E_WRONG_PASSWORD',
  NOT_ENCRYPTED: 'E_NOT_ENCRYPTED',
  IO: 'E_IO',
};
