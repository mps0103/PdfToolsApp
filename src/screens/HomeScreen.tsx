import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CATEGORIES, TOOLS, Tool } from '../tools/registry';
import { colors, radius, space, type } from '../theme';

type Props = { navigation: any };

// A placeholder keeps the last row of an odd-length section at half width
// instead of letting the single tile stretch across the grid.
const SPACER = '__spacer__';
type Cell = Tool | typeof SPACER;

const Tile = ({ tool, onPress }: { tool: Tool; onPress: () => void }) => (
  <Pressable
    onPress={onPress}
    style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}
    accessibilityRole="button"
    accessibilityLabel={tool.title}
  >
    <View style={styles.tileTop}>
      <Text style={type.tile} numberOfLines={2}>
        {tool.title}
      </Text>
      {!tool.ready && <View style={styles.soonDot} />}
    </View>
    <Text style={[type.hint, styles.tileHint]} numberOfLines={2}>
      {tool.hint}
    </Text>
  </Pressable>
);

export default function HomeScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (t: Tool) =>
      !q || t.title.toLowerCase().includes(q) || t.hint.toLowerCase().includes(q);

    return CATEGORIES.map(c => {
      const found = TOOLS.filter(t => t.category === c && match(t));
      const cells: Cell[] = [...found];
      if (cells.length % 2 === 1) cells.push(SPACER);
      return { title: c, data: [cells], count: found.length };
    }).filter(s => s.count > 0);
  }, [query]);

  const open = (tool: Tool) => navigation.navigate('Tool', { id: tool.id });

  return (
    <View style={styles.root}>
      {/* The status bar is drawn over the app, so the header has to clear it. */}
      <View style={[styles.header, { paddingTop: insets.top + space.md }]}>
        <View style={{ flex: 1 }}>
          <Text style={type.title}>PDF Tools</Text>
          <Text style={[type.hint, { marginTop: space.xs }]}>
            Everything runs on this phone. Nothing is uploaded.
          </Text>
        </View>
        <Pressable onPress={() => navigation.navigate('Files')} style={styles.filesButton}>
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

      {sections.length === 0 ? (
        <View style={styles.empty}>
          <Text style={type.body}>No tool matches “{query}”.</Text>
          <Text style={[type.hint, { marginTop: space.sm }]}> 
            Try “merge”, “password” or “image”.
          </Text>
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ paddingBottom: space.xl }}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionHeader}>{section.title.toUpperCase()}</Text>
          )}
          renderItem={({ item }) => (
            <FlatList
              data={item}
              numColumns={2}
              scrollEnabled={false}
              keyExtractor={(cell, i) => (cell === SPACER ? `spacer-${i}` : (cell as Tool).id)}
              columnWrapperStyle={styles.row}
              contentContainerStyle={{ gap: space.sm }}
              renderItem={({ item: cell }) =>
                cell === SPACER ? (
                  <View style={styles.spacer} />
                ) : (
                  <Tile tool={cell as Tool} onPress={() => open(cell as Tool)} />
                )
              }
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingHorizontal: space.lg,
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
  sectionHeader: {
    ...type.section,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
  row: { gap: space.sm, paddingHorizontal: space.lg },
  tile: {
    flex: 1,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
    // Fixed height keeps every tile identical regardless of how long its
    // title or hint runs. Without it, a two-line neighbour stretches the
    // row and the text inside drifts apart.
    height: 104,
    justifyContent: 'flex-start',
  },
  spacer: { flex: 1 },
  tilePressed: { backgroundColor: colors.surfaceAlt, borderColor: colors.accent },
  tileTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  tileHint: { marginTop: space.xs },
  soonDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.warn,
    marginLeft: space.sm,
    marginTop: 6,
  },
  empty: { padding: space.xl, alignItems: 'center' },
});
