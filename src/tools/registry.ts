export type Category =
  | 'Read'
  | 'Create'
  | 'Organize'
  | 'Convert'
  | 'Edit'
  | 'Secure'
  | 'Optimize';

export type InputKind = 'pdf' | 'pdfs' | 'images' | 'none';

export type Tool = {
  id: string;
  title: string;
  hint: string;
  category: Category;
  input: InputKind;
  ready: boolean; // false = shows "Coming soon" sheet, stays out of search results
};

export const TOOLS: Tool[] = [
  // Read
  { id: 'read', title: 'Open a PDF', hint: 'Read, zoom and jump to any page', category: 'Read', input: 'pdf', ready: true },

  // Create
  { id: 'images-to-pdf', title: 'Images to PDF', hint: 'Photos or gallery images into one file', category: 'Create', input: 'images', ready: true },
  { id: 'scan', title: 'Scan document', hint: 'Camera, edge detect, straighten', category: 'Create', input: 'images', ready: true },

  // Organize
  { id: 'merge', title: 'Merge', hint: 'Combine files in any order', category: 'Organize', input: 'pdfs', ready: true },
  { id: 'split', title: 'Split', hint: 'By page ranges or every page', category: 'Organize', input: 'pdf', ready: true },
  { id: 'extract-pages', title: 'Extract pages', hint: 'Keep only the pages you pick', category: 'Organize', input: 'pdf', ready: true },
  { id: 'delete-pages', title: 'Delete pages', hint: 'Remove pages you do not need', category: 'Organize', input: 'pdf', ready: true },
  { id: 'organize', title: 'Reorder pages', hint: 'Drag pages into a new order', category: 'Organize', input: 'pdf', ready: true },
  { id: 'rotate', title: 'Rotate', hint: 'Turn pages 90 or 180', category: 'Organize', input: 'pdf', ready: true },
  { id: 'flip', title: 'Flip', hint: 'Mirror pages horizontally or vertically', category: 'Organize', input: 'pdf', ready: true },
  { id: 'split-half', title: 'Split in half', hint: 'Two-page scans into single pages', category: 'Organize', input: 'pdf', ready: true },
  { id: 'n-up', title: 'N-up', hint: 'Print 2 or 4 pages per sheet', category: 'Organize', input: 'pdf', ready: true },
  { id: 'alternate-mix', title: 'Alternate and mix', hint: 'Interleave two documents', category: 'Organize', input: 'pdfs', ready: true },

  // Convert
  { id: 'pdf-to-images', title: 'PDF to images', hint: 'Export pages as JPG or PNG', category: 'Convert', input: 'pdf', ready: true },
  { id: 'pdf-to-text', title: 'PDF to text', hint: 'Pull out the text layer', category: 'Convert', input: 'pdf', ready: true },
  { id: 'extract-images', title: 'Extract images', hint: 'Save pictures embedded in the file', category: 'Convert', input: 'pdf', ready: true },
  { id: 'ocr', title: 'Make searchable', hint: 'Read text in scans, on device', category: 'Convert', input: 'pdf', ready: true },

  // Edit
  { id: 'crop', title: 'Crop', hint: 'Trim margins', category: 'Edit', input: 'pdf', ready: true },
  { id: 'resize', title: 'Resize', hint: 'Change page size or padding', category: 'Edit', input: 'pdf', ready: true },
  { id: 'page-numbers', title: 'Page numbers', hint: 'Stamp numbers in any corner', category: 'Edit', input: 'pdf', ready: true },
  { id: 'header-footer', title: 'Header and footer', hint: 'Repeat a label on every page', category: 'Edit', input: 'pdf', ready: true },
  { id: 'watermark', title: 'Watermark', hint: 'Text or image, over every page', category: 'Edit', input: 'pdf', ready: true },
  { id: 'annotate', title: 'Annotate', hint: 'Highlight, draw, add text', category: 'Edit', input: 'pdf', ready: true },
  { id: 'sign', title: 'Fill and sign', hint: 'Place a signature anywhere', category: 'Edit', input: 'pdf', ready: true },
  { id: 'metadata', title: 'Edit details', hint: 'Title, author, subject, keywords', category: 'Edit', input: 'pdf', ready: true },
  { id: 'bates', title: 'Bates numbering', hint: 'Sequential stamps across files', category: 'Edit', input: 'pdfs', ready: true },

  // Secure
  { id: 'protect', title: 'Add password', hint: 'Lock the file before sharing', category: 'Secure', input: 'pdf', ready: true },
  { id: 'unlock', title: 'Remove password', hint: 'Needs the current password', category: 'Secure', input: 'pdf', ready: true },
  { id: 'flatten', title: 'Flatten', hint: 'Make form fields read-only', category: 'Secure', input: 'pdf', ready: true },
  { id: 'remove-annotations', title: 'Remove markup', hint: 'Strip highlights and notes', category: 'Secure', input: 'pdf', ready: true },

  // Optimize
  { id: 'compress', title: 'Compress', hint: 'Shrink the file for email', category: 'Optimize', input: 'pdf', ready: true },
  { id: 'grayscale', title: 'Grayscale', hint: 'Drop colour to save space', category: 'Optimize', input: 'pdf', ready: true },
];

export const CATEGORIES: Category[] = ['Read', 'Create', 'Organize', 'Convert', 'Edit', 'Secure', 'Optimize'];

export const findTool = (id: string) => TOOLS.find(t => t.id === id);
