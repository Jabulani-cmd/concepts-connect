import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Upload, FileSpreadsheet, Download, CheckCircle2, XCircle, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { errorMessage } from "@/lib/errors";

interface ImportResult {
  row: number;
  email: string;
  full_name: string;
  status: "success" | "error";
  message: string;
}

const REQUIRED_COLUMNS = ["full_name", "email", "password", "portal_role"];

function parseCsv(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows = lines.slice(1).map((line) => {
    const values = line.split(",").map((v) => v.trim().replace(/^"|"$/g, ""));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = values[i] || "";
    });
    return row;
  });

  return { headers, rows };
}

function validateRow(row: Record<string, string>): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (!row.full_name?.trim()) errors.push("Missing full_name");
  if (!row.email?.trim()) errors.push("Missing email");
  if (!row.password?.trim()) errors.push("Missing password");
  else if (row.password.trim().length < 6) errors.push("Password must be ≥6 chars");
  if (!row.portal_role?.trim()) errors.push("Missing portal_role");
  else if (!["admin", "teacher", "student", "parent"].includes(row.portal_role.trim().toLowerCase()))
    errors.push(`Invalid portal_role: ${row.portal_role}`);
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (row.email && !emailRegex.test(row.email.trim())) errors.push("Invalid email format");

  return { valid: errors.length === 0, errors };
}

export default function BulkUserImport({ onImportComplete }: { onImportComplete?: () => void }) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [importType, setImportType] = useState<string>("student");
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [validationErrors, setValidationErrors] = useState<Record<number, string[]>>({});
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<ImportResult[]>([]);
  const [fileName, setFileName] = useState("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      toast({ title: "Please upload a CSV file", variant: "destructive" });
      return;
    }
    setFileName(file.name);
    setResults([]);
    setProgress(0);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const { headers: h, rows } = parseCsv(text);

      // Check required columns
      const missing = REQUIRED_COLUMNS.filter((c) => !h.includes(c));
      if (missing.length > 0) {
        toast({
          title: "Missing required columns",
          description: `CSV must include: ${missing.join(", ")}`,
          variant: "destructive",
        });
        setParsedRows([]);
        return;
      }

      setParsedRows(rows);

      // Validate all rows
      const errors: Record<number, string[]> = {};
      rows.forEach((row, i) => {
        const { valid, errors: rowErrors } = validateRow(row);
        if (!valid) errors[i] = rowErrors;
      });
      setValidationErrors(errors);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (parsedRows.length === 0) return;
    const validRows = parsedRows.filter((_, i) => !validationErrors[i]);
    if (validRows.length === 0) {
      toast({ title: "No valid rows to import", variant: "destructive" });
      return;
    }

    setImporting(true);
    setProgress(0);
    const importResults: ImportResult[] = [];

    const session = await supabase.auth.getSession();
    const token = session.data.session?.access_token;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      const rowIndex = parsedRows.indexOf(row);
      try {
        const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-users`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            action: "create-user",
            full_name: row.full_name.trim(),
            email: row.email.trim(),
            password: row.password.trim(),
            portal_role: row.portal_role.trim().toLowerCase(),
            staff_role: row.staff_role?.trim() || undefined,
            department: row.department?.trim() || undefined,
            phone: row.phone?.trim() || undefined,
            grade: row.grade?.trim() || undefined,
            class_name: row.class_name?.trim() || undefined,
          }),
        });
        const data = await res.json();
        if (data.error) {
          importResults.push({ row: rowIndex + 2, email: row.email, full_name: row.full_name, status: "error", message: data.error });
        } else {
          importResults.push({ row: rowIndex + 2, email: row.email, full_name: row.full_name, status: "success", message: "Created" });
        }
      } catch (err) {
        importResults.push({ row: rowIndex + 2, email: row.email, full_name: row.full_name, status: "error", message: errorMessage(err) });
      }
      setProgress(Math.round(((i + 1) / validRows.length) * 100));
    }

    setResults(importResults);
    setImporting(false);

    const successCount = importResults.filter((r) => r.status === "success").length;
    const errorCount = importResults.filter((r) => r.status === "error").length;
    toast({
      title: `Import complete: ${successCount} created, ${errorCount} failed`,
      variant: errorCount > 0 ? "destructive" : "default",
    });

    if (successCount > 0) onImportComplete?.();
  };

  const downloadTemplate = () => {
    let csv = "";
    if (importType === "student") {
      csv = "full_name,email,password,portal_role,grade,class_name,phone\n";
      csv += "Tatenda Moyo,tmoyo@mavingtech.com,Student2026!,student,Form 1,A,+263771234567\n";
      csv += "Nokuthula Ncube,nncube@mavingtech.com,Student2026!,student,Form 2,B,\n";
    } else {
      csv = "full_name,email,password,portal_role,staff_role,department,phone\n";
      csv += "Mr. T. Banda,tbanda@mavingtech.com,Teacher2026!,teacher,teacher,Sciences,+263 77 234 5678\n";
      csv += "Mrs. S. Ncube,sncube@mavingtech.com,Teacher2026!,teacher,hod,Mathematics,\n";
    }
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${importType}_import_template.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const validCount = parsedRows.length - Object.keys(validationErrors).length;
  const errorCount = Object.keys(validationErrors).length;

  return (
    <div className="space-y-4">
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" /> Bulk User Import
          </CardTitle>
          <CardDescription>
            Upload a CSV file to register multiple users at once. Download a template to get started.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Step 1: Choose type and download template */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-2">
              <Label>Import Type</Label>
              <Select value={importType} onValueChange={setImportType}>
                <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="student">Students</SelectItem>
                  <SelectItem value="teacher">Teachers / Staff</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button variant="outline" onClick={downloadTemplate}>
              <Download className="mr-2 h-4 w-4" /> Download Template
            </Button>
          </div>

          {/* Step 2: Upload CSV */}
          <div className="space-y-2">
            <Label>Upload CSV File</Label>
            <div
              className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 transition-colors hover:border-primary/50"
              onClick={() => fileRef.current?.click()}
            >
              <div className="text-center">
                <Upload className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  {fileName ? fileName : "Click to select a CSV file"}
                </p>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>

          {/* Step 3: Preview & validation */}
          {parsedRows.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <Badge variant="secondary">{parsedRows.length} rows found</Badge>
                <Badge variant={validCount > 0 ? "default" : "destructive"}>
                  {validCount} valid
                </Badge>
                {errorCount > 0 && (
                  <Badge variant="destructive">{errorCount} with errors</Badge>
                )}
              </div>

              <div className="max-h-64 overflow-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedRows.slice(0, 50).map((row, i) => (
                      <TableRow key={i} className={validationErrors[i] ? "bg-destructive/5" : ""}>
                        <TableCell className="text-muted-foreground">{i + 2}</TableCell>
                        <TableCell className="font-medium">{row.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">{row.email}</TableCell>
                        <TableCell>{row.portal_role}</TableCell>
                        <TableCell>
                          {validationErrors[i] ? (
                            <span className="flex items-center gap-1 text-xs text-destructive">
                              <AlertCircle className="h-3 w-3" />
                              {validationErrors[i].join(", ")}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle2 className="h-3 w-3" /> Valid
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {parsedRows.length > 50 && (
                <p className="text-xs text-muted-foreground">Showing first 50 of {parsedRows.length} rows</p>
              )}

              {importing && (
                <div className="space-y-1">
                  <Progress value={progress} />
                  <p className="text-xs text-muted-foreground text-center">Importing users... {progress}%</p>
                </div>
              )}

              <Button
                onClick={handleImport}
                disabled={importing || validCount === 0}
                className="w-full"
              >
                <Upload className="mr-2 h-4 w-4" />
                {importing ? "Importing..." : `Import ${validCount} Valid User${validCount !== 1 ? "s" : ""}`}
              </Button>
            </div>
          )}

          {/* Step 4: Results */}
          {results.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium">Import Results</h4>
              <div className="max-h-48 overflow-auto rounded border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">Row</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {results.map((r, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-muted-foreground">{r.row}</TableCell>
                        <TableCell>{r.full_name}</TableCell>
                        <TableCell className="text-muted-foreground">{r.email}</TableCell>
                        <TableCell>
                          {r.status === "success" ? (
                            <span className="flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle2 className="h-3 w-3" /> {r.message}
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs text-destructive">
                              <XCircle className="h-3 w-3" /> {r.message}
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
