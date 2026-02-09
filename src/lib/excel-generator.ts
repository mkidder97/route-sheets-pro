import * as XLSX from "xlsx";
import { format } from "date-fns";
import type { DayData, DocumentMetadata, BuildingData } from "./pdf-generator";

function formatAccessType(t: string | null): string {
  if (!t) return "";
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildingRow(b: BuildingData, stopNumber?: number) {
  const equipment = (b.special_equipment || []).map((e) => e.toLowerCase());
  const needsLadder = equipment.some((e) => e.includes("ladder") || e.includes("little giant"));
  const needsCadCore = equipment.some((e) => e.includes("cad") || e.includes("core") || e.includes("key"));
  const otherEquipment = (b.special_equipment || []).filter((e) => {
    const l = e.toLowerCase();
    return !l.includes("ladder") && !l.includes("little giant") && !l.includes("cad") && !l.includes("core") && !l.includes("key");
  });

  return {
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

export function generateInspectorExcel(
  days: DayData[],
  meta: DocumentMetadata
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Flatten all buildings across all days and sort by geography
  const allBuildings = days.flatMap((d) => d.buildings);

  allBuildings.sort((a, b) => {
    const stateComp = (a.state || "").localeCompare(b.state || "");
    if (stateComp !== 0) return stateComp;
    const cityComp = (a.city || "").localeCompare(b.city || "");
    if (cityComp !== 0) return cityComp;
    const zipComp = (a.zip_code || "").localeCompare(b.zip_code || "");
    if (zipComp !== 0) return zipComp;
    return (a.property_name || "").localeCompare(b.property_name || "");
  });

  const allRows = allBuildings.map((b, idx) => buildingRow(b, idx + 1));

  const mainWs = XLSX.utils.json_to_sheet(allRows);
  mainWs["!cols"] = detailColWidths;

  XLSX.utils.book_append_sheet(wb, mainWs, "Route Schedule");

  return wb;
}
