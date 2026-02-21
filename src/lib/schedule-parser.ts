import { startOfWeek, parse, isValid } from "date-fns";

// ─── Schedule-specific fields for column mapping ────────────────────────────

export interface ScheduleField {
  key: string;
  label: string;
  required: boolean;
}

export const SCHEDULE_FIELDS: ScheduleField[] = [
  { key: "building_code", label: "Building Code", required: false },
  { key: "property_name", label: "Property Name", required: false },
  { key: "address", label: "Address", required: true },
  { key: "city", label: "City", required: false },
  { key: "scheduled_week", label: "Scheduled Week / Inspection Date", required: true },
  { key: "inspector_name", label: "Inspector Name", required: false },
];

// ─── Fuzzy matching for schedule headers ────────────────────────────────────

const SCHEDULE_FUZZY_MAP: Record<string, string[]> = {
  building_code: ["building code", "buildingcode", "code", "bldg code", "bldg", "id"],
  property_name: ["property", "property name", "building", "building name", "name", "site"],
  address: ["address", "street", "street address"],
  city: ["city", "town"],
  scheduled_week: ["scheduled", "week", "inspection date", "date", "schedule", "scheduled week"],
  inspector_name: ["inspector", "inspector name", "assigned", "tech", "technician"],
};

export function fuzzyMatchScheduleColumns(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedHeaders = new Set<string>();
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();

  const score = (header: string, keywords: string[]): number => {
    const h = norm(header);
    for (const kw of keywords) {
      if (h === kw) return 100;
      if (h.includes(kw) || kw.includes(h)) return 80;
    }
    const hTokens = h.split(/\s+/);
    const maxOverlap = keywords.reduce((best, kw) => {
      const kwTokens = kw.split(/\s+/);
      const overlap = hTokens.filter((t) => kwTokens.includes(t)).length;
      return Math.max(best, overlap / Math.max(hTokens.length, kwTokens.length));
    }, 0);
    return maxOverlap > 0.4 ? maxOverlap * 60 : 0;
  };

  for (const field of SCHEDULE_FIELDS) {
    const keywords = SCHEDULE_FUZZY_MAP[field.key] ?? [norm(field.label)];
    let bestHeader = "";
    let bestScore = 30;

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

// ─── Date parsing ───────────────────────────────────────────────────────────

export interface ParsedWeek {
  date: string; // ISO YYYY-MM-DD (Monday of that week)
  isPriority: boolean;
}

export function parseScheduledWeek(text: string): ParsedWeek | null {
  if (!text) return null;
  let raw = String(text).trim();

  // Detect priority
  const isPriority = /priority/i.test(raw);
  raw = raw.replace(/priority\s*(inspection)?/gi, "").trim();

  // Strip "Week of" prefix
  raw = raw.replace(/^week\s+of\s*/i, "").trim();

  // Strip trailing day-of-week like "Monday", "Mon" etc.
  raw = raw.replace(/\s*(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\s*$/i, "").trim();

  // Try parsing various date formats
  let parsed: Date | null = null;
  const formats = [
    "MM/dd/yyyy", "M/d/yyyy", "MM-dd-yyyy", "M-d-yyyy",
    "yyyy-MM-dd", "MM/dd/yy", "M/d/yy",
  ];

  for (const fmt of formats) {
    const d = parse(raw, fmt, new Date());
    if (isValid(d) && d.getFullYear() > 2000) {
      parsed = d;
      break;
    }
  }

  // Also try native Date as last resort
  if (!parsed) {
    const d = new Date(raw);
    if (isValid(d) && d.getFullYear() > 2000) {
      parsed = d;
    }
  }

  if (!parsed) return null;

  // Get Monday of that week
  const monday = startOfWeek(parsed, { weekStartsOn: 1 });
  const iso = monday.toISOString().slice(0, 10);

  return { date: iso, isPriority };
}

// ─── Address normalization ──────────────────────────────────────────────────

export function normalizeAddress(addr: string): string {
  return addr.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

// ─── Inspector matching ────────────────────────────────────────────────────

export function matchInspector(
  uploadedName: string,
  inspectors: { id: string; name: string }[]
): { id: string; name: string } | null {
  if (!uploadedName?.trim()) return null;
  const norm = (s: string) => s.toLowerCase().trim();

  // Pass 1: exact match
  const exact = inspectors.find((i) => norm(i.name) === norm(uploadedName));
  if (exact) return exact;

  // Pass 2: last-name fallback
  const uploadedLast = norm(uploadedName).split(/[\s,]+/).pop() || "";
  if (uploadedLast.length <= 1) return null;

  const lastNameMatches = inspectors.filter((i) => {
    const inspLast = norm(i.name).split(/\s+/).pop() || "";
    return inspLast === uploadedLast;
  });

  return lastNameMatches.length === 1 ? lastNameMatches[0] : null;
}
