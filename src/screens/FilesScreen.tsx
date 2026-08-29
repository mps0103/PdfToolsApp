import React, { useCallback, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import RNFS from 'react-native-fs';
import { OUT_DIR, ensureOutDir, renameFile, shareFile } from '../lib/fs';
import { formatSize } from '../lib/files';
import { PdfSave } from '../native/PdfSave';
import { colors, radius, space, type } from '../theme';

type Entry = { name: string; path: string; size: number; when: number; isDir: boolean };

export default function FilesScreen({ navigation }: any) {
  const share = (target: string) => {
    shareFile(target).catch(e =>
      Alert.alert('Could not share', e?.message ?? 'Something went wrong.'),
    );
  };
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [renaming, setRenaming] = useState<Entry | null>(null);
  const [nameDraft, setNameDraft] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      await ensureOutDir();
      const items = await RNFS.readDir(OUT_DIR);
      setEntries(
        items
          .map(i => ({
            name: i.name,
            path: i.path,
            size: Number(i.size),
            when: i.mtime ? new Date(i.mtime).getTime() : 0,
            isDir: i.isDirectory(),
          }))
          .sort((a, b) => b.when - a.when),
      );
    } catch {
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const save = async (entry: Entry) => {
    if (entry.isDir) {
      Alert.alert('Folder', 'Open the folder and save images one at a time.');
      return;
    }
    try {
      await PdfSave.toDownloads(entry.path);
      Alert.alert('Saved', `${entry.name} is in your Downloads folder.`);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Something went wrong.');
    }
  };

  const openRename = (entry: Entry) => {
    const dot = entry.name.lastIndexOf('.');
    setNameDraft(dot > 0 ? entry.name.slice(0, dot) : entry.name);
    setRenaming(entry);
  };

  const applyRename = async () => {
    if (!renaming) return;
    try {
      await renameFile(renaming.path, nameDraft);
      setRenaming(null);
      load();
    } catch (e: any) {
      Alert.alert('Could not rename', e?.message ?? 'Try a different name.');
    }
  };

  const remove = (entry: Entry) =>
    Alert.alert('Delete this file?', entry.name, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await RNFS.unlink(entry.path).catch(() => {});
          load();
        },
      },
    ]);

  if (!entries.length) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={type.body}>Nothing here yet.</Text>
        <Text style={[type.hint, { marginTop: space.sm, textAlign: 'center' }]}>
          Files you create with any tool show up here.
        </Text>
        <Pressable
          onPress={() => navigation.navigate('Diagnostics')}
          style={[styles.action, { marginTop: space.lg }]}
        >
          <Text style={type.body}>Run self test</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
    <FlatList
      style={styles.root}
      data={entries}
      keyExtractor={e => e.path}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.textDim} />
      }
      contentContainerStyle={{ padding: space.lg, gap: space.sm }}
      ListFooterComponent={
        <Pressable
          onPress={() => navigation.navigate('Diagnostics')}
          style={[styles.action, { alignItems: 'center', marginTop: space.md }]}
        >
          <Text style={type.body}>Run self test</Text>
        </Pressable>
      }
      renderItem={({ item }) => (
        <View style={styles.card}>
          <Pressable
            onPress={() =>
              !item.isDir &&
              item.name.toLowerCase().endsWith('.pdf') &&
              navigation.navigate('Reader', {
                file: { uri: item.path, name: item.name, type: 'application/pdf', size: item.size },
                title: item.name,
              })
            }
          >
            <Text style={type.body} numberOfLines={1}>
              {item.name}
            </Text>
          </Pressable>
          <Text style={type.hint}>
            {item.isDir ? 'Folder' : formatSize(item.size)}
            {item.when ? ` · ${new Date(item.when).toLocaleDateString()}` : ''}
          </Text>

          <View style={styles.actions}>
            {!item.isDir && item.name.toLowerCase().endsWith('.pdf') && (
              <Pressable
                onPress={() =>
                  navigation.navigate('Reader', {
                    file: {
                      uri: item.path,
                      name: item.name,
                      type: 'application/pdf',
                      size: item.size,
                    },
                    title: item.name,
                  })
                }
                style={styles.action}
              >
                <Text style={type.body}>Read</Text>
              </Pressable>
            )}
            <Pressable onPress={() => openRename(item)} style={styles.action}>
              <Text style={type.body}>Rename</Text>
            </Pressable>
            <Pressable onPress={() => share(item.path)} style={styles.action}>
              <Text style={type.body}>Share</Text>
            </Pressable>
            <Pressable onPress={() => save(item)} style={styles.action}>
              <Text style={type.body}>Save to Downloads</Text>
            </Pressable>
            <Pressable onPress={() => remove(item)} style={styles.action}>
              <Text style={[type.body, { color: colors.warn }]}>Delete</Text>
            </Pressable>
          </View>
        </View>
      )}
    />

    <Modal visible={renaming !== null} transparent animationType="fade">
      <View style={styles.modalWrap}>
        <View style={styles.modal}>
          <Text style={[type.body, { fontWeight: '600' }]}>Rename file</Text>
          <Text style={[type.hint, { marginTop: space.xs }]}>The file extension stays the same.</Text>
          <TextInput
            value={nameDraft}
            onChangeText={setNameDraft}
            autoFocus
            selectTextOnFocus
            placeholder="File name"
            placeholderTextColor={colors.textDim}
            style={styles.input}
          />
          <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
            <Pressable onPress={() => setRenaming(null)} style={[styles.action, { flex: 1 }]}>
              <Text style={type.body}>Cancel</Text>
            </Pressable>
            <Pressable onPress={applyRename} style={[styles.cta, { flex: 1 }]}>
              <Text style={styles.ctaText}>Save name</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
  },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.md, flexWrap: 'wrap' },
  action: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
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
