

## Replace owner_company Input with Searchable Client Dropdown

### What Changes

In `src/pages/cm/CMProjectNew.tsx`, replace the freeform `owner_company` text input in `renderStep2()` (lines 675-685) with a Popover + Command combobox identical to the building selector pattern in `renderStep1()`.

### Implementation

**1. Add client state** (after the building state block, around line 116):
```typescript
const [clientOpen, setClientOpen] = useState(false);
const [clientSearch, setClientSearch] = useState("");
const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
```

**2. Add client fetch useEffect** (after the building fetch useEffect, around line 140):
```typescript
useEffect(() => {
  const fetchClients = async () => {
    let q = supabase
      .from("clients")
      .select("id, name")
      .eq("is_active", true)
      .order("name")
      .limit(50);
    if (clientSearch.trim()) {
      q = q.ilike("name", `%${clientSearch}%`);
    }
    const { data } = await q;
    if (data) setClients(data);
  };
  fetchClients();
}, [clientSearch]);
```

**3. Replace the owner_company Input** in `renderStep2()` (lines 675-685) with:
```tsx
<label className={labelCls}>Owner Company</label>
<Popover open={clientOpen} onOpenChange={setClientOpen}>
  <PopoverTrigger asChild>
    <Button
      variant="outline"
      role="combobox"
      aria-expanded={clientOpen}
      className={cn(
        "w-full justify-between h-11 border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800",
        !form.owner_company && "text-slate-500"
      )}
      disabled={submitting}
    >
      {form.owner_company || "Select owner company..."}
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-full p-0 bg-slate-800 border-slate-700" align="start">
    <Command className="bg-slate-800">
      <CommandInput
        placeholder="Type to search..."
        value={clientSearch}
        onValueChange={setClientSearch}
        className="text-slate-100"
      />
      <CommandList>
        <CommandEmpty className="text-slate-400 text-sm py-4 text-center">
          No clients found.
        </CommandEmpty>
        <CommandGroup>
          {clients.map((c) => (
            <CommandItem
              key={c.id}
              value={c.name}
              onSelect={() => {
                updateForm("owner_company", c.name);
                setClientOpen(false);
              }}
              className="text-slate-200 hover:bg-slate-700"
            >
              <Check className={cn("mr-2 h-4 w-4", form.owner_company === c.name ? "opacity-100" : "opacity-0")} />
              {c.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```

### Files Modified
- `src/pages/cm/CMProjectNew.tsx` — add client state + fetch effect, replace Input with combobox in Step 2

### No Changes To
- Step 1 building selector, Steps 3-5, form submission, FormData type

