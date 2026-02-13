import Tesseract from "tesseract.js";

const SF_REGEX = /(\d[\d,]*)\s*(?:sf|sq\.?\s*ft|square\s*feet|sqft)/i;

export interface OcrResult {
  extractedSF: number | null;
  rawText: string;
}

export async function ocrImage(imageFile: File): Promise<OcrResult> {
  const { data } = await Tesseract.recognize(imageFile, "eng", {
    logger: () => {},
  });

  const rawText = data.text;
  const match = rawText.match(SF_REGEX);
  const extractedSF = match
    ? parseInt(match[1].replace(/,/g, ""), 10) || null
    : null;

  return { extractedSF, rawText };
}

export function compareSF(extracted: number, stored: number): "match" | "mismatch" {
  const tolerance = stored * 0.1;
  return Math.abs(extracted - stored) <= tolerance ? "match" : "mismatch";
}

/**
 * Normalize a string for fuzzy matching: lowercase, strip punctuation, collapse whitespace.
 */
function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export interface BuildingCandidate {
  id: string;
  property_name: string;
  address: string;
}

export interface CadMatch {
  file: File;
  matchedBuilding: BuildingCandidate | null;
  confidence: "high" | "low" | "none";
  extractedSF: number | null;
  rawText: string;
}

/**
 * Given OCR text and a list of buildings, find the best-matching building.
 * Uses substring matching on normalized text against property name and address.
 */
export function matchBuilding(
  rawText: string,
  buildings: BuildingCandidate[]
): { building: BuildingCandidate | null; confidence: "high" | "low" | "none" } {
  const normalizedText = normalize(rawText);

  // Score each building
  let bestMatch: BuildingCandidate | null = null;
  let bestScore = 0;

  for (const b of buildings) {
    let score = 0;
    const normName = normalize(b.property_name);
    const normAddr = normalize(b.address);

    // Check property name match
    if (normName.length > 3 && normalizedText.includes(normName)) {
      score += 10;
    } else {
      // Try matching significant words from property name
      const nameWords = normName.split(" ").filter((w) => w.length > 3);
      const wordMatches = nameWords.filter((w) => normalizedText.includes(w));
      score += wordMatches.length * 3;
    }

    // Check address match (street number + street name)
    const addrParts = normAddr.split(" ");
    if (addrParts.length >= 2) {
      const streetNum = addrParts[0];
      const streetName = addrParts.slice(1).join(" ");
      if (normalizedText.includes(streetNum) && normalizedText.includes(streetName)) {
        score += 8;
      } else if (normalizedText.includes(streetNum)) {
        score += 2;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = b;
    }
  }

  if (bestScore >= 8) return { building: bestMatch, confidence: "high" };
  if (bestScore >= 3) return { building: bestMatch, confidence: "low" };
  return { building: null, confidence: "none" };
}
