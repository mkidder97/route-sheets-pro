

## Add Address-Based Fallback Match to Data Import

### Changes (single file: `src/pages/admin/Data.tsx`)

**1. Extend UnmatchedRow interface** to include `address`, `city`, `phone` fields so we can carry them through the fallback matching step.

**2. Capture address/city from XLSX rows** during the initial loop. Use `col("address")` and `col("city")` from the normalized header map to extract address and city values for unmatched rows.

**3. After the primary code-match loop, run address fallback:**
- Collect unique addresses from the unmatched list (non-empty, trimmed)
- Query `supabase.from("buildings").select("id, building_code, property_name, address, city, state").in("address", uniqueAddresses)` in batches
- Build an address+city lookup map (both lowercased+trimmed for comparison)
- Iterate the unmatched list: if a row's address+city matches a building, move it to `matchedRows` and remove from `unmatchedList`
- Update `emailCount` for any rescued rows with emails

**4. No UI changes** — the existing summary card, matched table, unmatched table, and import logic all work off the same `matched`/`unmatchedRows` state arrays, so rescued rows automatically appear in the right place with correct counts.

**5. Address column detection** — add `"address"` and `"city"` to the missing column detection so the warning banner fires if address fallback won't work.

### Implementation detail

```ts
// After primary loop, attempt address fallback on unmatchedList
const addressCol = col("address");
const cityCol = col("city");

if (addressCol && cityCol && unmatchedList.length > 0) {
  const unmatchedAddresses = [...new Set(
    unmatchedList.map(r => r.address).filter(Boolean)
  )];
  
  // Batch fetch buildings by address
  const addrBuildings = [];
  for (let i = 0; i < unmatchedAddresses.length; i += batchSize) {
    const batch = unmatchedAddresses.slice(i, i + batchSize);
    const { data } = await supabase
      .from("buildings")
      .select("id, building_code, property_name, address, city, state")
      .in("address", batch);
    if (data) addrBuildings.push(...data);
  }
  
  // Build address+city map (lowercase keys)
  const addrMap = new Map<string, typeof addrBuildings[0]>();
  for (const b of addrBuildings) {
    const key = `${(b.address || "").trim().toLowerCase()}|${(b.city || "").trim().toLowerCase()}`;
    addrMap.set(key, b);
  }
  
  // Rescue matches from unmatchedList
  const stillUnmatched: UnmatchedRow[] = [];
  for (const r of unmatchedList) {
    const key = `${(r.address || "").trim().toLowerCase()}|${(r.city || "").trim().toLowerCase()}`;
    const building = addrMap.get(key);
    if (building) {
      if (r.email) emailCount++;
      matchedRows.push({
        buildingId: building.id,
        propertyCode: r.propertyCode,
        propertyName: building.property_name,
        siteContact: r.siteContact,
        email: r.email,
        phone: r.phone,
      });
    } else {
      stillUnmatched.push(r);
    }
  }
  // Replace unmatchedList with stillUnmatched
}
```

### Files
- **Modified:** `src/pages/admin/Data.tsx` (parsing section only)

