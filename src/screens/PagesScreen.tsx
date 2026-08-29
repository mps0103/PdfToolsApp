import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import PageThumb from '../components/PageThumb';
import { PdfRender, RENDER_ERRORS } from '../native/PdfRender';
import { applyPageEdits } from '../workers/pdfLib';
import { shareFile } from '../lib/fs';
import { PickedFile } from '../lib/files';
import { colors, radius, space, type } from '../theme';

type Props = { route: any; navigation: any };

export default function PagesScreen({ route }: Props) {
  const file: PickedFile = route.params.file;
  const src = file.uri;

  const [order, setOrder] = useState<number[] | null>(null);
  const [originalCount, setOriginalCount] = useState(0);
  const [rotation, setRotation] = useState<Record<number, number>>({});
  const [selected, setSelected] = useState<number | null>(null); // position in `order`
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    PdfRender.pageCount(src)
      .then(n => {
        setOriginalCount(n);
        setOrder([...Array(n).keys()]);
      })
      .catch(e =>
        setError(
          e?.code === RENDER_ERRORS.ENCRYPTED
            ? 'This file is password protected. Remove the password first.'
            : 'Could not read the pages in this file.',
        ),
      );
  }, [src]);

  if (error) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={type.body}>{error}</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const move = (delta: number) => {
    if (selected === null) return;
    const to = selected + delta;
    if (to < 0 || to >= order.length) return;
    const next = [...order];
    [next[selected], next[to]] = [next[to], next[selected]];
    setOrder(next);
    setSelected(to);
  };

  const rotateSelected = () => {
    if (selected === null) return;
    const original = order[selected];
    setRotation(r => ({ ...r, [original]: ((r[original] ?? 0) + 90) % 360 }));
  };

  const removeSelected = () => {
    if (selected === null) return;
    if (order.length === 1) {
      Alert.alert('Cannot remove', 'A document needs at least one page.');
      return;
    }
    setOrder(o => o.filter((_, i) => i !== selected));
    setSelected(null);
  };

  const save = async () => {
    setBusy(true);
    try {
      const res = await applyPageEdits(file, { order, rotation });
      await shareFile(res.path);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  // Removing the last page leaves an identity order, so page count has to
  // be part of the check or Save stays disabled after a valid edit.
  const dirty =
    order.length !== originalCount ||
    order.some((p, i) => p !== i) ||
    Object.values(rotation).some(Boolean);

  return (
    <View style={styles.root}>
      <FlatList
        data={order}
        numColumns={3}
        keyExtractor={(p, i) => `${p}-${i}`}
        columnWrapperStyle={{ gap: space.sm, paddingHorizontal: space.md }}
        contentContainerStyle={{ gap: space.sm, paddingVertical: space.md }}
        renderItem={({ item: original, index }) => {
          const isOn = selected === index;
          return (
            <Pressable
              onPress={() => setSelected(isOn ? null : index)}
              style={[styles.cell, isOn && styles.cellOn]}
            >
              <View
                style={{
                  transform: [{ rotate: `${rotation[original] ?? 0}deg` }],
                }}
              >
                <PageThumb src={src} pageIndex={original} width={200} />
              </View>
              <Text style={[type.hint, { textAlign: 'center', marginTop: space.xs }]}>
                {index + 1}
              </Text>
            </Pressable>
          );
        }}
      />

      <View style={styles.bar}>
        <Action label="◀" onPress={() => move(-1)} disabled={selected === null} />
        <Action label="Rotate" onPress={rotateSelected} disabled={selected === null} />
        <Action label="Remove" onPress={removeSelected} disabled={selected === null} danger />
        <Action label="▶" onPress={() => move(1)} disabled={selected === null} />
      </View>

      <Pressable
        onPress={save}
        disabled={!dirty || busy}
        style={[styles.cta, (!dirty || busy) && styles.ctaOff]}
      >
        <Text style={styles.ctaText}>{busy ? 'Saving…' : 'Save changes'}</Text>
      </Pressable>

      <Text style={[type.hint, { textAlign: 'center', paddingBottom: space.md }]}>
        Tap a page to select it, then move, rotate or remove it.
      </Text>
    </View>
  );
}

const Action = ({
  label,
  onPress,
  disabled,
  danger,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) => (
  <Pressable
    onPress={onPress}
    disabled={disabled}
    style={[styles.action, disabled && { opacity: 0.35 }]}
  >
    <Text style={[type.body, danger && { color: colors.warn }]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  cell: {
    flex: 1 / 3,
    padding: space.xs,
    borderRadius: radius.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cellOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: space.sm,
  },
  action: { paddingVertical: space.md, paddingHorizontal: space.lg },
  cta: {
    margin: space.lg,
    marginBottom: space.sm,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: space.lg,
    alignItems: 'center',
  },
  ctaOff: { backgroundColor: colors.surfaceAlt },
  ctaText: { color: '#0B1020', fontSize: 16, fontWeight: '700' },
});
