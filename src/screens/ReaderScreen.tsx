import React, { useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Pdf from 'react-native-pdf';
import { PickedFile } from '../lib/files';
import { shareFile } from '../lib/fs';
import { colors, radius, space, type } from '../theme';

type Props = { route: any; navigation: any };

export default function ReaderScreen({ route, navigation }: Props) {
  const file: PickedFile = route.params.file;

  const [page, setPage] = useState(1);
  // Driving the viewer's `page` prop from onPageChanged makes it fight the
  // user's scroll, so only an explicit jump sets this.
  const [targetPage, setTargetPage] = useState(1);
  const [pageCount, setPageCount] = useState(0);
  const [night, setNight] = useState(false);
  const [horizontal, setHorizontal] = useState(false);
  const [password, setPassword] = useState('');
  const [askPassword, setAskPassword] = useState(false);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [jumpTo, setJumpTo] = useState('');
  const [showJump, setShowJump] = useState(false);

  const source = { uri: file.uri.startsWith('file://') ? file.uri : `file://${file.uri}` };

  const onError = (e: any) => {
    const message = String(e?.message ?? e);
    // The Android viewer reports a locked file as a password error rather
    // than a distinct code, so match on the text.
    if (/password/i.test(message)) {
      setAskPassword(true);
      setError(null);
      return;
    }
    setError('This file could not be opened. It may be damaged.');
  };

  return (
    <View style={styles.root}>
      {error ? (
        <View style={[styles.fill, styles.center]}>
          <Text style={type.body}>{error}</Text>
          <Pressable onPress={() => navigation.goBack()} style={styles.chip}>
            <Text style={type.body}>Go back</Text>
          </Pressable>
        </View>
      ) : (
        <Pdf
          key={`${password}-${horizontal}`}
          source={source}
          password={password || undefined}
          horizontal={horizontal}
          enablePaging={horizontal}
          spacing={horizontal ? 0 : 6}
          minScale={1}
          maxScale={4}
          page={targetPage}
          trustAllCerts={false}
          onLoadComplete={count => {
            setPageCount(count);
            setAskPassword(false);
          }}
          onPageChanged={p => setPage(p)}
          onError={onError}
          renderActivityIndicator={() => <ActivityIndicator color={colors.accent} />}
          style={[styles.fill, { backgroundColor: colors.bg }]}
        />
      )}

      {night && !error && <View pointerEvents="none" style={invertLayer} />}

      <View style={styles.bar}>
        <Pressable onPress={() => setShowJump(true)} style={styles.chip}>
          <Text style={type.body}>
            {pageCount ? `${page} / ${pageCount}` : '—'}
          </Text>
        </Pressable>
        <Pressable onPress={() => setNight(n => !n)} style={styles.chip}>
          <Text style={type.body}>{night ? 'Day' : 'Night'}</Text>
        </Pressable>
        <Pressable onPress={() => setHorizontal(h => !h)} style={styles.chip}>
          <Text style={type.body}>{horizontal ? 'Scroll' : 'Swipe'}</Text>
        </Pressable>
        <Pressable onPress={() => shareFile(file.uri)} style={styles.chip}>
          <Text style={type.body}>Share</Text>
        </Pressable>
      </View>

      <Modal visible={askPassword} transparent animationType="fade">
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <Text style={[type.body, { fontWeight: '600' }]}>This file is locked</Text>
            <Text style={[type.hint, { marginTop: space.xs }]}>
              Enter the password to read it.
            </Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              secureTextEntry
              autoCapitalize="none"
              autoFocus
              placeholder="Password"
              placeholderTextColor={colors.textDim}
              style={styles.input}
            />
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
              <Pressable onPress={() => navigation.goBack()} style={[styles.chip, { flex: 1 }]}>
                <Text style={type.body}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setPassword(draft);
                  setDraft('');
                  setAskPassword(false);
                }}
                style={[styles.cta, { flex: 1 }]}
              >
                <Text style={styles.ctaText}>Open</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showJump} transparent animationType="fade">
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <Text style={[type.body, { fontWeight: '600' }]}>Go to page</Text>
            <TextInput
              value={jumpTo}
              onChangeText={v => setJumpTo(v.replace(/\D/g, ''))}
              keyboardType="number-pad"
              autoFocus
              placeholder={`1 to ${pageCount || 1}`}
              placeholderTextColor={colors.textDim}
              style={styles.input}
            />
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
              <Pressable onPress={() => setShowJump(false)} style={[styles.chip, { flex: 1 }]}>
                <Text style={type.body}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const target = parseInt(jumpTo, 10);
                  if (target >= 1 && target <= pageCount) {
                    setTargetPage(target);
                    setPage(target);
                  }
                  setJumpTo('');
                  setShowJump(false);
                }}
                style={[styles.cta, { flex: 1 }]}
              >
                <Text style={styles.ctaText}>Go</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/**
 * A white layer in "difference" blend mode inverts everything beneath it:
 * white pages become black, black text becomes white. Zoom and scrolling
 * keep working because the viewer itself is untouched.
 *
 * The prop was named experimental_mixBlendMode when it landed in React
 * Native 0.76 and mixBlendMode afterwards, so both are set. Blend modes
 * need the new architecture, which this app runs on.
 */
const invertLayer: any = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: '#FFFFFF',
  experimental_mixBlendMode: 'difference',
  mixBlendMode: 'difference',
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1, width: Dimensions.get('window').width },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.md },
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: space.sm,
  },
  chip: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  ctaText: { color: '#0B1020', fontSize: 15, fontWeight: '700' },
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
});
