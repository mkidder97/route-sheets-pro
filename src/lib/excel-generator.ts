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
    const rows = day.buildings.map((b) => ({
      "Stop #": b.stop_order,
      "Property Name": b.property_name,
      Address: `${b.address}, ${b.city}, ${b.state} ${b.zip_code}`,
      SF: b.square_footage || "",
      "Market/Group": b.roof_group || "",
      "Bldg Code": b.building_code || "",
      "Access Type": formatAccessType(b.roof_access_type),
      "Access Location": b.access_location || "",
      Codes: b.lock_gate_codes || "",
      "Special Req": getSpecialReq(b),
      Notes: b.special_notes || "",
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 7 }, { wch: 22 }, { wch: 30 }, { wch: 10 },
      { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 30 },
      { wch: 25 }, { wch: 20 }, { wch: 25 },
    ];
    XLSX.utils.book_append_sheet(wb, ws, dayLabel);
  }

  return wb;
}
