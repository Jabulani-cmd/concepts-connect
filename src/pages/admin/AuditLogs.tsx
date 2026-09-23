import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Search, Download, Eye, RefreshCw, Shield, Filter } from "lucide-react";
import * as XLSX from "xlsx";

interface AuditLog {
  id: string;
  user_id: string | null;
  action: string;
  table_name: string | null;
  record_id: string | null;
  old_data: any;
  new_data: any;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

const ACTION_TYPES = ["all", "INSERT", "UPDATE", "DELETE", "LOGIN", "LOGOUT", "EXPORT", "VIEW"];
const ACTION_COLORS: Record<string, string> = {
  INSERT: "default",
  UPDATE: "secondary",
  DELETE: "destructive",
  LOGIN: "outline",
  LOGOUT: "outline",
  EXPORT: "secondary",
  VIEW: "outline",
};

export default function AuditLogs() {
  const { toast } = useToast();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("all");
  const [tableFilter, setTableFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);
  const [tables, setTables] = useState<string[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchLogs();
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("id, full_name");
    if (data) {
      const map: Record<string, string> = {};
      data.forEach(p => { map[p.id] = p.full_name; });
      setProfiles(map);
    }
  };

  const fetchLogs = async () => {
    setLoading(true);
    let query = supabase
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(500);

    if (actionFilter !== "all") query = query.eq("action", actionFilter);
    if (tableFilter !== "all") query = query.eq("table_name", tableFilter);
    if (dateFrom) query = query.gte("created_at", new Date(dateFrom).toISOString());
    if (dateTo) query = query.lte("created_at", new Date(dateTo + "T23:59:59").toISOString());

    const { data, error } = await query;
    if (error) {
      toast({ title: "Error loading logs", description: error.message, variant: "destructive" });
    } else {
      setLogs(data || []);
      // Extract unique tables
      const uniqueTables = [...new Set((data || []).map(l => l.table_name).filter(Boolean))] as string[];
      setTables(uniqueTables);
    }
    setLoading(false);
  };

  const filteredLogs = logs.filter(l => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      l.action?.toLowerCase().includes(s) ||
      l.table_name?.toLowerCase().includes(s) ||
      (l.user_id && profiles[l.user_id]?.toLowerCase().includes(s)) ||
      l.record_id?.toLowerCase().includes(s)
    );
  });

  const exportCSV = () => {
    const wb = XLSX.utils.book_new();
    const wsData = [
      ["Timestamp", "User", "Action", "Table", "Record ID", "IP Address"],
      ...filteredLogs.map(l => [
        new Date(l.created_at).toLocaleString(),
        l.user_id ? (profiles[l.user_id] || l.user_id) : "System",
        l.action,
        l.table_name || "",
        l.record_id || "",
        l.ip_address || "",
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Audit Logs");
    XLSX.writeFile(wb, `audit_logs_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast({ title: "Audit log exported" });
  };

  const logAuditAction = async (action: string, tableName?: string, recordId?: string, oldData?: any, newData?: any) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      user_id: user?.id || null,
      action,
      table_name: tableName || null,
      record_id: recordId || null,
      old_data: oldData || null,
      new_data: newData || null,
    } as any);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-primary flex items-center gap-2">
            <Shield className="h-5 w-5" /> Audit Logs
          </h2>
          <p className="text-sm text-muted-foreground">Track all system activity and changes</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
          <Button size="sm" onClick={exportCSV}>
            <Download className="mr-1 h-4 w-4" /> Export
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="text-xs font-medium text-muted-foreground">Search</label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input placeholder="Search by user, action, table…" value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="w-40">
              <label className="text-xs font-medium text-muted-foreground">Action</label>
              <Select value={actionFilter} onValueChange={v => { setActionFilter(v); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ACTION_TYPES.map(a => <SelectItem key={a} value={a}>{a === "all" ? "All Actions" : a}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <label className="text-xs font-medium text-muted-foreground">Table</label>
              <Select value={tableFilter} onValueChange={v => { setTableFilter(v); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Tables</SelectItem>
                  {tables.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="w-40">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
            </div>
            <div className="w-40">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} />
            </div>
            <Button variant="secondary" size="sm" onClick={fetchLogs}>
              <Filter className="mr-1 h-4 w-4" /> Apply
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary */}
      <div className="grid gap-4 sm:grid-cols-4">
        {[
          { label: "Total Logs", value: filteredLogs.length },
          { label: "Inserts", value: filteredLogs.filter(l => l.action === "INSERT").length },
          { label: "Updates", value: filteredLogs.filter(l => l.action === "UPDATE").length },
          { label: "Deletes", value: filteredLogs.filter(l => l.action === "DELETE").length },
        ].map((s, i) => (
          <Card key={i} className="border-none shadow-sm">
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{s.value}</p>
              <p className="text-xs text-muted-foreground">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Logs Table */}
      <Card>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Timestamp</TableHead>
                  <TableHead>User</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Table</TableHead>
                  <TableHead>Record</TableHead>
                  <TableHead className="text-right">Details</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      {loading ? "Loading audit logs…" : "No audit logs found. Activity will appear here as users interact with the system."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLogs.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-sm">{l.user_id ? (profiles[l.user_id] || l.user_id.slice(0, 8) + "…") : "System"}</TableCell>
                      <TableCell>
                        <Badge variant={(ACTION_COLORS[l.action] as any) || "outline"}>{l.action}</Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">{l.table_name || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{l.record_id ? l.record_id.slice(0, 8) + "…" : "—"}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => setSelectedLog(l)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="font-heading">Audit Log Detail</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><span className="font-medium text-muted-foreground">Timestamp:</span><p>{new Date(selectedLog.created_at).toLocaleString()}</p></div>
                <div><span className="font-medium text-muted-foreground">Action:</span><p><Badge variant={(ACTION_COLORS[selectedLog.action] as any) || "outline"}>{selectedLog.action}</Badge></p></div>
                <div><span className="font-medium text-muted-foreground">User:</span><p>{selectedLog.user_id ? (profiles[selectedLog.user_id] || selectedLog.user_id) : "System"}</p></div>
                <div><span className="font-medium text-muted-foreground">Table:</span><p>{selectedLog.table_name || "—"}</p></div>
                <div><span className="font-medium text-muted-foreground">Record ID:</span><p className="font-mono text-xs">{selectedLog.record_id || "—"}</p></div>
                <div><span className="font-medium text-muted-foreground">IP Address:</span><p>{selectedLog.ip_address || "—"}</p></div>
              </div>
              {selectedLog.old_data && (
                <div>
                  <span className="font-medium text-muted-foreground">Previous Data:</span>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(selectedLog.old_data, null, 2)}</pre>
                </div>
              )}
              {selectedLog.new_data && (
                <div>
                  <span className="font-medium text-muted-foreground">New Data:</span>
                  <pre className="mt-1 max-h-40 overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(selectedLog.new_data, null, 2)}</pre>
                </div>
              )}
              {selectedLog.user_agent && (
                <div>
                  <span className="font-medium text-muted-foreground">User Agent:</span>
                  <p className="text-xs text-muted-foreground break-all">{selectedLog.user_agent}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
