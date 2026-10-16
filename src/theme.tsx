import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useColorScheme } from 'react-native';
import { loadThemeChoice, saveThemeChoice } from './lib/themePref';

/**
 * Every colour the interface uses. Both palettes below fill all of it, so a
 * screen can never reach for something one theme has and the other does not.
 *
 * Note what is *not* here: the white of a PDF page, the ink colours in the
 * annotation tools, the brand red on the splash. Those belong to the document
 * or to the product, not to the interface, and they stay the same in both
 * themes.
 */
export type Palette = {
  bg: string;
  surface: string;
  surfaceAlt: string;
  line: string;
  text: string;
  textDim: string;
  accent: string;
  accentSoft: string;
  /** Text and icons drawn *on* an accent fill, where the page colours invert. */
  onAccent: string;
  warn: string;
  adSlot: string;
  /** The wash behind a modal. */
  scrim: string;
};

export const DARK: Palette = {
  bg: '#0F1115',
  surface: '#181B21',
  surfaceAlt: '#20242C',
  line: '#2A2F39',
  text: '#F2F4F7',
  textDim: '#9AA3B2',
  accent: '#4C8DFF',
  accentSoft: '#1D2A44',
  onAccent: '#0B1020',
  warn: '#E5A33B',
  adSlot: '#101318',
  scrim: '#000000AA',
};

/**
 * The light palette mirrors the roles above rather than inverting the values.
 *
 * The accent is the red off the splash logo, not a light version of the dark
 * theme blue: on a white ground this is the colour the app is already known
 * by. It carries white text at 4.9:1, so a filled button stays readable.
 */
export const LIGHT: Palette = {
  bg: '#F6F7F9',
  surface: '#FFFFFF',
  surfaceAlt: '#EDEFF3',
  line: '#DCE0E7',
  text: '#11151C',
  textDim: '#5B6472',
  accent: '#E01B18',
  accentSoft: '#FBE0DF',
  onAccent: '#FFFFFF',
  warn: '#A96A12',
  adSlot: '#EFF1F4',
  scrim: '#00000066',
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

export const radius = { sm: 8, md: 14, lg: 20 };

// Reserved height for the anchored adaptive banner. Never let content
// scroll under it — the page grid and annotation canvas both need the
// bottom edge to stay tappable.
export const AD_SLOT_HEIGHT = 62;

export type Typography = ReturnType<typeof makeTypography>;

/** The text styles carry a colour, so they are built per palette. */
export const makeTypography = (c: Palette) => ({
  title: { fontSize: 26, fontWeight: '700' as const, color: c.text, letterSpacing: -0.4 },
  section: { fontSize: 13, fontWeight: '600' as const, color: c.textDim, letterSpacing: 1.1 },
  tile: { fontSize: 15, fontWeight: '600' as const, color: c.text },
  hint: { fontSize: 12, color: c.textDim, lineHeight: 16 },
  body: { fontSize: 15, color: c.text },
  bodySmall: { fontSize: 13, color: c.text },
});

/** What the user picked, which is not the same as what is on screen. */
export type ThemeChoice = 'light' | 'dark' | 'system';

export const THEME_CHOICES: { key: ThemeChoice; label: string }[] = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
  { key: 'system', label: 'System' },
];

type ThemeValue = {
  colors: Palette;
  type: Typography;
  /** What is actually being shown, after 'system' is resolved. */
  scheme: 'light' | 'dark';
  choice: ThemeChoice;
  setChoice: (next: ThemeChoice) => void;
  /** False until the saved choice has been read, so nothing flashes. */
  ready: boolean;
};

const fallback: ThemeValue = {
  colors: DARK,
  type: makeTypography(DARK),
  scheme: 'dark',
  choice: 'system',
  setChoice: () => {},
  ready: false,
};

const ThemeContext = createContext<ThemeValue>(fallback);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Dark is the starting point because that is what every build before this
  // one looked like; the saved choice replaces it a frame later.
  const [choice, setChoiceState] = useState<ThemeChoice>('dark');
  const [ready, setReady] = useState(false);
  const system = useColorScheme();

  useEffect(() => {
    let alive = true;
    loadThemeChoice().then(saved => {
      if (!alive) return;
      if (saved) setChoiceState(saved);
      setReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const setChoice = useCallback((next: ThemeChoice) => {
    // Paint first, write second: the picker should feel instant, and a failed
    // write costs the user nothing worse than the old choice next launch.
    setChoiceState(next);
    saveThemeChoice(next);
  }, []);

  const value = useMemo<ThemeValue>(() => {
    const scheme: 'light' | 'dark' =
      choice === 'system' ? (system === 'light' ? 'light' : 'dark') : choice;
    const colors = scheme === 'light' ? LIGHT : DARK;
    return { colors, type: makeTypography(colors), scheme, choice, setChoice, ready };
  }, [choice, system, setChoice, ready]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/**
 * Builds a screen's StyleSheet from the active palette and rebuilds it only
 * when that palette changes.
 *
 * The factory is a module-level const in each screen, so it is stable across
 * renders and the memo holds. This is what lets the 144 `colors.x` references
 * already written across the app stay exactly as they were.
 */
export function useThemedStyles<T>(factory: (colors: Palette, type: Typography) => T): T {
  const { colors, type } = useTheme();
  return useMemo(() => factory(colors, type), [factory, colors, type]);
}
