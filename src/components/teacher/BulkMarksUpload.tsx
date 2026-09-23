import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Download, Upload, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import type { ClassOption, SubjectOption, StudentOption } from "@/types/school";
import { gradeFor } from "@/lib/grading";

interface Props {
  userId: string;
  classes: ClassOption[];
  subjects: SubjectOption[];
  students: StudentOption[];
  onMarksUploaded: () => void;
}

interface ParsedRow {
  admission_number: string;
  student_name: string;
  mark: number;
  student_id?: string;
  error?: string;
}

export default function BulkMarksUpload({ userId, classes, subjects, students, onMarksUploaded }: Props) {
  const { toast } = useToast();
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [term, setTerm] = useState("Term 1");
  const [assessmentType, setAssessmentType] = useState("test");
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const classStudents = classId
    ? students.filter(s => {
        const cls = classes.find(c => c.id === classId);
        return cls ? s.form === cls.level : false;
      })
    : [];

  const downloadTemplate = () => {
    const studs = classStudents.length > 0 ? classStudents : students.slice(0, 20);
    const header = "Admission Number,Student Name,Mark (%)";
    const rows = studs.map(s => `${s.admission_number},${s.full_name},`);
    const csv = [header, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const cls = classes.find(c => c.id === classId);
    a.download = `marks-template-${cls?.name || "all"}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n").filter(l => l.trim());
      // Skip header
      const dataLines = lines.slice(1);
      const parsed: ParsedRow[] = dataLines.map(line => {
        const parts = line.split(",").map(p => p.trim().replace(/^"|"$/g, ""));
        const admission = parts[0];
        const name = parts[1] || "";
        const markStr = parts[2];
        const mark = parseFloat(markStr);

        const student = students.find(s => s.admission_number === admission);

        if (!admission) return { admission_number: admission, student_name: name, mark: 0, error: "Missing admission number" };
        if (isNaN(mark) || mark < 0 || mark > 100) return { admission_number: admission, student_name: name, mark: 0, error: "Invalid mark (0-100)" };
        if (!student) return { admission_number: admission, student_name: name, mark, error: "Student not found" };

        return { admission_number: admission, student_name: student.full_name, mark, student_id: student.id };
      });

      setParsedRows(parsed);
      setShowPreview(true);
    };
    reader.readAsText(file);
  };

  const submitBulkMarks = async () => {
    if (!subjectId) { toast({ title: "Select a subject", variant: "destructive" }); return; }

    const validRows = parsedRows.filter(r => r.student_id && !r.error);
    if (validRows.length === 0) { toast({ title: "No valid rows to upload", variant: "destructive" }); return; }

    setUploading(true);
    const records = validRows.map(r => ({
      student_id: r.student_id!,
      subject_id: subjectId,
      mark: r.mark,
      term,
      assessment_type: assessmentType,
      teacher_id: userId,
    }));

    const { error } = await supabase.from("marks").insert(records);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: `${validRows.length} marks uploaded successfully!` });
      setParsedRows([]);
      setShowPreview(false);
      if (fileRef.current) fileRef.current.value = "";
      onMarksUploaded();
    }
    setUploading(false);
  };

  const validCount = parsedRows.filter(r => r.student_id && !r.error).length;
  const errorCount = parsedRows.filter(r => r.error).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading">Bulk Marks Upload</CardTitle>
        <CardDescription>Download a CSV template, fill in marks, then upload to save all at once.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Setup */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="space-y-2"><Label>Class</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Subject *</Label>
            <Select value={subjectId} onValueChange={setSubjectId}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{subjects.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Term</Label>
            <Select value={term} onValueChange={setTerm}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Term 1">Term 1</SelectItem>
                <SelectItem value="Term 2">Term 2</SelectItem>
                <SelectItem value="Term 3">Term 3</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Type</Label>
            <Select value={assessmentType} onValueChange={setAssessmentType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="test">Test</SelectItem>
                <SelectItem value="exam">Exam</SelectItem>
                <SelectItem value="assignment">Assignment</SelectItem>
                <SelectItem value="project">Project</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={downloadTemplate}>
            <Download className="mr-1 h-4 w-4" /> Download Template
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-1 h-4 w-4" /> Upload CSV
          </Button>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
        </div>

        {/* Preview */}
        {showPreview && parsedRows.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Badge variant="default" className="text-xs"><CheckCircle2 className="mr-1 h-3 w-3" />{validCount} valid</Badge>
              {errorCount > 0 && <Badge variant="destructive" className="text-xs"><AlertCircle className="mr-1 h-3 w-3" />{errorCount} errors</Badge>}
            </div>

            <div className="max-h-60 overflow-y-auto rounded border">
              <table className="w-full text-sm">
                <thead className="bg-muted sticky top-0">
                  <tr>
                    <th className="px-3 py-2 text-left">Adm No.</th>
                    <th className="px-3 py-2 text-left">Student</th>
                    <th className="px-3 py-2 text-center">Mark</th>
                    <th className="px-3 py-2 text-center">Grade</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {parsedRows.map((r, i) => (
                    <tr key={i} className={`border-b ${r.error ? "bg-destructive/5" : ""}`}>
                      <td className="px-3 py-1.5">{r.admission_number}</td>
                      <td className="px-3 py-1.5">{r.student_name}</td>
                      <td className="px-3 py-1.5 text-center font-medium">{r.error ? "—" : r.mark}</td>
                      <td className="px-3 py-1.5 text-center">{r.error ? "—" : <Badge className="text-[10px]">{gradeFor(r.mark)}</Badge>}</td>
                      <td className="px-3 py-1.5">{r.error ? <span className="text-xs text-destructive">{r.error}</span> : <CheckCircle2 className="h-4 w-4 text-green-600" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <Button onClick={submitBulkMarks} disabled={uploading || validCount === 0} className="w-full">
              {uploading ? "Uploading..." : `Upload ${validCount} Marks`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
