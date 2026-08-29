import React, { useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { findTool } from '../tools/registry';
import { pickFor, formatSize, PickedFile } from '../lib/files';
import { scanDocument } from '../lib/scanner';
import { shareFile } from '../lib/fs';
import { PdfSave } from '../native/PdfSave';
import {
  CANVAS_TOOLS,
  READER_TOOLS,
  RUNNERS,
  ToolOptions,
  VISUAL_TOOLS,
  optionsFor,
} from '../workers';
import { CRYPTO_ERRORS, PdfCrypto } from '../native/PdfCrypto';
import { COMPRESSION_LEVELS, CompressionLevel } from '../native/PdfCompress';
import { PAGE_SIZES, PageSizeKey } from '../workers/pdfLibExtra';
import { colors, radius, space, type } from '../theme';

type Props = { route: any; navigation: any };

export default function ToolScreen({ route, navigation }: Props) {
  const tool = findTool(route.params.id)!;
  const runner = RUNNERS[tool.id];
  // These tools hand off to another screen instead of running a worker,
  // so a missing runner is expected rather than a gap.
  const navigates =
    READER_TOOLS.includes(tool.id) ||
    CANVAS_TOOLS.includes(tool.id) ||
    VISUAL_TOOLS.includes(tool.id);
  const fields = useMemo(() => optionsFor(tool.id), [tool.id]);

  const [files, setFiles] = useState<PickedFile[]>([]);
  const [opts, setOpts] = useState<ToolOptions>({ allowPrinting: true, allowCopy: false });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ path: string; note?: string } | null>(null);

  // Some tools write a folder of images rather than one file.
  const resultIsFolder = !!result && !/\.[a-z0-9]{2,4}$/i.test(result.path);

  const set = <K extends keyof ToolOptions>(k: K, v: ToolOptions[K]) =>
    setOpts(o => ({ ...o, [k]: v }));

  const choose = async () => {
    try {
      const picked = tool.id === 'scan' ? await scanDocument() : await pickFor(tool.input);
      if (!picked.length) return;
      setResult(null);
      setFiles(prev => (tool.input === 'pdf' ? picked : [...prev, ...picked]));

      if (READER_TOOLS.includes(tool.id)) {
        navigation.navigate('Reader', { file: picked[0], title: picked[0].name });
        return;
      }

      if (CANVAS_TOOLS.includes(tool.id)) {
        navigation.navigate('Annotate', {
          file: picked[0],
          title: tool.title,
          signing: tool.id === 'sign',
        });
        return;
      }

      if (VISUAL_TOOLS.includes(tool.id)) {
        navigation.navigate('Pages', { file: picked[0], title: tool.title });
        return;
      }

      if (tool.id === 'unlock') {
        const locked = await PdfCrypto.isEncrypted(picked[0].uri).catch(() => true);
        if (!locked) Alert.alert('No password on this file', 'It already opens without one.');
      }
    } catch (e: any) {
      if (e?.code !== 'OPERATION_CANCELED') {
        Alert.alert('Could not open that file', 'Pick it again from a different folder.');
      }
    }
  };

  const run = async () => {
    if (!runner) {
      Alert.alert(tool.title, 'This tool is not built yet.');
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const res = await runner(files, opts);
      setResult(res);
    } catch (e: any) {
      Alert.alert(tool.title, messageFor(e));
    } finally {
      setBusy(false);
    }
  };

  const label =
    tool.id === 'scan'
      ? 'Open camera'
      : tool.input === 'images'
        ? 'Add images'
        : tool.input === 'pdfs'
          ? 'Add PDFs'
          : 'Choose PDF';

  return (
    <ScrollView style={styles.root} contentContainerStyle={{ padding: space.lg }}>
      <Text style={type.hint}>{tool.hint}</Text>

      {!runner && !navigates && (
        <View style={styles.notice}>
          <Text style={type.body}>This tool is not built yet.</Text>
          <Text style={[type.hint, { marginTop: space.xs }]}>
            File picking works, so it is ready for its worker.
          </Text>
        </View>
      )}

      <Pressable onPress={choose} style={styles.dropZone}>
        <Text style={[type.body, { fontWeight: '600' }]}>{label}</Text>
        <Text style={[type.hint, { marginTop: space.xs }]}>
          Files stay on this phone. Nothing is uploaded.
        </Text>
      </Pressable>

      <FlatList
        data={files}
        scrollEnabled={false}
        keyExtractor={(f, i) => f.uri + i}
        contentContainerStyle={{ gap: space.sm, paddingTop: space.md }}
        renderItem={({ item, index }) => (
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={type.body} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={type.hint}>{formatSize(item.size)}</Text>
            </View>
            <Pressable onPress={() => setFiles(f => f.filter((_, i) => i !== index))} hitSlop={12}>
              <Text style={{ color: colors.textDim, fontSize: 18 }}>×</Text>
            </Pressable>
          </View>
        )}
      />

      {fields.includes('ranges') && (
        <Field label="Pages">
          <TextInput
            value={opts.ranges ?? ''}
            onChangeText={v => set('ranges', v)}
            placeholder="1-3, 7, 10-"
            placeholderTextColor={colors.textDim}
            style={styles.input}
          />
        </Field>
      )}

      {fields.includes('text') && (
        <Field label="Watermark text">
          <TextInput
            value={opts.text ?? ''}
            onChangeText={v => set('text', v)}
            placeholder="DRAFT"
            placeholderTextColor={colors.textDim}
            style={styles.input}
          />
        </Field>
      )}

      {fields.includes('turns') && (
        <Field label="Turn by">
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {([90, 180, 270] as const).map(t => (
              <Pressable
                key={t}
                onPress={() => set('turns', t)}
                style={[styles.chip, (opts.turns ?? 90) === t && styles.chipOn]}
              >
                <Text style={type.body}>{t}°</Text>
              </Pressable>
            ))}
          </View>
        </Field>
      )}

      {fields.includes('dpi') && (
        <Field label="Quality">
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {([100, 150, 220] as const).map(d => (
              <Pressable
                key={d}
                onPress={() => set('dpi', d)}
                style={[styles.chip, (opts.dpi ?? 150) === d && styles.chipOn]}
              >
                <Text style={type.body}>{d} dpi</Text>
              </Pressable>
            ))}
          </View>
        </Field>
      )}

      {fields.includes('format') && (
        <Field label="Format">
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {(['jpg', 'png'] as const).map(f => (
              <Pressable
                key={f}
                onPress={() => set('format', f)}
                style={[styles.chip, (opts.format ?? 'jpg') === f && styles.chipOn]}
              >
                <Text style={type.body}>{f.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </Field>
      )}

      {fields.includes('level') && (
        <Field label="How much">
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {(Object.keys(COMPRESSION_LEVELS) as CompressionLevel[]).map(l => (
              <Pressable
                key={l}
                onPress={() => set('level', l)}
                style={[styles.chip, (opts.level ?? 'balanced') === l && styles.chipOn]}
              >
                <Text style={type.body}>{COMPRESSION_LEVELS[l].label}</Text>
              </Pressable>
            ))}
          </View>
          <Text style={[type.hint, { marginTop: space.sm }]}>
            Photos are re-saved at lower quality. Text stays sharp at every level.
          </Text>
        </Field>
      )}

      {fields.includes('axis') && (
        <Field label={tool.id === 'flip' ? 'Mirror' : 'Cut'}>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {(['horizontal', 'vertical'] as const).map(a => (
              <Pressable
                key={a}
                onPress={() => set('axis', a)}
                style={[
                  styles.chip,
                  (opts.axis ?? (tool.id === 'flip' ? 'horizontal' : 'vertical')) === a &&
                    styles.chipOn,
                ]}
              >
                <Text style={type.body}>{a === 'horizontal' ? 'Left to right' : 'Top to bottom'}</Text>
              </Pressable>
            ))}
          </View>
        </Field>
      )}

      {fields.includes('perSheet') && (
        <Field label="Pages per sheet">
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {([2, 4] as const).map(n => (
              <Pressable
                key={n}
                onPress={() => set('perSheet', n)}
                style={[styles.chip, (opts.perSheet ?? 2) === n && styles.chipOn]}
              >
                <Text style={type.body}>{n} up</Text>
              </Pressable>
            ))}
          </View>
        </Field>
      )}

      {fields.includes('percent') && (
        <Field label="Trim from each edge">
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {([3, 5, 10, 15] as const).map(v => (
              <Pressable
                key={v}
                onPress={() => set('percent', v)}
                style={[styles.chip, (opts.percent ?? 5) === v && styles.chipOn]}
              >
                <Text style={type.body}>{v}%</Text>
              </Pressable>
            ))}
          </View>
        </Field>
      )}

      {fields.includes('size') && (
        <Field label="Page size">
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            {(Object.keys(PAGE_SIZES) as PageSizeKey[]).map(k => (
              <Pressable
                key={k}
                onPress={() => set('size', k)}
                style={[styles.chip, (opts.size ?? 'a4') === k && styles.chipOn]}
              >
                <Text style={type.body}>{PAGE_SIZES[k].label}</Text>
              </Pressable>
            ))}
          </View>
        </Field>
      )}

      {fields.includes('header') && (
        <>
          <Field label="Header">
            <TextInput
              value={opts.header ?? ''}
              onChangeText={v => set('header', v)}
              placeholder="Shown at the top of every page"
              placeholderTextColor={colors.textDim}
              style={styles.input}
            />
          </Field>
          <Field label="Footer">
            <TextInput
              value={opts.footer ?? ''}
              onChangeText={v => set('footer', v)}
              placeholder="Shown at the bottom of every page"
              placeholderTextColor={colors.textDim}
              style={styles.input}
            />
          </Field>
        </>
      )}

      {fields.includes('prefix') && (
        <>
          <Field label="Prefix">
            <TextInput
              value={opts.prefix ?? ''}
              onChangeText={v => set('prefix', v)}
              placeholder="ABC-"
              placeholderTextColor={colors.textDim}
              style={styles.input}
            />
          </Field>
          <Field label="Start at">
            <TextInput
              value={String(opts.start ?? 1)}
              onChangeText={v => set('start', parseInt(v.replace(/\D/g, ''), 10) || 1)}
              keyboardType="number-pad"
              style={styles.input}
            />
          </Field>
        </>
      )}

      {fields.includes('meta') &&
        (['title', 'author', 'subject', 'keywords'] as const).map(k => (
          <Field key={k} label={k}>
            <TextInput
              value={opts.meta?.[k] ?? ''}
              onChangeText={v => set('meta', { ...(opts.meta ?? {}), [k]: v })}
              placeholder={k === 'keywords' ? 'Comma separated' : ''}
              placeholderTextColor={colors.textDim}
              style={styles.input}
            />
          </Field>
        ))}

      {fields.includes('password') && (
        <Field label={tool.id === 'unlock' ? 'Current password' : 'New password'}>
          <TextInput
            value={opts.password ?? ''}
            onChangeText={v => set('password', v)}
            secureTextEntry
            autoCapitalize="none"
            placeholder={tool.id === 'unlock' ? 'Password that opens this file' : 'At least 4 characters'}
            placeholderTextColor={colors.textDim}
            style={styles.input}
          />
          {tool.id === 'unlock' && (
            <Text style={[type.hint, { marginTop: space.sm }]}>
              You need the password. This tool decrypts a file you can already open — it does not
              guess or break passwords.
            </Text>
          )}
        </Field>
      )}

      {fields.includes('allowPrinting') && (
        <>
          <Toggle
            label="Allow printing"
            value={opts.allowPrinting ?? true}
            onChange={v => set('allowPrinting', v)}
          />
          <Toggle
            label="Allow copying text"
            value={opts.allowCopy ?? false}
            onChange={v => set('allowCopy', v)}
          />
        </>
      )}

      <Pressable
        onPress={run}
        disabled={files.length === 0 || busy}
        style={[styles.cta, (files.length === 0 || busy) && styles.ctaOff]}
      >
        <Text style={styles.ctaText}>{busy ? 'Working…' : tool.title}</Text>
      </Pressable>

      {result && (
        <View style={styles.result}>
          <Text style={[type.body, { fontWeight: '600' }]}>Done</Text>
          <Text style={[type.hint, { marginTop: space.xs }]} numberOfLines={2}>
            {result.path.split('/').pop()}
          </Text>
          {result.note && (
            <Text style={[type.hint, { marginTop: space.sm, color: colors.warn }]}>
              {result.note}
            </Text>
          )}
          {!resultIsFolder && result.path.toLowerCase().endsWith('.pdf') && (
            <Pressable
              onPress={() =>
                navigation.navigate('Reader', {
                  file: {
                    uri: result.path,
                    name: result.path.split('/').pop() ?? 'document.pdf',
                    type: 'application/pdf',
                    size: null,
                  },
                  title: 'Result',
                })
              }
              style={styles.secondary}
            >
              <Text style={[type.body, { fontWeight: '600' }]}>Read</Text>
            </Pressable>
          )}
          {!resultIsFolder && (
            <Pressable onPress={() => shareFile(result.path)} style={styles.secondary}>
              <Text style={[type.body, { fontWeight: '600' }]}>Share</Text>
            </Pressable>
          )}
          {resultIsFolder ? (
            <Pressable onPress={() => navigation.navigate('Files')} style={styles.secondary}>
              <Text style={[type.body, { fontWeight: '600' }]}>Open in Files</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={async () => {
                try {
                  await PdfSave.toDownloads(result.path);
                  Alert.alert('Saved', 'The file is in your Downloads folder.');
                } catch (e: any) {
                  Alert.alert('Could not save', e?.message ?? 'Something went wrong.');
                }
              }}
              style={styles.secondary}
            >
              <Text style={[type.body, { fontWeight: '600' }]}>Save to Downloads</Text>
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
  );
}

function messageFor(e: any) {
  switch (e?.code) {
    case CRYPTO_ERRORS.WRONG_PASSWORD:
      return 'That password did not open the file. Check it and try again.';
    case CRYPTO_ERRORS.NOT_ENCRYPTED:
      return 'This file has no password on it.';
    default:
      return e?.message ?? 'Something went wrong with that file.';
  }
}

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <View style={{ marginTop: space.lg }}>
    <Text style={[type.section, { marginBottom: space.sm }]}>{label.toUpperCase()}</Text>
    {children}
  </View>
);

const Toggle = ({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) => (
  <View style={[styles.row, { marginTop: space.md }]}>
    <Text style={[type.body, { flex: 1 }]}>{label}</Text>
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ true: colors.accentSoft, false: colors.line }}
      thumbColor={value ? colors.accent : colors.textDim}
    />
  </View>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  notice: {
    marginTop: space.md,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
    borderLeftWidth: 3,
    borderLeftColor: colors.warn,
  },
  dropZone: {
    marginTop: space.lg,
    padding: space.xl,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.line,
    backgroundColor: colors.surface,
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius.sm,
    padding: space.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
    color: colors.text,
    fontSize: 15,
  },
  chip: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  chipOn: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  cta: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: space.lg,
    alignItems: 'center',
    marginTop: space.xl,
  },
  ctaOff: { backgroundColor: colors.surfaceAlt },
  ctaText: { color: '#0B1020', fontSize: 16, fontWeight: '700' },
  result: {
    marginTop: space.lg,
    padding: space.lg,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
  },
  secondary: {
    marginTop: space.md,
    paddingVertical: space.md,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
});
