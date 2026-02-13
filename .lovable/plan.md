

# Fix False-Positive Building Matches

## Problem

The matching logic produces incorrect "high confidence" matches because the **fallback word-matching** (used when structured field scores are low) is too generous with common words. For example, if the OCR text from any CAD contains the word "logistics" anywhere (even from noise), a building called "DFW Logistics Center" can accumulate enough points from individual word hits to reach "high confidence."

## Root Cause

Two issues in `matchBuilding()` in `src/lib/cad-ocr.ts`:

1. **Fallback raw-text matching triggers too easily** -- it activates when structured field score is below 6, and awards up to 10 points for word matches alone. A building with a generic name ("DFW Logistics Center") can score 9 points (3 words x 3 pts each) from words scattered anywhere in the OCR text.

2. **No minimum word count filter** -- single common words like "center", "park", or "drive" can each contribute 3 points, even though they appear on nearly every CAD drawing.

## Solution

### Changes to `src/lib/cad-ocr.ts`

**1. Require more word overlap before awarding fallback points**
- Only award word-match points when at least 2 significant words match (not just 1)
- Reduce per-word score from 3 to 2
- Require matched words to be 4+ characters (already done) AND not be common words like "center", "park", "building", "drive"

**2. Cap fallback-only scores below the high-confidence threshold**
- If the score comes entirely from raw-text fallback (no structured field matches), cap maximum confidence at "low"
- Only allow "high" confidence when at least one structured field (project, address, or customer) contributed to the score

**3. Add a "structured match" flag**
- Track whether any points came from structured field matching
- Use this flag to gate "high" confidence: `if (bestScore >= 8 && hadStructuredMatch)` returns high, otherwise low

### Specific Code Changes

| Location | Change |
|----------|--------|
| Lines 269-292 | Add common-word filter list; require 2+ word matches for any points; reduce per-word score to 2 |
| Lines 217-298 | Add `hadStructuredMatch` boolean tracking per building |
| Lines 300-302 | Gate high confidence on `hadStructuredMatch` flag |

### Common Words Filter

```text
Words to exclude from fallback matching:
"center", "park", "building", "plaza", "tower", "suite",
"north", "south", "east", "west", "drive", "road", "street",
"avenue", "lane", "court", "place", "way", "unit"
```

### Updated Confidence Logic

```text
High:  score >= 8 AND at least one structured field contributed
Low:   score >= 3 (any source)
None:  score < 3
```

This prevents a building from reaching "high" confidence purely from scattered common words in OCR noise, while keeping the current behavior intact when the title block fields (Project, Address, Customer) are successfully extracted and match.

