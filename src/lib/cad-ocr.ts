import Tesseract from "tesseract.js";

const SF_REGEX = /(\d[\d,]*)\s*(?:sf|sq\.?\s*ft|square\s*feet|sqft)/i;

export interface OcrResult {
  extractedSF: number | null;
  rawText: string;
}

export async function extractSquareFootage(imageFile: File): Promise<OcrResult> {
  const { data } = await Tesseract.recognize(imageFile, "eng", {
    logger: () => {},
  });

  const rawText = data.text;
  const match = rawText.match(SF_REGEX);

  if (!match) {
    return { extractedSF: null, rawText };
  }

  const parsed = parseInt(match[1].replace(/,/g, ""), 10);
  return { extractedSF: isNaN(parsed) ? null : parsed, rawText };
}

export function compareSF(extracted: number, stored: number): "match" | "mismatch" {
  const tolerance = stored * 0.1;
  return Math.abs(extracted - stored) <= tolerance ? "match" : "mismatch";
}
