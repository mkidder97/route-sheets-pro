const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const DELAY_MS = 1100; // Nominatim requires max 1 request/second

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface GeocodingResult {
  buildingId: string;
  latitude: number | null;
  longitude: number | null;
  success: boolean;
}

export async function geocodeAddress(
  address: string,
  city: string,
  state: string,
  zipCode: string
): Promise<{ lat: number; lng: number } | null> {
  const query = `${address}, ${city}, ${state} ${zipCode}`;
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

export async function geocodeBuildingsBatch(
  buildings: Array<{ id: string; address: string; city: string; state: string; zip_code: string }>,
  onProgress?: (completed: number, total: number) => void
): Promise<GeocodingResult[]> {
  const results: GeocodingResult[] = [];
  for (let i = 0; i < buildings.length; i++) {
    const b = buildings[i];
    const coords = await geocodeAddress(b.address, b.city, b.state, b.zip_code);
    results.push({
      buildingId: b.id,
      latitude: coords?.lat ?? null,
      longitude: coords?.lng ?? null,
      success: coords !== null,
    });
    onProgress?.(i + 1, buildings.length);
    if (i < buildings.length - 1) await delay(DELAY_MS);
  }
  return results;
}
