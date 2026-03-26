import { TextSegment } from '@/types';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { DEFAULT_VOICE, voiceOptions } from './constants';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Serialize Mongoose documents to plain JSON objects (strips ObjectId, Date, etc.)
export const serializeData = <T>(data: T): T => JSON.parse(JSON.stringify(data));

// Auto generate slug
export function generateSlug(text: string): string {
  return text
      .replace(/\.[^/.]+$/, '') // Remove file extension (.pdf, .txt, etc.)
      .toLowerCase() // Convert to lowercase
      .trim() // Remove whitespace from both ends
      // Keep Unicode letters/numbers (including Cyrillic), spaces and hyphens.
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/[\s_]+/g, '-') // Replace spaces and underscores with hyphens
      .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
}

// Escape regex special characters to prevent ReDoS attacks
export const escapeRegex = (str: string): string => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

// Splits text content into segments for MongoDB storage and search
export const splitIntoSegments = (
    text: string,
    segmentSize: number = 500, // Maximum words per segment
    overlapSize: number = 50, // Words to overlap between segments for context
): TextSegment[] => {
  // Validate parameters to prevent infinite loops
  if (segmentSize <= 0) {
    throw new Error('segmentSize must be greater than 0');
  }
  if (overlapSize < 0 || overlapSize >= segmentSize) {
    throw new Error('overlapSize must be >= 0 and < segmentSize');
  }

  const words = text.split(/\s+/).filter((word) => word.length > 0);
  const segments: TextSegment[] = [];

  let segmentIndex = 0;
  let startIndex = 0;

  while (startIndex < words.length) {
    const endIndex = Math.min(startIndex + segmentSize, words.length);
    const segmentWords = words.slice(startIndex, endIndex);
    const segmentText = segmentWords.join(' ');

    segments.push({
      text: segmentText,
      segmentIndex,
      wordCount: segmentWords.length,
    });

    segmentIndex++;

    if (endIndex >= words.length) break;
    startIndex = endIndex - overlapSize;
  }

  return segments;
};

// Get voice data by persona key or voice ID
export const getVoice = (persona?: string) => {
  if (!persona) return voiceOptions[DEFAULT_VOICE];

  // Find by voice ID
  const voiceEntry = Object.values(voiceOptions).find((v) => v.id === persona);
  if (voiceEntry) return voiceEntry;

  // Find by key
  const voiceByKey = voiceOptions[persona as keyof typeof voiceOptions];
  if (voiceByKey) return voiceByKey;

  // Default fallback
  return voiceOptions[DEFAULT_VOICE];
};

// Format duration in seconds to MM:SS format
export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const countMatches = (text: string, regex: RegExp) => (text.match(regex) || []).length;

const normalizeExtractedText = (text: string): string =>
    text
        .replace(/[ \t]+/g, ' ')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

const shouldUseOcrFallback = (text: string): boolean => {
  const sample = text.trim();
  if (sample.length < 80) return false;

  const cyrillicCount = countMatches(sample, /\p{Script=Cyrillic}/gu);
  const latinCount = countMatches(sample, /[A-Za-z]/g);
  const digitCount = countMatches(sample, /\d/g);
  const mixedWords = countMatches(
      sample,
      /\b(?=[\p{L}\d]*\p{Script=Cyrillic})(?=[\p{L}\d]*[A-Za-z])[\p{L}\d]+\b/gu,
  );

  const mostlyLatin = latinCount > cyrillicCount * 2 && latinCount > 40;
  const noisyMixedWords = mixedWords >= 5;
  const suspiciousDigits = digitCount > 0 && digitCount > Math.floor(cyrillicCount / 8);

  return mostlyLatin && (noisyMixedWords || suspiciousDigits);
};

const renderPageToCanvas = async (
    page: {
      getViewport: (cfg: { scale: number }) => { width: number; height: number };
      render: (params: {
        canvasContext: CanvasRenderingContext2D;
        viewport: { width: number; height: number };
      }) => { promise: Promise<void> };
    },
    scale: number,
): Promise<HTMLCanvasElement> => {
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;

  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Could not get canvas context');
  }

  await page.render({ canvasContext: context, viewport }).promise;
  return canvas;
};

export async function parsePDFFile(file: File) {
  let ocrWorker:
      | {
          recognize: (image: HTMLCanvasElement) => Promise<{ data: { text: string } }>;
          terminate: () => Promise<void>;
        }
      | null = null;

  try {
    const pdfjsLib = await import('pdfjs-dist');
    const pdfVersion = (pdfjsLib as unknown as { version?: string }).version ?? '4.10.38';

    if (typeof window !== 'undefined') {
      pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          'pdfjs-dist/build/pdf.worker.min.mjs',
          import.meta.url,
      ).toString();
    }

    // Read file as array buffer
    const arrayBuffer = await file.arrayBuffer();

    // Load PDF document (try with cMaps/fonts first for better extraction).
    let pdfDocument;
    try {
      const loadingTask = pdfjsLib.getDocument({
        data: arrayBuffer,
        cMapUrl: `https://unpkg.com/pdfjs-dist@${pdfVersion}/cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `https://unpkg.com/pdfjs-dist@${pdfVersion}/standard_fonts/`,
        useSystemFonts: true,
      });
      pdfDocument = await loadingTask.promise;
    } catch {
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      pdfDocument = await loadingTask.promise;
    }

    // Render first page as cover image
    const firstPage = await pdfDocument.getPage(1);
    const coverCanvas = await renderPageToCanvas(firstPage, 2);
    const coverDataURL = coverCanvas.toDataURL('image/png');

    // Extract text from all pages
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      let pageText = textContent.items
          .filter((item) => 'str' in item)
          .map((item) => (item as { str: string }).str)
          .join(' ');

      if (shouldUseOcrFallback(pageText)) {
        if (!ocrWorker) {
          const { createWorker } = await import('tesseract.js');
          ocrWorker = await createWorker('rus+eng');
        }

        const pageCanvas = await renderPageToCanvas(page, 2);
        const ocrResult = await ocrWorker.recognize(pageCanvas);
        const ocrText = normalizeExtractedText(ocrResult.data?.text ?? '');

        if (ocrText.length > Math.max(40, Math.floor(pageText.length * 0.4))) {
          pageText = ocrText;
        }
      }

      fullText += normalizeExtractedText(pageText) + '\n';
    }

    // Split text into segments for search
    const segments = splitIntoSegments(fullText);

    await pdfDocument.destroy();
    if (ocrWorker) {
      await ocrWorker.terminate();
      ocrWorker = null;
    }

    return {
      content: segments,
      cover: coverDataURL,
    };
  } catch (error) {
    console.error('Error parsing PDF:', error);
    throw new Error(`Failed to parse PDF file: ${error instanceof Error ? error.message : String(error)}`);
  } finally {
    if (ocrWorker) {
      await ocrWorker.terminate();
    }
  }
}
