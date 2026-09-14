// @ts-nocheck
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, FileSpreadsheet, CheckCircle, AlertTriangle, XCircle, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import * as XLSX from "xlsx";

type MigrationTarget = "students" | "staff" | "fee_structures" | "payments" | "classes" | "inventory_items";

interface ValidationResult {
  row: number;
  field: string;
  value: string;
  issue: string;
  severity: "error" | "warning";
}

interface MigrationStats {
  total: number;
  valid: number;
  warnings: number;
  errors: number;
  imported: number;
}

const TARGET_CONFIGS: Record<MigrationTarget, { label: string; requiredFields: string[]; description: string }> = {
  students: {
    label: "Students",
    requiredFields: ["admission_number", "full_name", "form"],
    description: "Import student records. Required: admission_number, full_name, form. Optional: gender, date_of_birth, stream, guardian_name, guardian_phone, guardian_email, address, medical_conditions.",
  },
  staff: {
    label: "Staff",
    requiredFields: ["full_name"],
    description: "Import staff records. Required: full_name. Optional: staff_number, email, phone, department, role, category, qualifications, national_id.",
  },
  fee_structures: {
    label: "Fee Structures",
    requiredFields: ["form", "term", "academic_year", "amount_usd"],
    description: "Import fee structures. Required: form, term, academic_year, amount_usd. Optional: amount_zig, boarding_status, description.",
  },
  payments: {
    label: "Payments",
    requiredFields: ["receipt_number", "amount_usd"],
    description: "Import payment records. Required: receipt_number, amount_usd. Optional: amount_zig, payment_date, payment_method, reference_number, notes.",
  },
  classes: {
    label: "Classes",
    requiredFields: ["name"],
    description: "Import class records. Required: name. Optional: form_level, stream, room, capacity.",
  },
  inventory_items: {
    label: "Inventory Items",
    requiredFields: ["name", "item_code"],
    description: "Import inventory. Required: name, item_code. Optional: quantity, unit, location, supplier, reorder_level.",
  },
};

export default function DataMigration() {
  const { toast } = useToast();
  const [target, setTarget] = useState<MigrationTarget>("students");
  const [rawData, setRawData] = useState<Record<string, any>[]>([]);
  const [validationResults, setValidationResults] = useState<ValidationResult[]>([]);
  const [stats, setStats] = useState<MigrationStats | null>(null);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState<"upload" | "validate" | "review" | "import" | "done">("upload");

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const json = XLSX.utils.sheet_to_json<Record<string, any>>(sheet);

        if (json.length === 0) {
          toast({ title: "Empty file", description: "No data found in the uploaded file.", variant: "destructive" });
          return;
        }

        setRawData(json);
        setStep("validate");
        validateData(json);
      } catch {
        toast({ title: "Error reading file", description: "Please upload a valid Excel or CSV file.", variant: "destructive" });
      }
    };
    reader.readAsBinaryString(file);
  };

  const validateData = (data: Record<string, any>[]) => {
    const config = TARGET_CONFIGS[target];
    const issues: ValidationResult[] = [];
    let errorCount = 0;
    let warningCount = 0;

    data.forEach((row, idx) => {
      // Check required fields
      config.requiredFields.forEach((field) => {
        if (!row[field] || String(row[field]).trim() === "") {
          issues.push({ row: idx + 2, field, value: "", issue: `Missing required field: ${field}`, severity: "error" });
          errorCount++;
        }
      });

      // Target-specific validation
      if (target === "students") {
        if (row.guardian_phone && !/^(\+263|0)7[0-9]{8}$/.test(String(row.guardian_phone))) {
          issues.push({ row: idx + 2, field: "guardian_phone", value: String(row.guardian_phone), issue: "Invalid Zimbabwe phone format", severity: "warning" });
          warningCount++;
        }
        if (row.guardian_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(row.guardian_email))) {
          issues.push({ row: idx + 2, field: "guardian_email", value: String(row.guardian_email), issue: "Invalid email format", severity: "warning" });
          warningCount++;
        }
      }

      if (target === "staff" && row.national_id) {
        if (!/^\d{2}-\d{6,7}[A-Z]-\d{2}$/.test(String(row.national_id))) {
          issues.push({ row: idx + 2, field: "national_id", value: String(row.national_id), issue: "Invalid National ID format", severity: "warning" });
          warningCount++;
        }
      }
    });

    setValidationResults(issues);
    setStats({ total: data.length, valid: data.length - errorCount, warnings: warningCount, errors: errorCount, imported: 0 });
    setStep("review");
  };

  const runImport = async () => {
    if (!stats || stats.errors > 0) {
      toast({ title: "Cannot import", description: "Fix all errors before importing.", variant: "destructive" });
      return;
    }

    setImporting(true);
    setStep("import");
    let imported = 0;
    const batchSize = 50;

    try {
      for (let i = 0; i < rawData.length; i += batchSize) {
        const batch = rawData.slice(i, i + batchSize).map((row) => {
          const cleaned: Record<string, any> = {};
          Object.entries(row).forEach(([key, val]) => {
            const k = key.trim().toLowerCase().replace(/\s+/g, "_");
            cleaned[k] = typeof val === "string" ? val.trim() : val;
          });
          return cleaned;
        });

        const { error } = await supabase.from(target).insert(batch as any);
        if (error) {
          toast({ title: `Import error at batch ${Math.floor(i / batchSize) + 1}`, description: error.message, variant: "destructive" });
          break;
        }

        imported += batch.length;
        setProgress(Math.round((imported / rawData.length) * 100));
        setStats((prev) => prev ? { ...prev, imported } : null);
      }

      if (imported === rawData.length) {
        toast({ title: "Import complete", description: `Successfully imported ${imported} ${TARGET_CONFIGS[target].label.toLowerCase()} records.` });
        setStep("done");
      }
    } catch (err: any) {
      toast({ title: "Import failed", description: err?.message || "An unexpected error occurred", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const config = TARGET_CONFIGS[target];
    const ws = XLSX.utils.aoa_to_sheet([config.requiredFields]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, target);
    XLSX.writeFile(wb, `${target}_template.xlsx`);
  };

  const reset = () => {
    setRawData([]);
    setValidationResults([]);
    setStats(null);
    setProgress(0);
    setStep("upload");
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-heading text-2xl font-bold text-foreground">Data Migration Tool</h2>
          <p className="text-sm text-muted-foreground">Import existing school data from Excel/CSV files</p>
        </div>
        {step !== "upload" && (
          <Button variant="outline" onClick={reset}>Start Over</Button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {["upload", "validate", "review", "import", "done"].map((s, i) => (
          <div key={s} className="flex items-center gap-1">
            <Badge variant={step === s ? "default" : s === "done" && step === "done" ? "default" : "outline"} className={step === s ? "bg-primary" : ""}>
              {i + 1}. {s.charAt(0).toUpperCase() + s.slice(1)}
            </Badge>
            {i < 4 && <span className="text-muted-foreground">→</span>}
          </div>
        ))}
      </div>

      <Tabs value={target} onValueChange={(v) => { setTarget(v as MigrationTarget); reset(); }}>
        <TabsList className="flex-wrap">
          {Object.entries(TARGET_CONFIGS).map(([key, cfg]) => (
            <TabsTrigger key={key} value={key}>{cfg.label}</TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Import {TARGET_CONFIGS[target].label}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{TARGET_CONFIGS[target].description}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === "upload" && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Button variant="outline" onClick={downloadTemplate}>
                  <Download className="mr-2 h-4 w-4" /> Download Template
                </Button>
              </div>
              <div className="rounded-lg border-2 border-dashed border-muted-foreground/25 p-8 text-center">
                <Upload className="mx-auto h-12 w-12 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">Upload your Excel (.xlsx) or CSV file</p>
                <Label htmlFor="migration-file" className="mt-4 inline-block cursor-pointer">
                  <Button asChild variant="default"><span>Choose File</span></Button>
                </Label>
                <Input id="migration-file" type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
              </div>
            </div>
          )}

          {step === "review" && stats && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold">{stats.total}</p><p className="text-xs text-muted-foreground">Total Rows</p></CardContent></Card>
                <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-green-600">{stats.valid}</p><p className="text-xs text-muted-foreground">Valid</p></CardContent></Card>
                <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-yellow-600">{stats.warnings}</p><p className="text-xs text-muted-foreground">Warnings</p></CardContent></Card>
                <Card><CardContent className="pt-4 text-center"><p className="text-2xl font-bold text-red-600">{stats.errors}</p><p className="text-xs text-muted-foreground">Errors</p></CardContent></Card>
              </div>

              {validationResults.length > 0 && (
                <div className="max-h-64 overflow-auto rounded border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Row</TableHead>
                        <TableHead>Field</TableHead>
                        <TableHead>Value</TableHead>
                        <TableHead>Issue</TableHead>
                        <TableHead>Severity</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {validationResults.slice(0, 100).map((r, i) => (
                        <TableRow key={i}>
                          <TableCell>{r.row}</TableCell>
                          <TableCell className="font-mono text-xs">{r.field}</TableCell>
                          <TableCell className="max-w-[120px] truncate text-xs">{r.value || "—"}</TableCell>
                          <TableCell className="text-xs">{r.issue}</TableCell>
                          <TableCell>
                            {r.severity === "error" ? <Badge variant="destructive">Error</Badge> : <Badge className="bg-yellow-500">Warning</Badge>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Preview first 5 rows */}
              {rawData.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium">Data Preview (first 5 rows)</h4>
                  <div className="max-h-48 overflow-auto rounded border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(rawData[0]).map((k) => <TableHead key={k} className="text-xs">{k}</TableHead>)}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rawData.slice(0, 5).map((row, i) => (
                          <TableRow key={i}>
                            {Object.values(row).map((v, j) => <TableCell key={j} className="text-xs">{String(v ?? "")}</TableCell>)}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button onClick={runImport} disabled={stats.errors > 0}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  {stats.errors > 0 ? "Fix errors first" : `Import ${stats.valid} Records`}
                </Button>
                {stats.errors > 0 && (
                  <p className="flex items-center gap-1 text-sm text-destructive">
                    <XCircle className="h-4 w-4" /> Fix {stats.errors} error(s) in your file and re-upload
                  </p>
                )}
              </div>
            </div>
          )}

          {step === "import" && (
            <div className="space-y-4 py-8 text-center">
              <p className="text-lg font-medium">Importing data...</p>
              <Progress value={progress} className="mx-auto max-w-md" />
              <p className="text-sm text-muted-foreground">{stats?.imported ?? 0} of {stats?.total ?? 0} records</p>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-4 py-8 text-center">
              <CheckCircle className="mx-auto h-16 w-16 text-green-600" />
              <p className="text-lg font-medium text-green-600">Import Complete!</p>
              <p className="text-sm text-muted-foreground">Successfully imported {stats?.imported} {TARGET_CONFIGS[target].label.toLowerCase()} records.</p>
              <Button onClick={reset}>Import More Data</Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
