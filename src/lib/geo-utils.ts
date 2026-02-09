type CentroidMap = Record<string, [number, number]>;

let centroidCache: CentroidMap | null = null;

export async function loadZipCentroids(): Promise<CentroidMap> {
  if (centroidCache) return centroidCache;
  const data = await import('../data/us-zip-centroids.json');
  centroidCache = data.default as unknown as CentroidMap;
  return centroidCache;
}

export function getCoordinates(
  centroids: CentroidMap,
  zipCode: string
): { lat: number; lng: number } | null {
  const normalized = zipCode.replace(/\D/g, '').padStart(5, '0');
  const entry = centroids[normalized];
  if (!entry) {
    console.warn(`Zip code ${normalized} not found in centroid dataset`);
    return null;
  }
  return { lat: entry[0], lng: entry[1] };
}

const EARTH_RADIUS_MILES = 3958.8;

export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_MILES * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface BuildingWithCoords {
  id: string;
  lat: number | null;
  lng: number | null;
  [key: string]: unknown;
}

export function estimateRouteDistance(buildings: BuildingWithCoords[]): number {
  let total = 0;
  for (let i = 1; i < buildings.length; i++) {
    const prev = buildings[i - 1];
    const curr = buildings[i];
    if (prev.lat != null && prev.lng != null && curr.lat != null && curr.lng != null) {
      total += haversineDistance(prev.lat, prev.lng, curr.lat, curr.lng);
    }
  }
  return Math.round(total * 10) / 10;
}
