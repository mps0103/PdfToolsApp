import React, { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import RNFS from 'react-native-fs';
import { OUT_DIR } from '../lib/fs';
import { TestResult, runSelfTest } from '../lib/selftest';
import { colors, radius, space, type } from '../theme';

export default function DiagnosticsScreen() {
  const [results, setResults] = useState<TestResult[] | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const run = async () => {
    setResults(null);
    setProgress({ done: 0, total: 1 });
    try {
      const out = await runSelfTest((done, total) => setProgress({ done, total }));
      setResults(out);
    } catch (e: any) {
      setResults([
        {
          id: 'setup',
          title: 'Test setup',
          outcome: 'fail',
          ms: 0,
          detail: e?.message ?? 'Could not create the sample document.',
        },
      ]);
    } finally {
      setProgress(null);
    }
  };

  const clean = async () => {
    const items = await RNFS.readDir(OUT_DIR).catch(() => []);
    await Promise.all(
      items
        .filter(i => i.name.startsWith('selftest'))
        .map(i => RNFS.unlink(i.path).catch(() => {})),
    );
    setResults(null);
  };

  const passed = results?.filter(r => r.outcome === 'pass').length ?? 0;
  const failed = results?.filter(r => r.outcome === 'fail').length ?? 0;
  const skipped = results?.filter(r => r.outcome === 'skipped').length ?? 0;

  return (
    <View style={styles.root}>
      <Text style={[type.hint, { padding: space.lg, paddingBottom: 0 }]}>
        Runs every tool against a generated sample document. Use it after a build to check the
        native modules loaded.
      </Text>

      <Pressable onPress={run} disabled={!!progress} style={[styles.cta, !!progress && styles.ctaOff]}>
        <Text style={styles.ctaText}>
          {progress ? `Testing ${progress.done} of ${progress.total}…` : 'Run self test'}
        </Text>
      </Pressable>

      {results && (
        <View style={styles.summary}>
          <Text style={type.body}>
            {passed} passed · {failed} failed · {skipped} skipped
          </Text>
          <Pressable onPress={clean} hitSlop={10}>
            <Text style={[type.hint, { color: colors.accent }]}>Delete test files</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={results ?? []}
        keyExtractor={r => r.id}
        contentContainerStyle={{ padding: space.lg, gap: space.sm }}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={[styles.dot, { backgroundColor: dotColor(item.outcome) }]} />
            <View style={{ flex: 1 }}>
              <Text style={type.body}>{item.title}</Text>
              {item.detail && (
                <Text style={type.hint} numberOfLines={3}>
                  {item.detail}
                </Text>
              )}
            </View>
            {item.ms > 0 && <Text style={type.hint}>{item.ms} ms</Text>}
          </View>
        )}
      />
    </View>
  );
}

const dotColor = (outcome: TestResult['outcome']) =>
  outcome === 'pass' ? '#4CC38A' : outcome === 'fail' ? '#E5484D' : colors.textDim;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  cta: {
    margin: space.lg,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: space.lg,
    alignItems: 'center',
  },
  ctaOff: { backgroundColor: colors.surfaceAlt },
  ctaText: { color: '#0B1020', fontSize: 16, fontWeight: '700' },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: space.md,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
