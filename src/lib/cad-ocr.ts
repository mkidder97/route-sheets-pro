import Tesseract from "tesseract.js";

// ── Regex patterns ──────────────────────────────────────────────────────────

const SF_REGEX =
  /(?:ROOF\s*)?SQ\.?\s*FT\.?\s*[=:]\s*(\d[\d,]*)|(\d[\d,]*)\s*(?:sf|sq\.?\s*ft|square\s*feet|sqft)/i;

// ── Public types ────────────────────────────────────────────────────────────

export interface OcrResult {
  extractedSF: number | null;
  rawText: string;
  titleBlockFields: TitleBlockFields;
}

export interface TitleBlockFields {
  project: string | null;
  address: string | null;
  customer: string | null;
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

// ── Image helpers ───────────────────────────────────────────────────────────

/**
 * Load a File/Blob into an HTMLImageElement (off-screen).
 */
function loadImage(src: Blob | File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      resolve(img);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(src);
  });
}

/**
 * Crop a percentage-based region from an image, apply grayscale + contrast
 * boost, and optionally upscale if the crop is small.
 *
 * @param file   Source image
 * @param xPct   Left edge as 0-1 fraction
 * @param yPct   Top edge as 0-1 fraction
 * @param wPct   Width as 0-1 fraction
 * @param hPct   Height as 0-1 fraction
 */
async function cropRegion(
  file: File | Blob,
  xPct: number,
  yPct: number,
  wPct: number,
  hPct: number
): Promise<Blob> {
  const img = await loadImage(file instanceof Blob ? file : file);
  const sx = Math.round(img.naturalWidth * xPct);
  const sy = Math.round(img.naturalHeight * yPct);
  const sw = Math.round(img.naturalWidth * wPct);
  const sh = Math.round(img.naturalHeight * hPct);

  // Upscale factor: if crop width < 800px, scale up
  const scale = sw < 800 ? 2 : 1;

  const canvas = document.createElement("canvas");
  canvas.width = sw * scale;
  canvas.height = sh * scale;
  const ctx = canvas.getContext("2d")!;

  // Draw cropped region
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);

  // Grayscale + contrast boost
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imageData.data;
  const contrast = 1.5;
  const intercept = 128 * (1 - contrast);
  for (let i = 0; i < d.length; i += 4) {
    // Luminance
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    // Contrast stretch
    const val = Math.max(0, Math.min(255, gray * contrast + intercept));
    d[i] = d[i + 1] = d[i + 2] = val;
  }
  ctx.putImageData(imageData, 0, 0);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Canvas toBlob failed"))), "image/png");
  });
}

// ── OCR ─────────────────────────────────────────────────────────────────────

/**
 * Run Tesseract on a blob with sparse-text PSM, falling back to block mode
 * if too little text is returned.
 */
async function recognizeBlob(blob: Blob): Promise<string> {
  const first = await Tesseract.recognize(blob, "eng", {
    logger: () => {},
  });
  const text = first.data.text.trim();

  // Fallback: if very little text, retry with different config
  if (text.length < 20) {
    const second = await Tesseract.recognize(blob, "eng", {
      logger: () => {},
    });
    return second.data.text.trim();
  }
  return text;
}

/**
 * OCR a CAD image by cropping to relevant regions first.
 *
 * 1. Bottom-right 40% x 45% → title block (project, address, customer)
 * 2. Bottom 25% full-width strip → square footage value
 */
export async function ocrImage(imageFile: File): Promise<OcrResult> {
  // Crop both regions in parallel
  const [titleBlockBlob, bottomStripBlob] = await Promise.all([
    cropRegion(imageFile, 0.6, 0.55, 0.4, 0.45), // bottom-right quadrant
    cropRegion(imageFile, 0.0, 0.75, 1.0, 0.25), // bottom strip full-width
  ]);

  // OCR both in parallel
  const [titleBlockText, bottomStripText] = await Promise.all([
    recognizeBlob(titleBlockBlob),
    recognizeBlob(bottomStripBlob),
  ]);

  const rawText = titleBlockText + "\n" + bottomStripText;

  // Extract SF
  const match = rawText.match(SF_REGEX);
  const extractedSF = match
    ? parseInt((match[1] || match[2]).replace(/,/g, ""), 10) || null
    : null;

  // Extract structured fields
  const titleBlockFields = extractTitleBlockFields(rawText);

  return { extractedSF, rawText, titleBlockFields };
}

// ── Title block field extraction ────────────────────────────────────────────

export function extractTitleBlockFields(rawText: string): TitleBlockFields {
  let project: string | null = null;
  let address: string | null = null;
  let customer: string | null = null;

  // Project: line
  const projectMatch = rawText.match(/Project\s*[:\-]\s*(.+)/i);
  if (projectMatch) {
    project = projectMatch[1].trim();
  }

  // Customer: line
  const customerMatch = rawText.match(/Customer\s*[:\-]\s*(.+)/i);
  if (customerMatch) {
    customer = customerMatch[1].trim();
  }

  // Address: look for a line with street number + road keywords + city/state/zip
  const addressRegex =
    /(\d{1,6}\s+[\w.\s]+(?:road|rd|street|st|avenue|ave|boulevard|blvd|drive|dr|lane|ln|way|parkway|pkwy|circle|cir|court|ct|place|pl|highway|hwy)[\s,]*[\w\s]*,?\s*[A-Z]{2}\s*\d{5}(?:-\d{4})?)/i;
  const addrMatch = rawText.match(addressRegex);
  if (addrMatch) {
    address = addrMatch[1].trim();
  }

  return { project, address, customer };
}

// ── Matching ────────────────────────────────────────────────────────────────

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export function compareSF(extracted: number, stored: number): "match" | "mismatch" {
  const tolerance = stored * 0.1;
  return Math.abs(extracted - stored) <= tolerance ? "match" : "mismatch";
}

/**
 * Given OCR text (and structured title-block fields) plus a list of buildings,
 * find the best-matching building.
 */
export function matchBuilding(
  rawText: string,
  buildings: BuildingCandidate[],
  titleBlockFields?: TitleBlockFields
): { building: BuildingCandidate | null; confidence: "high" | "low" | "none" } {
  const normalizedText = normalize(rawText);
  const fields = titleBlockFields ?? extractTitleBlockFields(rawText);

  const COMMON_WORDS = new Set([
    "center", "park", "building", "plaza", "tower", "suite",
    "north", "south", "east", "west", "drive", "road", "street",
    "avenue", "lane", "court", "place", "way", "unit",
  ]);

  let bestMatch: BuildingCandidate | null = null;
  let bestScore = 0;
  let bestHadStructured = false;

  for (const b of buildings) {
    let score = 0;
    let hadStructuredMatch = false;
    const normName = normalize(b.property_name);
    const normAddr = normalize(b.address);

    // ── Structured field matching (high-value signals) ──

    // Project name vs property_name
    if (fields.project) {
      const normProject = normalize(fields.project);
      if (normName.length > 3 && normProject.includes(normName)) {
        score += 12;
        hadStructuredMatch = true;
      } else if (normProject.length > 3 && normName.includes(normProject)) {
        score += 12;
        hadStructuredMatch = true;
      } else {
        // Word overlap between project and property name
        const projWords = normProject.split(" ").filter((w) => w.length > 2);
        const nameWords = normName.split(" ").filter((w) => w.length > 2);
        const overlap = projWords.filter((pw) => nameWords.some((nw) => nw === pw || pw.includes(nw) || nw.includes(pw)));
        if (overlap.length >= 2) { score += 8; hadStructuredMatch = true; }
        else if (overlap.length === 1) { score += 4; hadStructuredMatch = true; }
      }
    }

    // Structured address vs building address
    if (fields.address) {
      const normExtAddr = normalize(fields.address);
      if (normExtAddr.includes(normAddr) || normAddr.includes(normExtAddr)) {
        score += 10;
        hadStructuredMatch = true;
      } else {
        const extParts = normExtAddr.split(" ");
        const bldParts = normAddr.split(" ");
        if (extParts[0] && bldParts[0] && extParts[0] === bldParts[0]) {
          score += 4;
          hadStructuredMatch = true;
          const extStreet = extParts.slice(1);
          const bldStreet = bldParts.slice(1);
          const streetOverlap = extStreet.filter((w) => w.length > 2 && bldStreet.includes(w));
          score += Math.min(streetOverlap.length * 2, 6);
        }
      }
    }

    // Customer name vs property_name
    if (fields.customer) {
      const normCust = normalize(fields.customer);
      if (normName.includes(normCust) || normCust.includes(normName)) {
        score += 5;
        hadStructuredMatch = true;
      }
    }

    // ── Fallback: raw text word matching ──

    if (score < 6) {
      // Full property name in raw text
      if (normName.length > 3 && normalizedText.includes(normName)) {
        score += 10;
      } else {
        // Filter out common words, require 4+ chars
        const nameWords = normName.split(" ").filter((w) => w.length > 3 && !COMMON_WORDS.has(w));
        const wordMatches = nameWords.filter((w) => normalizedText.includes(w));
        // Only award points if 2+ significant words match
        if (wordMatches.length >= 2) {
          score += wordMatches.length * 2;
        }
      }

      // Address in raw text
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
    }

    if (score > bestScore) {
      bestScore = score;
      bestMatch = b;
      bestHadStructured = hadStructuredMatch;
    }
  }

  // High confidence requires structured field contribution
  if (bestScore >= 8 && bestHadStructured) return { building: bestMatch, confidence: "high" };
  if (bestScore >= 3) return { building: bestMatch, confidence: "low" };
  return { building: null, confidence: "none" };
}
