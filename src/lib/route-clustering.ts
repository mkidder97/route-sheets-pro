import type { Tables } from '@/integrations/supabase/types';
import { loadZipCentroids, getCoordinates, haversineDistance, estimateRouteDistance } from './geo-utils';

export interface ClusterBuilding {
  id: string;
  property_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  square_footage: number | null;
  roof_access_type: string | null;
  is_priority: boolean;
  requires_advance_notice: boolean;
  requires_escort: boolean;
  special_equipment: string[] | null;
  lat: number | null;
  lng: number | null;
}

export interface DayCluster {
  dayNumber: number;
  buildings: ClusterBuilding[];
  estimatedDistanceMiles: number;
}

function toBuildingWithCoords(b: ClusterBuilding) {
  return { id: b.id, lat: b.lat, lng: b.lng };
}

export async function generateClusters(
  buildings: Tables<'buildings'>[],
  buildingsPerDay: number,
  startLocation?: string
): Promise<{ clusters: DayCluster[]; unresolved: string[] }> {
  const centroids = await loadZipCentroids();
  const unresolved: string[] = [];

  // Map buildings to ClusterBuilding with resolved coordinates
  const mapped: ClusterBuilding[] = buildings.map((b) => {
    let lat = b.latitude;
    let lng = b.longitude;

    if (lat == null || lng == null) {
      const coords = getCoordinates(centroids, b.zip_code);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
      } else {
        unresolved.push(b.zip_code);
      }
    }

    return {
      id: b.id,
      property_name: b.property_name,
      address: b.address,
      city: b.city,
      state: b.state,
      zip_code: b.zip_code,
      square_footage: b.square_footage,
      roof_access_type: b.roof_access_type,
      is_priority: b.is_priority ?? false,
      requires_advance_notice: b.requires_advance_notice ?? false,
      requires_escort: b.requires_escort ?? false,
      special_equipment: b.special_equipment,
      lat,
      lng,
    };
  });

  // Resolve start location coordinates if provided
  let startCoords: { lat: number; lng: number } | null = null;
  if (startLocation) {
    // Check if it's a zip code (5 digits)
    const zipMatch = startLocation.match(/\b(\d{5})\b/);
    if (zipMatch) {
      const coords = getCoordinates(centroids, zipMatch[1]);
      if (coords) startCoords = coords;
    }
  }

  // Sort ALL buildings by nearest-neighbor geography (no priority/notice separation)
  const sorted = greedyNearestNeighbor([...mapped], startCoords);

  // Slice into daily chunks
  const dayChunks: ClusterBuilding[][] = [];
  for (let i = 0; i < sorted.length; i += buildingsPerDay) {
    dayChunks.push(sorted.slice(i, i + buildingsPerDay));
  }

  // Bias priority-heavy chunks toward early days
  dayChunks.sort((a, b) => {
    const countA = a.filter((x) => x.is_priority).length;
    const countB = b.filter((x) => x.is_priority).length;
    return countB - countA;
  });

  // Re-apply nearest-neighbor within each daily chunk for optimal stop order
  const refined = dayChunks.map((chunk) => nearestNeighborChain(chunk, startCoords));

  const clusters: DayCluster[] = refined.map((chunk, i) => {
    const stops = chunk.map(toBuildingWithCoords);
    // Include distance from start location to first stop for every day
    let startToFirst = 0;
    if (startCoords && stops.length > 0 && stops[0].lat != null && stops[0].lng != null) {
      startToFirst = haversineDistance(startCoords.lat, startCoords.lng, stops[0].lat, stops[0].lng);
    }
    return {
      dayNumber: i + 1,
      buildings: chunk,
      estimatedDistanceMiles: Math.round((startToFirst + estimateRouteDistance(stops)) * 10) / 10,
    };
  });

  return { clusters, unresolved: [...new Set(unresolved)] };
}

function greedyNearestNeighbor(buildings: ClusterBuilding[], startCoords?: { lat: number; lng: number } | null): ClusterBuilding[] {
  return nearestNeighborChain(buildings, startCoords);
}

function nearestNeighborChain(buildings: ClusterBuilding[], startCoords?: { lat: number; lng: number } | null): ClusterBuilding[] {
  if (buildings.length <= 1) return buildings;

  const remaining = [...buildings];

  // If start coords provided, sort by distance from start; otherwise start from northernmost
  if (startCoords) {
    remaining.sort((a, b) => {
      const distA = (a.lat != null && a.lng != null) ? haversineDistance(startCoords.lat, startCoords.lng, a.lat, a.lng) : Infinity;
      const distB = (b.lat != null && b.lng != null) ? haversineDistance(startCoords.lat, startCoords.lng, b.lat, b.lng) : Infinity;
      return distA - distB;
    });
  } else {
    remaining.sort((a, b) => (b.lat ?? 0) - (a.lat ?? 0));
  }
  const result: ClusterBuilding[] = [remaining.shift()!];

  while (remaining.length > 0) {
    const last = result[result.length - 1];
    if (last.lat == null || last.lng == null) {
      result.push(remaining.shift()!);
      continue;
    }

    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const candidate = remaining[i];
      if (candidate.lat == null || candidate.lng == null) continue;
      const dist = haversineDistance(last.lat, last.lng, candidate.lat, candidate.lng);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    result.push(remaining.splice(bestIdx, 1)[0]);
  }

  return result;
}
