import { NativeModules } from 'react-native';

type PdfRenderNative = {
  pageCount(srcPath: string): Promise<number>;
  renderPage(srcPath: string, pageIndex: number, targetWidth: number): Promise<string>;
  exportPages(
    srcPath: string,
    destDir: string,
    dpi: number,
    format: 'png' | 'jpg',
  ): Promise<string[]>;
};

const native = NativeModules.PdfRender as PdfRenderNative | undefined;

function required(): PdfRenderNative {
  if (!native) {
    throw new Error(
      'PdfRender native module is missing. Rebuild the app after adding the Kotlin module.',
    );
  }
  return native;
}

// Thumbnails are deterministic per file+page+width, so cache the promise
// and let the same grid scroll back without re-rendering.
const cache = new Map<string, Promise<string>>();

export const PdfRender = {
  pageCount: (src: string) => required().pageCount(src),

  thumbnail(src: string, pageIndex: number, width = 220): Promise<string> {
    const key = `${src}|${pageIndex}|${width}`;
    let hit = cache.get(key);
    if (!hit) {
      hit = required()
        .renderPage(src, pageIndex, width)
        .catch(e => {
          cache.delete(key);
          throw e;
        });
      cache.set(key, hit);
    }
    return hit;
  },

  exportPages: (src: string, destDir: string, dpi: number, format: 'png' | 'jpg') =>
    required().exportPages(src, destDir, dpi, format),

  clearCache() {
    cache.clear();
  },
};

export const RENDER_ERRORS = {
  ENCRYPTED: 'E_ENCRYPTED',
  MEMORY: 'E_MEMORY',
  IO: 'E_IO',
};
