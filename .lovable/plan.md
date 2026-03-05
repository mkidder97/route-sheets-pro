

## Inspector Reassignment Dropdown on Visit Cards

### Change

In `src/pages/cm/CMProjectDetail.tsx`, replace the static inspector name display (lines 385-388) with a conditional render: office mode gets an inline `Select` dropdown for reassignment; field mode keeps the read-only text.

Add a `handleReassignInspector` function that updates `cm_visits.inspector_id`, invalidates the visits query, and shows a toast.

**Lines 385-388 — current:**
```tsx
<div className="flex items-center gap-1.5 text-xs text-muted-foreground">
  <User className="h-3 w-3" />
  {inspName}
</div>
```

**Replaced with:**
```tsx
{isOffice ? (
  <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5">
    <User className="h-3 w-3 text-muted-foreground" />
    <Select
      value={visit.inspector_id ?? "unassigned"}
      onValueChange={(val) => handleReassignInspector(visit.id, val === "unassigned" ? null : val)}
    >
      <SelectTrigger className="h-6 text-xs border-none bg-transparent p-0 gap-1 text-muted-foreground hover:text-slate-200 w-auto focus:ring-0">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unassigned">Unassigned</SelectItem>
        {assignableInspectors?.map((insp) => (
          <SelectItem key={insp.id} value={insp.id}>{insp.full_name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  </div>
) : (
  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
    <User className="h-3 w-3" />
    {inspName}
  </div>
)}
```

**New function** (added after `revertToDraft` mutation, ~line 216):
```tsx
const handleReassignInspector = async (visitId: string, newInspectorId: string | null) => {
  const { error } = await supabase
    .from("cm_visits")
    .update({ inspector_id: newInspectorId })
    .eq("id", visitId);
  if (error) {
    toast.error("Failed to reassign inspector");
    return;
  }
  queryClient.invalidateQueries({ queryKey: ["cm-visits", projectId] });
  toast.success("Inspector reassigned");
};
```

### Files Modified
- `src/pages/cm/CMProjectDetail.tsx` — visit card inspector display + new handler function

### Not Changed
- Schedule form, PDF actions, revert logic, field mode behavior, or any other component

