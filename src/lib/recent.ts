import RNFS from 'react-native-fs';

export type RecentFile = {
  uri: string;
  name: string;
  size: number | null;
  openedAt: number;
};

const RECENT_PATH = `${RNFS.DocumentDirectoryPath}/recent.json`;
const MAX_ENTRIES = 20;

async function readRaw(): Promise<RecentFile[]> {
  try {
    const exists = await RNFS.exists(RECENT_PATH);
    if (!exists) return [];
    const txt = await RNFS.readFile(RECENT_PATH, 'utf8');
    return JSON.parse(txt) as RecentFile[];
  } catch {
    return [];
  }
}

async function persist(list: RecentFile[]) {
  try {
    await RNFS.writeFile(RECENT_PATH, JSON.stringify(list), 'utf8');
  } catch {
    // Ignore persistence failures — recency is best-effort.
  }
}

/**
 * listRecent reads the persisted recents, validates that each file still
 * exists on disk, drops missing items, persists the cleaned list, and
 * returns the most-recent-first array. Validation is the reason this
 * function is async and does more than a plain read: picked files often
 * live in cache which the OS may clear, so entries must be verified.
 */
export async function listRecent(): Promise<RecentFile[]> {
  try {
    const raw = await readRaw();
    const cleaned: RecentFile[] = [];
    for (const e of raw) {
      try {
        const path = decodeURI(e.uri.replace('file://', ''));
        // RNFS.exists returns false for missing files — skip these.
        if (await RNFS.exists(path)) cleaned.push(e);
      } catch {
        // If any check fails, drop the entry.
      }
    }
    if (cleaned.length !== raw.length) await persist(cleaned);
    // Return most-recent-first sorted by openedAt desc
    return cleaned.sort((a, b) => b.openedAt - a.openedAt).slice(0, MAX_ENTRIES);
  } catch {
    return [];
  }
}

export async function addRecent(file: RecentFile): Promise<void> {
  try {
    const raw = await readRaw();
    const filtered = raw.filter(r => r.uri !== file.uri);
    filtered.unshift(file);
    const list = filtered.slice(0, MAX_ENTRIES);
    await persist(list);
  } catch {
    // Best-effort; ignore failures.
  }
}

export async function removeRecent(uri: string): Promise<void> {
  try {
    const raw = await readRaw();
    const list = raw.filter(r => r.uri !== uri);
    await persist(list);
  } catch {
    // ignore
  }
}

export async function clearRecent(): Promise<void> {
  try {
    await persist([]);
  } catch {
    // ignore
  }
}
