import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Trash2, Edit2, Clock, MapPin } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Json } from "@/integrations/supabase/types";

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const dayShort = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const activityTypes = [
  { value: "class", label: "Class / Lesson" },
  { value: "study", label: "Study Time" },
  { value: "sport", label: "Sports" },
  { value: "club", label: "Club / Society" },
  { value: "break", label: "Break" },
  { value: "other", label: "Other" },
];

const activityColors: Record<string, string> = {
  class: "bg-primary/10 border-primary/30 text-primary",
  study: "bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-300",
  sport: "bg-green-50 border-green-200 text-green-700 dark:bg-green-950 dark:border-green-800 dark:text-green-300",
  club: "bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-950 dark:border-purple-800 dark:text-purple-300",
  break: "bg-orange-50 border-orange-200 text-orange-700 dark:bg-orange-950 dark:border-orange-800 dark:text-orange-300",
  other: "bg-muted border-border text-foreground",
};

interface TimetableEntry {
  id: string;
  day_of_week: number;
  time_slot: string;
  end_time: string | null;
  activity: string;
  activity_type: string;
  description: string | null;
  location: string | null;
}

const emptyForm = {
  day_of_week: "1",
  time_slot: "07:30",
  end_time: "08:30",
  activity: "",
  activity_type: "class",
  description: "",
  location: "",
};

export default function PersonalTimetableEditor({ title = "My Timetable" }: { title?: string }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [entries, setEntries] = useState<TimetableEntry[]>([]);
  const [rowId, setRowId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [saving, setSaving] = useState(false);

  // Entries are stored as a JSON list in a single personal_timetables row per user.
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("personal_timetables")
      .select("id, data")
      .eq("user_id", user!.id)
      .maybeSingle();
    if (error) console.error(error);
    setRowId(data?.id ?? null);
    const stored = (data?.data as { entries?: TimetableEntry[] } | null)?.entries;
    setEntries(Array.isArray(stored) ? stored : []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (user) fetchEntries();
  }, [fetchEntries, user]);

  const persistEntries = async (next: TimetableEntry[]) => {
    const data = { entries: next } as unknown as Json;
    if (rowId) {
      return supabase
        .from("personal_timetables")
        .update({ data, updated_at: new Date().toISOString() })
        .eq("id", rowId);
    }
    return supabase.from("personal_timetables").insert({ user_id: user!.id, data });
  };

  const openAdd = () => {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (entry: TimetableEntry) => {
    setEditingId(entry.id);
    setForm({
      day_of_week: String(entry.day_of_week),
      time_slot: entry.time_slot,
      end_time: entry.end_time || "",
      activity: entry.activity,
      activity_type: entry.activity_type,
      description: entry.description || "",
      location: entry.location || "",
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.activity || !form.time_slot) {
      toast({ title: "Activity and time are required", variant: "destructive" });
      return;
    }
    setSaving(true);

    const entry: TimetableEntry = {
      id: editingId ?? crypto.randomUUID(),
      day_of_week: parseInt(form.day_of_week),
      time_slot: form.time_slot,
      end_time: form.end_time || null,
      activity: form.activity,
      activity_type: form.activity_type,
      description: form.description || null,
      location: form.location || null,
    };
    const next = editingId
      ? entries.map(e => (e.id === editingId ? entry : e))
      : [...entries, entry];

    const { error } = await persistEntries(next);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: editingId ? "Entry updated!" : "Entry added!" });
    }

    setSaving(false);
    setDialogOpen(false);
    fetchEntries();
  };

  const handleDelete = async (id: string) => {
    const { error } = await persistEntries(entries.filter(e => e.id !== id));
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Entry removed" });
      fetchEntries();
    }
  };

  // Group entries by day for grid view
  const entriesByDay = days.map((_, i) =>
    entries.filter(e => e.day_of_week === i + 1).sort((a, b) => a.time_slot.localeCompare(b.time_slot))
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-3">
          <CardTitle className="font-heading">{title}</CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setViewMode(viewMode === "grid" ? "list" : "grid")}>
              {viewMode === "grid" ? "List View" : "Grid View"}
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm" onClick={openAdd}>
                  <Plus className="mr-1 h-4 w-4" /> Add Entry
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle className="font-heading">{editingId ? "Edit Entry" : "Add Timetable Entry"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Day *</Label>
                      <Select value={form.day_of_week} onValueChange={v => setForm(p => ({ ...p, day_of_week: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {days.map((d, i) => <SelectItem key={i} value={String(i + 1)}>{d}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={form.activity_type} onValueChange={v => setForm(p => ({ ...p, activity_type: v }))}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {activityTypes.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Activity / Subject *</Label>
                    <Input value={form.activity} onChange={e => setForm(p => ({ ...p, activity: e.target.value }))} placeholder="e.g. Mathematics, Soccer practice" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Start Time *</Label>
                      <Input type="time" value={form.time_slot} onChange={e => setForm(p => ({ ...p, time_slot: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <Label>End Time</Label>
                      <Input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Location</Label>
                    <Input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} placeholder="e.g. Room 12, Sports Field" />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea rows={2} value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))} placeholder="Additional details..." />
                  </div>
                  <Button onClick={handleSave} disabled={saving} className="w-full">
                    {saving ? "Saving..." : editingId ? "Update Entry" : "Add Entry"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-center text-muted-foreground italic py-8">Loading timetable...</p>
        ) : entries.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No timetable entries yet. Start building your schedule!</p>
            <Button onClick={openAdd}><Plus className="mr-1 h-4 w-4" /> Add Your First Entry</Button>
          </div>
        ) : viewMode === "grid" ? (
          <div className="overflow-x-auto">
            <div className="grid grid-cols-5 lg:grid-cols-7 gap-2 min-w-[600px]">
              {entriesByDay.map((dayEntries, dayIdx) => (
                <div key={dayIdx} className="space-y-2">
                  <h4 className="text-center text-xs font-bold uppercase tracking-wider text-muted-foreground py-1 bg-muted rounded">
                    {dayShort[dayIdx]}
                  </h4>
                  {dayEntries.length > 0 ? dayEntries.map(entry => (
                    <div
                      key={entry.id}
                      className={`rounded-lg border p-2 text-xs cursor-pointer transition-shadow hover:shadow-md ${activityColors[entry.activity_type] || activityColors.other}`}
                      onClick={() => openEdit(entry)}
                    >
                      <div className="flex items-center gap-1 mb-1">
                        <Clock className="h-3 w-3 shrink-0" />
                        <span className="font-semibold">{entry.time_slot}{entry.end_time ? `–${entry.end_time}` : ""}</span>
                      </div>
                      <p className="font-medium leading-tight">{entry.activity}</p>
                      {entry.location && (
                        <div className="flex items-center gap-1 mt-1 opacity-75">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{entry.location}</span>
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5 mt-1"
                        onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </div>
                  )) : (
                    <p className="text-center text-[10px] text-muted-foreground py-4 italic">No entries</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {days.map((day, dayIdx) => {
              const dayEntries = entriesByDay[dayIdx];
              if (dayEntries.length === 0) return null;
              return (
                <div key={dayIdx}>
                  <h4 className="text-sm font-bold text-primary mb-2">{day}</h4>
                  <div className="space-y-2">
                    {dayEntries.map(entry => (
                      <div key={entry.id} className={`flex items-center justify-between rounded-lg border p-3 ${activityColors[entry.activity_type] || activityColors.other}`}>
                        <div className="flex items-center gap-3">
                          <div className="text-center min-w-[60px]">
                            <p className="text-xs font-bold">{entry.time_slot}</p>
                            {entry.end_time && <p className="text-[10px] opacity-75">to {entry.end_time}</p>}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{entry.activity}</p>
                            <div className="flex items-center gap-3 text-xs opacity-75">
                              <span>{activityTypes.find(t => t.value === entry.activity_type)?.label}</span>
                              {entry.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{entry.location}</span>}
                            </div>
                            {entry.description && <p className="text-xs mt-1 opacity-75">{entry.description}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(entry)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(entry.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Legend */}
        {entries.length > 0 && (
          <div className="flex flex-wrap gap-3 mt-6 pt-4 border-t">
            {activityTypes.map(t => (
              <div key={t.value} className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${activityColors[t.value]}`}>
                <span className="h-2 w-2 rounded-full bg-current" />
                {t.label}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
