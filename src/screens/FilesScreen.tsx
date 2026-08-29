import React, { useCallback, useState } from 'react';
import {
  Alert,
  BackHandler,
  FlatList,
  Image,
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

const isImage = (name: string) => /\.(png|jpe?g|webp)$/i.test(name);
const isPdf = (name: string) => name.toLowerCase().endsWith('.pdf');
const fileUri = (p: string) => (p.startsWith('file://') ? p : `file://${p}`);

export default function FilesScreen({ navigation, route }: any) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(false);
  const [renaming, setRenaming] = useState<Entry | null>(null);
  const [nameDraft, setNameDraft] = useState('');
  // Tools that export images or text write a folder. Browsing into it is the
  // only way to reach what they produced. A tool can also send us straight
  // into that folder via route params.
  const [dir, setDir] = useState<string>(route?.params?.dir ?? OUT_DIR);
  const [viewing, setViewing] = useState<Entry | null>(null);

  const inSubfolder = dir !== OUT_DIR;
  const folderName = dir.split('/').pop() ?? '';

  const share = (target: string) => {
    shareFile(target).catch(e =>
      Alert.alert('Could not share', e?.message ?? 'Something went wrong.'),
    );
  };

  const load = useCallback(async (target: string) => {
    setLoading(true);
    try {
      await ensureOutDir();
      const items = await RNFS.readDir(target);
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
      load(dir);
    }, [load, dir]),
  );

  // Hardware back leaves the folder before it leaves the screen.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        if (dir !== OUT_DIR) {
          setDir(OUT_DIR);
          return true;
        }
        return false;
      });
      return () => sub.remove();
    }, [dir]),
  );

  const openFolder = (entry: Entry) => setDir(entry.path);

  const saveOne = async (entry: Entry) => {
    try {
      await PdfSave.toDownloads(entry.path);
      Alert.alert('Saved', `${entry.name} is in your Downloads folder.`);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Something went wrong.');
    }
  };

  /** Copies every file in a folder to Downloads and reports once, not per file. */
  const saveFolder = async (entry: Entry) => {
    try {
      const items = await RNFS.readDir(entry.path);
      const files = items.filter(i => i.isFile());
      if (!files.length) {
        Alert.alert('Empty folder', 'There is nothing in here to save.');
        return;
      }

      let saved = 0;
      let failed = 0;
      for (const f of files) {
        try {
          await PdfSave.toDownloads(f.path);
          saved++;
        } catch {
          failed++;
        }
      }

      Alert.alert(
        'Saved to Downloads',
        failed
          ? `${saved} saved, ${failed} could not be copied.`
          : `${saved} file${saved === 1 ? '' : 's'} saved.`,
      );
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
      load(dir);
    } catch (e: any) {
      Alert.alert('Could not rename', e?.message ?? 'Try a different name.');
    }
  };

  const remove = (entry: Entry) =>
    Alert.alert(
      entry.isDir ? 'Delete this folder?' : 'Delete this file?',
      entry.isDir ? `${entry.name} and everything inside it.` : entry.name,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            await RNFS.unlink(entry.path).catch(() => {});
            load(dir);
          },
        },
      ],
    );

  const openInReader = (entry: Entry) =>
    navigation.navigate('Reader', {
      file: {
        uri: entry.path,
        name: entry.name,
        type: 'application/pdf',
        size: entry.size,
      },
      title: entry.name,
    });

  const header = inSubfolder ? (
    <View style={styles.folderBar}>
      <Pressable onPress={() => setDir(OUT_DIR)} style={styles.action}>
        <Text style={type.body}>← All files</Text>
      </Pressable>
      <Text style={[type.hint, { flex: 1 }]} numberOfLines={1}>
        {folderName} · {entries.length} item{entries.length === 1 ? '' : 's'}
      </Text>
    </View>
  ) : null;

  if (!entries.length) {
    return (
      <View style={styles.root}>
        <View style={{ padding: space.lg, paddingBottom: 0 }}>{header}</View>
        <View style={[styles.root, styles.center]}>
          <Text style={type.body}>
            {inSubfolder ? 'This folder is empty.' : 'Nothing here yet.'}
          </Text>
          <Text style={[type.hint, { marginTop: space.sm, textAlign: 'center' }]}>
            {inSubfolder
              ? 'The files may have been moved or deleted.'
              : 'Files you create with any tool show up here.'}
          </Text>
          {!inSubfolder && (
            <Pressable
              onPress={() => navigation.navigate('Diagnostics')}
              style={[styles.action, { marginTop: space.lg }]}
            >
              <Text style={type.body}>Run self test</Text>
            </Pressable>
          )}
        </View>
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
          <RefreshControl
            refreshing={loading}
            onRefresh={() => load(dir)}
            tintColor={colors.textDim}
          />
        }
        contentContainerStyle={{ padding: space.lg, gap: space.sm }}
        ListHeaderComponent={header}
        ListFooterComponent={
          inSubfolder ? null : (
            <Pressable
              onPress={() => navigation.navigate('Diagnostics')}
              style={[styles.action, { alignItems: 'center', marginTop: space.md }]}
            >
              <Text style={type.body}>Run self test</Text>
            </Pressable>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Pressable
              onPress={() => {
                if (item.isDir) openFolder(item);
                else if (isPdf(item.name)) openInReader(item);
                else if (isImage(item.name)) setViewing(item);
              }}
            >
              <View style={styles.cardTop}>
                {item.isDir && <Text style={styles.folderGlyph}>▸</Text>}
                {isImage(item.name) && (
                  <Image source={{ uri: fileUri(item.path) }} style={styles.thumb} />
                )}
                <View style={{ flex: 1 }}>
                  <Text style={type.body} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={type.hint}>
                    {item.isDir ? 'Folder · tap to open' : formatSize(item.size)}
                    {item.when ? ` · ${new Date(item.when).toLocaleDateString()}` : ''}
                  </Text>
                </View>
              </View>
            </Pressable>

            <View style={styles.actions}>
              {item.isDir ? (
                <>
                  <Pressable onPress={() => openFolder(item)} style={styles.action}>
                    <Text style={type.body}>Open</Text>
                  </Pressable>
                  <Pressable onPress={() => saveFolder(item)} style={styles.action}>
                    <Text style={type.body}>Save all to Downloads</Text>
                  </Pressable>
                </>
              ) : (
                <>
                  {isPdf(item.name) && (
                    <Pressable onPress={() => openInReader(item)} style={styles.action}>
                      <Text style={type.body}>Read</Text>
                    </Pressable>
                  )}
                  {isImage(item.name) && (
                    <Pressable onPress={() => setViewing(item)} style={styles.action}>
                      <Text style={type.body}>View</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={() => openRename(item)} style={styles.action}>
                    <Text style={type.body}>Rename</Text>
                  </Pressable>
                  <Pressable onPress={() => share(item.path)} style={styles.action}>
                    <Text style={type.body}>Share</Text>
                  </Pressable>
                  <Pressable onPress={() => saveOne(item)} style={styles.action}>
                    <Text style={type.body}>Save to Downloads</Text>
                  </Pressable>
                </>
              )}
              <Pressable onPress={() => remove(item)} style={styles.action}>
                <Text style={[type.body, { color: colors.warn }]}>Delete</Text>
              </Pressable>
            </View>
          </View>
        )}
      />

      {/* Full-screen image preview */}
      <Modal visible={viewing !== null} transparent animationType="fade">
        <Pressable style={styles.viewerWrap} onPress={() => setViewing(null)}>
          {viewing && (
            <Image
              source={{ uri: fileUri(viewing.path) }}
              style={styles.viewerImage}
              resizeMode="contain"
            />
          )}
          <Text style={[type.hint, { marginTop: space.lg }]}>Tap anywhere to close</Text>
        </Pressable>
      </Modal>

      <Modal visible={renaming !== null} transparent animationType="fade">
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <Text style={[type.body, { fontWeight: '600' }]}>Rename file</Text>
            <Text style={[type.hint, { marginTop: space.xs }]}>
              The file extension stays the same.
            </Text>
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
  folderBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingBottom: space.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: space.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  folderGlyph: { color: colors.accent, fontSize: 16 },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    backgroundColor: '#FFFFFF',
  },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.md, flexWrap: 'wrap' },
  action: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
  },
  viewerWrap: {
    flex: 1,
    backgroundColor: '#000000EE',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
  },
  viewerImage: { width: '100%', height: '80%' },
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