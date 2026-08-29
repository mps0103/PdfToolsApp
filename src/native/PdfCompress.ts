import { NativeModules } from 'react-native';

export type RewriteResult = {
  path: string;
  bytesBefore: number;
  bytesAfter: number;
  imagesRewritten: number;
};

type PdfCompressNative = {
  rewriteImages(
    srcPath: string,
    destPath: string,
    quality: number,
    maxEdge: number,
    grayscale: boolean,
  ): Promise<RewriteResult>;
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
 * maxEdge caps the longest side of every embedded image in pixels.
 * 1600 still prints acceptably; 1000 is fine for anything read on screen.
 */
export const COMPRESSION_LEVELS = {
  light: { quality: 0.85, maxEdge: 2200, label: 'Light' },
  balanced: { quality: 0.7, maxEdge: 1600, label: 'Balanced' },
  strong: { quality: 0.5, maxEdge: 1000, label: 'Strong' },
} as const;

export type CompressionLevel = keyof typeof COMPRESSION_LEVELS;

export const PdfCompress = {
  compress: (src: string, dest: string, level: CompressionLevel = 'balanced') => {
    const { quality, maxEdge } = COMPRESSION_LEVELS[level];
    return required().rewriteImages(src, dest, quality, maxEdge, false);
  },

  grayscale: (src: string, dest: string) =>
    // Keep resolution, drop colour only.
    required().rewriteImages(src, dest, 0.8, 0, true),
};

export const COMPRESS_ERRORS = { MEMORY: 'E_MEMORY', IO: 'E_IO' };
