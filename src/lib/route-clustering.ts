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
  buildingsPerDay: number
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

  // Separate priority from regular
  const priority = mapped.filter((b) => b.is_priority);
  const regular = mapped.filter((b) => !b.is_priority);

  // Sort by 3-digit zip prefix, then apply greedy nearest-neighbor
  const sorted = greedyNearestNeighbor([...regular]);

  // Merge priority buildings into the sorted list at geographically sensible positions
  const merged = insertPriorityBuildings(sorted, priority);

  // Group advance-notice buildings together where possible
  const reordered = groupAdvanceNotice(merged);

  // Slice into daily chunks
  const dayChunks: ClusterBuilding[][] = [];
  for (let i = 0; i < reordered.length; i += buildingsPerDay) {
    dayChunks.push(reordered.slice(i, i + buildingsPerDay));
  }

  // Refine: within each chunk, prefer same access types together
  const refined = dayChunks.map((chunk) => refineByAccessType(chunk));

  const clusters: DayCluster[] = refined.map((chunk, i) => ({
    dayNumber: i + 1,
    buildings: chunk,
    estimatedDistanceMiles: estimateRouteDistance(chunk.map(toBuildingWithCoords)),
  }));

  return { clusters, unresolved: [...new Set(unresolved)] };
}

function greedyNearestNeighbor(buildings: ClusterBuilding[]): ClusterBuilding[] {
  if (buildings.length <= 1) return buildings;

  // Primary sort by 3-digit zip prefix to create regional groups
  buildings.sort((a, b) => {
    const prefixA = a.zip_code.substring(0, 3);
    const prefixB = b.zip_code.substring(0, 3);
    if (prefixA !== prefixB) return prefixA.localeCompare(prefixB);
    return 0;
  });

  // Within each prefix group, apply nearest-neighbor
  const groups = new Map<string, ClusterBuilding[]>();
  for (const b of buildings) {
    const prefix = b.zip_code.substring(0, 3);
    if (!groups.has(prefix)) groups.set(prefix, []);
    groups.get(prefix)!.push(b);
  }

  const result: ClusterBuilding[] = [];
  for (const group of groups.values()) {
    result.push(...nearestNeighborChain(group));
  }

  return result;
}

function nearestNeighborChain(buildings: ClusterBuilding[]): ClusterBuilding[] {
  if (buildings.length <= 1) return buildings;

  const remaining = [...buildings];
  // Start from northernmost building
  remaining.sort((a, b) => (b.lat ?? 0) - (a.lat ?? 0));
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

function insertPriorityBuildings(
  sorted: ClusterBuilding[],
  priority: ClusterBuilding[]
): ClusterBuilding[] {
  if (priority.length === 0) return sorted;

  const result = [...sorted];

  for (const pb of priority) {
    if (pb.lat == null || pb.lng == null) {
      // No coords — insert at beginning
      result.unshift(pb);
      continue;
    }

    // Find the closest building in the sorted list
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < result.length; i++) {
      const b = result[i];
      if (b.lat == null || b.lng == null) continue;
      const dist = haversineDistance(pb.lat, pb.lng, b.lat, b.lng);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }
    result.splice(bestIdx, 0, pb);
  }

  return result;
}

function groupAdvanceNotice(buildings: ClusterBuilding[]): ClusterBuilding[] {
  // Move advance-notice buildings to even-numbered positions in the sequence
  // so they fall on days with a buffer day before them
  const notice = buildings.filter((b) => b.requires_advance_notice);
  const rest = buildings.filter((b) => !b.requires_advance_notice);

  if (notice.length === 0) return buildings;

  // Interleave: put notice buildings later in the sequence
  return [...rest, ...notice];
}

function refineByAccessType(chunk: ClusterBuilding[]): ClusterBuilding[] {
  // Within a day's chunk, group by access type for fewer equipment swaps
  return [...chunk].sort((a, b) => {
    const typeA = a.roof_access_type ?? 'zzz';
    const typeB = b.roof_access_type ?? 'zzz';
    return typeA.localeCompare(typeB);
  });
}
