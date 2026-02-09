// System fields for column mapping
export interface SystemField {
  key: string;
  label: string;
  required: boolean;
  dbColumn: string;
}

export const SYSTEM_FIELDS: SystemField[] = [
  { key: "client_name", label: "Client Name", required: true, dbColumn: "client_name" },
  { key: "market_region", label: "Market / Region", required: true, dbColumn: "market_region" },
  { key: "roof_group", label: "Roof Group", required: false, dbColumn: "roof_group" },
  { key: "building_code", label: "Building Code", required: false, dbColumn: "building_code" },
  { key: "stop_number", label: "Stop Number", required: false, dbColumn: "stop_number" },
  { key: "property_name", label: "Property Name", required: true, dbColumn: "property_name" },
  { key: "address", label: "Address", required: true, dbColumn: "address" },
  { key: "city", label: "City", required: true, dbColumn: "city" },
  { key: "state", label: "State", required: true, dbColumn: "state" },
  { key: "zip_code", label: "Zip Code", required: true, dbColumn: "zip_code" },
  { key: "scheduled_week", label: "Scheduled Week", required: false, dbColumn: "scheduled_week" },
  { key: "inspector_name", label: "Inspector Name", required: false, dbColumn: "inspector_name" },
  { key: "square_footage", label: "Square Footage", required: false, dbColumn: "square_footage" },
  { key: "roof_access", label: "Roof Access Type", required: false, dbColumn: "roof_access" },
  { key: "access_location", label: "Access Location", required: false, dbColumn: "access_location" },
  { key: "codes_notes", label: "Codes / Notes", required: false, dbColumn: "codes_notes" },
];

// Fuzzy matching keywords per system field
const FUZZY_MAP: Record<string, string[]> = {
  client_name: ["client", "customer", "company", "owner"],
  market_region: ["market", "region", "metro", "area", "location"],
  roof_group: ["roof group", "roofgroup", "group", "portfolio"],
  building_code: ["building code", "buildingcode", "code", "bldg code", "id"],
  stop_number: ["stop", "stop number", "stop #", "stop no", "#"],
  property_name: ["property", "property name", "building", "building name", "name", "site"],
  address: ["address", "street", "street address"],
  city: ["city", "town"],
  state: ["state", "st"],
  zip_code: ["zip", "zip code", "zipcode", "postal", "postal code"],
  scheduled_week: ["scheduled", "week", "inspection date", "date", "schedule"],
  inspector_name: ["inspector", "inspector name", "assigned", "tech", "technician"],
  square_footage: ["square footage", "sqft", "sq ft", "sf", "square feet", "footage", "size"],
  roof_access: ["roof access", "access type", "access method", "roof access type"],
  access_location: ["access location", "access", "location description", "directions"],
  codes_notes: ["codes", "notes", "gate", "lock", "special", "comments"],
};

export function fuzzyMatchColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedHeaders = new Set<string>();

  // Normalize a string for matching
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();

  // Score how well a header matches a field's keywords
  const score = (header: string, keywords: string[]): number => {
    const h = norm(header);
    for (const kw of keywords) {
      if (h === kw) return 100;
      if (h.includes(kw) || kw.includes(h)) return 80;
    }
    // Token overlap
    const hTokens = h.split(/\s+/);
    const maxOverlap = keywords.reduce((best, kw) => {
      const kwTokens = kw.split(/\s+/);
      const overlap = hTokens.filter((t) => kwTokens.includes(t)).length;
      return Math.max(best, overlap / Math.max(hTokens.length, kwTokens.length));
    }, 0);
    return maxOverlap > 0.4 ? maxOverlap * 60 : 0;
  };

  // First pass: exact/high-confidence matches
  for (const field of SYSTEM_FIELDS) {
    const keywords = FUZZY_MAP[field.key] ?? [norm(field.label)];
    let bestHeader = "";
    let bestScore = 30; // minimum threshold

    for (const header of headers) {
      if (usedHeaders.has(header)) continue;
      const s = score(header, keywords);
      if (s > bestScore) {
        bestScore = s;
        bestHeader = header;
      }
    }

    if (bestHeader) {
      mapping[field.key] = bestHeader;
      usedHeaders.add(bestHeader);
    }
  }

  return mapping;
}

// Smart detection for special conditions
export interface DetectedFlags {
  requires_advance_notice: boolean;
  requires_escort: boolean;
  special_equipment: string[];
  is_priority: boolean;
}

export function detectFlags(row: Record<string, string>, scheduledWeekKey?: string): DetectedFlags {
  const allText = Object.values(row).join(" ").toLowerCase();
  const scheduledWeek = scheduledWeekKey ? (row[scheduledWeekKey] ?? "").toLowerCase() : "";

  const flags: DetectedFlags = {
    requires_advance_notice: false,
    requires_escort: false,
    special_equipment: [],
    is_priority: false,
  };

  // Advance notice
  if (/24[\s-]*hour|advance\s*notice/i.test(allText)) {
    flags.requires_advance_notice = true;
  }

  // Escort
  if (/escort|check\s*in|security\s*(desk)?|photo\s*id/i.test(allText)) {
    flags.requires_escort = true;
  }

  // Equipment
  const equipmentPatterns: [RegExp, string][] = [
    [/little\s*giant/i, "Little Giant Ladder"],
    [/step\s*ladder/i, "Step Ladder"],
    [/drone/i, "Drone"],
    [/\b(\d+)['\s]*(?:foot|ft)?\s*ladder/i, "Ladder"],
    [/8[']\s*ladder/i, "8' Ladder"],
    [/10[']\s*ladder/i, "10' Ladder"],
    [/32[']\s*ladder/i, "32' Ladder"],
  ];

  for (const [pattern, name] of equipmentPatterns) {
    const match = allText.match(pattern);
    if (match) {
      if (name === "Ladder" && match[1]) {
        flags.special_equipment.push(`${match[1]}' Ladder`);
      } else {
        flags.special_equipment.push(name);
      }
    }
  }
  // Deduplicate
  flags.special_equipment = [...new Set(flags.special_equipment)];

  // Priority
  if (/priority/i.test(scheduledWeek)) {
    flags.is_priority = true;
  }

  return flags;
}

// Classify roof access type from description
export function classifyRoofAccess(description: string): string {
  const d = description.toLowerCase();
  if (/roof\s*hatch/i.test(d)) return "roof_hatch";
  if (/exterior\s*ladder/i.test(d)) return "exterior_ladder";
  if (/interior\s*(ladder|roof\s*hatch)/i.test(d)) return "interior_ladder";
  if (/ground\s*level/i.test(d)) return "ground_level";
  return "other";
}

export interface ParsedBuilding {
  client_name: string;
  market_region: string;
  roof_group: string;
  building_code: string;
  stop_number: string;
  property_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  scheduled_week: string;
  inspector_name: string;
  square_footage: number | null;
  roof_access_type: string;
  roof_access_description: string;
  access_location: string;
  lock_gate_codes: string;
  special_notes: string;
  requires_advance_notice: boolean;
  requires_escort: boolean;
  special_equipment: string[];
  is_priority: boolean;
  _warnings: string[];
}

export function mapRowToBuilding(
  row: Record<string, string>,
  mapping: Record<string, string>
): ParsedBuilding {
  const get = (key: string) => {
    const header = mapping[key];
    if (!header) return "";
    return (row[header] ?? "").toString().trim();
  };

  const flags = detectFlags(row, mapping.scheduled_week);
  const roofAccessDesc = get("roof_access");
  const accessLocation = get("access_location");
  const codesNotes = get("codes_notes");

  // Combine access/codes/notes for full picture
  const combinedNotes = [accessLocation, codesNotes].filter(Boolean).join(" | ");

  const sqft = parseInt(get("square_footage").replace(/[^0-9]/g, ""), 10);

  const warnings: string[] = [];
  if (!get("address")) warnings.push("Missing address");
  if (!get("property_name")) warnings.push("Missing property name");
  if (!get("city")) warnings.push("Missing city");
  if (!get("state")) warnings.push("Missing state");
  if (!get("zip_code")) warnings.push("Missing zip code");

  return {
    client_name: get("client_name"),
    market_region: get("market_region"),
    roof_group: get("roof_group"),
    building_code: get("building_code"),
    stop_number: get("stop_number"),
    property_name: get("property_name"),
    address: get("address"),
    city: get("city"),
    state: get("state"),
    zip_code: get("zip_code"),
    scheduled_week: get("scheduled_week"),
    inspector_name: get("inspector_name"),
    square_footage: isNaN(sqft) ? null : sqft,
    roof_access_type: classifyRoofAccess(roofAccessDesc),
    roof_access_description: roofAccessDesc,
    access_location: accessLocation,
    lock_gate_codes: codesNotes,
    special_notes: combinedNotes,
    requires_advance_notice: flags.requires_advance_notice,
    requires_escort: flags.requires_escort,
    special_equipment: flags.special_equipment,
    is_priority: flags.is_priority,
    _warnings: warnings,
  };
}
