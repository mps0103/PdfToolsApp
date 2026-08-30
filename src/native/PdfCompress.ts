import { NativeModules } from 'react-native';

export type RewriteResult = {
  path: string;
  bytesBefore: number;
  bytesAfter: number;
  imagesRewritten: number;
};

export type SignatureResult = {
  path: string;
  width: number;
  height: number;
};

type PdfCompressNative = {
  rewriteImages(
    srcPath: string,
    destPath: string,
    quality: number,
    maxEdge: number,
    grayscale: boolean,
  ): Promise<RewriteResult>;
  signatureFromImage(
    srcPath: string,
    destPath: string,
    threshold: number,
  ): Promise<SignatureResult>;
};

const native = NativeModules.PdfCompress as PdfCompressNative | undefined;

function required(): PdfCompressNative {
  if (!native) {
    throw new Error(
      'PdfCompress native module is missing. Rebuild the app after adding the Kotlin module.',
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

/**
 * maxEdge caps the longest side of every embedded image in pixels.
 * 1600 still prints acceptably; 1000 is fine for anything read on screen.
 */
export const COMPRESSION_LEVELS = {
  light: { quality: 0.85, maxEdge: 2200, label: 'Light' },
  balanced: { quality: 0.7, maxEdge: 1600, label: 'Balanced' },
  strong: { quality: 0.5, maxEdge: 1000, label: 'Strong' },
} as const;

export type CompressionLevel = keyof typeof COMPRESSION_LEVELS;

/** Luminance cutoff for signature extraction, 0-255. */
export const SIGNATURE_THRESHOLD_DEFAULT = 200;
export const SIGNATURE_THRESHOLD_MIN = 100;
export const SIGNATURE_THRESHOLD_MAX = 245;

export const PdfCompress = {
  compress: (src: string, dest: string, level: CompressionLevel = 'balanced') => {
    const { quality, maxEdge } = COMPRESSION_LEVELS[level];
    return required().rewriteImages(cleanPath(src), cleanPath(dest), quality, maxEdge, false);
  },

  grayscale: (src: string, dest: string) =>
    // Keep resolution, drop colour only.
    required().rewriteImages(cleanPath(src), cleanPath(dest), 0.8, 0, true),

  /**
   * Strips the paper from a photographed signature, leaving transparent ink.
   * 200 suits black ink on white paper. Lower it for photos taken in warm
   * indoor light, where the paper itself reads as grey and would otherwise
   * survive the cut.
   */
  signature: (src: string, dest: string, threshold = SIGNATURE_THRESHOLD_DEFAULT) =>
    required().signatureFromImage(cleanPath(src), cleanPath(dest), threshold),
};

export const COMPRESS_ERRORS = { MEMORY: 'E_MEMORY', IO: 'E_IO' };
export const SIGNATURE_ERRORS = { EMPTY: 'E_EMPTY', MEMORY: 'E_MEMORY', IO: 'E_IO' };