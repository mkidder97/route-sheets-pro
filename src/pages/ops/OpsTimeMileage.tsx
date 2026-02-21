import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { createNotification } from "@/lib/notifications";
import {
  ChevronLeft, ChevronRight, Download, AlertTriangle, Check, X,
} from "lucide-react";
import {
  startOfWeek, endOfWeek, addWeeks, subWeeks, format, addDays, isSameDay,
} from "date-fns";
import * as XLSX from "xlsx";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
interface MileageLog {
  id?: string;
  user_id: string;
  date: string;
  miles: number;
  notes: string | null;
}

interface MileageApproval {
  id: string;
  user_id: string;
  week_start: string;
  status: string;
  approved_by: string | null;
  approved_at: string | null;
  rejection_notes: string | null;
}

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
function getWeekStart(d: Date) {
  return startOfWeek(d, { weekStartsOn: 1 });
}

function weekDays(weekStart: Date) {
  return Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  submitted: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

/* ------------------------------------------------------------------ */
/*  Main Component                                                     */
/* ------------------------------------------------------------------ */
export default function OpsTimeMileage() {
  const { user, role } = useAuth();
  const isManager = role === "admin" || role === "office_manager";
  const [showMyMileage, setShowMyMileage] = useState(!isManager);

  // If role changes (e.g. on load), sync default view
  useEffect(() => {
    setShowMyMileage(!isManager);
  }, [isManager]);

  if (showMyMileage || !isManager) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold">Time &amp; Mileage</h1>
          {isManager && (
            <Button variant="outline" size="sm" onClick={() => setShowMyMileage(false)}>
              Team View
            </Button>
          )}
        </div>
        <FieldOpsView userId={user?.id ?? ""} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-xl sm:text-2xl font-bold">Time &amp; Mileage</h1>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowMyMileage(true)}>
            My Mileage
          </Button>
        </div>
      </div>
      <ManagerView />
    </div>
  );
}

/* ================================================================== */
/*  FIELD OPS VIEW                                                     */
/* ================================================================== */
function FieldOpsView({ userId }: { userId: string }) {
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [logs, setLogs] = useState<Record<string, MileageLog>>({});
  const [approval, setApproval] = useState<MileageApproval | null>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const weekEnd = useMemo(() => addDays(weekStart, 4), [weekStart]);

  const fetchData = useCallback(async () => {
    if (!userId) return;
    const ws = format(weekStart, "yyyy-MM-dd");
    const we = format(weekEnd, "yyyy-MM-dd");

    const [logsRes, approvalRes] = await Promise.all([
      supabase
        .from("mileage_logs")
        .select("*")
        .eq("user_id", userId)
        .gte("date", ws)
        .lte("date", we),
      supabase
        .from("mileage_approvals")
        .select("*")
        .eq("user_id", userId)
        .eq("week_start", ws)
        .maybeSingle(),
    ]);

    const map: Record<string, MileageLog> = {};
    (logsRes.data ?? []).forEach((l: any) => {
      map[l.date] = l;
    });
    setLogs(map);
    setApproval(approvalRes.data as MileageApproval | null);
  }, [userId, weekStart, weekEnd]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const status = approval?.status ?? "draft";
  const readOnly = status === "approved";

  const handleMilesChange = async (date: string, value: string) => {
    const miles = parseFloat(value) || 0;
    const existing = logs[date];
    const updated = { ...logs };

    if (existing?.id) {
      updated[date] = { ...existing, miles };
      setLogs(updated);
      await supabase.from("mileage_logs").update({ miles }).eq("id", existing.id);
    } else {
      const entry: MileageLog = { user_id: userId, date, miles, notes: null };
      updated[date] = entry;
      setLogs(updated);
      const { data } = await supabase.from("mileage_logs").upsert(
        { user_id: userId, date, miles, notes: null },
        { onConflict: "user_id,date" }
      ).select().single();
      if (data) updated[date] = data as any;
      setLogs({ ...updated });
    }
  };

  const handleNotesChange = async (date: string, notes: string) => {
    const existing = logs[date];
    const updated = { ...logs };

    if (existing?.id) {
      updated[date] = { ...existing, notes };
      setLogs(updated);
      await supabase.from("mileage_logs").update({ notes }).eq("id", existing.id);
    } else {
      const entry: MileageLog = { user_id: userId, date, miles: 0, notes };
      updated[date] = entry;
      setLogs(updated);
      const { data } = await supabase.from("mileage_logs").upsert(
        { user_id: userId, date, miles: 0, notes },
        { onConflict: "user_id,date" }
      ).select().single();
      if (data) updated[date] = data as any;
      setLogs({ ...updated });
    }
  };

  const totalMiles = useMemo(
    () => days.reduce((sum, d) => sum + (logs[format(d, "yyyy-MM-dd")]?.miles ?? 0), 0),
    [days, logs],
  );

  const handleSubmit = async () => {
    if (totalMiles === 0) return;
    setSubmitting(true);
    const ws = format(weekStart, "yyyy-MM-dd");

    await supabase.from("mileage_approvals").upsert(
      { user_id: userId, week_start: ws, status: "submitted" },
      { onConflict: "user_id,week_start" }
    );

    await supabase.from("activity_log").insert({
      action: "mileage_submitted",
      entity_type: "mileage_approvals",
      entity_id: userId,
      user_id: userId,
      details: { week_start: ws, total_miles: totalMiles },
    });

    toast({ title: "Submitted", description: "Mileage submitted for approval." });
    setSubmitting(false);
    fetchData();
  };

  return (
    <div className="space-y-3">
      {/* Week selector */}
      <div className="flex items-center justify-center gap-3">
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setWeekStart(s => subWeeks(s, 1))}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="text-center">
          <span className="font-semibold text-sm sm:text-base">
            Week of {format(weekStart, "MMM d, yyyy")}
          </span>
          <Badge className={`ml-2 ${STATUS_COLORS[status]}`}>{status}</Badge>
        </div>
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setWeekStart(s => addWeeks(s, 1))}>
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Rejection banner */}
      {status === "rejected" && approval?.rejection_notes && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{approval.rejection_notes}</AlertDescription>
        </Alert>
      )}

      {/* Day rows */}
      <div className="space-y-2">
        {days.map((day) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const log = logs[dateStr];
          return (
            <div key={dateStr} className="rounded-lg border bg-card p-3 space-y-2">
              <div className="font-medium text-sm">{format(day, "EEEE, MMM d")}</div>
              <div className="flex gap-2">
                <Input
                  type="number"
                  step="0.1"
                  min="0"
                  placeholder="Miles"
                  className="h-12 text-lg w-28 flex-shrink-0"
                  value={log?.miles ?? ""}
                  readOnly={readOnly}
                  onChange={(e) => handleMilesChange(dateStr, e.target.value)}
                />
                <Input
                  placeholder="Notes (optional)"
                  className="h-12"
                  value={log?.notes ?? ""}
                  readOnly={readOnly}
                  onChange={(e) => handleNotesChange(dateStr, e.target.value)}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Total + submit */}
      <div className="rounded-lg border bg-card p-4 flex items-center justify-between">
        <div>
          <span className="text-muted-foreground text-sm">Weekly Total</span>
          <div className="text-2xl font-bold">{totalMiles.toFixed(1)} mi</div>
        </div>
        {!readOnly && (
          <Button
            size="lg"
            className="h-12 px-6"
            disabled={totalMiles === 0 || submitting || status === "submitted"}
            onClick={handleSubmit}
          >
            {status === "submitted" ? "Submitted" : status === "rejected" ? "Re-submit" : "Submit for Approval"}
          </Button>
        )}
      </div>
    </div>
  );
}

/* ================================================================== */
/*  MANAGER VIEW                                                       */
/* ================================================================== */
function ManagerView() {
  const { user } = useAuth();
  const [weekStart, setWeekStart] = useState(() => getWeekStart(new Date()));
  const [rows, setRows] = useState<{
    profile: UserProfile;
    logs: Record<string, MileageLog>;
    approval: MileageApproval | null;
    total: number;
  }[]>([]);
  const [reviewUser, setReviewUser] = useState<typeof rows[0] | null>(null);
  const [rejectionNotes, setRejectionNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const days = useMemo(() => weekDays(weekStart), [weekStart]);
  const ws = format(weekStart, "yyyy-MM-dd");
  const we = format(addDays(weekStart, 4), "yyyy-MM-dd");

  const fetchData = useCallback(async () => {
    const [logsRes, approvalsRes, profilesRes] = await Promise.all([
      supabase.from("mileage_logs").select("*").gte("date", ws).lte("date", we),
      supabase.from("mileage_approvals").select("*").eq("week_start", ws),
      supabase.from("user_profiles").select("id, full_name, email"),
    ]);

    const allLogs = (logsRes.data ?? []) as MileageLog[];
    const approvals = (approvalsRes.data ?? []) as MileageApproval[];
    const profiles = (profilesRes.data ?? []) as UserProfile[];

    // Group by user
    const userIds = [...new Set(allLogs.map((l) => l.user_id))];
    const built = userIds.map((uid) => {
      const userLogs = allLogs.filter((l) => l.user_id === uid);
      const logMap: Record<string, MileageLog> = {};
      userLogs.forEach((l) => { logMap[l.date] = l; });
      const total = userLogs.reduce((s, l) => s + Number(l.miles), 0);
      const profile = profiles.find((p) => p.id === uid) ?? { id: uid, full_name: "Unknown", email: "" };
      const approval = approvals.find((a) => a.user_id === uid) ?? null;
      return { profile, logs: logMap, approval, total };
    });

    built.sort((a, b) => a.profile.full_name.localeCompare(b.profile.full_name));
    setRows(built);
  }, [ws, we]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleApprove = async (row: typeof rows[0]) => {
    setProcessing(true);
    const approvalId = row.approval?.id;
    if (approvalId) {
      await supabase.from("mileage_approvals").update({
        status: "approved",
        approved_by: user?.id ?? null,
        approved_at: new Date().toISOString(),
      }).eq("id", approvalId);
    } else {
      await supabase.from("mileage_approvals").upsert({
        user_id: row.profile.id,
        week_start: ws,
        status: "approved",
        approved_by: user?.id ?? null,
        approved_at: new Date().toISOString(),
      }, { onConflict: "user_id,week_start" });
    }

    await createNotification(
      row.profile.id,
      "Mileage Approved",
      `Your mileage for week of ${format(weekStart, "MMM d, yyyy")} has been approved.`,
      "status_change",
      "mileage",
      approvalId ?? undefined,
    );

    await supabase.from("activity_log").insert({
      action: "mileage_approved",
      entity_type: "mileage_approvals",
      entity_id: row.profile.id,
      user_id: user?.id ?? null,
      details: { week_start: ws },
    });

    toast({ title: "Approved", description: `Mileage approved for ${row.profile.full_name}.` });
    setReviewUser(null);
    setProcessing(false);
    fetchData();
  };

  const handleReject = async (row: typeof rows[0]) => {
    if (!rejectionNotes.trim()) {
      toast({ title: "Required", description: "Please enter rejection notes.", variant: "destructive" });
      return;
    }
    setProcessing(true);
    const approvalId = row.approval?.id;
    if (approvalId) {
      await supabase.from("mileage_approvals").update({
        status: "rejected",
        rejection_notes: rejectionNotes,
      }).eq("id", approvalId);
    } else {
      await supabase.from("mileage_approvals").upsert({
        user_id: row.profile.id,
        week_start: ws,
        status: "rejected",
        rejection_notes: rejectionNotes,
      }, { onConflict: "user_id,week_start" });
    }

    await createNotification(
      row.profile.id,
      "Mileage Rejected",
      `Your mileage for week of ${format(weekStart, "MMM d, yyyy")} was rejected: ${rejectionNotes}`,
      "status_change",
      "mileage",
      approvalId ?? undefined,
    );

    await supabase.from("activity_log").insert({
      action: "mileage_rejected",
      entity_type: "mileage_approvals",
      entity_id: row.profile.id,
      user_id: user?.id ?? null,
      details: { week_start: ws, rejection_notes: rejectionNotes },
    });

    toast({ title: "Rejected", description: `Mileage rejected for ${row.profile.full_name}.` });
    setReviewUser(null);
    setRejectionNotes("");
    setProcessing(false);
    fetchData();
  };

  const handleExport = () => {
    const exportRows: Record<string, string | number>[] = [];
    rows.forEach((row) => {
      days.forEach((day) => {
        const dateStr = format(day, "yyyy-MM-dd");
        const log = row.logs[dateStr];
        if (log) {
          exportRows.push({
            Name: row.profile.full_name,
            Date: format(day, "MM/dd/yyyy"),
            Miles: Number(log.miles),
            Notes: log.notes ?? "",
          });
        }
      });
      // Summary row
      exportRows.push({
        Name: row.profile.full_name,
        Date: "TOTAL",
        Miles: row.total,
        Notes: "",
      });
    });

    const wbk = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(exportRows);
    sheet["!cols"] = [{ wch: 24 }, { wch: 14 }, { wch: 10 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wbk, sheet, "Mileage");
    XLSX.writeFile(wbk, `Mileage - Week of ${format(weekStart, "MMM d yyyy")}.xlsx`);
  };

  return (
    <div className="space-y-3">
      {/* Week selector + export */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setWeekStart(s => subWeeks(s, 1))}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <span className="font-semibold text-sm sm:text-base">
            Week of {format(weekStart, "MMM d, yyyy")}
          </span>
          <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setWeekStart(s => addWeeks(s, 1))}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="h-4 w-4 mr-1" /> Export
        </Button>
      </div>

      {rows.length === 0 ? (
        <p className="text-muted-foreground text-sm py-8 text-center">No mileage entries this week.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                {days.map((d) => (
                  <TableHead key={d.toISOString()} className="text-center w-16">
                    {format(d, "EEE")}
                  </TableHead>
                ))}
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-center">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const st = row.approval?.status ?? "draft";
                return (
                  <TableRow key={row.profile.id}>
                    <TableCell className="font-medium whitespace-nowrap">{row.profile.full_name}</TableCell>
                    {days.map((d) => {
                      const dateStr = format(d, "yyyy-MM-dd");
                      const log = row.logs[dateStr];
                      return (
                        <TableCell key={dateStr} className="text-center tabular-nums">
                          {log ? Number(log.miles).toFixed(1) : "—"}
                        </TableCell>
                      );
                    })}
                    <TableCell className="text-right font-semibold tabular-nums">
                      {row.total.toFixed(1)}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge className={STATUS_COLORS[st]}>{st}</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {st === "submitted" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setReviewUser(row); setRejectionNotes(""); }}
                        >
                          Review
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Review Sheet */}
      <Sheet open={!!reviewUser} onOpenChange={(o) => { if (!o) setReviewUser(null); }}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{reviewUser?.profile.full_name}</SheetTitle>
            <SheetDescription>Week of {format(weekStart, "MMM d, yyyy")}</SheetDescription>
          </SheetHeader>

          {reviewUser && (
            <div className="space-y-4 mt-4">
              {days.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const log = reviewUser.logs[dateStr];
                return (
                  <div key={dateStr} className="flex items-start justify-between border-b pb-2">
                    <div>
                      <div className="font-medium text-sm">{format(day, "EEEE, MMM d")}</div>
                      {log?.notes && <div className="text-xs text-muted-foreground mt-0.5">{log.notes}</div>}
                    </div>
                    <span className="font-semibold tabular-nums">
                      {log ? `${Number(log.miles).toFixed(1)} mi` : "—"}
                    </span>
                  </div>
                );
              })}

              <div className="flex items-center justify-between pt-2">
                <span className="font-medium">Weekly Total</span>
                <span className="text-xl font-bold">{reviewUser.total.toFixed(1)} mi</span>
              </div>

              <div className="space-y-2 pt-4">
                <Textarea
                  placeholder="Rejection notes (required to reject)"
                  value={rejectionNotes}
                  onChange={(e) => setRejectionNotes(e.target.value)}
                />
                <div className="flex gap-2">
                  <Button
                    className="flex-1 h-12"
                    variant="default"
                    disabled={processing}
                    onClick={() => handleApprove(reviewUser)}
                  >
                    <Check className="h-4 w-4 mr-1" /> Approve
                  </Button>
                  <Button
                    className="flex-1 h-12"
                    variant="destructive"
                    disabled={processing}
                    onClick={() => handleReject(reviewUser)}
                  >
                    <X className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
