import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path, Rect as SvgRect, Text as SvgText } from 'react-native-svg';
import {
  Annotation,
  HIGHLIGHT_COLORS,
  INK_COLORS,
  PageFrame,
  Point,
  commitAnnotations,
  pageFrames,
} from '../lib/annotations';
import { PickedFile } from '../lib/files';
import ResultCard from '../components/ResultCard';
import { PdfRender, RENDER_ERRORS } from '../native/PdfRender';
import { colors, radius, space, type } from '../theme';

type Mode = 'ink' | 'highlight' | 'text' | 'whiteout';
type Props = { route: any; navigation: any };

const CANVAS_WIDTH = Math.min(Dimensions.get('window').width - space.lg * 2, 520);

export default function AnnotateScreen({ route, navigation }: Props) {
  const file: PickedFile = route.params.file;
  const signing: boolean = route.params.signing ?? false;

  const [frames, setFrames] = useState<Record<number, PageFrame> | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(signing ? 'ink' : 'ink');
  const [color, setColor] = useState<string>(INK_COLORS.black);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [live, setLive] = useState<Point[] | null>(null);
  const [pendingText, setPendingText] = useState<Point | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ path: string; note?: string } | null>(null);

  const start = useRef<Point | null>(null);
  const liveRef = useRef<Point[] | null>(null);

  const setStroke = (points: Point[] | null) => {
    liveRef.current = points;
    setLive(points);
  };
  const pageCount = frames ? Object.keys(frames).length : 0;
  const frame = frames?.[pageIndex];

  useEffect(() => {
    pageFrames(file, CANVAS_WIDTH)
      .then(setFrames)
      .catch(() => setError('Could not read this file.'));
  }, [file]);

  useEffect(() => {
    if (!frames) return;
    setPageImage(null);
    PdfRender.thumbnail(file.uri, pageIndex, 900)
      .then(setPageImage)
      .catch(e =>
        setError(
          e?.code === RENDER_ERRORS.ENCRYPTED
            ? 'This file is password protected. Remove the password first.'
            : 'Could not draw this page.',
        ),
      );
  }, [frames, pageIndex, file.uri]);

  const canvasHeight = frame
    ? (frame.heightPt / frame.widthPt) * CANVAS_WIDTH
    : CANVAS_WIDTH * 1.414;

  const responder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,

        onPanResponderGrant: e => {
          const p = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
          start.current = p;
          if (mode === 'ink') setStroke([p]);
          if (mode === 'text') setPendingText(p);
        },

        onPanResponderMove: e => {
          const p = { x: e.nativeEvent.locationX, y: e.nativeEvent.locationY };
          if (mode === 'ink') setStroke([...(liveRef.current ?? []), p]);
          else if (mode !== 'text') setStroke([start.current!, p]);
        },

        onPanResponderRelease: () => {
          const points = liveRef.current;
          setStroke(null);
          if (!points || mode === 'text') return;

          if (mode === 'ink') {
            if (points.length < 2) return;
            setAnnotations(a => [
              ...a,
              { kind: 'ink', page: pageIndex, points, color, width: signing ? 2.5 : 2 },
            ]);
            return;
          }

          const [a1, a2] = [points[0], points[points.length - 1]];
          const rect = {
            x: Math.min(a1.x, a2.x),
            y: Math.min(a1.y, a2.y),
            w: Math.abs(a2.x - a1.x),
            h: Math.abs(a2.y - a1.y),
          };
          if (rect.w < 4 || rect.h < 4) return;

          setAnnotations(a => [
            ...a,
            mode === 'highlight'
              ? { kind: 'highlight', page: pageIndex, rect, color }
              : { kind: 'whiteout', page: pageIndex, rect },
          ]);
        },
      }),
    [mode, color, pageIndex, signing],
  );

  const undo = () => setAnnotations(a => a.slice(0, -1));

  const save = async () => {
    if (!frames) return;
    setBusy(true);
    try {
      const res = await commitAnnotations(file, annotations, frames);
      setResult(res);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  if (error) {
    return (
      <View style={[styles.root, styles.center]}>
        <Text style={type.body}>{error}</Text>
      </View>
    );
  }

  if (!frames) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  const onThisPage = annotations.filter(a => a.page === pageIndex);
  const palette = mode === 'highlight' ? HIGHLIGHT_COLORS : INK_COLORS;

  return (
    <View style={styles.root}>
      <View style={styles.canvasWrap}>
        <View
          style={[styles.canvas, { width: CANVAS_WIDTH, height: canvasHeight }]}
          {...responder.panHandlers}
        >
          {pageImage ? (
            <Image source={{ uri: pageImage }} style={StyleSheet.absoluteFill} resizeMode="stretch" />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.center]}>
              <ActivityIndicator color={colors.textDim} />
            </View>
          )}

          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            {onThisPage.map((a, i) => {
              if (a.kind === 'ink') {
                return (
                  <Path
                    key={i}
                    d={a.points.map((p, j) => `${j ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')}
                    stroke={a.color}
                    strokeWidth={a.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                );
              }
              if (a.kind === 'highlight' || a.kind === 'whiteout') {
                return (
                  <SvgRect
                    key={i}
                    x={a.rect.x}
                    y={a.rect.y}
                    width={a.rect.w}
                    height={a.rect.h}
                    fill={a.kind === 'whiteout' ? '#FFFFFF' : a.color}
                    opacity={a.kind === 'whiteout' ? 1 : 0.35}
                  />
                );
              }
              return (
                <SvgText key={i} x={a.at.x} y={a.at.y + a.size} fontSize={a.size} fill={a.color}>
                  {a.value}
                </SvgText>
              );
            })}

            {live && mode === 'ink' && (
              <Path
                d={live.map((p, j) => `${j ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ')}
                stroke={color}
                strokeWidth={signing ? 2.5 : 2}
                strokeLinecap="round"
                fill="none"
              />
            )}
            {live && live.length === 2 && mode !== 'ink' && mode !== 'text' && (
              <SvgRect
                x={Math.min(live[0].x, live[1].x)}
                y={Math.min(live[0].y, live[1].y)}
                width={Math.abs(live[1].x - live[0].x)}
                height={Math.abs(live[1].y - live[0].y)}
                fill={mode === 'whiteout' ? '#FFFFFF' : color}
                opacity={mode === 'whiteout' ? 1 : 0.35}
              />
            )}
          </Svg>
        </View>
      </View>

      <View style={styles.pager}>
        <Pressable onPress={() => setPageIndex(i => Math.max(0, i - 1))} hitSlop={12}>
          <Text style={[type.body, pageIndex === 0 && { opacity: 0.3 }]}>Previous</Text>
        </Pressable>
        <Text style={type.hint}>
          Page {pageIndex + 1} of {pageCount}
        </Text>
        <Pressable
          onPress={() => setPageIndex(i => Math.min(pageCount - 1, i + 1))}
          hitSlop={12}
        >
          <Text style={[type.body, pageIndex === pageCount - 1 && { opacity: 0.3 }]}>Next</Text>
        </Pressable>
      </View>

      <View style={styles.tools}>
        {(['ink', 'highlight', 'text', 'whiteout'] as Mode[]).map(m => (
          <Pressable
            key={m}
            onPress={() => {
              setMode(m);
              setColor(m === 'highlight' ? HIGHLIGHT_COLORS.yellow : INK_COLORS.black);
            }}
            style={[styles.tool, mode === m && styles.toolOn]}
          >
            <Text style={type.body}>{labelFor(m, signing)}</Text>
          </Pressable>
        ))}
      </View>

      {mode !== 'whiteout' && (
        <View style={styles.swatches}>
          {Object.values(palette).map(c => (
            <Pressable
              key={c}
              onPress={() => setColor(c)}
              style={[
                styles.swatch,
                { backgroundColor: c },
                color === c && { borderColor: colors.text, borderWidth: 2 },
              ]}
            />
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <Pressable onPress={undo} disabled={!annotations.length} style={styles.secondary}>
          <Text style={[type.body, !annotations.length && { opacity: 0.35 }]}>Undo</Text>
        </Pressable>
        <Pressable
          onPress={save}
          disabled={!annotations.length || busy}
          style={[styles.cta, (!annotations.length || busy) && styles.ctaOff]}
        >
          <Text style={styles.ctaText}>{busy ? 'Saving…' : 'Save'}</Text>
        </Pressable>
      </View>

      {result && (
        <ResultCard
          path={result.path}
          note={result.note}
          navigation={navigation}
          onPathChange={next => setResult({ ...result, path: next })}
        />
      )}

      <Modal visible={pendingText !== null} transparent animationType="fade">
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <Text style={[type.body, { fontWeight: '600' }]}>Add text</Text>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              autoFocus
              placeholder="Type here"
              placeholderTextColor={colors.textDim}
              style={styles.input}
            />
            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
              <Pressable
                onPress={() => {
                  setPendingText(null);
                  setDraft('');
                }}
                style={[styles.secondary, { flex: 1 }]}
              >
                <Text style={type.body}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (draft.trim() && pendingText) {
                    setAnnotations(a => [
                      ...a,
                      {
                        kind: 'text',
                        page: pageIndex,
                        at: pendingText,
                        value: draft.trim(),
                        size: 14,
                        color,
                      },
                    ]);
                  }
                  setPendingText(null);
                  setDraft('');
                }}
                style={[styles.cta, { flex: 1, marginTop: 0 }]}
              >
                <Text style={styles.ctaText}>Place</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const labelFor = (m: Mode, signing: boolean) =>
  m === 'ink' ? (signing ? 'Sign' : 'Draw') : m === 'whiteout' ? 'Cover' : m === 'text' ? 'Text' : 'Highlight';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  canvasWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.md },
  canvas: { backgroundColor: '#FFFFFF', borderRadius: radius.sm, overflow: 'hidden' },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  tools: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    paddingVertical: space.sm,
  },
  tool: { paddingVertical: space.md, paddingHorizontal: space.md, borderRadius: radius.sm },
  toolOn: { backgroundColor: colors.accentSoft },
  swatches: {
    flexDirection: 'row',
    gap: space.md,
    justifyContent: 'center',
    paddingVertical: space.sm,
    backgroundColor: colors.surface,
  },
  swatch: { width: 26, height: 26, borderRadius: 13, borderColor: 'transparent', borderWidth: 2 },
  actions: {
    flexDirection: 'row',
    gap: space.md,
    padding: space.lg,
    backgroundColor: colors.surface,
  },
  secondary: {
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  cta: {
    flex: 1,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: space.md,
    alignItems: 'center',
  },
  ctaOff: { backgroundColor: colors.surfaceAlt },
  ctaText: { color: '#0B1020', fontSize: 16, fontWeight: '700' },
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
