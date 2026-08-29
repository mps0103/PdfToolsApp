import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Path, Rect as SvgRect, Text as SvgText } from 'react-native-svg';
import ImageCropPicker from 'react-native-image-crop-picker';
import {
  Annotation,
  HIGHLIGHT_COLORS,
  INK_COLORS,
  PageFrame,
  Point,
  Rect,
  commitAnnotations,
  pageFrames,
} from '../lib/annotations';
import { PickedFile, pickImages } from '../lib/files';
import {
  deleteSignature,
  keepSignature,
  listSignatures,
  signatureTempPath,
} from '../lib/fs';
import ResultCard from '../components/ResultCard';
import { PdfRender, RENDER_ERRORS } from '../native/PdfRender';
import { PdfCompress, SIGNATURE_THRESHOLD_DEFAULT } from '../native/PdfCompress';
import { colors, radius, space, type } from '../theme';

type Mode = 'ink' | 'highlight' | 'text' | 'whiteout' | 'signature';
type Props = { route: any; navigation: any };

const CANVAS_WIDTH = Math.min(Dimensions.get('window').width - space.lg * 2, 520);

// Thresholds the user can step through when the paper was not white enough.
const THRESHOLDS = [160, 180, 200, 220, 240];

const fileUri = (p: string) => (p.startsWith('file://') ? p : `file://${p}`);

export default function AnnotateScreen({ route, navigation }: Props) {
  const file: PickedFile = route.params.file;
  const signing: boolean = route.params.signing ?? false;

  const [frames, setFrames] = useState<Record<number, PageFrame> | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageImage, setPageImage] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>(signing ? 'signature' : 'ink');
  const [color, setColor] = useState<string>(INK_COLORS.black);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [redoStack, setRedoStack] = useState<Annotation[]>([]);
  const [live, setLive] = useState<Point[] | null>(null);
  const [pendingText, setPendingText] = useState<Point | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ path: string; note?: string } | null>(null);

  // Signature state
  const [library, setLibrary] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [preview, setPreview] = useState<{
    sourcePath: string;
    outPath: string;
    threshold: number;
    width: number;
    height: number;
  } | null>(null);
  const [processing, setProcessing] = useState(false);
  const [selectedSig, setSelectedSig] = useState<number | null>(null);

  const start = useRef<Point | null>(null);
  const liveRef = useRef<Point[] | null>(null);

  // Gesture handlers must not be rebuilt while a finger is down, so they read
  // the current annotations from a ref instead of closing over state.
  const annotationsRef = useRef<Annotation[]>(annotations);
  annotationsRef.current = annotations;
  const gestureRect = useRef<Rect | null>(null);
  const gestureAngle = useRef(0);
  // Which handler owns the current touch. Without this, drag and resize both
  // grant during one gesture, and each grant re-baselines the starting rect —
  // the accumulated movement is then applied again from the new size, which
  // is what made resizing lurch in and out.
  const activeGesture = useRef<'drag' | 'resize' | 'rotate' | null>(null);
  const respondersRef = useRef<Map<number, { drag: any; resize: any; rotate: any }>>(
    new Map(),
  );

  const setStroke = (points: Point[] | null) => {
    liveRef.current = points;
    setLive(points);
  };

  const addAnnotation = (a: Annotation) => {
    setAnnotations(list => [...list, a]);
    setRedoStack([]);
  };

  const pageCount = frames ? Object.keys(frames).length : 0;
  const frame = frames?.[pageIndex];

  const refreshLibrary = useCallback(() => {
    listSignatures()
      .then(setLibrary)
      .catch(() => setLibrary([]));
  }, []);

  useEffect(() => {
    refreshLibrary();
  }, [refreshLibrary]);

  useEffect(() => {
    pageFrames(file, CANVAS_WIDTH)
      .then(setFrames)
      .catch(() => setError('Could not read this file.'));
  }, [file]);

  useEffect(() => {
    if (!frames) return;
    setPageImage(null);
    setSelectedSig(null);
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
        onStartShouldSetPanResponder: () => mode !== 'signature',
        onMoveShouldSetPanResponder: () => mode !== 'signature',

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
            addAnnotation({
              kind: 'ink',
              page: pageIndex,
              points,
              color,
              width: signing ? 2.5 : 2,
            });
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

          addAnnotation(
            mode === 'highlight'
              ? { kind: 'highlight', page: pageIndex, rect, color }
              : { kind: 'whiteout', page: pageIndex, rect },
          );
        },
      }),
    [mode, color, pageIndex, signing],
  );

  /* ------------------------------------------------------------------ */
  /* Signature import                                                   */
  /* ------------------------------------------------------------------ */

  const processSignature = async (sourcePath: string, threshold: number) => {
    setProcessing(true);
    try {
      const out = signatureTempPath();
      const res = await PdfCompress.signature(sourcePath, out, threshold);
      setPreview({
        sourcePath,
        outPath: res.path,
        threshold,
        width: res.width,
        height: res.height,
      });
    } catch (e: any) {
      if (e?.code === 'E_EMPTY') {
        Alert.alert(
          'Nothing found',
          'No ink was detected. Try a higher setting, or a photo with better contrast.',
        );
      } else {
        Alert.alert('Could not process', e?.message ?? 'That image could not be read.');
      }
    } finally {
      setProcessing(false);
    }
  };

  /**
   * Crop first, then strip the background. A photo of paper on a desk keeps
   * the dark desk edge otherwise, and the auto-trim treats that as ink.
   */
  const importSignature = async () => {
    try {
      const picked = await pickImages();
      if (!picked.length) return;

      let sourcePath = picked[0].uri;
      try {
        const cropped = await ImageCropPicker.openCropper({
          path: sourcePath,
          mediaType: 'photo',
          freeStyleCropEnabled: true,
          cropperToolbarTitle: 'Crop to the signature',
          cropperActiveWidgetColor: colors.accent,
          cropperToolbarColor: colors.bg,
          cropperToolbarWidgetColor: '#FFFFFF',
          compressImageQuality: 1,
          includeBase64: false,
        });
        sourcePath = cropped.path;
      } catch (e: any) {
        // Backing out of the cropper keeps the original photo.
        if (e?.code !== 'E_PICKER_CANCELLED') throw e;
      }

      await processSignature(sourcePath, SIGNATURE_THRESHOLD_DEFAULT);
    } catch (e: any) {
      Alert.alert('Could not open', e?.message ?? 'That image could not be read.');
    }
  };

  /** Re-crop the same photo without starting over. */
  const recrop = async () => {
    if (!preview) return;
    try {
      const cropped = await ImageCropPicker.openCropper({
        path: preview.sourcePath,
        mediaType: 'photo',
        freeStyleCropEnabled: true,
        cropperToolbarTitle: 'Crop to the signature',
        cropperActiveWidgetColor: colors.accent,
        cropperToolbarColor: colors.bg,
        cropperToolbarWidgetColor: '#FFFFFF',
        compressImageQuality: 1,
        includeBase64: false,
      });
      await processSignature(cropped.path, preview.threshold);
    } catch (e: any) {
      if (e?.code !== 'E_PICKER_CANCELLED') {
        Alert.alert('Could not crop', e?.message ?? 'Something went wrong.');
      }
    }
  };

  const confirmSignature = async () => {
    if (!preview) return;
    try {
      const saved = await keepSignature(preview.outPath);
      setPreview(null);
      refreshLibrary();
      placeSignature(saved);
      setPickerOpen(false);
    } catch (e: any) {
      Alert.alert('Could not save', e?.message ?? 'Something went wrong.');
    }
  };

  const placeSignature = (path: string) => {
    Image.getSize(
      fileUri(path),
      (w, h) => {
        const width = CANVAS_WIDTH / 3;
        const height = (h / w) * width;
        addAnnotation({
          kind: 'signature',
          page: pageIndex,
          path,
          rect: {
            x: (CANVAS_WIDTH - width) / 2,
            y: canvasHeight * 0.6,
            w: width,
            h: height,
          },
          rotation: 0,
        });
        setPickerOpen(false);
      },
      () => Alert.alert('Could not load', 'That signature file is unreadable.'),
    );
  };

  const removeSignatureFromLibrary = (path: string) => {
    Alert.alert('Delete signature?', 'It stays on any page you already placed it.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteSignature(path);
          refreshLibrary();
        },
      },
    ]);
  };

  /* ------------------------------------------------------------------ */
  /* Signature placement gestures                                       */
  /* ------------------------------------------------------------------ */

  const updateRect = (index: number, rect: Rect) => {
    setAnnotations(list =>
      list.map((a, i) => (i === index && a.kind === 'signature' ? { ...a, rect } : a)),
    );
  };

  const rectAt = (index: number): Rect | null => {
    const a = annotationsRef.current[index];
    return a && a.kind === 'signature' ? a.rect : null;
  };

  /**
   * Built once per signature and cached. Recreating a PanResponder while a
   * finger is down tears the gesture apart.
   */
  const respondersFor = (index: number) => {
    const cached = respondersRef.current.get(index);
    if (cached) return cached;

    const drag = PanResponder.create({
      // Refuses the touch outright while a handle owns it.
      onStartShouldSetPanResponder: () => activeGesture.current === null,
      onMoveShouldSetPanResponder: (_, g) =>
        activeGesture.current === null && (Math.abs(g.dx) > 1 || Math.abs(g.dy) > 1),
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setSelectedSig(index);
        activeGesture.current = 'drag';
        gestureRect.current = rectAt(index);
      },
      onPanResponderMove: (_, g) => {
        const from = gestureRect.current;
        if (!from || activeGesture.current !== 'drag') return;
        updateRect(index, {
          ...from,
          // Keep part of it on the page so it cannot be lost offscreen.
          x: Math.min(Math.max(from.x + g.dx, -from.w * 0.6), CANVAS_WIDTH - from.w * 0.4),
          y: Math.min(Math.max(from.y + g.dy, -from.h * 0.6), canvasHeight - from.h * 0.4),
        });
      },
      onPanResponderRelease: () => {
        gestureRect.current = null;
        activeGesture.current = null;
      },
      onPanResponderTerminate: () => {
        gestureRect.current = null;
        activeGesture.current = null;
      },
    });

    const resize = PanResponder.create({
      // Capture claims the touch before the parent can, so the handle always
      // wins even though it sits inside the draggable view.
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setSelectedSig(index);
        activeGesture.current = 'resize';
        gestureRect.current = rectAt(index);
      },
      onPanResponderMove: (_, g) => {
        const from = gestureRect.current;
        if (!from || activeGesture.current !== 'resize') return;
        const ratio = from.h / from.w;
        // Averaging both axes keeps the size steady when the finger drifts
        // sideways along the diagonal.
        const delta = (g.dx + g.dy) / 2;
        const w = Math.min(Math.max(from.w + delta, 40), CANVAS_WIDTH);
        updateRect(index, { ...from, w, h: w * ratio });
      },
      onPanResponderRelease: () => {
        gestureRect.current = null;
        activeGesture.current = null;
      },
      onPanResponderTerminate: () => {
        gestureRect.current = null;
        activeGesture.current = null;
      },
    });

    const rotate = PanResponder.create({
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: () => {
        setSelectedSig(index);
        activeGesture.current = 'rotate';
        const a = annotationsRef.current[index];
        gestureAngle.current = a && a.kind === 'signature' ? a.rotation : 0;
      },
      onPanResponderMove: (_, g) => {
        if (activeGesture.current !== 'rotate') return;
        // Half a degree per pixel of sideways travel: a full swipe covers a
        // useful range without being twitchy.
        const next = Math.max(-180, Math.min(180, gestureAngle.current + g.dx * 0.5));
        setAnnotations(list =>
          list.map((a, i) =>
            i === index && a.kind === 'signature' ? { ...a, rotation: next } : a,
          ),
        );
      },
      onPanResponderRelease: () => {
        activeGesture.current = null;
      },
      onPanResponderTerminate: () => {
        activeGesture.current = null;
      },
    });

    const pair = { drag, resize, rotate };
    respondersRef.current.set(index, pair);
    return pair;
  };

  /* ------------------------------------------------------------------ */

  const lastOnThisPage = () => {
    for (let i = annotations.length - 1; i >= 0; i--) {
      if (annotations[i].page === pageIndex) return i;
    }
    return -1;
  };

  const undoIndex = lastOnThisPage();
  const canUndo = undoIndex >= 0;
  const canRedo = redoStack.some(a => a.page === pageIndex);

  const undo = () => {
    if (undoIndex < 0) return;
    const removed = annotations[undoIndex];
    setAnnotations(list => list.filter((_, i) => i !== undoIndex));
    setRedoStack(stack => [...stack, removed]);
    setSelectedSig(null);
    // Indices shift after a removal, so cached handlers are no longer valid.
    respondersRef.current.clear();
  };

  const redo = () => {
    for (let i = redoStack.length - 1; i >= 0; i--) {
      if (redoStack[i].page === pageIndex) {
        const restored = redoStack[i];
        setRedoStack(stack => stack.filter((_, j) => j !== i));
        setAnnotations(list => [...list, restored]);
        return;
      }
    }
  };

  const save = async () => {
    if (!frames) return;
    setBusy(true);
    setSelectedSig(null);
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

  const onThisPage = annotations
    .map((a, i) => ({ a, i }))
    .filter(entry => entry.a.page === pageIndex);

  const palette = mode === 'highlight' ? HIGHLIGHT_COLORS : INK_COLORS;

  return (
    <View style={styles.root}>
      <View style={styles.canvasWrap}>
        <View
          style={[styles.canvas, { width: CANVAS_WIDTH, height: canvasHeight }]}
          {...responder.panHandlers}
        >
          {pageImage ? (
            <Image
              source={{ uri: pageImage }}
              style={StyleSheet.absoluteFill}
              resizeMode="stretch"
            />
          ) : (
            <View style={[StyleSheet.absoluteFill, styles.center]}>
              <ActivityIndicator color={colors.textDim} />
            </View>
          )}

          <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
            {onThisPage.map(({ a, i }) => {
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
              if (a.kind === 'text') {
                return (
                  <SvgText
                    key={i}
                    x={a.at.x}
                    y={a.at.y + a.size}
                    fontSize={a.size}
                    fill={a.color}
                  >
                    {a.value}
                  </SvgText>
                );
              }
              // Signatures are real views, drawn below, so they can be dragged.
              return null;
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

          {onThisPage.map(({ a, i }) => {
            if (a.kind !== 'signature') return null;
            const handlers = respondersFor(i);
            return (
              <View
                key={`sig-${i}`}
                style={{
                  position: 'absolute',
                  left: a.rect.x,
                  top: a.rect.y,
                  width: a.rect.w,
                  height: a.rect.h,
                  transform: [{ rotate: `${a.rotation}deg` }],
                }}
                pointerEvents={mode === 'signature' ? 'auto' : 'none'}
                {...(mode === 'signature' ? handlers.drag.panHandlers : {})}
              >
                <Image
                  source={{ uri: fileUri(a.path) }}
                  style={StyleSheet.absoluteFill}
                  resizeMode="contain"
                />
                {mode === 'signature' && selectedSig === i && (
                  <>
                    <View style={styles.sigOutline} pointerEvents="none" />
                    <View style={styles.sigHandle} {...handlers.resize.panHandlers} />
                    <View style={styles.sigRotate} {...handlers.rotate.panHandlers}>
                      <Text style={styles.sigRotateGlyph}>⟳</Text>
                    </View>
                  </>
                )}
              </View>
            );
          })}
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
        {(['signature', 'ink', 'highlight', 'text', 'whiteout'] as Mode[]).map(m => (
          <Pressable
            key={m}
            onPress={() => {
              setMode(m);
              setSelectedSig(null);
              if (m === 'signature') setPickerOpen(true);
              else setColor(m === 'highlight' ? HIGHLIGHT_COLORS.yellow : INK_COLORS.black);
            }}
            style={[styles.tool, mode === m && styles.toolOn]}
          >
            <Text style={type.bodySmall}>{labelFor(m)}</Text>
          </Pressable>
        ))}
      </View>

      {mode === 'signature' ? (
        <View style={styles.sigBar}>
          <Pressable onPress={() => setPickerOpen(true)} style={styles.secondary}>
            <Text style={type.body}>Signatures</Text>
          </Pressable>
          <Text style={[type.hint, { flex: 1, textAlign: 'center' }]}>
            {selectedSig === null
              ? 'Tap a signature to select it'
              : 'Blue corner resizes, amber corner rotates'}
          </Text>
        </View>
      ) : (
        mode !== 'whiteout' && (
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
        )
      )}

      <View style={styles.actions}>
        <Pressable onPress={undo} disabled={!canUndo} style={styles.secondary}>
          <Text style={[type.body, !canUndo && { opacity: 0.35 }]}>Undo</Text>
        </Pressable>
        <Pressable onPress={redo} disabled={!canRedo} style={styles.secondary}>
          <Text style={[type.body, !canRedo && { opacity: 0.35 }]}>Redo</Text>
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

      {/* Signature library */}
      <Modal visible={pickerOpen} transparent animationType="fade">
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <Text style={[type.body, { fontWeight: '600' }]}>Your signatures</Text>
            <Text style={[type.hint, { marginTop: space.xs }]}>
              Photograph your signature on white paper. You crop it, then the
              paper is removed automatically.
            </Text>

            {library.length > 0 ? (
              <ScrollView horizontal style={{ marginTop: space.md }}>
                {library.map(path => (
                  <Pressable
                    key={path}
                    onPress={() => placeSignature(path)}
                    onLongPress={() => removeSignatureFromLibrary(path)}
                    style={styles.sigThumb}
                  >
                    <Image
                      source={{ uri: fileUri(path) }}
                      style={{ width: 110, height: 54 }}
                      resizeMode="contain"
                    />
                  </Pressable>
                ))}
              </ScrollView>
            ) : (
              <Text style={[type.hint, { marginTop: space.md }]}>Nothing saved yet.</Text>
            )}

            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.lg }}>
              <Pressable
                onPress={() => setPickerOpen(false)}
                style={[styles.secondary, { flex: 1 }]}
              >
                <Text style={type.body}>Close</Text>
              </Pressable>
              <Pressable
                onPress={importSignature}
                disabled={processing}
                style={[styles.cta, { flex: 1 }]}
              >
                <Text style={styles.ctaText}>{processing ? 'Working…' : 'Add new'}</Text>
              </Pressable>
            </View>
            {library.length > 0 && (
              <Text style={[type.hint, { marginTop: space.sm }]}>
                Long press a signature to delete it.
              </Text>
            )}
          </View>
        </View>
      </Modal>

      {/* Threshold preview */}
      <Modal visible={preview !== null} transparent animationType="fade">
        <View style={styles.modalWrap}>
          <View style={styles.modal}>
            <Text style={[type.body, { fontWeight: '600' }]}>Check the result</Text>
            <Text style={[type.hint, { marginTop: space.xs }]}>
              Only the ink should remain. Lower the number if paper is still
              showing, raise it if part of the signature vanished.
            </Text>

            {preview && (
              <View style={styles.previewBox}>
                <Image
                  source={{ uri: `${fileUri(preview.outPath)}?t=${preview.threshold}` }}
                  style={{ width: '100%', height: 120 }}
                  resizeMode="contain"
                />
              </View>
            )}

            <View style={styles.thresholds}>
              {THRESHOLDS.map(t => (
                <Pressable
                  key={t}
                  onPress={() => preview && processSignature(preview.sourcePath, t)}
                  style={[styles.chip, preview?.threshold === t && styles.chipOn]}
                >
                  <Text style={type.hint}>{t}</Text>
                </Pressable>
              ))}
            </View>

            <Pressable onPress={recrop} style={[styles.secondary, { marginTop: space.md }]}>
              <Text style={type.body}>Crop again</Text>
            </Pressable>

            <View style={{ flexDirection: 'row', gap: space.sm, marginTop: space.md }}>
              <Pressable
                onPress={() => setPreview(null)}
                style={[styles.secondary, { flex: 1 }]}
              >
                <Text style={type.body}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={confirmSignature}
                disabled={processing}
                style={[styles.cta, { flex: 1 }]}
              >
                <Text style={styles.ctaText}>{processing ? 'Working…' : 'Use it'}</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
                    addAnnotation({
                      kind: 'text',
                      page: pageIndex,
                      at: pendingText,
                      value: draft.trim(),
                      size: 14,
                      color,
                    });
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

const labelFor = (m: Mode) => {
  switch (m) {
    case 'signature':
      return 'Sign';
    case 'ink':
      return 'Draw';
    case 'whiteout':
      return 'Cover';
    case 'text':
      return 'Text';
    default:
      return 'Mark';
  }
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.xl },
  canvasWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.md },
  canvas: { backgroundColor: '#FFFFFF', borderRadius: radius.sm, overflow: 'hidden' },
  sigOutline: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderWidth: 1,
    borderColor: colors.accent,
    borderStyle: 'dashed',
  },
  sigHandle: {
    position: 'absolute',
    right: -13,
    bottom: -13,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.accent,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  sigRotate: {
    position: 'absolute',
    right: -13,
    top: -13,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.warn,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sigRotateGlyph: { color: '#0B1020', fontSize: 15, fontWeight: '700' },
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
  tool: { paddingVertical: space.md, paddingHorizontal: space.sm, borderRadius: radius.sm },
  toolOn: { backgroundColor: colors.accentSoft },
  sigBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    backgroundColor: colors.surface,
  },
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
    gap: space.sm,
    padding: space.lg,
    backgroundColor: colors.surface,
  },
  secondary: {
    paddingVertical: space.md,
    paddingHorizontal: space.md,
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
  sigThumb: {
    backgroundColor: '#FFFFFF',
    borderRadius: radius.sm,
    padding: space.sm,
    marginRight: space.sm,
  },
  previewBox: {
    marginTop: space.md,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.sm,
    padding: space.sm,
  },
  thresholds: {
    flexDirection: 'row',
    gap: space.sm,
    marginTop: space.md,
    justifyContent: 'space-between',
  },
  chip: {
    flex: 1,
    paddingVertical: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
  },
  chipOn: { backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.accent },
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