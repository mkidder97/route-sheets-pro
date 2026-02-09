

# Inspector Document Generator -- Full Build

## Overview
Build the complete document generation system on the Schedules page. This produces professional, field-ready PDF packets that inspectors carry for 2-week periods. Includes a "Generate All" batch mode that creates a ZIP file containing one PDF per inspector.

## New Dependencies
- **jspdf** -- client-side PDF generation
- **jspdf-autotable** -- professional table rendering with text wrapping, alternating rows, styling
- **jszip** -- bundle multiple PDFs into a single ZIP download
- **file-saver** -- trigger browser downloads for generated files

## Database Migration
Create a `generated_documents` table to track generation history:

```text
generated_documents
--------------------
id              uuid PK
route_plan_id   uuid FK -> route_plans (nullable)
client_id       uuid FK -> clients
region_id       uuid FK -> regions
inspector_id    uuid FK -> inspectors (nullable, null for batch)
format          text ('pdf' | 'excel')
file_name       text
created_at      timestamptz
```

RLS policy: allow all operations (public, matching existing table patterns).

## Files to Create

### 1. `src/lib/pdf-generator.ts`
Core PDF generation using jsPDF + jspdf-autotable.

**Cover Page (portrait):**
- Client name, region, inspector name
- Date range, total building count, priority count
- Logo placeholder area

**Summary Page (portrait):**
- Day-by-day overview table: Day, Date, # Buildings, Cities, Total SF, Priority flag, Notes
- Advance notice buildings list (for calling ahead)
- Escort-required buildings list
- Equipment checklist aggregated across all days

**Daily Route Sheets (landscape):**
- Header: "Day X -- Date -- City/Area"
- Table with columns prioritizing width for Access Location and Codes:
  - Stop # (narrow), Property Name (medium), Address (medium), SF (narrow), Market/Group (narrow), Building Code (narrow), Access Type (narrow), **Access Location (wide)**, **Codes (wide)**, Special Req (medium), Notes (medium)
- Minimum 9pt font size throughout
- Text wrapping enabled on all cells (no truncation)
- Alternating row shading for readability
- Color-coded badges: red PRIORITY, amber 24H NOTICE, purple ESCORT REQUIRED

**Back Page (portrait):**
- Blank notes section
- Emergency contacts placeholder
- "Report any access issues to operations immediately"

### 2. `src/lib/excel-generator.ts`
Uses existing `xlsx` package. Creates workbook with:
- Summary tab
- One tab per day with the same columns as the PDF daily sheets

### 3. `src/pages/Schedules.tsx` (complete rewrite)
Multi-step wizard plus document history.

**Step 1 -- Configuration:**
- Client selector
- Region selector (or "All Regions")
- Inspector selector with explicit **"All Inspectors"** option
- Date range pickers (start + end date)
- Format toggle: PDF (default) or Excel

**Step 2 -- Preview:**
- Summary card showing what will be generated
- If "All Inspectors" selected: shows list of inspectors and building counts per inspector
- Confirm / go back buttons

**Step 3 -- Generate + Download:**
- Progress bar during generation
- Single inspector: direct PDF/Excel download
- **"All Inspectors" batch mode**: generates one PDF per inspector, bundles into a single ZIP using JSZip, triggers download as `[Client]_[Region]_Schedules.zip`
- Saves record(s) to `generated_documents` table

**Document History section (below wizard):**
- Table of previously generated documents with file name, format, date, and inspector name
- No re-download (files are generated on-the-fly, but history shows what was produced)

## Data Flow

```text
User selects client + region + inspector(s)
    |
    v
Query route_plans matching filters
    |
    v
For each route_plan:
  - Load route_plan_days (ordered by day_number)
  - Load route_plan_buildings for each day (ordered by stop_order)
  - Join building details (address, codes, access info, sqft, etc.)
  - Resolve client/region/inspector names
    |
    v
If single inspector:
  - Generate one PDF/Excel -> download
If "All Inspectors":
  - Find all inspectors in region
  - Query route_plans per inspector
  - Generate one PDF per inspector
  - Bundle into ZIP -> download
    |
    v
Save record(s) to generated_documents
```

## Daily Route Sheet Column Widths (Landscape)
To ensure Access Location and Codes get enough space:

| Column | Relative Width | Notes |
|--------|---------------|-------|
| Stop # | 5% | Just a number |
| Property Name | 12% | |
| Address | 13% | |
| SF | 5% | Numeric |
| Market/Group | 6% | Can be narrow |
| Building Code | 6% | Can be narrow |
| Access Type | 7% | Short text |
| Access Location | 16% | Wide -- critical field |
| Codes | 12% | Wide -- critical field |
| Special Req | 9% | |
| Notes | 9% | |

All cells use text wrapping with a minimum font size of 9pt. Row height auto-expands to fit content.

## Key Design Decisions
- PDF generated entirely client-side (no edge function needed)
- ZIP bundling via JSZip for the "Generate All" batch flow
- Landscape orientation for daily sheets to maximize column space
- Access Location and Codes columns get the most width allocation
- 9pt minimum font -- readable on phone screens and printed paper
- No data truncation -- cells wrap to multiple lines as needed

