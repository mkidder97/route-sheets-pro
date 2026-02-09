import * as XLSX from "xlsx";
import { format } from "date-fns";
import type { DayData, DocumentMetadata, BuildingData } from "./pdf-generator";

function formatAccessType(t: string | null): string {
  if (!t) return "";
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getSpecialReq(b: BuildingData): string {
  const parts: string[] = [];
  if (b.is_priority) parts.push("PRIORITY");
  if (b.requires_advance_notice) parts.push("24H NOTICE");
  if (b.requires_escort) parts.push("ESCORT REQ");
  if (b.special_equipment?.length) parts.push(b.special_equipment.join(", "));
  return parts.join(" | ");
}

export function generateInspectorExcel(
  days: DayData[],
  meta: DocumentMetadata
): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Summary tab
  const summaryData = days.map((d) => {
    const cities = [...new Set(d.buildings.map((b) => b.city))].join(", ");
    const totalSF = d.buildings.reduce((s, b) => s + (b.square_footage || 0), 0);
    return {
      Day: `Day ${d.day_number}`,
      Date: d.day_date ? format(new Date(d.day_date + "T00:00:00"), "EEE, MMM d") : "",
      "# Buildings": d.buildings.length,
      Cities: cities,
      "Total SF": totalSF,
      "Has Priority": d.buildings.some((b) => b.is_priority) ? "YES" : "",
      "Est. Miles": d.estimated_distance_miles ?? "",
    };
  });

  const summaryWs = XLSX.utils.json_to_sheet(summaryData);
  summaryWs["!cols"] = [
    { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 30 },
    { wch: 12 }, { wch: 12 }, { wch: 10 },
  ];
  XLSX.utils.book_append_sheet(wb, summaryWs, "Summary");

  // Per-day tabs
  for (const day of days) {
    const dayLabel = `Day ${day.day_number}`;
    const rows = day.buildings.map((b) => {
      // Break out equipment into recognizable flags
      const equipment = (b.special_equipment || []).map((e) => e.toLowerCase());
      const needsLadder = equipment.some((e) => e.includes("ladder") || e.includes("little giant"));
      const needsCadCore = equipment.some((e) => e.includes("cad") || e.includes("core") || e.includes("key"));
      const otherEquipment = (b.special_equipment || []).filter((e) => {
        const l = e.toLowerCase();
        return !l.includes("ladder") && !l.includes("little giant") && !l.includes("cad") && !l.includes("core") && !l.includes("key");
      });

      return {
        "Stop #": b.stop_order,
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
        "24H Advance Notice": b.requires_advance_notice ? "YES" : "",
        "Needs Ladder": needsLadder ? "YES" : "",
        "Needs CAD/Core": needsCadCore ? "YES" : "",
        "Other Equipment": otherEquipment.join(", "),
        Notes: b.special_notes || "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
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
      { wch: 32 }, // Access Location
      { wch: 28 }, // Codes (Lock/Gate)
      { wch: 12 }, // Needs Escort
      { wch: 16 }, // 24H Advance Notice
      { wch: 12 }, // Needs Ladder
      { wch: 14 }, // Needs CAD/Core
      { wch: 18 }, // Other Equipment
      { wch: 30 }, // Notes
    ];
    XLSX.utils.book_append_sheet(wb, ws, dayLabel);
  }

  return wb;
}
