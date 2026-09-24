import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Building, Plus, Edit, Trash2, Users, BedDouble, Heart, Search, Download, Eye, Phone, ArrowRightLeft, GripVertical } from "lucide-react";
import { FORM_LEVELS } from "@/lib/forms";

type Hostel = Tables<"hostels">;
type Room = Tables<"rooms">;
type BedAllocation = Tables<"bed_allocations">;
type HealthVisit = Tables<"health_visits">;
type StudentOption = Pick<Tables<"students">, "id" | "full_name" | "admission_number" | "form" | "stream" | "guardian_phone" | "emergency_contact">;
type StaffOption = Pick<Tables<"staff">, "id" | "full_name" | "role">;

const roomTypes = ["dormitory", "single", "double", "suite"];

export default function BoardingManagement() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("hostels");

  // Hostels
  const [hostels, setHostels] = useState<Hostel[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [allocations, setAllocations] = useState<BedAllocation[]>([]);
  const [healthVisits, setHealthVisits] = useState<HealthVisit[]>([]);
  const [students, setStudents] = useState<StudentOption[]>([]);
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);

  // Dialogs
  const [hostelDialog, setHostelDialog] = useState(false);
  const [roomDialog, setRoomDialog] = useState(false);
  const [allocDialog, setAllocDialog] = useState(false);
  const [healthDialog, setHealthDialog] = useState(false);
  const [hostelDetailId, setHostelDetailId] = useState<string | null>(null);

  // Forms
  const [editingHostelId, setEditingHostelId] = useState<string | null>(null);
  const [hostelForm, setHostelForm] = useState({ name: "", capacity: 0, phone: "", location: "", description: "", housemaster_id: "", assistant_housemaster_id: "" });
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  const [roomForm, setRoomForm] = useState({ hostel_id: "", room_number: "", room_type: "dormitory", capacity: 1, floor: 0, notes: "" });
  const [allocForm, setAllocForm] = useState({ room_id: "", student_id: "", bed_number: "" });
  const [healthForm, setHealthForm] = useState({ student_id: "", symptoms: "", diagnosis: "", treatment: "", medication_given: "", follow_up_date: "", visited_by: "", notes: "", parent_notified: false });

  // Filters
  const [boarderSearch, setBoarderSearch] = useState("");
  const [boarderHostelFilter, setBoarderHostelFilter] = useState("all");
  const [boarderFormFilter, setBoarderFormFilter] = useState("all");
  const [healthSearch, setHealthSearch] = useState("");

  useEffect(() => { fetchAll(); }, []);

  const fetchAll = async () => {
    setLoading(true);
    const [h, r, a, hv, s, st] = await Promise.all([
      supabase.from("hostels").select("*").order("name"),
      supabase.from("rooms").select("*").order("room_number"),
      supabase.from("bed_allocations").select("*").eq("status", "active"),
      supabase.from("health_visits").select("*").order("visit_date", { ascending: false }).limit(200),
      supabase.from("students").select("id, full_name, admission_number, form, stream, guardian_phone, emergency_contact").eq("status", "active").order("full_name"),
      supabase.from("staff").select("id, full_name, role").order("full_name"),
    ]);
    if (h.data) setHostels(h.data);
    if (r.data) setRooms(r.data);
    if (a.data) setAllocations(a.data);
    if (hv.data) setHealthVisits(hv.data);
    if (s.data) setStudents(s.data);
    if (st.data) setStaff(st.data);
    setLoading(false);
  };

  // =========== HOSTELS ===========
  const openAddHostel = () => {
    setEditingHostelId(null);
    setHostelForm({ name: "", capacity: 0, phone: "", location: "", description: "", housemaster_id: "", assistant_housemaster_id: "" });
    setHostelDialog(true);
  };
  const openEditHostel = (h: Hostel) => {
    setEditingHostelId(h.id);
    setHostelForm({ name: h.name, capacity: h.capacity ?? 0, phone: h.phone || "", location: h.location || "", description: h.description || "", housemaster_id: h.housemaster_id || "", assistant_housemaster_id: h.assistant_housemaster_id || "" });
    setHostelDialog(true);
  };
  const saveHostel = async () => {
    const payload = { ...hostelForm, housemaster_id: hostelForm.housemaster_id || null, assistant_housemaster_id: hostelForm.assistant_housemaster_id || null };
    if (editingHostelId) {
      const { error } = await supabase.from("hostels").update(payload).eq("id", editingHostelId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Hostel updated" });
    } else {
      const { error } = await supabase.from("hostels").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Hostel added" });
    }
    setHostelDialog(false);
    fetchAll();
  };
  const deleteHostel = async (id: string) => {
    await supabase.from("hostels").delete().eq("id", id);
    toast({ title: "Hostel removed" });
    fetchAll();
  };

  // =========== ROOMS ===========
  const openAddRoom = (hostelId?: string) => {
    setEditingRoomId(null);
    setRoomForm({ hostel_id: hostelId || "", room_number: "", room_type: "dormitory", capacity: 1, floor: 0, notes: "" });
    setRoomDialog(true);
  };
  const saveRoom = async () => {
    const payload = { ...roomForm, floor: roomForm.floor || null };
    if (editingRoomId) {
      const { error } = await supabase.from("rooms").update(payload).eq("id", editingRoomId);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Room updated" });
    } else {
      const { error } = await supabase.from("rooms").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
      toast({ title: "Room added" });
    }
    setRoomDialog(false);
    fetchAll();
  };

  // =========== ALLOCATIONS ===========
  const openAllocate = (roomId?: string) => {
    setAllocForm({ room_id: roomId || "", student_id: "", bed_number: "" });
    setAllocDialog(true);
  };
  const saveAllocation = async () => {
    if (!allocForm.room_id || !allocForm.student_id) { toast({ title: "Select room and student", variant: "destructive" }); return; }
    const { error } = await supabase.from("bed_allocations").insert({
      room_id: allocForm.room_id, student_id: allocForm.student_id,
      bed_number: allocForm.bed_number || null, status: "active",
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Student allocated" });
    setAllocDialog(false);
    fetchAll();
  };
  const vacateStudent = async (alloc: BedAllocation) => {
    const { error } = await supabase.from("bed_allocations").update({ status: "vacated", allocation_end_date: new Date().toISOString().split("T")[0] }).eq("id", alloc.id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Student vacated" });
    fetchAll();
  };

  // Drag-and-drop transfer
  const [dragAlloc, setDragAlloc] = useState<BedAllocation | null>(null);
  const [dropTargetRoom, setDropTargetRoom] = useState<string | null>(null);

  const handleDragStart = (e: React.DragEvent, alloc: BedAllocation) => {
    setDragAlloc(alloc);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", alloc.id);
  };

  const handleDragOver = (e: React.DragEvent, roomId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDropTargetRoom(roomId);
  };

  const handleDragLeave = () => {
    setDropTargetRoom(null);
  };

  const handleDrop = async (e: React.DragEvent, targetRoomId: string) => {
    e.preventDefault();
    setDropTargetRoom(null);
    if (!dragAlloc || dragAlloc.room_id === targetRoomId) { setDragAlloc(null); return; }

    const targetRoom = rooms.find(r => r.id === targetRoomId);
    const sourceRoom = rooms.find(r => r.id === dragAlloc.room_id);
    if (!targetRoom || !sourceRoom) { setDragAlloc(null); return; }

    const targetAllocs = allocations.filter(a => a.room_id === targetRoomId);
    if (targetAllocs.length >= (targetRoom.capacity ?? 0)) {
      toast({ title: "Room is full", description: `${targetRoom.room_number} has no vacancies`, variant: "destructive" });
      setDragAlloc(null);
      return;
    }

    // Update allocation to new room
    const { error } = await supabase.from("bed_allocations").update({ room_id: targetRoomId, status: "active" }).eq("id", dragAlloc.id);
    if (error) { toast({ title: "Transfer failed", description: error.message, variant: "destructive" }); setDragAlloc(null); return; }

    toast({ title: "Student transferred", description: `Moved ${studentName(dragAlloc.student_id)} to room ${targetRoom.room_number}` });
    setDragAlloc(null);
    fetchAll();
  };

  // =========== HEALTH ===========
  const openAddHealth = () => {
    setHealthForm({ student_id: "", symptoms: "", diagnosis: "", treatment: "", medication_given: "", follow_up_date: "", visited_by: "", notes: "", parent_notified: false });
    setHealthDialog(true);
  };
  const saveHealth = async () => {
    if (!healthForm.student_id) { toast({ title: "Select a student", variant: "destructive" }); return; }
    const { error } = await supabase.from("health_visits").insert({
      ...healthForm, follow_up_date: healthForm.follow_up_date || null,
    });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Health visit recorded" });
    setHealthDialog(false);
    fetchAll();
  };

  // =========== HELPERS ===========
  const studentName = (id: string) => students.find(s => s.id === id)?.full_name || "Unknown";
  const staffName = (id: string | null) => (id ? staff.find(s => s.id === id)?.full_name : null) || "-";
  const allocatedStudentIds = new Set(allocations.map(a => a.student_id));
  const unallocatedStudents = students.filter(s => !allocatedStudentIds.has(s.id));

  // Boarder list with filters
  const boarders = allocations.map(a => {
    const student = students.find(s => s.id === a.student_id);
    const room = rooms.find(r => r.id === a.room_id);
    const hostel = room ? hostels.find(h => h.id === room.hostel_id) : null;
    return { ...a, student, room, hostel };
  }).filter(b => {
    if (!b.student) return false;
    const matchSearch = boarderSearch ? (b.student.full_name.toLowerCase().includes(boarderSearch.toLowerCase()) || b.student.admission_number.toLowerCase().includes(boarderSearch.toLowerCase())) : true;
    const matchHostel = boarderHostelFilter === "all" || b.hostel?.id === boarderHostelFilter;
    const matchForm = boarderFormFilter === "all" || b.student.form === boarderFormFilter;
    return matchSearch && matchHostel && matchForm;
  });

  const exportBoarders = () => {
    const header = "Admission #,Name,Form,Hostel,Room,Bed,Guardian Phone,Emergency Contact";
    const rows = boarders.map(b => `${b.student?.admission_number},"${b.student?.full_name}",${b.student?.form},${b.hostel?.name || ""},${b.room?.room_number || ""},${b.bed_number || ""},${b.student?.guardian_phone || ""},${b.student?.emergency_contact || ""}`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `boarders-${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const detailHostel = hostelDetailId ? hostels.find(h => h.id === hostelDetailId) : null;
  const detailRooms = hostelDetailId ? rooms.filter(r => r.hostel_id === hostelDetailId) : [];
  const detailAllocations = detailRooms.flatMap(r => allocations.filter(a => a.room_id === r.id));

  if (loading) return <div className="py-12 text-center text-muted-foreground">Loading boarding data...</div>;

  return (
    <div className="space-y-6">
      <h2 className="font-heading text-2xl font-bold text-foreground">Boarding Management</h2>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="hostels"><Building className="mr-1 h-4 w-4" /> Hostels</TabsTrigger>
          <TabsTrigger value="boarders"><Users className="mr-1 h-4 w-4" /> Boarders</TabsTrigger>
          <TabsTrigger value="health"><Heart className="mr-1 h-4 w-4" /> Health</TabsTrigger>
        </TabsList>

        {/* ============ HOSTELS TAB ============ */}
        <TabsContent value="hostels" className="space-y-4">
          {hostelDetailId && detailHostel ? (
            // Hostel detail view
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Button variant="outline" size="sm" onClick={() => setHostelDetailId(null)}>← Back</Button>
                <h3 className="font-heading text-xl font-bold">{detailHostel.name}</h3>
              </div>

              {/* Summary cards */}
              <div className="grid gap-4 sm:grid-cols-4">
                <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-primary">{detailHostel.capacity}</p><p className="text-xs text-muted-foreground">Total Capacity</p></CardContent></Card>
                <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-secondary">{detailAllocations.length}</p><p className="text-xs text-muted-foreground">Current Boarders</p></CardContent></Card>
                <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-accent">{detailRooms.length}</p><p className="text-xs text-muted-foreground">Rooms</p></CardContent></Card>
                <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{detailHostel.capacity - detailAllocations.length}</p><p className="text-xs text-muted-foreground">Vacancies</p></CardContent></Card>
              </div>

              {/* Housemaster info */}
              <Card>
                <CardContent className="p-4 flex flex-wrap gap-6 text-sm">
                  <div><span className="text-muted-foreground">Housemaster:</span> <strong>{staffName(detailHostel.housemaster_id)}</strong></div>
                  <div><span className="text-muted-foreground">Assistant:</span> <strong>{staffName(detailHostel.assistant_housemaster_id)}</strong></div>
                  {detailHostel.phone && <div><Phone className="inline h-3.5 w-3.5 mr-1" />{detailHostel.phone}</div>}
                  {detailHostel.location && <div>📍 {detailHostel.location}</div>}
                </CardContent>
              </Card>

              {/* Room grid */}
              <div className="flex items-center justify-between">
                <h4 className="font-heading font-semibold">Rooms</h4>
                <Button size="sm" onClick={() => openAddRoom(hostelDetailId)}><Plus className="mr-1 h-4 w-4" /> Add Room</Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                {detailRooms.map(room => {
                  const roomAllocs = allocations.filter(a => a.room_id === room.id);
                  const occupancyPct = room.capacity > 0 ? (roomAllocs.length / room.capacity) * 100 : 0;
                  const color = occupancyPct >= 100 ? "bg-destructive/10 border-destructive/30" : occupancyPct >= 75 ? "bg-orange-50 border-orange-200" : "bg-green-50 border-green-200";
                  const isDropTarget = dropTargetRoom === room.id && dragAlloc?.room_id !== room.id;
                  return (
                    <Card
                      key={room.id}
                      className={`border-2 transition-all ${color} ${isDropTarget ? "ring-2 ring-primary scale-[1.02] shadow-lg" : ""}`}
                      onDragOver={(e) => handleDragOver(e, room.id)}
                      onDragLeave={handleDragLeave}
                      onDrop={(e) => handleDrop(e, room.id)}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-mono font-bold text-sm">{room.room_number}</span>
                          <Badge variant="outline" className="text-[10px]">{room.room_type}</Badge>
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">{roomAllocs.length}/{room.capacity} beds • Floor {room.floor || "G"}</div>
                        <div className="space-y-1 mb-2">
                          {roomAllocs.map(a => (
                            <div
                              key={a.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, a)}
                              onDragEnd={() => { setDragAlloc(null); setDropTargetRoom(null); }}
                              className="flex items-center justify-between text-xs bg-background/80 rounded px-1.5 py-1 cursor-grab active:cursor-grabbing border border-transparent hover:border-muted-foreground/20 transition-colors group"
                            >
                              <div className="flex items-center gap-1 truncate flex-1">
                                <GripVertical className="h-3 w-3 text-muted-foreground/50 group-hover:text-muted-foreground shrink-0" />
                                <span className="truncate">{studentName(a.student_id)}</span>
                              </div>
                              <AlertDialog>
                                <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-5 w-5"><Trash2 className="h-3 w-3 text-destructive" /></Button></AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader><AlertDialogTitle>Vacate student?</AlertDialogTitle>
                                    <AlertDialogDescription>Remove {studentName(a.student_id)} from room {room.room_number}?</AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => vacateStudent(a)}>Vacate</AlertDialogAction></AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          ))}
                        </div>
                        {isDropTarget && roomAllocs.length < room.capacity && (
                          <div className="border-2 border-dashed border-primary/50 rounded p-1.5 text-center text-xs text-primary animate-pulse">
                            Drop here to transfer
                          </div>
                        )}
                        {roomAllocs.length < room.capacity && !isDropTarget && (
                          <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => openAllocate(room.id)}>
                            <Plus className="mr-1 h-3 w-3" /> Assign
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ) : (
            // Hostel list view
            <div className="space-y-4">
              <div className="flex justify-end">
                <Button onClick={openAddHostel}><Plus className="mr-1 h-4 w-4" /> Add Hostel</Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {hostels.map(h => {
                  const hostelRooms = rooms.filter(r => r.hostel_id === h.id);
                  const hostelAllocs = hostelRooms.flatMap(r => allocations.filter(a => a.room_id === r.id));
                  const pct = h.capacity > 0 ? Math.round((hostelAllocs.length / h.capacity) * 100) : 0;
                  return (
                    <Card key={h.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between">
                          <CardTitle className="font-heading text-lg">{h.name}</CardTitle>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => setHostelDetailId(h.id)}><Eye className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="icon" onClick={() => openEditHostel(h)}><Edit className="h-4 w-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="ghost" size="icon"><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader><AlertDialogTitle>Delete {h.name}?</AlertDialogTitle>
                                  <AlertDialogDescription>This will remove the hostel and all its rooms. This cannot be undone.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => deleteHostel(h.id)} className="bg-destructive">Delete</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Occupancy</span>
                            <span className="font-semibold">{hostelAllocs.length}/{h.capacity} ({pct}%)</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-orange-500" : "bg-green-500"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                          </div>
                          <div className="flex gap-4 text-xs text-muted-foreground">
                            <span><BedDouble className="inline h-3 w-3 mr-1" />{hostelRooms.length} rooms</span>
                            {h.location && <span>📍 {h.location}</span>}
                          </div>
                          <div className="text-xs"><span className="text-muted-foreground">Housemaster:</span> {staffName(h.housemaster_id)}</div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
                {hostels.length === 0 && (
                  <div className="col-span-full text-center py-12 text-muted-foreground">No hostels yet. Click "Add Hostel" to get started.</div>
                )}
              </div>
            </div>
          )}
        </TabsContent>

        {/* ============ BOARDERS TAB ============ */}
        <TabsContent value="boarders" className="space-y-4">
          <Card>
            <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search by name or admission #..." value={boarderSearch} onChange={e => setBoarderSearch(e.target.value)} className="pl-9" />
              </div>
              <Select value={boarderHostelFilter} onValueChange={setBoarderHostelFilter}>
                <SelectTrigger className="w-[160px]"><SelectValue placeholder="Hostel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Hostels</SelectItem>
                  {hostels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={boarderFormFilter} onValueChange={setBoarderFormFilter}>
                <SelectTrigger className="w-[140px]"><SelectValue placeholder="Form" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Forms</SelectItem>
                  {FORM_LEVELS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" onClick={exportBoarders}><Download className="mr-1 h-4 w-4" /> Export</Button>
            </CardContent>
          </Card>

          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Adm #</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Form</TableHead>
                    <TableHead>Hostel</TableHead>
                    <TableHead>Room</TableHead>
                    <TableHead>Bed</TableHead>
                    <TableHead>Emergency</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {boarders.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">No boarders found.</TableCell></TableRow>
                  ) : boarders.map(b => (
                    <TableRow key={b.id}>
                      <TableCell className="font-mono text-xs">{b.student?.admission_number}</TableCell>
                      <TableCell className="font-medium">{b.student?.full_name}</TableCell>
                      <TableCell>{b.student?.form}</TableCell>
                      <TableCell>{b.hostel?.name || "-"}</TableCell>
                      <TableCell>{b.room?.room_number || "-"}</TableCell>
                      <TableCell>{b.bed_number || "-"}</TableCell>
                      <TableCell>
                        {b.student?.emergency_contact ? (
                          <a href={`tel:${b.student.emergency_contact}`} className="text-primary hover:underline text-xs flex items-center gap-1">
                            <Phone className="h-3 w-3" />{b.student.emergency_contact}
                          </a>
                        ) : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild><Button variant="ghost" size="sm" className="text-xs"><ArrowRightLeft className="mr-1 h-3 w-3" /> Vacate</Button></AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader><AlertDialogTitle>Vacate {b.student?.full_name}?</AlertDialogTitle></AlertDialogHeader>
                            <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => vacateStudent(b)}>Vacate</AlertDialogAction></AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>

        {/* ============ HEALTH TAB ============ */}
        <TabsContent value="health" className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search visits..." value={healthSearch} onChange={e => setHealthSearch(e.target.value)} className="pl-9" />
            </div>
            <Button onClick={openAddHealth}><Plus className="mr-1 h-4 w-4" /> Record Visit</Button>
          </div>

          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Student</TableHead>
                    <TableHead>Symptoms</TableHead>
                    <TableHead>Diagnosis</TableHead>
                    <TableHead>Treatment</TableHead>
                    <TableHead>Follow-up</TableHead>
                    <TableHead>Notified</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {healthVisits.filter(v => {
                    if (!healthSearch) return true;
                    const name = studentName(v.student_id).toLowerCase();
                    return name.includes(healthSearch.toLowerCase()) || v.symptoms?.toLowerCase().includes(healthSearch.toLowerCase());
                  }).map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="text-xs">{new Date(v.visit_date).toLocaleDateString()}</TableCell>
                      <TableCell className="font-medium">{studentName(v.student_id)}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{v.symptoms || "-"}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{v.diagnosis || "-"}</TableCell>
                      <TableCell className="text-sm max-w-[200px] truncate">{v.treatment || "-"}</TableCell>
                      <TableCell className="text-xs">{v.follow_up_date ? new Date(v.follow_up_date).toLocaleDateString() : "-"}</TableCell>
                      <TableCell><Badge variant={v.parent_notified ? "default" : "outline"} className="text-[10px]">{v.parent_notified ? "Yes" : "No"}</Badge></TableCell>
                    </TableRow>
                  ))}
                  {healthVisits.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No health visits recorded.</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ============ HOSTEL DIALOG ============ */}
      <Dialog open={hostelDialog} onOpenChange={setHostelDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-heading">{editingHostelId ? "Edit Hostel" : "Add Hostel"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1"><Label>Name *</Label><Input value={hostelForm.name} onChange={e => setHostelForm(f => ({ ...f, name: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Total Capacity *</Label><Input type="number" value={hostelForm.capacity} onChange={e => setHostelForm(f => ({ ...f, capacity: parseInt(e.target.value) || 0 }))} /></div>
            <div className="space-y-1"><Label>Phone</Label><Input value={hostelForm.phone} onChange={e => setHostelForm(f => ({ ...f, phone: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Location</Label><Input value={hostelForm.location} onChange={e => setHostelForm(f => ({ ...f, location: e.target.value }))} /></div>
            <div className="space-y-1">
              <Label>Housemaster</Label>
              <Select value={hostelForm.housemaster_id} onValueChange={v => setHostelForm(f => ({ ...f, housemaster_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{staff.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Assistant Housemaster</Label>
              <Select value={hostelForm.assistant_housemaster_id} onValueChange={v => setHostelForm(f => ({ ...f, assistant_housemaster_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>{staff.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1"><Label>Description</Label><Textarea value={hostelForm.description} onChange={e => setHostelForm(f => ({ ...f, description: e.target.value }))} rows={2} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setHostelDialog(false)}>Cancel</Button>
            <Button onClick={saveHostel} disabled={!hostelForm.name}>{editingHostelId ? "Update" : "Add"} Hostel</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ ROOM DIALOG ============ */}
      <Dialog open={roomDialog} onOpenChange={setRoomDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading">{editingRoomId ? "Edit Room" : "Add Room"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <Label>Hostel *</Label>
              <Select value={roomForm.hostel_id} onValueChange={v => setRoomForm(f => ({ ...f, hostel_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select hostel" /></SelectTrigger>
                <SelectContent>{hostels.map(h => <SelectItem key={h.id} value={h.id}>{h.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Room Number *</Label><Input value={roomForm.room_number} onChange={e => setRoomForm(f => ({ ...f, room_number: e.target.value }))} /></div>
            <div className="space-y-1">
              <Label>Type</Label>
              <Select value={roomForm.room_type} onValueChange={v => setRoomForm(f => ({ ...f, room_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{roomTypes.map(t => <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Capacity</Label><Input type="number" value={roomForm.capacity} onChange={e => setRoomForm(f => ({ ...f, capacity: parseInt(e.target.value) || 1 }))} /></div>
            <div className="space-y-1"><Label>Floor</Label><Input type="number" value={roomForm.floor} onChange={e => setRoomForm(f => ({ ...f, floor: parseInt(e.target.value) || 0 }))} /></div>
            <div className="sm:col-span-2 space-y-1"><Label>Notes</Label><Textarea value={roomForm.notes} onChange={e => setRoomForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setRoomDialog(false)}>Cancel</Button>
            <Button onClick={saveRoom} disabled={!roomForm.hostel_id || !roomForm.room_number}>Save Room</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ ALLOCATION DIALOG ============ */}
      <Dialog open={allocDialog} onOpenChange={setAllocDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="font-heading">Assign Student to Bed</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Room *</Label>
              <Select value={allocForm.room_id} onValueChange={v => setAllocForm(f => ({ ...f, room_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select room" /></SelectTrigger>
                <SelectContent>
                  {rooms.filter(r => {
                    const roomAllocs = allocations.filter(a => a.room_id === r.id);
                    return roomAllocs.length < r.capacity;
                  }).map(r => {
                    const hostel = hostels.find(h => h.id === r.hostel_id);
                    return <SelectItem key={r.id} value={r.id}>{hostel?.name} · {r.room_number}</SelectItem>;
                  })}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Student *</Label>
              <Select value={allocForm.student_id} onValueChange={v => setAllocForm(f => ({ ...f, student_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>
                  {unallocatedStudents.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name} ({s.admission_number})</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Bed Number (optional)</Label><Input value={allocForm.bed_number} onChange={e => setAllocForm(f => ({ ...f, bed_number: e.target.value }))} placeholder="e.g. B3" /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setAllocDialog(false)}>Cancel</Button>
            <Button onClick={saveAllocation}>Assign</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ============ HEALTH VISIT DIALOG ============ */}
      <Dialog open={healthDialog} onOpenChange={setHealthDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle className="font-heading">Record Health Visit</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2 space-y-1">
              <Label>Student *</Label>
              <Select value={healthForm.student_id} onValueChange={v => setHealthForm(f => ({ ...f, student_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Select student" /></SelectTrigger>
                <SelectContent>{students.map(s => <SelectItem key={s.id} value={s.id}>{s.full_name} ({s.admission_number})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2 space-y-1"><Label>Symptoms</Label><Textarea value={healthForm.symptoms} onChange={e => setHealthForm(f => ({ ...f, symptoms: e.target.value }))} rows={2} /></div>
            <div className="space-y-1"><Label>Diagnosis</Label><Input value={healthForm.diagnosis} onChange={e => setHealthForm(f => ({ ...f, diagnosis: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Treatment</Label><Input value={healthForm.treatment} onChange={e => setHealthForm(f => ({ ...f, treatment: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Medication Given</Label><Input value={healthForm.medication_given} onChange={e => setHealthForm(f => ({ ...f, medication_given: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Follow-up Date</Label><Input type="date" value={healthForm.follow_up_date} onChange={e => setHealthForm(f => ({ ...f, follow_up_date: e.target.value }))} /></div>
            <div className="space-y-1"><Label>Seen By (Nurse)</Label><Input value={healthForm.visited_by} onChange={e => setHealthForm(f => ({ ...f, visited_by: e.target.value }))} /></div>
            <div className="flex items-center gap-2 pt-5">
              <input type="checkbox" checked={healthForm.parent_notified} onChange={e => setHealthForm(f => ({ ...f, parent_notified: e.target.checked }))} className="rounded" />
              <Label className="text-sm">Parent notified</Label>
            </div>
            <div className="sm:col-span-2 space-y-1"><Label>Notes</Label><Textarea value={healthForm.notes} onChange={e => setHealthForm(f => ({ ...f, notes: e.target.value }))} rows={2} /></div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setHealthDialog(false)}>Cancel</Button>
            <Button onClick={saveHealth} disabled={!healthForm.student_id}>Save Visit</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
