import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileText, Download, Users, GraduationCap, Building, Printer, FileSpreadsheet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { SCHOOL_LOGO_URL, SCHOOL_NAME, urlToDataUrl } from "@/lib/finance/pdf";
import { DEFAULT_FORM, FORM_LEVELS } from "@/lib/forms";
import { SCHOOL_CONTACT_LINE } from "@/lib/school";

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

interface EnrollmentRow {
  form: string;
  male: number;
  female: number;
  total: number;
}

interface StaffRow {
  category: string;
  count: number;
  qualified: number;
  department: string | null;
}

export default function EMISReports() {
  const { toast } = useToast();
  const [academicYear, setAcademicYear] = useState("2026");
  const [loading, setLoading] = useState(false);

  // Enrollment data
  const [enrollmentData, setEnrollmentData] = useState<EnrollmentRow[]>([]);
  const [totalStudents, setTotalStudents] = useState(0);
  const [genderChart, setGenderChart] = useState<{ name: string; value: number }[]>([]);

  // Staff data
  const [staffData, setStaffData] = useState<StaffRow[]>([]);
  const [staffSummary, setStaffSummary] = useState({ total: 0, teaching: 0, nonTeaching: 0, leadership: 0 });

  // Infrastructure data
  const [infraData, setInfraData] = useState({ classrooms: 0, totalCapacity: 0, totalItems: 0, totalQuantity: 0 });
  const [inventorySummary, setInventorySummary] = useState<{ name: string; quantity: number }[]>([]);

  const fetchAllData = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchEnrollment(), fetchStaff(), fetchInfrastructure()]);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAllData();
  }, [academicYear, fetchAllData]);

  const fetchEnrollment = async () => {
    const { data: students } = await supabase
      .from("students")
      .select("form, gender")
      .eq("status", "active")
      ;

    if (!students) return;

    const byForm: Record<string, { male: number; female: number }> = {};
    FORM_LEVELS.forEach(f => { byForm[f] = { male: 0, female: 0 }; });

    students.forEach(s => {
      const f = s.form || DEFAULT_FORM;
      if (!byForm[f]) byForm[f] = { male: 0, female: 0 };
      if (s.gender?.toLowerCase() === "male") byForm[f].male++;
      else if (s.gender?.toLowerCase() === "female") byForm[f].female++;
      else byForm[f].male++; // default
    });

    const rows: EnrollmentRow[] = FORM_LEVELS.map(f => ({
      form: f,
      male: byForm[f]?.male || 0,
      female: byForm[f]?.female || 0,
      total: (byForm[f]?.male || 0) + (byForm[f]?.female || 0),
    }));

    setEnrollmentData(rows);
    setTotalStudents(students.length);

    const totalMale = rows.reduce((s, r) => s + r.male, 0);
    const totalFemale = rows.reduce((s, r) => s + r.female, 0);
    setGenderChart([
      { name: "Male", value: totalMale },
      { name: "Female", value: totalFemale },
    ]);
  };

  const fetchStaff = async () => {
    const { data: staff } = await supabase
      .from("staff")
      .select("category, department, qualifications, status")
      ;

    if (!staff) return;

    const active = staff.filter(s => s.status !== "inactive");
    const categoryCounts: Record<string, { count: number; qualified: number }> = {};

    active.forEach(s => {
      const cat = s.category || "teaching";
      if (!categoryCounts[cat]) categoryCounts[cat] = { count: 0, qualified: 0 };
      categoryCounts[cat].count++;
      if (s.qualifications) categoryCounts[cat].qualified++;
    });

    const rows: StaffRow[] = Object.entries(categoryCounts).map(([cat, d]) => ({
      category: cat.charAt(0).toUpperCase() + cat.slice(1),
      count: d.count,
      qualified: d.qualified,
      department: null,
    }));

    setStaffData(rows);
    setStaffSummary({
      total: active.length,
      teaching: categoryCounts["teaching"]?.count || 0,
      nonTeaching: categoryCounts["non-teaching"]?.count || 0,
      leadership: categoryCounts["leadership"]?.count || 0,
    });
  };

  const fetchInfrastructure = async () => {
    const { data: classes } = await supabase.from("classes").select("id, capacity, room");
    const { data: items } = await supabase.from("inventory_items").select("id, name, quantity, category_id");
    const { data: categories } = await supabase.from("inventory_categories").select("id, name");

    const classrooms = classes?.filter(c => c.room)?.length || 0;
    const totalCapacity = classes?.reduce((s, c) => s + (c.capacity || 0), 0) || 0;

    // Map categories
    const catMap: Record<string, string> = {};
    categories?.forEach(c => { catMap[c.id] = c.name; });

    const catSummary: Record<string, number> = {};
    items?.forEach(i => {
      const catName = i.category_id ? (catMap[i.category_id] || "Other") : "Uncategorized";
      catSummary[catName] = (catSummary[catName] || 0) + (i.quantity || 0);
    });

    setInfraData({
      classrooms,
      totalCapacity,
      totalItems: items?.length || 0,
      totalQuantity: items?.reduce((s, i) => s + (i.quantity || 0), 0) || 0,
    });

    setInventorySummary(Object.entries(catSummary).map(([name, qty]) => ({ name, quantity: qty })));
  };

  const generatePDF = async (reportType: string) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();

    try {
      const logo = await urlToDataUrl(SCHOOL_LOGO_URL);
      doc.addImage(logo, "PNG", 14, 8, 24, 24);
    } catch {
      // Keep the report usable if the logo cannot be loaded.
    }

    // Header
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("MINISTRY OF PRIMARY AND SECONDARY EDUCATION", pageWidth / 2, 15, { align: "center" });
    doc.setFontSize(11);
    doc.text(SCHOOL_NAME.toUpperCase(), pageWidth / 2, 22, { align: "center" });
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.text(SCHOOL_CONTACT_LINE, pageWidth / 2, 27, { align: "center" });
    doc.setFontSize(9);
    doc.text(`EMIS ${reportType} Report: Academic Year ${academicYear}`, pageWidth / 2, 32, { align: "center" });
    doc.text(`Generated: ${new Date().toLocaleDateString()}`, pageWidth / 2, 36, { align: "center" });
    doc.line(14, 39, pageWidth - 14, 39);

    if (reportType === "Student Enrollment") {
      autoTable(doc, {
        startY: 45,
        head: [["Form Level", "Male", "Female", "Total"]],
        body: [
          ...enrollmentData.map(r => [r.form, r.male, r.female, r.total]),
          ["TOTAL", enrollmentData.reduce((s, r) => s + r.male, 0), enrollmentData.reduce((s, r) => s + r.female, 0), totalStudents],
        ],
        theme: "grid",
        headStyles: { fillColor: [128, 0, 0] },
        footStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold" },
      });
    } else if (reportType === "Staff Returns") {
      autoTable(doc, {
        startY: 45,
        head: [["Category", "Count", "Qualified", "% Qualified"]],
        body: [
          ...staffData.map(r => [r.category, r.count, r.qualified, r.count > 0 ? `${Math.round((r.qualified / r.count) * 100)}%` : "0%"]),
          ["TOTAL", staffSummary.total, staffData.reduce((s, r) => s + r.qualified, 0), ""],
        ],
        theme: "grid",
        headStyles: { fillColor: [128, 0, 0] },
      });

      const finalY = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 100;
      doc.setFontSize(10);
      doc.text(`Teacher-Student Ratio: 1:${staffSummary.teaching > 0 ? Math.round(totalStudents / staffSummary.teaching) : "N/A"}`, 14, finalY + 10);
    } else if (reportType === "Infrastructure") {
      autoTable(doc, {
        startY: 45,
        head: [["Facility", "Count/Quantity"]],
        body: [
          ["Classrooms", infraData.classrooms],
          ["Total Classroom Capacity", infraData.totalCapacity],
          ["Total Inventory Items", infraData.totalItems],
          ["Total Inventory Quantity", infraData.totalQuantity],
          ...inventorySummary.map(i => [`  ${i.name}`, i.quantity]),
        ],
        theme: "grid",
        headStyles: { fillColor: [128, 0, 0] },
      });
    }

    // Footer
    const pageHeight = doc.internal.pageSize.getHeight();
    doc.setFontSize(8);
    doc.text("This report is generated for EMIS submission to the Ministry of Primary and Secondary Education.", 14, pageHeight - 15);
    doc.text("Authorized Signature: ____________________     Date: ____________________", 14, pageHeight - 10);

    doc.save(`EMIS_${reportType.replace(/\s/g, "_")}_${academicYear}.pdf`);
    toast({ title: "PDF generated", description: `${reportType} report downloaded.` });
  };

  const generateExcel = (reportType: string) => {
    const wb = XLSX.utils.book_new();

    if (reportType === "Student Enrollment") {
      const wsData = [
        ["EMIS Student Enrollment Report", "", "", ""],
        [SCHOOL_NAME, "", "", ""],
        [`Academic Year: ${academicYear}`, "", "", ""],
        [],
        ["Form Level", "Male", "Female", "Total"],
        ...enrollmentData.map(r => [r.form, r.male, r.female, r.total]),
        ["TOTAL", enrollmentData.reduce((s, r) => s + r.male, 0), enrollmentData.reduce((s, r) => s + r.female, 0), totalStudents],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      ws["!cols"] = [{ wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
      XLSX.utils.book_append_sheet(wb, ws, "Enrollment");
    } else if (reportType === "Staff Returns") {
      const wsData = [
        ["EMIS Staff Returns Report", "", "", ""],
        [SCHOOL_NAME, "", "", ""],
        [`Academic Year: ${academicYear}`, "", "", ""],
        [],
        ["Category", "Count", "Qualified", "% Qualified"],
        ...staffData.map(r => [r.category, r.count, r.qualified, r.count > 0 ? `${Math.round((r.qualified / r.count) * 100)}%` : "0%"]),
        ["TOTAL", staffSummary.total, staffData.reduce((s, r) => s + r.qualified, 0), ""],
        [],
        [`Teacher-Student Ratio: 1:${staffSummary.teaching > 0 ? Math.round(totalStudents / staffSummary.teaching) : "N/A"}`],
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Staff Returns");
    } else if (reportType === "Infrastructure") {
      const wsData = [
        ["EMIS Infrastructure Report", ""],
        [SCHOOL_NAME, ""],
        [`Academic Year: ${academicYear}`, ""],
        [],
        ["Facility", "Count/Quantity"],
        ["Classrooms", infraData.classrooms],
        ["Total Classroom Capacity", infraData.totalCapacity],
        ["Total Inventory Items", infraData.totalItems],
        [],
        ["Inventory by Category", ""],
        ...inventorySummary.map(i => [i.name, i.quantity]),
      ];
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      XLSX.utils.book_append_sheet(wb, ws, "Infrastructure");
    }

    XLSX.writeFile(wb, `EMIS_${reportType.replace(/\s/g, "_")}_${academicYear}.xlsx`);
    toast({ title: "Excel generated", description: `${reportType} spreadsheet downloaded.` });
  };

  const generateCSV = (reportType: string) => {
    let csv = "";
    if (reportType === "Student Enrollment") {
      csv = "Form Level,Male,Female,Total\n";
      enrollmentData.forEach(r => { csv += `${r.form},${r.male},${r.female},${r.total}\n`; });
      csv += `TOTAL,${enrollmentData.reduce((s, r) => s + r.male, 0)},${enrollmentData.reduce((s, r) => s + r.female, 0)},${totalStudents}\n`;
    } else if (reportType === "Staff Returns") {
      csv = "Category,Count,Qualified,Percent Qualified\n";
      staffData.forEach(r => { csv += `${r.category},${r.count},${r.qualified},${r.count > 0 ? Math.round((r.qualified / r.count) * 100) : 0}%\n`; });
    } else if (reportType === "Infrastructure") {
      csv = "Facility,Count\n";
      csv += `Classrooms,${infraData.classrooms}\nCapacity,${infraData.totalCapacity}\nInventory Items,${infraData.totalItems}\n`;
      inventorySummary.forEach(i => { csv += `${i.name},${i.quantity}\n`; });
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `EMIS_${reportType.replace(/\s/g, "_")}_${academicYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "CSV generated", description: `EMIS-compatible CSV downloaded.` });
  };

  const ExportButtons = ({ reportType }: { reportType: string }) => (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" onClick={() => generatePDF(reportType)}>
        <FileText className="mr-1 h-4 w-4" /> PDF
      </Button>
      <Button size="sm" variant="outline" onClick={() => generateExcel(reportType)}>
        <FileSpreadsheet className="mr-1 h-4 w-4" /> Excel
      </Button>
      <Button size="sm" variant="secondary" onClick={() => generateCSV(reportType)}>
        <Download className="mr-1 h-4 w-4" /> CSV
      </Button>
      <Button size="sm" variant="ghost" onClick={() => window.print()}>
        <Printer className="mr-1 h-4 w-4" /> Print
      </Button>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-bold text-primary">EMIS Reports</h2>
          <p className="text-sm text-muted-foreground">Ministry of Primary and Secondary Education returns</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={academicYear} onValueChange={setAcademicYear}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="2024">2024</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
              <SelectItem value="2026">2026</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={fetchAllData} disabled={loading}>
            {loading ? "Loading…" : "Refresh Data"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="enrollment" className="space-y-4">
        <TabsList className="flex-wrap">
          <TabsTrigger value="enrollment"><Users className="mr-1 h-4 w-4" /> Enrollment</TabsTrigger>
          <TabsTrigger value="staff"><GraduationCap className="mr-1 h-4 w-4" /> Staff Returns</TabsTrigger>
          <TabsTrigger value="infrastructure"><Building className="mr-1 h-4 w-4" /> Infrastructure</TabsTrigger>
        </TabsList>

        {/* ENROLLMENT TAB */}
        <TabsContent value="enrollment" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-heading">Student Enrollment Summary</CardTitle>
                <CardDescription>Total enrollment by form and gender for EMIS submission</CardDescription>
              </div>
              <ExportButtons reportType="Student Enrollment" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <Card className="border-none shadow-sm bg-muted/30">
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{totalStudents}</p>
                    <p className="text-xs text-muted-foreground">Total Students</p>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-muted/30">
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{genderChart[0]?.value || 0}</p>
                    <p className="text-xs text-muted-foreground">Male Students</p>
                  </CardContent>
                </Card>
                <Card className="border-none shadow-sm bg-muted/30">
                  <CardContent className="p-4 text-center">
                    <p className="text-3xl font-bold text-primary">{genderChart[1]?.value || 0}</p>
                    <p className="text-xs text-muted-foreground">Female Students</p>
                  </CardContent>
                </Card>
              </div>

              <div className="grid gap-6 lg:grid-cols-2">
                <div>
                  <h4 className="mb-2 font-heading text-sm font-semibold">Enrollment by Form</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={enrollmentData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="form" fontSize={11} />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Bar dataKey="male" name="Male" fill="hsl(var(--primary))" />
                      <Bar dataKey="female" name="Female" fill="hsl(var(--accent))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h4 className="mb-2 font-heading text-sm font-semibold">Gender Distribution</h4>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie data={genderChart} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                        {genderChart.map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i]} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Form Level</TableHead>
                    <TableHead className="text-right">Male</TableHead>
                    <TableHead className="text-right">Female</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {enrollmentData.map(r => (
                    <TableRow key={r.form}>
                      <TableCell className="font-medium">{r.form}</TableCell>
                      <TableCell className="text-right">{r.male}</TableCell>
                      <TableCell className="text-right">{r.female}</TableCell>
                      <TableCell className="text-right font-semibold">{r.total}</TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-muted/50 font-bold">
                    <TableCell>TOTAL</TableCell>
                    <TableCell className="text-right">{enrollmentData.reduce((s, r) => s + r.male, 0)}</TableCell>
                    <TableCell className="text-right">{enrollmentData.reduce((s, r) => s + r.female, 0)}</TableCell>
                    <TableCell className="text-right">{totalStudents}</TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* STAFF RETURNS TAB */}
        <TabsContent value="staff" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-heading">Staff Returns</CardTitle>
                <CardDescription>Staff summary by category and qualification for MoPSE</CardDescription>
              </div>
              <ExportButtons reportType="Staff Returns" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-4">
                {[
                  { label: "Total Staff", value: staffSummary.total },
                  { label: "Teaching", value: staffSummary.teaching },
                  { label: "Non-Teaching", value: staffSummary.nonTeaching },
                  { label: "Teacher:Student", value: staffSummary.teaching > 0 ? `1:${Math.round(totalStudents / staffSummary.teaching)}` : "N/A" },
                ].map((s, i) => (
                  <Card key={i} className="border-none shadow-sm bg-muted/30">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-primary">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={staffData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="category" fontSize={11} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="count" name="Total" fill="hsl(var(--primary))" />
                  <Bar dataKey="qualified" name="Qualified" fill="#10b981" />
                </BarChart>
              </ResponsiveContainer>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Count</TableHead>
                    <TableHead className="text-right">Qualified</TableHead>
                    <TableHead className="text-right">% Qualified</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffData.map(r => (
                    <TableRow key={r.category}>
                      <TableCell className="font-medium">{r.category}</TableCell>
                      <TableCell className="text-right">{r.count}</TableCell>
                      <TableCell className="text-right">{r.qualified}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary">{r.count > 0 ? `${Math.round((r.qualified / r.count) * 100)}%` : "0%"}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* INFRASTRUCTURE TAB */}
        <TabsContent value="infrastructure" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="font-heading">Infrastructure Report</CardTitle>
                <CardDescription>Facilities, equipment and resources inventory for EMIS</CardDescription>
              </div>
              <ExportButtons reportType="Infrastructure" />
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-4">
                {[
                  { label: "Classrooms", value: infraData.classrooms },
                  { label: "Total Capacity", value: infraData.totalCapacity },
                  { label: "Inventory Items", value: infraData.totalItems },
                  { label: "Total Stock Qty", value: infraData.totalQuantity },
                ].map((s, i) => (
                  <Card key={i} className="border-none shadow-sm bg-muted/30">
                    <CardContent className="p-4 text-center">
                      <p className="text-2xl font-bold text-primary">{s.value}</p>
                      <p className="text-xs text-muted-foreground">{s.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {inventorySummary.length > 0 && (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={inventorySummary} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis dataKey="name" type="category" width={120} fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="quantity" name="Quantity" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              )}

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Facility / Category</TableHead>
                    <TableHead className="text-right">Count / Quantity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell className="font-medium">Classrooms</TableCell>
                    <TableCell className="text-right">{infraData.classrooms}</TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-medium">Total Classroom Capacity</TableCell>
                    <TableCell className="text-right">{infraData.totalCapacity}</TableCell>
                  </TableRow>
                  {inventorySummary.map(i => (
                    <TableRow key={i.name}>
                      <TableCell className="pl-8 text-muted-foreground">{i.name}</TableCell>
                      <TableCell className="text-right">{i.quantity}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
