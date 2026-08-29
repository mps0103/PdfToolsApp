import DocumentScanner from 'react-native-document-scanner-plugin';
import { PickedFile } from './files';

/**
 * Google's ML Kit scanner handles edge detection, perspective correction and
 * retakes in its own activity, so there is no camera UI to build here.
 */
export async function scanDocument(maxPages = 20): Promise<PickedFile[]> {
  const { scannedImages } = await DocumentScanner.scanDocument({
    maxNumDocuments: maxPages,
    croppedImageQuality: 90,
  });

  if (!scannedImages?.length) return [];

  return scannedImages.map((uri, i) => ({
    uri,
    name: `scan-${i + 1}.jpg`,
    type: 'image/jpeg',
    size: null,
  }));
}
