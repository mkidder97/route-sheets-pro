import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";

export interface BuildingData {
  id: string;
  stop_order: number;
  property_name: string;
  address: string;
  city: string;
  state: string;
  zip_code: string;
  square_footage: number | null;
  roof_group: string | null;
  building_code: string | null;
  roof_access_type: string | null;
  access_location: string | null;
  lock_gate_codes: string | null;
  is_priority: boolean | null;
  requires_advance_notice: boolean | null;
  requires_escort: boolean | null;
  special_equipment: string[] | null;
  special_notes: string | null;
}

export interface DayData {
  day_number: number;
  day_date: string;
  estimated_distance_miles: number | null;
  buildings: BuildingData[];
}

export interface DocumentMetadata {
  clientName: string;
  regionName: string;
  inspectorName: string;
  startDate: string;
  endDate: string;
}

function formatSF(sf: number | null): string {
  if (!sf) return "—";
  return sf.toLocaleString();
}

function formatAccessType(t: string | null): string {
  if (!t) return "—";
  return t.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function getSpecialReq(b: BuildingData): string {
  const parts: string[] = [];
  if (b.is_priority) parts.push("PRIORITY");
  if (b.requires_advance_notice) parts.push("24H NOTICE");
  if (b.requires_escort) parts.push("ESCORT REQ");
  if (b.special_equipment?.length) parts.push(b.special_equipment.join(", "));
  return parts.join(" | ") || "—";
}

export function generateInspectorPDF(
  days: DayData[],
  meta: DocumentMetadata
): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();

  const totalBuildings = days.reduce((s, d) => s + d.buildings.length, 0);
  const priorityCount = days.reduce(
    (s, d) => s + d.buildings.filter((b) => b.is_priority).length,
    0
  );

  // ── COVER PAGE ──
  // Logo placeholder
  doc.setFillColor(240, 240, 240);
  doc.roundedRect(pageW / 2 - 60, 80, 120, 60, 8, 8, "F");
  doc.setFontSize(10);
  doc.setTextColor(160, 160, 160);
  doc.text("LOGO", pageW / 2, 115, { align: "center" });

  doc.setTextColor(30, 30, 30);
  doc.setFontSize(28);
  doc.text(`${meta.clientName}`, pageW / 2, 200, { align: "center" });
  doc.setFontSize(16);
  doc.setTextColor(80, 80, 80);
  doc.text("Roof Inspection Schedule", pageW / 2, 228, { align: "center" });

  doc.setDrawColor(200, 200, 200);
  doc.line(pageW / 2 - 100, 248, pageW / 2 + 100, 248);

  doc.setFontSize(18);
  doc.setTextColor(50, 50, 50);
  doc.text(meta.regionName, pageW / 2, 280, { align: "center" });

  doc.setFontSize(14);
  doc.text(`Inspector: ${meta.inspectorName}`, pageW / 2, 320, { align: "center" });

  const startFormatted = format(new Date(meta.startDate + "T00:00:00"), "MMMM d, yyyy");
  const endFormatted = format(new Date(meta.endDate + "T00:00:00"), "MMMM d, yyyy");
  doc.setFontSize(13);
  doc.setTextColor(100, 100, 100);
  doc.text(`${startFormatted} — ${endFormatted}`, pageW / 2, 355, { align: "center" });

  doc.setFontSize(12);
  doc.setTextColor(50, 50, 50);
  doc.text(`Total Buildings: ${totalBuildings}`, pageW / 2, 400, { align: "center" });
  if (priorityCount > 0) {
    doc.setTextColor(200, 50, 50);
    doc.text(`Priority Inspections: ${priorityCount}`, pageW / 2, 420, { align: "center" });
  }

  doc.setFontSize(9);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated ${format(new Date(), "MMM d, yyyy h:mm a")}`, pageW / 2, pageH - 40, {
    align: "center",
  });

  // ── SUMMARY PAGE ──
  doc.addPage("letter", "portrait");
  doc.setFontSize(18);
  doc.setTextColor(30, 30, 30);
  doc.text("Schedule Summary", 40, 50);

  // Day-by-day table
  const summaryRows = days.map((d) => {
    const cities = [...new Set(d.buildings.map((b) => b.city))].join(", ");
    const totalSF = d.buildings.reduce((s, b) => s + (b.square_footage || 0), 0);
    const hasPriority = d.buildings.some((b) => b.is_priority);
    const notes: string[] = [];
    if (d.buildings.some((b) => b.requires_advance_notice)) notes.push("Advance notice");
    if (d.buildings.some((b) => b.requires_escort)) notes.push("Escort needed");
    return [
      `Day ${d.day_number}`,
      d.day_date ? format(new Date(d.day_date + "T00:00:00"), "EEE, MMM d") : "—",
      String(d.buildings.length),
      cities,
      formatSF(totalSF),
      hasPriority ? "YES" : "",
      notes.join(", "),
    ];
  });

  autoTable(doc, {
    startY: 65,
    head: [["Day", "Date", "# Bldgs", "Cities", "Total SF", "Priority", "Notes"]],
    body: summaryRows,
    styles: { fontSize: 9, cellPadding: 4 },
    headStyles: { fillColor: [50, 50, 50], textColor: 255, fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 245] },
    columnStyles: {
      0: { cellWidth: 45 },
      2: { cellWidth: 45, halign: "center" },
      4: { cellWidth: 60, halign: "right" },
      5: { cellWidth: 50, halign: "center" },
    },
  });

  let cursorY = (doc as any).lastAutoTable?.finalY || 200;

  // Advance notice list
  const noticeBuildings = days.flatMap((d) =>
    d.buildings.filter((b) => b.requires_advance_notice).map((b) => ({
      ...b,
      dayNumber: d.day_number,
      dayDate: d.day_date,
    }))
  );

  if (noticeBuildings.length > 0) {
    cursorY += 20;
    doc.setFontSize(13);
    doc.setTextColor(180, 120, 0);
    doc.text("⚠ Buildings Requiring 24-Hour Advance Notice", 40, cursorY);
    cursorY += 5;

    autoTable(doc, {
      startY: cursorY,
      head: [["Day", "Property", "Address", "Phone/Notes"]],
      body: noticeBuildings.map((b) => [
        `Day ${b.dayNumber}`,
        b.property_name,
        `${b.address}, ${b.city}`,
        b.special_notes || "—",
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [200, 150, 30], textColor: 255 },
    });
    cursorY = (doc as any).lastAutoTable?.finalY || cursorY + 50;
  }

  // Escort list
  const escortBuildings = days.flatMap((d) =>
    d.buildings.filter((b) => b.requires_escort).map((b) => ({
      ...b,
      dayNumber: d.day_number,
    }))
  );

  if (escortBuildings.length > 0) {
    cursorY += 20;
    doc.setFontSize(13);
    doc.setTextColor(120, 60, 180);
    doc.text("🔒 Buildings Requiring Escort / Security Check-in", 40, cursorY);
    cursorY += 5;

    autoTable(doc, {
      startY: cursorY,
      head: [["Day", "Property", "Address", "Notes"]],
      body: escortBuildings.map((b) => [
        `Day ${b.dayNumber}`,
        b.property_name,
        `${b.address}, ${b.city}`,
        b.special_notes || "—",
      ]),
      styles: { fontSize: 9, cellPadding: 3 },
      headStyles: { fillColor: [120, 60, 180], textColor: 255 },
    });
    cursorY = (doc as any).lastAutoTable?.finalY || cursorY + 50;
  }

  // Equipment checklist
  const allEquipment = new Set<string>();
  days.forEach((d) =>
    d.buildings.forEach((b) =>
      b.special_equipment?.forEach((e) => allEquipment.add(e))
    )
  );

  if (allEquipment.size > 0) {
    cursorY += 20;
    if (cursorY > pageH - 100) {
      doc.addPage("letter", "portrait");
      cursorY = 50;
    }
    doc.setFontSize(13);
    doc.setTextColor(30, 30, 30);
    doc.text("Equipment Checklist", 40, cursorY);
    cursorY += 15;
    doc.setFontSize(10);
    [...allEquipment].forEach((eq) => {
      doc.rect(45, cursorY - 8, 8, 8);
      doc.text(eq, 60, cursorY);
      cursorY += 16;
    });
  }

  // ── DAILY ROUTE SHEETS (landscape) ──
  for (const day of days) {
    doc.addPage("letter", "landscape");
    const lw = doc.internal.pageSize.getWidth();

    const dateStr = day.day_date
      ? format(new Date(day.day_date + "T00:00:00"), "EEEE, MMMM d, yyyy")
      : "";
    const cities = [...new Set(day.buildings.map((b) => b.city))].join(", ");

    doc.setFontSize(14);
    doc.setTextColor(30, 30, 30);
    doc.text(`Day ${day.day_number} — ${dateStr} — ${cities}`, 30, 35);

    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text(
      `${day.buildings.length} buildings | ~${day.estimated_distance_miles ?? "?"} miles`,
      lw - 30,
      35,
      { align: "right" }
    );

    const body = day.buildings.map((b) => [
      String(b.stop_order),
      b.property_name,
      `${b.address}\n${b.city}, ${b.state} ${b.zip_code}`,
      formatSF(b.square_footage),
      b.roof_group || "—",
      b.building_code || "—",
      formatAccessType(b.roof_access_type),
      b.access_location || "—",
      b.lock_gate_codes || "—",
      getSpecialReq(b),
      b.special_notes || "—",
    ]);

    // Column widths: total landscape letter ~756pt usable
    // Stop(5%) Prop(12%) Addr(13%) SF(5%) Mkt(6%) Code(6%) AccType(7%) AccLoc(16%) Codes(12%) Spec(9%) Notes(9%)
    const usable = lw - 60;
    const cw = (pct: number) => usable * pct;

    autoTable(doc, {
      startY: 50,
      head: [
        [
          "Stop",
          "Property Name",
          "Address",
          "SF",
          "Market/Group",
          "Bldg Code",
          "Access Type",
          "Access Location",
          "Codes",
          "Special Req",
          "Notes",
        ],
      ],
      body,
      styles: {
        fontSize: 9,
        cellPadding: 3,
        overflow: "linebreak",
        minCellHeight: 20,
        lineWidth: 0.25,
        lineColor: [200, 200, 200],
      },
      headStyles: {
        fillColor: [50, 50, 50],
        textColor: 255,
        fontStyle: "bold",
        fontSize: 8,
      },
      alternateRowStyles: { fillColor: [248, 248, 248] },
      columnStyles: {
        0: { cellWidth: cw(0.05), halign: "center" },
        1: { cellWidth: cw(0.12) },
        2: { cellWidth: cw(0.13) },
        3: { cellWidth: cw(0.05), halign: "right" },
        4: { cellWidth: cw(0.06) },
        5: { cellWidth: cw(0.06) },
        6: { cellWidth: cw(0.07) },
        7: { cellWidth: cw(0.16), fontStyle: "bold" },
        8: { cellWidth: cw(0.12), fontStyle: "bold" },
        9: { cellWidth: cw(0.09) },
        10: { cellWidth: cw(0.09) },
      },
      didParseCell(data) {
        if (data.section !== "body") return;
        const row = day.buildings[data.row.index];
        if (!row) return;

        // Special Req column coloring
        if (data.column.index === 9) {
          const text = String(data.cell.raw || "");
          if (text.includes("PRIORITY")) {
            data.cell.styles.textColor = [200, 30, 30];
            data.cell.styles.fontStyle = "bold";
          } else if (text.includes("24H NOTICE")) {
            data.cell.styles.textColor = [180, 120, 0];
            data.cell.styles.fontStyle = "bold";
          } else if (text.includes("ESCORT")) {
            data.cell.styles.textColor = [120, 60, 180];
            data.cell.styles.fontStyle = "bold";
          }
        }

        // Priority row left border
        if (row.is_priority && data.column.index === 0) {
          data.cell.styles.fillColor = [255, 235, 235];
        }
      },
      margin: { left: 30, right: 30 },
    });

    // Footer
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    const ph = doc.internal.pageSize.getHeight();
    doc.text(
      `${meta.clientName} — ${meta.regionName} — ${meta.inspectorName}`,
      30,
      ph - 15
    );
    doc.text(
      `Day ${day.day_number} of ${days.length}`,
      lw - 30,
      ph - 15,
      { align: "right" }
    );
  }

  // ── BACK PAGE ──
  doc.addPage("letter", "portrait");
  const bpW = doc.internal.pageSize.getWidth();
  const bpH = doc.internal.pageSize.getHeight();

  doc.setFontSize(18);
  doc.setTextColor(30, 30, 30);
  doc.text("Field Notes", 40, 50);

  doc.setDrawColor(200, 200, 200);
  for (let y = 80; y < bpH - 180; y += 28) {
    doc.line(40, y, bpW - 40, y);
  }

  // Emergency contacts
  const boxY = bpH - 160;
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(40, boxY, bpW - 80, 120, 4, 4, "F");

  doc.setFontSize(11);
  doc.setTextColor(50, 50, 50);
  doc.text("Emergency Contacts", 55, boxY + 20);

  doc.setFontSize(9);
  doc.setTextColor(100, 100, 100);
  doc.text("Operations Manager: ________________________  Phone: ________________________", 55, boxY + 40);
  doc.text("Regional Supervisor: ________________________  Phone: ________________________", 55, boxY + 58);
  doc.text("Client Contact: ________________________  Phone: ________________________", 55, boxY + 76);

  doc.setFontSize(10);
  doc.setTextColor(200, 50, 50);
  doc.text("Report any access issues to operations immediately.", 55, boxY + 100);

  return doc;
}
