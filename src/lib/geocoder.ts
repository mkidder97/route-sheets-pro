import { loadZipCentroids, getCoordinates } from "./geo-utils";

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const DELAY_MS = 1100; // Nominatim requires max 1 request/second

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Address simplification helpers ---

const ABBREVIATION_MAP: Record<string, string> = {
  rd: "Road",
  dr: "Drive",
  blvd: "Boulevard",
  pkwy: "Parkway",
  ln: "Lane",
  ct: "Court",
  ave: "Avenue",
  st: "Street",
  pl: "Place",
  cir: "Circle",
  trl: "Trail",
  hwy: "Highway",
  ter: "Terrace",
  expy: "Expressway",
  ind: "Industrial",
  bldg: "",
  ste: "",
  spc: "",
};

/**
 * Simplify an address for a second geocoding attempt:
 * - Remove parenthetical text
 * - Remove "Bldg", "Building", "Suite", "Ste", "Unit", "Apt" + their numbers
 * - Expand common abbreviations (Rd → Road, etc.)
 */
export function simplifyAddress(address: string): string {
  let s = address;

  // Remove parenthetical text
  s = s.replace(/\([^)]*\)/g, "");

  // Remove building/suite/unit identifiers and their numbers
  s = s.replace(/\b(building|bldg\.?|suite|ste\.?|unit|apt\.?|spc\.?|#)\s*\S*/gi, "");

  // Expand abbreviations (word-boundary match, case-insensitive)
  s = s.replace(/\b([A-Za-z]+)\.?\b/g, (match, word) => {
    const lower = word.toLowerCase().replace(/\.$/, "");
    const expanded = ABBREVIATION_MAP[lower];
    if (expanded !== undefined) return expanded;
    return match;
  });

  // Collapse extra whitespace
  s = s.replace(/\s{2,}/g, " ").trim();

  // Remove trailing commas or dots
  s = s.replace(/[,.\s]+$/, "").trim();

  return s;
}

// --- Geocoding types ---

export interface GeocodingResult {
  buildingId: string;
  latitude: number | null;
  longitude: number | null;
  success: boolean;
  source?: "nominatim" | "zip_centroid";
}

// --- Core geocoding ---

async function nominatimQuery(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(
      `${NOMINATIM_URL}?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=us`,
      { headers: { "User-Agent": "RoofRoute/1.0 (roof-inspection-app)" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (data.length === 0) return null;
    return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
  } catch {
    return null;
  }
}

/**
 * Geocode an address with two Nominatim attempts:
 * 1. Full address
 * 2. Simplified address (abbreviations expanded, unit numbers stripped)
 */
export async function geocodeAddress(
  address: string,
  city: string,
  state: string,
  zipCode: string
): Promise<{ lat: number; lng: number } | null> {
  // Attempt 1: full address
  const fullQuery = `${address}, ${city}, ${state} ${zipCode}`;
  const result = await nominatimQuery(fullQuery);
  if (result) return result;

  // Attempt 2: simplified address
  const simplified = simplifyAddress(address);
  if (simplified !== address && simplified.length > 0) {
    await delay(DELAY_MS);
    const simplifiedQuery = `${simplified}, ${city}, ${state} ${zipCode}`;
    return nominatimQuery(simplifiedQuery);
  }

  return null;
}

/**
 * Batch geocode buildings with Nominatim (full + simplified),
 * then fall back to zip code centroids for any remaining failures.
 */
export async function geocodeBuildingsBatch(
  buildings: Array<{ id: string; address: string; city: string; state: string; zip_code: string }>,
  onProgress?: (completed: number, total: number) => void
): Promise<GeocodingResult[]> {
  const results: GeocodingResult[] = [];

  // Phase 1: Nominatim (full + simplified retry)
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const coords = await geocodeAddress(b.address, b.city, b.state, b.zip_code);
    results.push({
      buildingId: b.id,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      success: coords !== null,
      source: coords ? "nominatim" : undefined,
    });
    onProgress?.(i + 1, buildings.length);
    if (i < buildings.length - 1) await delay(DELAY_MS);
  }

  // Phase 2: Zip centroid fallback for failures
  const failures = results.filter((r) => !r.success);
  if (failures.length > 0) {
    const centroids = await loadZipCentroids();
    const buildingMap = new Map(buildings.map((b) => [b.id, b]));

    for (const result of failures) {
      const building = buildingMap.get(result.buildingId);
      if (!building) continue;
      const centroid = getCoordinates(centroids, building.zip_code);
      if (centroid) {
        result.latitude = centroid.lat;
        result.longitude = centroid.lng;
        result.success = true;
        result.source = "zip_centroid";
      }
    }
  }

  return results;
}
