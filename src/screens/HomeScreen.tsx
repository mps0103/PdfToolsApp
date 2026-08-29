import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { CATEGORIES, TOOLS, Tool } from '../tools/registry';
import { colors, radius, space, type } from '../theme';

type Props = { navigation: any };

// One flat list of rows, built here rather than by nesting a FlatList inside
// a SectionList. Every row is either a heading or a pair of tiles, so the
// grid alignment is fully determined by this file.
type Row =
  | { kind: 'heading'; key: string; label: string }
  | { kind: 'pair'; key: string; left: Tool; right: Tool | null };

const TILE_HEIGHT = 88;

export default function HomeScreen({ navigation }: Props) {
  const [query, setQuery] = useState('');

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (t: Tool) =>
      !q || t.title.toLowerCase().includes(q) || t.hint.toLowerCase().includes(q);

    const out: Row[] = [];
    for (const category of CATEGORIES) {
      const found = TOOLS.filter(t => t.category === category && match(t));
      if (!found.length) continue;

      out.push({ kind: 'heading', key: `h-${category}`, label: category.toUpperCase() });
      for (let i = 0; i < found.length; i += 2) {
        out.push({
          kind: 'pair',
          key: `r-${found[i].id}`,
          left: found[i],
          right: found[i + 1] ?? null,
        });
      }
    }
    return out;
  }, [query]);

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
              {tile(item.left)}
              {item.right ? tile(item.right) : <View style={styles.tileGhost} />}
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
  // Fills the empty half of an odd row so the last tile keeps its width.
  tileGhost: { flex: 1, height: TILE_HEIGHT },
  tilePressed: { backgroundColor: colors.surfaceAlt, borderColor: colors.accent },
  tileHint: { marginTop: space.xs },
  empty: { padding: space.xl, alignItems: 'center' },
});
