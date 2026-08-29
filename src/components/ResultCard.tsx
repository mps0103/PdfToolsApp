import React, { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { renameFile, shareFile } from '../lib/fs';
import { PdfSave } from '../native/PdfSave';
import { colors, radius, space, type } from '../theme';

type Props = {
  path: string;
  note?: string;
  navigation: any;
  onPathChange?: (next: string) => void;
};

/**
 * The finished-file card. Every tool ends here so rename, read, share and
 * save behave the same way regardless of which screen produced the file.
 */
export default function ResultCard({ path, note, navigation, onPathChange }: Props) {
  const share = (target: string) => {
    shareFile(target).catch(e =>
      Alert.alert('Could not share', e?.message ?? 'Something went wrong.'),
    );
  };
  const [renaming, setRenaming] = useState(false);
  const [draft, setDraft] = useState('');

  const name = path.split('/').pop() ?? 'document.pdf';
  const isPdf = name.toLowerCase().endsWith('.pdf');

  const openRename = () => {
    const dot = name.lastIndexOf('.');
    setDraft(dot > 0 ? name.slice(0, dot) : name);
    setRenaming(true);
  };

  const applyRename = async () => {
    try {
      const moved = await renameFile(path, draft);
      onPathChange?.(moved);
      setRenaming(false);
    } catch (e: any) {
      Alert.alert('Could not rename', e?.message ?? 'Try a different name.');
    }
  };

  const save = async () => {
    try {
      await PdfSave.toDownloads(path);
      Alert.alert('Saved', 'The file is in your Downloads folder.');
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Something went wrong.');
    }
  };

  return (
    <View style={styles.card}>
      <Text style={[type.body, { fontWeight: '600' }]}>Done</Text>
      <Text style={[type.hint, { marginTop: space.xs }]} numberOfLines={2}>
        {name}
      </Text>
      {note && (
        <Text style={[type.hint, { marginTop: space.sm, color: colors.warn }]}>{note}</Text>
      )}

      <View style={styles.actions}>
        <Pressable onPress={openRename} style={styles.action}>
          <Text style={type.body}>Rename</Text>
        </Pressable>
        {isPdf && (
          <Pressable
            onPress={() =>
              navigation.navigate('Reader', {
                file: { uri: path, name, type: 'application/pdf', size: null },
                title: name,
              })
            }
            style={styles.action}
          >
            <Text style={type.body}>Read</Text>
          </Pressable>
        )}
        <Pressable onPress={() => share(path)} style={styles.action}>
          <Text style={type.body}>Share</Text>
        </Pressable>
        <Pressable onPress={save} style={styles.action}>
          <Text style={type.body}>Save to Downloads</Text>
        </Pressable>
      </View>

      <Modal visible={renaming} transparent animationType="fade">
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <Text style={[type.body, { fontWeight: '600' }]}>Rename file</Text>
            <Text style={[type.hint, { marginTop: space.xs }]}>
              The file extension stays the same.
            </Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              autoFocus
              selectTextOnFocus
              placeholder="File name"
              placeholderTextColor={colors.textDim}
              style={styles.input}
            />
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
              <Pressable onPress={() => setRenaming(false)} style={[styles.action, { flex: 1 }]}>
                <Text style={type.body}>Cancel</Text>
              </Pressable>
              <Pressable onPress={applyRename} style={[styles.cta, { flex: 1 }]}>
                <Text style={styles.ctaText}>Save name</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    margin: space.lg,
    marginTop: space.sm,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  action: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  modalWrap: {
    flex: 1,
    backgroundColor: '#000000AA',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  modal: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.lg,
  },
  input: {
    marginTop: space.md,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    color: colors.text,
    fontSize: 15,
  },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  ctaText: { color: '#0B1020', fontSize: 15, fontWeight: '700' },
});
