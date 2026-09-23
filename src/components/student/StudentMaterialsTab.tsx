import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Video, Link as LinkIcon, Presentation, Download, Search, Eye, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const typeIcons: Record<string, any> = {
  document: FileText,
  video: Video,
  link: LinkIcon,
  presentation: Presentation,
};

interface Props {
  studentClassId: string | null;
}

export default function StudentMaterialsTab({ studentClassId }: Props) {
  const [materials, setMaterials] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");

  useEffect(() => {
    fetchMaterials();
    fetchSubjects();
  }, [studentClassId]);

  const fetchMaterials = async () => {
    setLoading(true);
    let query = supabase
      .from("study_materials")
      .select("*, subjects(name), classes(name)")
      .eq("is_published", true)
      .order("created_at", { ascending: false });

    if (studentClassId) {
      query = query.eq("class_id", studentClassId);
    }

    const { data } = await query;
    setMaterials(data || []);
    setLoading(false);
  };

  const fetchSubjects = async () => {
    const { data } = await supabase.from("subjects").select("id, name").order("name");
    setSubjects(data || []);
  };

  const filtered = materials.filter((m) => {
    const matchSearch = !search || m.title.toLowerCase().includes(search.toLowerCase());
    const matchSubject = subjectFilter === "all" || m.subject_id === subjectFilter;
    return matchSearch && matchSubject;
  });

  const bumpCount = (m: any) => {
    supabase.from("study_materials").update({ download_count: (m.download_count || 0) + 1 }).eq("id", m.id).then();
  };

  const openView = (m: any) => {
    const url = m.file_url || m.link_url;
    if (!url) return;
    window.open(url, "_blank", "noopener,noreferrer");
    bumpCount(m);
  };

  const openPrint = (m: any) => {
    const url = m.file_url || m.link_url;
    if (!url) return;
    const w = window.open(url, "_blank");
    if (w) {
      // Give the browser a moment to load the file, then trigger print
      setTimeout(() => { try { w.focus(); w.print(); } catch {} }, 1200);
    }
    bumpCount(m);
  };

  const handleDownload = async (m: any) => {
    const url = m.file_url || m.link_url;
    if (!url) return;
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      const ext = (url.split(".").pop() || "").split("?")[0];
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `${m.title}${ext ? "." + ext : ""}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(a.href);
    } catch {
      window.open(url, "_blank", "noopener,noreferrer");
    }
    bumpCount(m);
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search & Filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search materials..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={subjectFilter} onValueChange={setSubjectFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {subjects.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Materials List */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpenIcon className="mx-auto mb-3 h-10 w-10 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No study materials available yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Check back later for new uploads from your teachers.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((m) => {
            const Icon = typeIcons[m.material_type] || FileText;
            return (
              <Card key={m.id} className="overflow-hidden">
                <CardContent className="flex items-center gap-3 p-3">
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-secondary/10">
                    <Icon className="h-5 w-5 text-secondary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium leading-tight truncate">{m.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[11px] text-muted-foreground">{m.subjects?.name || "General"}</span>
                      <span className="text-[11px] text-muted-foreground">•</span>
                      <span className="text-[11px] text-muted-foreground">
                        {format(new Date(m.created_at), "MMM d")}
                      </span>
                    </div>
                    {m.tags && m.tags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {m.tags.slice(0, 2).map((t: string) => (
                          <Badge key={t} variant="outline" className="text-[9px] px-1.5 py-0">{t}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Button variant="ghost" size="icon" className="h-9 w-9" title="View" onClick={() => openView(m)}>
                      <Eye className="h-4 w-4" />
                    </Button>
                    {m.material_type !== "link" && m.file_url && (
                      <Button variant="ghost" size="icon" className="h-9 w-9" title="Print" onClick={() => openPrint(m)}>
                        <Printer className="h-4 w-4" />
                      </Button>
                    )}
                    {m.material_type !== "link" && m.file_url && (
                      <Button variant="ghost" size="icon" className="h-9 w-9" title="Download" onClick={() => handleDownload(m)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

function BookOpenIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}
