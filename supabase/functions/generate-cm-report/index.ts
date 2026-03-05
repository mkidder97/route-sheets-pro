import { createClient } from "npm:@supabase/supabase-js@2";
import { PDFDocument, rgb, StandardFonts } from "npm:pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ── colour helpers ── */
const SRC_GREEN = rgb(0.13, 0.37, 0.18); // dark green
const BLACK = rgb(0, 0, 0);
const WHITE = rgb(1, 1, 1);
const SAGE = rgb(0.66, 0.77, 0.63); // #A8C5A0
const GRAY = rgb(0.4, 0.4, 0.4);

const PAGE_W = 612; // US Letter
const PAGE_H = 792;
const MARGIN = 50;
const CONTENT_W = PAGE_W - MARGIN * 2;

interface Contact {
  name?: string;
  email?: string;
  phone?: string;
  role?: string;
  title?: string;
  organization?: string;
}

/* ── helper: draw text wrapping ── */
function drawWrapped(
  page: any,
  text: string,
  x: number,
  y: number,
  font: any,
  size: number,
  maxW: number,
  color = BLACK,
): number {
  if (!text) return y;
  const words = text.split(/\s+/);
  let line = "";
  let curY = y;
  const lineH = size * 1.4;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(test, size) > maxW && line) {
      page.drawText(line, { x, y: curY, size, font, color });
      curY -= lineH;
      if (curY < MARGIN + 30) {
        return curY; // signal page break needed
      }
      line = word;
    } else {
      line = test;
    }
  }
  if (line) {
    page.drawText(line, { x, y: curY, size, font, color });
    curY -= lineH;
  }
  return curY;
}

/* ── helper: repeating page header ── */
function drawPageHeader(page: any, projectName: string, fontBold: any, font: any) {
  // Project name left
  page.drawText(projectName, {
    x: MARGIN,
    y: PAGE_H - MARGIN,
    size: 10,
    font: fontBold,
    color: SRC_GREEN,
  });
  // SRC right
  const srcW = fontBold.widthOfTextAtSize("SRC", 10);
  page.drawText("SRC", {
    x: PAGE_W - MARGIN - srcW,
    y: PAGE_H - MARGIN,
    size: 10,
    font: fontBold,
    color: SRC_GREEN,
  });
  // Rule
  page.drawLine({
    start: { x: MARGIN, y: PAGE_H - MARGIN - 8 },
    end: { x: PAGE_W - MARGIN, y: PAGE_H - MARGIN - 8 },
    thickness: 1,
    color: SRC_GREEN,
  });
}

/* ── helper: footer ── */
function drawFooter(page: any, visitId: string, font: any) {
  page.drawText("powered by RoofMind", {
    x: MARGIN,
    y: 25,
    size: 7,
    font,
    color: GRAY,
  });
  const idStr = visitId.substring(0, 8);
  const w = font.widthOfTextAtSize(idStr, 7);
  page.drawText(idStr, {
    x: PAGE_W - MARGIN - w,
    y: 25,
    size: 7,
    font,
    color: GRAY,
  });
}

/* ── helper: draw a section label (bold underline) ── */
function drawSectionLabel(
  page: any,
  label: string,
  x: number,
  y: number,
  fontBold: any,
  size = 10,
) {
  page.drawText(label, { x, y, size, font: fontBold, color: BLACK });
  const w = fontBold.widthOfTextAtSize(label, size);
  page.drawLine({
    start: { x, y: y - 2 },
    end: { x: x + w, y: y - 2 },
    thickness: 0.5,
    color: BLACK,
  });
  return y - size * 1.6;
}

/* ── helper: draw contact lines ── */
function drawContacts(
  page: any,
  contacts: Contact[],
  x: number,
  y: number,
  font: any,
  size = 8,
): number {
  let curY = y;
  for (const c of contacts) {
    const nameTitle = [c.name, c.role || c.title].filter(Boolean).join(", ");
    if (nameTitle) {
      page.drawText(nameTitle, { x, y: curY, size, font, color: BLACK });
      curY -= size * 1.4;
    }
    if (c.phone) {
      page.drawText(c.phone, { x, y: curY, size, font, color: BLACK });
      curY -= size * 1.4;
    }
    if (c.email) {
      page.drawText(c.email, { x, y: curY, size, font, color: BLACK });
      curY -= size * 1.4;
    }
    curY -= 4; // gap between contacts
  }
  return curY;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify JWT
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client for data + storage
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { visitId } = await req.json();
    if (!visitId) {
      return new Response(JSON.stringify({ error: "visitId required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Fetch data ──
    const { data: visit, error: visitErr } = await supabase
      .from("cm_visits")
      .select("*")
      .eq("id", visitId)
      .single();
    if (visitErr || !visit) throw new Error("Visit not found");

    const { data: project, error: projErr } = await supabase
      .from("cm_projects")
      .select("*, buildings!inner(property_name, address, city, state, zip_code)")
      .eq("id", visit.cm_project_id)
      .single();
    if (projErr || !project) throw new Error("Project not found");

    let srcAssociateName = "";
    if (visit.src_associate_id) {
      const { data: assoc } = await supabase
        .from("user_profiles")
        .select("full_name")
        .eq("id", visit.src_associate_id)
        .single();
      if (assoc) srcAssociateName = assoc.full_name;
    }

    const { data: sections } = await supabase
      .from("cm_visit_sections")
      .select("*")
      .eq("cm_visit_id", visitId)
      .order("sort_order");

    const { data: photos } = await supabase
      .from("cm_photos")
      .select("*")
      .eq("cm_visit_id", visitId)
      .order("sort_order");

    const bld = (project as any).buildings;
    const ownerContacts: Contact[] = (project.owner_contacts ?? []) as Contact[];
    const contractorContacts: Contact[] = (project.contractor_contacts ?? []) as Contact[];
    const ccList: Contact[] = (project.cc_list ?? []) as Contact[];
    const buildingName = bld?.property_name ?? project.project_name;

    // ── Build PDF ──
    const pdfDoc = await PDFDocument.create();
    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    // ━━ PAGE 1: COVER ━━
    const cover = pdfDoc.addPage([PAGE_W, PAGE_H]);
    let y = PAGE_H - MARGIN;

    // Header line
    const headerLeft = `FIELD OBSERVATION REPORT: #${visit.visit_number}`;
    const headerRight = `DATE: ${formatDate(visit.visit_date)}`;
    cover.drawText(headerLeft, { x: MARGIN, y, size: 11, font: fontBold, color: BLACK });
    const hrW = fontBold.widthOfTextAtSize(headerRight, 11);
    cover.drawText(headerRight, { x: PAGE_W - MARGIN - hrW, y, size: 11, font: fontBold, color: BLACK });
    y -= 18;

    // SRC top right
    const srcLabel = "SRC";
    const srcLabelW = fontBold.widthOfTextAtSize(srcLabel, 14);
    cover.drawText(srcLabel, {
      x: PAGE_W - MARGIN - srcLabelW,
      y: PAGE_H - MARGIN + 14,
      size: 14,
      font: fontBold,
      color: SRC_GREEN,
    });

    // Project name
    const projNameDisplay = project.project_name;
    cover.drawText(projNameDisplay, { x: MARGIN, y, size: 14, font: fontBold, color: SRC_GREEN });
    y -= 14;

    // Rule
    cover.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_W - MARGIN, y },
      thickness: 1.5,
      color: SRC_GREEN,
    });
    y -= 20;

    // Two-column layout
    const colW = CONTENT_W / 2 - 10;
    const rightX = MARGIN + colW + 20;
    let leftY = y;
    let rightY = y;

    // LEFT COLUMN
    // PROJECT
    leftY = drawSectionLabel(cover, "PROJECT", MARGIN, leftY, fontBold);
    cover.drawText(project.project_name, { x: MARGIN, y: leftY, size: 9, font: fontBold, color: BLACK });
    leftY -= 12;
    if (bld) {
      cover.drawText(bld.property_name, { x: MARGIN, y: leftY, size: 8, font: fontRegular, color: BLACK });
      leftY -= 11;
      cover.drawText(bld.address, { x: MARGIN, y: leftY, size: 8, font: fontRegular, color: BLACK });
      leftY -= 11;
      cover.drawText(`${bld.city}, ${bld.state} ${bld.zip_code}`, { x: MARGIN, y: leftY, size: 8, font: fontRegular, color: BLACK });
      leftY -= 16;
    }

    // OWNER
    leftY = drawSectionLabel(cover, "OWNER", MARGIN, leftY, fontBold);
    if (project.owner_company) {
      cover.drawText(project.owner_company, { x: MARGIN, y: leftY, size: 8, font: fontRegular, color: BLACK });
      leftY -= 11;
    }
    if (project.owner_address) {
      cover.drawText(project.owner_address, { x: MARGIN, y: leftY, size: 8, font: fontRegular, color: BLACK });
      leftY -= 11;
    }
    if (project.owner_city_state_zip) {
      cover.drawText(project.owner_city_state_zip, { x: MARGIN, y: leftY, size: 8, font: fontRegular, color: BLACK });
      leftY -= 14;
    }
    if (ownerContacts.length > 0) {
      leftY = drawContacts(cover, ownerContacts, MARGIN, leftY, fontRegular);
      leftY -= 6;
    }

    // ROOF CONSULTANT
    leftY = drawSectionLabel(cover, "ROOF CONSULTANT", MARGIN, leftY, fontBold);
    const srcLines = [
      "Southern Roof Consultants (SRC)",
      "875 Pasadena Avenue S - Suite A",
      "South Pasadena, FL 33707",
      "",
      "John Biggers, President",
      "(727) 362-0116 ext. 205  |  jbiggers@southernroof.biz",
    ];
    for (const line of srcLines) {
      if (!line) { leftY -= 4; continue; }
      cover.drawText(line, { x: MARGIN, y: leftY, size: 8, font: fontRegular, color: BLACK });
      leftY -= 11;
    }
    if (srcAssociateName) {
      leftY -= 4;
      cover.drawText(srcAssociateName, { x: MARGIN, y: leftY, size: 8, font: fontRegular, color: BLACK });
      leftY -= 11;
    }

    // RIGHT COLUMN
    rightY = drawSectionLabel(cover, "ROOFING CONTRACTOR", rightX, rightY, fontBold);
    if (project.contractor_name) {
      cover.drawText(project.contractor_name, { x: rightX, y: rightY, size: 9, font: fontBold, color: BLACK });
      rightY -= 14;
    }
    if (contractorContacts.length > 0) {
      rightY = drawContacts(cover, contractorContacts, rightX, rightY, fontRegular);
    }

    drawFooter(cover, visitId, fontRegular);

    // ━━ CONTENT PAGES ━━
    let contentPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
    drawPageHeader(contentPage, project.project_name, fontBold, fontRegular);
    drawFooter(contentPage, visitId, fontRegular);
    y = PAGE_H - MARGIN - 22;

    // Helper: ensure space, add new page if needed
    const ensureSpace = (needed: number) => {
      if (y < MARGIN + needed) {
        contentPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
        drawPageHeader(contentPage, project.project_name, fontBold, fontRegular);
        drawFooter(contentPage, visitId, fontRegular);
        y = PAGE_H - MARGIN - 22;
      }
    };

    // Weather line
    const weatherParts = [
      `Chance of Rain: ${visit.weather_rain_pct || "—"}`,
      `Winds: ${visit.weather_wind_mph || "—"}`,
      `Temp. Range: ${visit.weather_temp_range || "—"}`,
    ];
    contentPage.drawText(weatherParts.join("     "), {
      x: MARGIN,
      y,
      size: 9,
      font: fontRegular,
      color: BLACK,
    });
    y -= 20;

    // Overview
    ensureSpace(40);
    y = drawSectionLabel(contentPage, "OVERVIEW OF TODAY'S WORK:", MARGIN, y, fontBold, 10);
    y -= 2;
    if (visit.overview_narrative) {
      y = drawWrapped(contentPage, visit.overview_narrative, MARGIN, y, fontRegular, 9, CONTENT_W);
    }
    y -= 14;

    // Checklist sections
    if (sections && sections.length > 0) {
      for (const sec of sections) {
        ensureSpace(60);
        y = drawSectionLabel(contentPage, sec.section_title.toUpperCase(), MARGIN, y, fontBold, 10);
        y -= 2;

        const items = (sec.checklist_items ?? []) as string[];
        for (let i = 0; i < items.length; i++) {
          ensureSpace(16);
          const itemText = `${i + 1}. ${items[i]}`;
          y = drawWrapped(contentPage, itemText, MARGIN + 10, y, fontRegular, 8, CONTENT_W - 10);
        }

        if (sec.notes) {
          ensureSpace(30);
          y -= 4;
          contentPage.drawText("Notes:", { x: MARGIN, y, size: 9, font: fontBold, color: BLACK });
          y -= 12;
          y = drawWrapped(contentPage, sec.notes, MARGIN + 15, y, fontRegular, 8, CONTENT_W - 15);
        }
        y -= 14;
      }
    }

    // ━━ FINAL SUMMARY PAGE ━━
    contentPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
    drawPageHeader(contentPage, project.project_name, fontBold, fontRegular);
    drawFooter(contentPage, visitId, fontRegular);
    y = PAGE_H - MARGIN - 22;

    // Observation of completed work
    y = drawSectionLabel(contentPage, "OBSERVATION OF COMPLETED WORK:", MARGIN, y, fontBold, 10);
    y -= 2;
    const completionLines = [
      `${visit.completion_tpo_delivered_pct ?? 0}% TPO materials delivered on site.`,
      `${visit.completion_membrane_pct ?? 0}% New membrane installed to date (${visit.unit_qty_infill_sf ?? 0} SF).`,
      `${visit.completion_flashing_pct ?? 0}% Flashing details completed to date.`,
      `${visit.completion_sheet_metal_pct ?? 0}% Sheet metal installed to date.`,
    ];
    for (const line of completionLines) {
      contentPage.drawText(line, { x: MARGIN + 10, y, size: 9, font: fontRegular, color: BLACK });
      y -= 13;
    }
    y -= 8;

    // Project schedule
    y = drawSectionLabel(contentPage, "PROJECT SCHEDULE:", MARGIN, y, fontBold, 10);
    y -= 2;
    const schedLines = [
      `${project.contract_completion_date ? formatDate(project.contract_completion_date) : "—"} — ${project.total_contract_days ?? "—"} calendar days.`,
      `${visit.schedule_days_used ?? 0} calendar days used.`,
      `${visit.schedule_weather_days_credited ?? 0} weather/CO days credited.`,
      `${visit.schedule_days_remaining ?? 0} remaining calendar days.`,
    ];
    for (const line of schedLines) {
      contentPage.drawText(line, { x: MARGIN + 10, y, size: 9, font: fontRegular, color: BLACK });
      y -= 13;
    }
    y -= 8;

    // Unit price quantities
    y = drawSectionLabel(contentPage, "UNIT PRICE QUANTITIES INSTALLED TO DATE:", MARGIN, y, fontBold, 10);
    y -= 2;
    const unitLines = [
      `${visit.unit_qty_infill_sf ?? 0} SF roof assembly removal/replacement with in-fill insulation.`,
      `${visit.unit_qty_deck_coating_sf ?? 0} SF rust-inhibiting deck coating.`,
      `${visit.unit_qty_deck_replaced_sf ?? 0} SF steel deck replaced.`,
    ];
    for (const line of unitLines) {
      contentPage.drawText(line, { x: MARGIN + 10, y, size: 9, font: fontRegular, color: BLACK });
      y -= 13;
    }
    y -= 8;

    // General notes
    if (visit.general_notes) {
      y = drawSectionLabel(contentPage, "GENERAL NOTES:", MARGIN, y, fontBold, 10);
      y -= 2;
      y = drawWrapped(contentPage, visit.general_notes, MARGIN + 10, y, fontRegular, 9, CONTENT_W - 10);
      y -= 14;
    }

    // SRC Associate
    if (srcAssociateName) {
      contentPage.drawText(`SRC Associate: ${srcAssociateName}`, {
        x: MARGIN,
        y,
        size: 9,
        font: fontBold,
        color: BLACK,
      });
      y -= 18;
    }

    // CC list
    if (ccList.length > 0) {
      contentPage.drawText("cc:", { x: MARGIN, y, size: 9, font: fontBold, color: BLACK });
      y -= 13;
      for (const c of ccList) {
        const parts = [c.name, c.organization].filter(Boolean);
        const ccLine = parts.join("; ");
        if (ccLine) {
          contentPage.drawText(ccLine, { x: MARGIN + 20, y, size: 8, font: fontRegular, color: BLACK });
          y -= 11;
        }
      }
    }

    // ━━ PHOTO PAGES (2 per page) ━━
    if (photos && photos.length > 0) {
      const PHOTO_W = 200;
      const PHOTO_H = 150;
      const ROW_H = PHOTO_H + 30;
      const COL_NUM_W = 50;
      const COL_DESC_W = 180;
      const COL_PHOTO_X = MARGIN + COL_NUM_W + COL_DESC_W + 10;

      for (let i = 0; i < photos.length; i += 2) {
        const photoPage = pdfDoc.addPage([PAGE_W, PAGE_H]);
        drawPageHeader(photoPage, project.project_name, fontBold, fontRegular);
        drawFooter(photoPage, visitId, fontRegular);
        let py = PAGE_H - MARGIN - 22;

        // Header row
        const headerH = 22;
        photoPage.drawRectangle({
          x: MARGIN,
          y: py - headerH,
          width: CONTENT_W,
          height: headerH,
          color: SAGE,
        });
        photoPage.drawText("Photo #", { x: MARGIN + 5, y: py - 15, size: 9, font: fontBold, color: WHITE });
        photoPage.drawText("Description", { x: MARGIN + COL_NUM_W + 5, y: py - 15, size: 9, font: fontBold, color: WHITE });
        photoPage.drawText("Photo", { x: COL_PHOTO_X + 5, y: py - 15, size: 9, font: fontBold, color: WHITE });
        py -= headerH;

        // Draw up to 2 photos
        for (let j = i; j < Math.min(i + 2, photos.length); j++) {
          const photo = photos[j];

          // Row border
          photoPage.drawRectangle({
            x: MARGIN,
            y: py - ROW_H,
            width: CONTENT_W,
            height: ROW_H,
            borderColor: GRAY,
            borderWidth: 0.5,
            color: WHITE,
          });

          // Photo number
          photoPage.drawText(`${photo.photo_number}`, {
            x: MARGIN + 10,
            y: py - 20,
            size: 9,
            font: fontRegular,
            color: BLACK,
          });

          // Description
          if (photo.description) {
            drawWrapped(
              photoPage,
              photo.description,
              MARGIN + COL_NUM_W + 5,
              py - 15,
              fontRegular,
              8,
              COL_DESC_W - 10,
            );
          }

          // Embed photo image
          try {
            const imgResp = await fetch(photo.public_url);
            if (imgResp.ok) {
              const imgBytes = new Uint8Array(await imgResp.arrayBuffer());
              const contentType = imgResp.headers.get("content-type") || "";
              let image;
              if (contentType.includes("png")) {
                image = await pdfDoc.embedPng(imgBytes);
              } else {
                image = await pdfDoc.embedJpg(imgBytes);
              }
              const scaled = image.scaleToFit(PHOTO_W, PHOTO_H);
              photoPage.drawImage(image, {
                x: COL_PHOTO_X + 5,
                y: py - ROW_H + 10,
                width: scaled.width,
                height: scaled.height,
              });
            }
          } catch (imgErr) {
            console.error(`Failed to embed photo ${photo.photo_number}:`, imgErr);
            photoPage.drawText("[Photo unavailable]", {
              x: COL_PHOTO_X + 10,
              y: py - ROW_H / 2,
              size: 8,
              font: fontRegular,
              color: GRAY,
            });
          }

          py -= ROW_H;
        }
      }
    }

    // ── Save PDF ──
    const pdfBytes = await pdfDoc.save();
    const storagePath = `reports/${visitId}/report.pdf`;

    const { error: uploadErr } = await supabase.storage
      .from("cm-reports")
      .upload(storagePath, pdfBytes, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

    const { data: urlData } = supabase.storage
      .from("cm-reports")
      .getPublicUrl(storagePath);
    const publicUrl = urlData.publicUrl;

    // Update visit record
    const { error: updateErr } = await supabase
      .from("cm_visits")
      .update({ pdf_path: publicUrl, pdf_generated_at: new Date().toISOString() })
      .eq("id", visitId);
    if (updateErr) throw new Error(`Failed to update visit: ${updateErr.message}`);

    // ── Notify Make automation ──
    try {
      await fetch("https://hook.us2.make.com/r5wlvour1t4j8k1wjrdwak11nrnsxh4t", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pdfUrl: publicUrl,
          buildingName,
          projectName: project.project_name,
          visitNumber: visit.visit_number,
          visitDate: formatDate(visit.visit_date),
          clientName: project.owner_company ?? "",
          buildingId: project.building_id,
          suggestedFileName: `FOR_${buildingName.replace(/\s+/g, '_')}_Visit${visit.visit_number}_${formatDate(visit.visit_date).replace(/\//g, '')}.pdf`,
        }),
      });
      console.log("Make webhook triggered successfully");
    } catch (webhookErr) {
      console.error("Make webhook failed (non-fatal):", webhookErr);
    }

    return new Response(
      JSON.stringify({ success: true, pdfUrl: publicUrl }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("generate-cm-report error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
