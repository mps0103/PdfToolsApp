import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { CATEGORIES, TOOLS, Tool } from '../tools/registry';
import { colors, radius, space, type } from '../theme';

type Props = { navigation: any };

// One flat list of rows, built here rather than by nesting a FlatList inside
// a SectionList. Every row is either a heading or a group of tiles, so the
// grid alignment is fully determined by this file.
type Row =
  | { kind: 'heading'; key: string; label: string }
  | { kind: 'tiles'; key: string; items: (Tool | null)[] };

const TILE_HEIGHT = 88;

/**
 * Two columns on phones, more as the screen grows. The thresholds keep the
 * tile between roughly 140 and 240px at every common size, so the text never
 * cramps on a small phone or stretches absurdly on a tablet in landscape.
 */
const columnsFor = (width: number) => {
  if (width >= 1000) return 5;
  if (width >= 800) return 4;
  if (width >= 600) return 3;
  return 2;
};

export default function HomeScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  // useWindowDimensions, not Dimensions.get, so rotating the device relays
  // the grid instead of keeping the launch-time column count.
  const { width } = useWindowDimensions();
  const columns = columnsFor(width);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (t: Tool) =>
      !q || t.title.toLowerCase().includes(q) || t.hint.toLowerCase().includes(q);

    const out: Row[] = [];
    for (const category of CATEGORIES) {
      const found = TOOLS.filter(t => t.category === category && match(t));
      if (!found.length) continue;

      out.push({ kind: 'heading', key: `h-${category}`, label: category.toUpperCase() });

      for (let i = 0; i < found.length; i += columns) {
        const items: (Tool | null)[] = found.slice(i, i + columns);
        // Pad the last row so its tiles keep the same width as every other
        // row rather than stretching to fill.
        while (items.length < columns) items.push(null);
        out.push({ kind: 'tiles', key: `r-${found[i].id}`, items });
      }
    }
    return out;
  }, [query, columns]);

  const open = (tool: Tool) => navigation.navigate('Tool', { id: tool.id });

  const tile = (tool: Tool) => (
    <Pressable
      onPress={() => open(tool)}
      style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
      accessibilityRole="button"
      accessibilityLabel={tool.title}
    >
      <Text style={type.tile} numberOfLines={1}>
        {tool.title}
      </Text>
      <Text style={[type.hint, styles.tileHint]} numberOfLines={2}>
        {tool.hint}
      </Text>
    </Pressable>
  );

  return (
    <View style={styles.root}>
      <FlatList
        data={rows}
        keyExtractor={r => r.key}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <View style={{ flex: 1 }}>
                <Text style={type.title}>PDF Tools</Text>
                <Text style={[type.hint, { marginTop: space.xs }]}>
                  Everything runs on this phone. Nothing is uploaded.
                </Text>
              </View>
              <Pressable
                onPress={() => navigation.navigate('Files')}
                style={styles.filesButton}
              >
                <Text style={type.body}>Files</Text>
              </Pressable>
            </View>

            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search tools"
              placeholderTextColor={colors.textDim}
              style={styles.search}
            />
          </View>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={type.body}>No tool matches that search.</Text>
            <Text style={[type.hint, { marginTop: space.sm }]}>
              Try merge, password or image.
            </Text>
          </View>
        }
        renderItem={({ item }) =>
          item.kind === 'heading' ? (
            <Text style={styles.heading}>{item.label}</Text>
          ) : (
            <View style={styles.row}>
              {item.items.map((t, i) =>
                t ? (
                  <React.Fragment key={t.id}>{tile(t)}</React.Fragment>
                ) : (
                  <View key={`ghost-${i}`} style={styles.tileGhost} />
                ),
              )}
            </View>
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  listContent: { paddingBottom: space.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
  },
  filesButton: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  search: {
    marginHorizontal: space.lg,
    marginTop: space.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    color: colors.text,
    fontSize: 15,
  },
  heading: {
    ...type.section,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  row: {
    flexDirection: 'row',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingBottom: space.md,
  },
  tile: {
    flex: 1,
    height: TILE_HEIGHT,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
    justifyContent: 'center',
  },
  // Fills the empty slots of a short last row so its tiles keep the same
  // width as every other row.
  tileGhost: { flex: 1, height: TILE_HEIGHT },
  tilePressed: { backgroundColor: colors.surfaceAlt, borderColor: colors.accent },
  tileHint: { marginTop: space.xs },
  empty: { padding: space.xl, alignItems: 'center' },
});