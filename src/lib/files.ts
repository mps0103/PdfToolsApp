import { Linking } from 'react-native';
import {
  pick,
  types,
  keepLocalCopy,
  type FileToCopy,
} from '@react-native-documents/picker';
import { launchImageLibrary } from 'react-native-image-picker';
import type { InputKind } from '../tools/registry';

export type PickedFile = {
  uri: string;
  name: string;
  size?: number | null;
  type?: string | null;
};

// Content URIs from the SAF go stale once the picker closes, so copy
// everything into app cache before any tool touches it.
async function localise(files: PickedFile[]): Promise<PickedFile[]> {
  if (!files.length) return files;

  const copies = await keepLocalCopy({
    // keepLocalCopy wants a non-empty tuple; the guard above proves it.
    files: files.map(f => ({ uri: f.uri, fileName: f.name })) as [FileToCopy, ...FileToCopy[]],
    destination: 'cachesDirectory',
  });

  return files.map((f, i) => {
    const copy = copies[i];
    return copy.status === 'success' ? { ...f, uri: copy.localUri } : f;
  });
}

export async function pickPdfs(multiple: boolean): Promise<PickedFile[]> {
  const result = await pick({ type: [types.pdf], allowMultiSelection: multiple });
  return localise(
    result.map(r => ({
      uri: r.uri,
      name: r.name ?? 'document.pdf',
      size: r.size,
      type: r.type,
    })),
  );
}

export async function pickImages(): Promise<PickedFile[]> {
  const res = await launchImageLibrary({ mediaType: 'photo', selectionLimit: 0 });
  if (res.didCancel || !res.assets) return [];
  return res.assets.map(a => ({
    uri: a.uri!,
    name: a.fileName ?? 'image.jpg',
    size: a.fileSize,
    type: a.type,
  }));
}

export async function pickFor(input: InputKind): Promise<PickedFile[]> {
  switch (input) {
    case 'pdf':
      return pickPdfs(false);
    case 'pdfs':
      return pickPdfs(true);
    case 'images':
      return pickImages();
    default:
      return [];
  }
}

export const formatSize = (bytes?: number | null) => {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

/* ---------------------------------------------------------------------- */
/* Files opened from outside the app                                      */
/* ---------------------------------------------------------------------- */

/**
 * Pulls a readable filename out of a content:// URI. Android usually ends
 * these with the display name, but not always, so there is a fallback.
 */
function nameFromUri(uri: string): string {
  try {
    const tail = decodeURIComponent(uri).split('/').pop() ?? '';
    if (tail.toLowerCase().endsWith('.pdf')) return tail;
  } catch {
    // Malformed encoding — fall through to the default.
  }
  return `document-${Date.now()}.pdf`;
}

/**
 * Takes the URI Android hands over when a PDF is opened with this app and
 * copies it into the cache. The permission granted on that URI lasts only
 * as long as the launching intent, so anything that reads the file later
 * needs its own copy.
 */
export async function importIncoming(uri: string): Promise<PickedFile | null> {
  if (!uri) return null;

  const name = nameFromUri(uri);
  try {
    const [copied] = await localise([{ uri, name, type: 'application/pdf', size: null }]);
    return copied ?? null;
  } catch {
    return null;
  }
}

/**
 * The URI the app was launched with, or null for a normal launch from the
 * icon. Only PDFs are accepted; anything else is ignored rather than
 * failing later in the reader.
 */
export async function launchUri(): Promise<string | null> {
  try {
    const url = await Linking.getInitialURL();
    return url && /^(content|file):/i.test(url) ? url : null;
  } catch {
    return null;
  }
}