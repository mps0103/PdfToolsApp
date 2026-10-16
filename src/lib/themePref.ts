import RNFS from 'react-native-fs';
import type { ThemeChoice } from '../theme';

/**
 * The chosen theme, kept beside the recent-files list in the same folder and
 * in the same plain-JSON way. It is one short string, so a dedicated store
 * would be more machinery than the thing it holds.
 */
const THEME_PATH = `${RNFS.DocumentDirectoryPath}/theme.json`;

const isChoice = (v: unknown): v is ThemeChoice =>
  v === 'light' || v === 'dark' || v === 'system';

export async function loadThemeChoice(): Promise<ThemeChoice | null> {
  try {
    if (!(await RNFS.exists(THEME_PATH))) return null;
    const parsed = JSON.parse(await RNFS.readFile(THEME_PATH, 'utf8'));
    return isChoice(parsed?.choice) ? parsed.choice : null;
  } catch {
    // A missing or damaged file just means the default theme.
    return null;
  }
}

export async function saveThemeChoice(choice: ThemeChoice): Promise<void> {
  try {
    await RNFS.writeFile(THEME_PATH, JSON.stringify({ choice }), 'utf8');
  } catch {
    // Best effort, exactly like the recents list.
  }
}
