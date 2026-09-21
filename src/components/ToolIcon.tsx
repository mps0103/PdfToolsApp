import React from 'react';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { colors } from '../theme';

/**
 * One line drawing per tool, sized on a 24x24 grid. They sit faded in the
 * corner of a tile, so they are read at a glance rather than studied: a
 * single recognisable silhouette each, no labels and no fine detail that
 * would turn to mush at 28px and a third of full opacity.
 */

// Shared page outline with a folded corner, used by the tools that act on
// a document as a whole rather than on its pixels.
const page = (
  <>
    <Path d="M7 3h6l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <Path d="M13 3v4h4" />
  </>
);

const ICONS: Record<string, React.ReactNode> = {
  // Read
  read: (
    <>
      <Path d="M12 7C10.3 5.6 7.8 5 4.5 5v12c3.3 0 5.8.6 7.5 2 1.7-1.4 4.2-2 7.5-2V5c-3.3 0-5.8.6-7.5 2Z" />
      <Path d="M12 7v12" />
    </>
  ),

  // Create
  'images-to-pdf': (
    <>
      <Rect x={6} y={3.5} width={15} height={13} rx={2} />
      <Path d="M3 7v12a1.5 1.5 0 0 0 1.5 1.5H17" />
      <Circle cx={10.5} cy={8} r={1.3} />
      <Path d="M6 14l3.5-3 2.8 2.4 2.2-1.8 6.5 5.4" />
    </>
  ),
  scan: (
    <>
      <Path d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8" />
      <Path d="M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8" />
      <Path d="M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16" />
      <Path d="M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
      <Path d="M4 12h16" />
    </>
  ),

  // Organize
  merge: (
    <>
      <Path d="M4 5v3a4 4 0 0 0 4 4h11" />
      <Path d="M4 19v-3a4 4 0 0 1 4-4" />
      <Path d="M16 9l3 3-3 3" />
    </>
  ),
  split: (
    <>
      <Path d="M20 5v3a4 4 0 0 1-4 4H5" />
      <Path d="M20 19v-3a4 4 0 0 0-4-4" />
      <Path d="M8 9l-3 3 3 3" />
    </>
  ),
  'extract-pages': (
    <>
      <Path d="M14 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5a2 2 0 0 0 2-2v-2.5" />
      <Path d="M11.5 10H20" />
      <Path d="M17.5 7.2L20.3 10l-2.8 2.8" />
    </>
  ),
  'delete-pages': (
    <>
      {page}
      <Path d="M9.6 12.6l4.8 4.8" />
      <Path d="M14.4 12.6l-4.8 4.8" />
    </>
  ),
  organize: (
    <>
      <Path d="M9 6h11" />
      <Path d="M9 12h11" />
      <Path d="M9 18h11" />
      <Path d="M4 8v8" />
      <Path d="M2.6 9.4L4 8l1.4 1.4" />
      <Path d="M2.6 14.6L4 16l1.4-1.4" />
    </>
  ),
  rotate: (
    <>
      <Path d="M20 12a8 8 0 1 1-2.7-6" />
      <Path d="M20 3.5V8h-4.5" />
    </>
  ),
  flip: (
    <>
      <Path d="M12 3v18" strokeDasharray="2 3" />
      <Path d="M9 7l-5 5 5 5V7Z" />
      <Path d="M15 7l5 5-5 5V7Z" />
    </>
  ),
  'split-half': (
    <>
      <Rect x={3} y={5} width={7} height={14} rx={1.5} />
      <Rect x={14} y={5} width={7} height={14} rx={1.5} />
      <Path d="M12 4v16" strokeDasharray="2 3" />
    </>
  ),
  'n-up': (
    <>
      <Rect x={4} y={4} width={7} height={7} rx={1.5} />
      <Rect x={13} y={4} width={7} height={7} rx={1.5} />
      <Rect x={4} y={13} width={7} height={7} rx={1.5} />
      <Rect x={13} y={13} width={7} height={7} rx={1.5} />
    </>
  ),
  'alternate-mix': (
    <>
      <Path d="M3 8h5a4 4 0 0 1 4 4 4 4 0 0 0 4 4h4" />
      <Path d="M3 16h5a4 4 0 0 0 4-4 4 4 0 0 1 4-4h4" />
      <Path d="M18.5 6.2L20.3 8l-1.8 1.8" />
      <Path d="M18.5 14.2L20.3 16l-1.8 1.8" />
    </>
  ),

  // Convert
  'pdf-to-images': (
    <>
      <Rect x={3} y={5} width={18} height={14} rx={2} />
      <Circle cx={8} cy={10} r={1.4} />
      <Path d="M3 16.5l4.8-4.2 3.6 3 2.6-2.1 7 5.8" />
    </>
  ),
  'pdf-to-text': (
    <>
      {page}
      <Path d="M9 12h6" />
      <Path d="M9 15.5h6" />
      <Path d="M9 19h4" />
    </>
  ),
  'extract-images': (
    <>
      <Rect x={3} y={7} width={13} height={13} rx={2} />
      <Circle cx={7} cy={11.5} r={1.1} />
      <Path d="M3 16.8l3.4-3 2.4 2 1.9-1.5 5.3 4.4" />
      <Path d="M14.5 9.5L21 3" />
      <Path d="M16 3h5v5" />
    </>
  ),
  ocr: (
    <>
      <Path d="M4 6h10" />
      <Path d="M4 10h6" />
      <Circle cx={13.5} cy={13.5} r={5} />
      <Path d="M17.3 17.3L21 21" />
    </>
  ),

  // Edit
  crop: (
    <>
      <Path d="M6 2v14a2 2 0 0 0 2 2h14" />
      <Path d="M2 6h14a2 2 0 0 1 2 2v14" />
    </>
  ),
  resize: (
    <>
      <Rect x={3} y={3} width={18} height={18} rx={2} />
      <Path d="M8 13V8h5" />
      <Path d="M16 11v5h-5" />
      <Path d="M8 8l4.5 4.5" />
      <Path d="M16 16l-4.5-4.5" />
    </>
  ),
  'page-numbers': (
    <>
      <Path d="M9.5 4L7.5 20" />
      <Path d="M17 4l-2 16" />
      <Path d="M4.5 9h15" />
      <Path d="M3.5 15h15" />
    </>
  ),
  'header-footer': (
    <>
      <Rect x={3} y={3} width={18} height={18} rx={2} />
      <Path d="M3 8h18" />
      <Path d="M3 16h18" />
    </>
  ),
  watermark: (
    <>
      <Path d="M12 3.5s6 6.2 6 10a6 6 0 0 1-12 0c0-3.8 6-10 6-10Z" />
      <Path d="M9 13.8a3 3 0 0 0 3 3" />
    </>
  ),
  annotate: (
    <>
      <Path d="M4 20l1-4L16 5l3 3L8 19l-4 1Z" />
      <Path d="M14.5 6.5l3 3" />
    </>
  ),
  sign: (
    <>
      <Path d="M3 16.5c3-.8 4-9 6-9s1 7 3 7 3-3.5 5-3.5" />
      <Path d="M3 20.5h18" />
    </>
  ),
  metadata: (
    <>
      <Path d="M3 12.5V5a2 2 0 0 1 2-2h7.5l8 8-9.5 9.5-8-8Z" />
      <Circle cx={7.6} cy={7.6} r={1.3} />
    </>
  ),
  bates: (
    <>
      <Rect x={8} y={3} width={12} height={12} rx={2} />
      <Path d="M4 7.5V19a2 2 0 0 0 2 2h11.5" />
      <Path d="M12.6 6.2l-1 6.6" />
      <Path d="M16.8 6.2l-1 6.6" />
      <Path d="M10.3 8.6h8" />
      <Path d="M9.9 11.4h8" />
    </>
  ),

  // Secure
  protect: (
    <>
      <Rect x={4.5} y={10} width={15} height={10.5} rx={2} />
      <Path d="M8 10V7.5a4 4 0 0 1 8 0V10" />
      <Circle cx={12} cy={15.2} r={1.2} />
    </>
  ),
  unlock: (
    <>
      <Rect x={4.5} y={10} width={15} height={10.5} rx={2} />
      <Path d="M8 10V7.5a4 4 0 0 1 7.7-1.5" />
      <Circle cx={12} cy={15.2} r={1.2} />
    </>
  ),
  flatten: (
    <>
      <Path d="M12 3l9 5-9 5-9-5 9-5Z" />
      <Path d="M3 13l9 5 9-5" />
    </>
  ),
  'remove-annotations': (
    <>
      <Rect x={4} y={4} width={16} height={16} rx={2} />
      <Path d="M8 9.5h8" />
      <Path d="M8 13.5h5" />
      <Path d="M4.8 19.2L19.2 4.8" />
    </>
  ),

  // Optimize
  compress: (
    <>
      <Path d="M9.5 4v5.5H4" />
      <Path d="M14.5 4v5.5H20" />
      <Path d="M9.5 20v-5.5H4" />
      <Path d="M14.5 20v-5.5H20" />
    </>
  ),
  grayscale: (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M12 3.5a8.5 8.5 0 0 1 0 17Z" fill={colors.textDim} stroke="none" />
    </>
  ),

  // Not a tool, but the About tile sits in the same grid.
  about: (
    <>
      <Circle cx={12} cy={12} r={8.5} />
      <Path d="M12 11v5.5" />
      <Circle cx={12} cy={7.8} r={0.9} fill={colors.textDim} stroke="none" />
    </>
  ),
};

type Props = { id: string; size?: number };

export default function ToolIcon({ id, size = 22 }: Props) {
  // A tool without a drawing of its own still gets the page outline, so a
  // newly added tool looks unfinished rather than broken.
  const glyph = ICONS[id] ?? page;

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={0.28}>
      <G
        stroke={colors.textDim}
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      >
        {glyph}
      </G>
    </Svg>
  );
}
