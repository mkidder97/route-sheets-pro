

# Revised OCR Strategy for CAD Title Block Extraction

## What We Learned

The CAD drawings follow a consistent format from Southern Roof Consultants:
- **Title block in the bottom-right corner** contains all the key data
- **Project field**: "Parc 114 - Bldg 4" with the address below ("6631 N. Belt Line Road, Irving, TX 75063")
- **Customer field**: "Link Logistics"
- **Square footage**: Displayed as "ROOF SQ. FT. = 76,559" just above the legend area
- The rest of the drawing is architectural lines, symbols, and legend -- irrelevant to matching

## Current Problem

The OCR scans the entire image, picking up legend text ("HVAC unit curb", "Vent stack", "Gutter", etc.), dimension labels ("435'", "175'"), and random symbol noise. This pollutes the text and causes wrong matches.

## Revised Plan

### 1. Crop to the Bottom-Right Quadrant Before OCR

Instead of scanning the full image, crop to the bottom-right ~40% width and ~40% height using an off-screen Canvas. This isolates the title block where the project name, address, customer, and square footage live.

### 2. Also Scan the Bottom Strip for Square Footage

The "ROOF SQ. FT. = 76,559" text sits just above the legend, slightly outside the title block. Crop a horizontal strip across the bottom ~25% of the image as a second OCR region to catch the SF value.

### 3. Update the SF Regex

Add support for the "ROOF SQ. FT. = 76,559" format:
- Current: `/(\d[\d,]*)\s*(?:sf|sq\.?\s*ft|square\s*feet|sqft)/i`
- New: `/(?:ROOF\s*)?SQ\.?\s*FT\.?\s*[=:]\s*(\d[\d,]*)|(\d[\d,]*)\s*(?:sf|sq\.?\s*ft|square\s*feet|sqft)/i`

### 4. Extract Structured Fields from Title Block Text

After OCR on the title block crop, parse for labeled fields:
- `Project:` line for building name and address
- `Customer:` line for property owner/name
- These structured extractions feed into `matchBuilding()` as stronger signals than raw full-text scanning

### 5. Preprocess the Cropped Region

Before OCR, apply canvas preprocessing to the cropped region:
- Grayscale conversion
- Contrast boost (1.5x)
- Upscale if the crop is small (< 800px wide)

---

## Technical Details

### File: `src/lib/cad-ocr.ts`

**New function: `cropRegion(file, x%, y%, w%, h%): Promise<Blob>`**
- Loads image into off-screen canvas
- Crops to the specified percentage region
- Applies grayscale + contrast boost
- Returns processed Blob

**Updated `ocrImage()`**
1. Crop bottom-right 40% x 45% of image (title block region)
2. Crop bottom 25% full-width strip (for SF value)
3. Run Tesseract on both crops (can run in parallel)
4. Merge the two text results
5. Parse SF using updated regex
6. Return combined rawText and extractedSF

**New function: `extractTitleBlockFields(rawText): { project, address, customer }`**
- Regex for `Project:\s*(.+)` to grab project/building name
- Regex for address pattern (number + street + city/state/zip) in lines near "Project:"
- Regex for `Customer:\s*(.+)` to grab customer/property name

**Updated `matchBuilding()`**
- First try matching structured fields (project name, address from title block) -- these are high-confidence signals
- If structured fields match a building's property_name or address, score +10 immediately
- Fall back to current word-matching logic for unstructured text
- Customer name also checked against property_name (+5 if match)

### Updated Scoring

```text
Signal                                         Points
----------------------------------------------+------
Structured "Project:" matches property_name    | 12
Structured address matches building address    | 10
Customer name matches property_name            | 5
Word-level matches (existing fallback)         | 1-3 each
```

High confidence threshold stays at 8 (easily hit with structured matches).

### No changes to other files

The `SavedRoutes.tsx` batch upload flow stays the same -- it already calls `ocrImage()` and `matchBuilding()`. The improvements are entirely within the OCR extraction layer.

