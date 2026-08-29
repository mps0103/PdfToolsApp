import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { PickedFile } from './files';
import { OUT_DIR, ensureOutDir, writeOutput } from './fs';
import { RUNNERS, ToolOptions } from '../workers';
import { findTool } from '../tools/registry';

export type TestOutcome = 'pass' | 'fail' | 'skipped';

export type TestResult = {
  id: string;
  title: string;
  outcome: TestOutcome;
  ms: number;
  detail?: string;
};

// A 1x1 PNG. Enough to prove embedPng and the image pipeline work
// without shipping a fixture file.
const TINY_PNG =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** Builds a three-page document with text, shapes and a form field. */
export async function makeSample(): Promise<PickedFile> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);

  for (let i = 0; i < 3; i++) {
    const page = doc.addPage([595.28, 841.89]);
    page.drawText(`Sample page ${i + 1}`, {
      x: 60,
      y: 760,
      size: 24,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    page.drawText(
      'This document exists so the self test has something predictable to work on.',
      { x: 60, y: 720, size: 11, font, color: rgb(0.3, 0.3, 0.3) },
    );
    page.drawRectangle({
      x: 60,
      y: 400,
      width: 200,
      height: 120,
      color: rgb(0.3, 0.55, 0.9),
      opacity: 0.6,
    });
  }

  const form = doc.getForm();
  form.createTextField('sample.field').addToPage(doc.getPage(0), {
    x: 60,
    y: 600,
    width: 220,
    height: 28,
  });

  const path = await writeOutput('selftest-sample.pdf', await doc.saveAsBase64());
  return { uri: path, name: 'selftest-sample.pdf', type: 'application/pdf', size: null };
}

async function makeSampleImage(): Promise<PickedFile> {
  const path = await writeOutput('selftest-pixel.png', TINY_PNG);
  return { uri: path, name: 'selftest-pixel.png', type: 'image/png', size: null };
}

/** Sensible defaults so every tool has what it needs to run unattended. */
function optionsFor(id: string): ToolOptions {
  switch (id) {
    case 'extract-pages':
    case 'split':
      return { ranges: '1-2' };
    case 'delete-pages':
      return { ranges: '3' };
    case 'watermark':
      return { text: 'SELF TEST' };
    case 'rotate':
      return { turns: 90 };
    case 'protect':
    case 'unlock':
      return { password: 'selftest123' };
    case 'crop':
      return { percent: 5 };
    case 'resize':
      return { size: 'a5' };
    case 'header-footer':
      return { header: 'Header', footer: 'Footer' };
    case 'bates':
      return { prefix: 'TEST-', start: 1 };
    case 'metadata':
      return { meta: { title: 'Self test', author: 'PDF Tools' } };
    case 'n-up':
      return { perSheet: 2 };
    case 'flip':
      return { axis: 'horizontal' };
    case 'split-half':
      return { axis: 'vertical' };
    case 'compress':
      return { level: 'balanced' };
    case 'pdf-to-images':
      return { dpi: 100, format: 'jpg' };
    default:
      return {};
  }
}

// Tools that cannot run without a person: the scanner opens a camera,
// the canvas tools need touch input.
const INTERACTIVE = ['scan', 'annotate', 'sign', 'organize', 'read'];

export async function runSelfTest(
  onProgress?: (done: number, total: number) => void,
): Promise<TestResult[]> {
  await ensureOutDir();
  const sample = await makeSample();
  const image = await makeSampleImage();

  // Unlock needs an encrypted input, so chain it onto whatever protect made.
  let encrypted: PickedFile | null = null;

  const ids = Object.keys(RUNNERS);
  const results: TestResult[] = [];

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const tool = findTool(id);
    const title = tool?.title ?? id;
    onProgress?.(i, ids.length);

    if (INTERACTIVE.includes(id)) {
      results.push({ id, title, outcome: 'skipped', ms: 0, detail: 'Needs input from you' });
      continue;
    }

    const started = Date.now();
    try {
      let input: PickedFile[];
      if (tool?.input === 'images') input = [image, image];
      else if (id === 'unlock') {
        if (!encrypted) {
          results.push({
            id,
            title,
            outcome: 'skipped',
            ms: 0,
            detail: 'Add password did not produce a file to unlock',
          });
          continue;
        }
        input = [encrypted];
      } else if (tool?.input === 'pdfs') input = [sample, sample];
      else input = [sample];

      const res = await RUNNERS[id](input, optionsFor(id));

      if (id === 'protect') {
        encrypted = {
          uri: res.path,
          name: 'selftest-locked.pdf',
          type: 'application/pdf',
          size: null,
        };
      }

      results.push({
        id,
        title,
        outcome: 'pass',
        ms: Date.now() - started,
        detail: res.note,
      });
    } catch (e: any) {
      results.push({
        id,
        title,
        outcome: 'fail',
        ms: Date.now() - started,
        detail: e?.code ? `${e.code}: ${e.message ?? ''}`.trim() : (e?.message ?? 'Unknown error'),
      });
    }
  }

  onProgress?.(ids.length, ids.length);
  return results;
}

export const SELFTEST_PREFIX = `${OUT_DIR}/selftest`;
