import * as XLSX from "xlsx";
import type { DayData, DocumentMetadata, BuildingData } from "./pdf-generator";

function formatAccessType(t: string | null): string {
  if (!t) return "";
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildingRow(b: BuildingData, stopNumber?: number, dayNumber?: number) {
  const equipment = (b.special_equipment || []).map((e) => e.toLowerCase());
  const needsLadder = equipment.some((e) => e.includes("ladder") || e.includes("little giant"));
  const needsCadCore = equipment.some((e) => e.includes("cad") || e.includes("core") || e.includes("key"));
  const otherEquipment = (b.special_equipment || []).filter((e) => {
    const l = e.toLowerCase();
    return !l.includes("ladder") && !l.includes("little giant") && !l.includes("cad") && !l.includes("core") && !l.includes("key");
  });

  const base: Record<string, string | number> = {};
  if (dayNumber !== undefined) {
    base["Day"] = dayNumber;
  }

  return {
    ...base,
    "Stop #": stopNumber ?? b.stop_order,
    "Property Name": b.property_name,
    Address: b.address,
    City: b.city,
    State: b.state,
    Zip: b.zip_code,
    SF: b.square_footage || "",
    "Market/Group": b.roof_group || "",
    "Bldg Code": b.building_code || "",
    Priority: b.is_priority ? "YES" : "",
    "Access Type": formatAccessType(b.roof_access_type),
    "Access Location": b.access_location || "",
    "Codes (Lock/Gate)": b.lock_gate_codes || "",
    "Needs Escort": b.requires_escort ? "YES" : "",
    "24H Notice": b.requires_advance_notice ? "YES" : "",
    "Needs Ladder": needsLadder ? "YES" : "",
    "Needs CAD/Core": needsCadCore ? "YES" : "",
    "Other Equipment": otherEquipment.join(", "),
    "PM Name": b.property_manager_name || "",
    "PM Phone": b.property_manager_phone || "",
    "PM Email": b.property_manager_email || "",
    Notes: b.special_notes || "",
  };
}

const detailColWidths = [
  { wch: 7 },  // Stop #
  { wch: 24 }, // Property Name
  { wch: 28 }, // Address
  { wch: 16 }, // City
  { wch: 6 },  // State
  { wch: 8 },  // Zip
  { wch: 10 }, // SF
  { wch: 14 }, // Market/Group
  { wch: 10 }, // Bldg Code
  { wch: 8 },  // Priority
  { wch: 16 }, // Access Type
  { wch: 40 }, // Access Location
  { wch: 28 }, // Codes (Lock/Gate)
  { wch: 12 }, // Needs Escort
  { wch: 12 }, // 24H Notice
  { wch: 12 }, // Needs Ladder
  { wch: 14 }, // Needs CAD/Core
  { wch: 18 }, // Other Equipment
  { wch: 20 }, // PM Name
  { wch: 16 }, // PM Phone
  { wch: 24 }, // PM Email
  { wch: 70 }, // Notes
];

const allBuildingsColWidths = [
  { wch: 6 },  // Day
  ...detailColWidths,
];

export function generateInspectorExcel(
  days: DayData[],
  meta: DocumentMetadata
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const allRows = days.flatMap((day, dayIdx) =>
    day.buildings.map((b, i) => buildingRow(b, i + 1, dayIdx + 1))
  );

  const ws = XLSX.utils.json_to_sheet(allRows);
  ws["!cols"] = allBuildingsColWidths;

  const sheetName = meta.inspectorName
    ? meta.inspectorName.substring(0, 31)
    : "Schedule";

  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  return wb;
}
