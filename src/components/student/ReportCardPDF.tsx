import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { downloadHtmlDocument } from "@/lib/finance/print";
import { SCHOOL_LOGO_URL, SCHOOL_MOTTO, SCHOOL_NAME } from "@/lib/finance/pdf";
import { SCHOOL_ADDRESS, SCHOOL_CONTACT_LINE, SCHOOL_PHONE_EMAIL_LINE } from "@/lib/school";
import { GRADE_BANDS } from "@/lib/grading";

interface ResultRow {
  subject_name: string;
  subject_code: string | null;
  mark: number;
  grade: string;
  teacher_comment: string | null;
  class_rank: number | null;
  class_size: number | null;
}

interface ReportCardProps {
  studentName: string;
  admissionNumber: string;
  form: string;
  stream: string | null;
  examName: string;
  term: string;
  academicYear: string;
  results: ResultRow[];
  overallRank: { rank: number; total: number } | null;
  averageMark: number;
  averageGrade: string;
  studentId: string | null;
}


/** "A 75-100", "B 65-74", … generated from the shared grade bands. */
function gradingKeyHtml(): string {
  return GRADE_BANDS.map((band, i) => {
    const max = i === 0 ? 100 : GRADE_BANDS[i - 1].min - 1;
    return `<span class="grading-key-item"><strong>${band.grade}</strong> ${band.min}-${max}</span>`;
  }).join("\n      ");
}
export default function ReportCardDownloadButton(props: ReportCardProps) {
  const [generating, setGenerating] = useState(false);

  const handleDownload = async () => {
    setGenerating(true);

    // Fetch attendance summary
    const attendanceSummary = { total: 0, present: 0, absent: 0, late: 0 };
    if (props.studentId) {
      const { data: att } = await supabase
        .from("attendance")
        .select("status")
        .eq("student_id", props.studentId);

      if (att && att.length > 0) {
        attendanceSummary.total = att.length;
        attendanceSummary.present = att.filter((a) => a.status === "present").length;
        attendanceSummary.late = att.filter((a) => a.status === "late").length;
        attendanceSummary.absent = att.filter((a) => a.status === "absent").length;
      }
    }

    const attendanceRate =
      attendanceSummary.total > 0
        ? Math.round(((attendanceSummary.present + attendanceSummary.late) / attendanceSummary.total) * 100)
        : 0;

    const totalMarks = props.results.reduce((s, r) => s + r.mark, 0);

    const html = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Report Card - ${props.studentName}</title>
<style>
  @media print { @page { size: A4; margin: 15mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', Georgia, serif; color: #1a1a1a; background: #fff; font-size: 11pt; }
  .container { max-width: 210mm; margin: 0 auto; padding: 10mm; }

  /* Header */
  .header { text-align: center; border-bottom: 3px double #6b2bab; padding-bottom: 12px; margin-bottom: 16px; }
  .school-logo { width: 86px; height: 86px; object-fit: contain; margin: 0 auto 6px; display: block; }
  .school-name { font-size: 22pt; font-weight: bold; color: #6b2bab; letter-spacing: 1px; text-transform: uppercase; }
  .school-motto { font-size: 9pt; color: #555; font-style: italic; margin-top: 2px; }
  .school-contact { font-size: 8pt; color: #555; margin-top: 3px; }
  .report-title { font-size: 14pt; font-weight: bold; margin-top: 10px; color: #3f3f46; text-transform: uppercase; letter-spacing: 2px; border: 2px solid #6b2bab; display: inline-block; padding: 4px 20px; }

  /* Student Info */
  .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; margin: 16px 0; padding: 12px; background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; }
  .info-item { display: flex; gap: 6px; font-size: 10pt; }
  .info-label { font-weight: bold; color: #555; min-width: 110px; }
  .info-value { color: #1a1a1a; }

  /* Results Table */
  .results-table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 10pt; }
  .results-table th { background: #6b2bab; color: #fff; padding: 8px 10px; text-align: left; font-weight: 600; }
  .results-table th:nth-child(n+3) { text-align: center; }
  .results-table td { padding: 7px 10px; border-bottom: 1px solid #dee2e6; }
  .results-table td:nth-child(n+3) { text-align: center; }
  .results-table tr:nth-child(even) { background: #f8f9fa; }
  .results-table tr:hover { background: #e9ecef; }
  .results-table .total-row { background: #6b2bab !important; color: #fff; font-weight: bold; }

  .grade-badge { display: inline-block; padding: 2px 8px; border-radius: 3px; font-weight: bold; font-size: 10pt; }
  .grade-a-star { background: #d4edda; color: #155724; }
  .grade-a { background: #d4edda; color: #155724; }
  .grade-b { background: #cce5ff; color: #004085; }
  .grade-c { background: #d1ecf1; color: #0c5460; }
  .grade-d { background: #fff3cd; color: #856404; }
  .grade-e { background: #ffe5cc; color: #8a4100; }
  .grade-u { background: #f8d7da; color: #721c24; }

  /* Summary */
  .summary-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 16px 0; }
  .summary-box { border: 1px solid #dee2e6; border-radius: 4px; padding: 12px; }
  .summary-box h3 { font-size: 11pt; color: #6b2bab; border-bottom: 1px solid #dee2e6; padding-bottom: 6px; margin-bottom: 8px; }
  .summary-row { display: flex; justify-content: space-between; font-size: 10pt; padding: 3px 0; }
  .summary-row .val { font-weight: bold; }

  /* Grading Key */
  .grading-key { margin: 16px 0; }
  .grading-key h3 { font-size: 10pt; color: #6b2bab; margin-bottom: 6px; }
  .grading-key-grid { display: flex; gap: 8px; flex-wrap: wrap; font-size: 9pt; }
  .grading-key-item { padding: 2px 8px; border: 1px solid #ccc; border-radius: 3px; }

  /* Signatures */
  .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 24px; margin-top: 40px; padding-top: 10px; }
  .sig-block { text-align: center; }
  .sig-line { border-top: 1px solid #333; margin-top: 40px; padding-top: 4px; font-size: 9pt; color: #555; }

  /* Footer */
  .footer { text-align: center; margin-top: 20px; font-size: 8pt; color: #888; border-top: 1px solid #dee2e6; padding-top: 8px; }

  .print-btn { position: fixed; top: 20px; right: 20px; padding: 10px 24px; background: #6b2bab; color: #fff; border: none; border-radius: 6px; font-size: 14px; cursor: pointer; z-index: 999; }
  .print-btn:hover { background: #154360; }
  @media print { .print-btn { display: none; } }
</style>
</head>
<body>
<button class="print-btn" onclick="window.print()">🖨️ Print / Save PDF</button>
<div class="container">
  <div class="header">
    <img class="school-logo" src="${SCHOOL_LOGO_URL}" alt="${SCHOOL_NAME} logo" />
    <div class="school-name">${SCHOOL_NAME}</div>
    <div class="school-motto">"${SCHOOL_MOTTO}"</div>
    <div class="school-contact">${SCHOOL_ADDRESS}<br/>${SCHOOL_PHONE_EMAIL_LINE}</div>
    <div class="report-title">Termly Report Card</div>
  </div>

  <div class="info-grid">
    <div class="info-item"><span class="info-label">Student Name:</span><span class="info-value">${props.studentName}</span></div>
    <div class="info-item"><span class="info-label">Admission No:</span><span class="info-value">${props.admissionNumber}</span></div>
    <div class="info-item"><span class="info-label">Form/Class:</span><span class="info-value">${props.form}${props.stream ? " " + props.stream : ""}</span></div>
    <div class="info-item"><span class="info-label">Exam:</span><span class="info-value">${props.examName}</span></div>
    <div class="info-item"><span class="info-label">Term:</span><span class="info-value">${props.term}</span></div>
    <div class="info-item"><span class="info-label">Academic Year:</span><span class="info-value">${props.academicYear}</span></div>
  </div>

  <table class="results-table">
    <thead>
      <tr>
        <th>#</th>
        <th>Subject</th>
        <th>Mark (%)</th>
        <th>Grade</th>
        <th>Position</th>
        <th>Comment</th>
      </tr>
    </thead>
    <tbody>
      ${props.results
        .map(
          (r, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${r.subject_name}${r.subject_code ? " (" + r.subject_code + ")" : ""}</td>
          <td><strong>${r.mark}</strong></td>
          <td><span class="grade-badge grade-${(r.grade || "U").toLowerCase().replace("*", "-star")}">${r.grade}</span></td>
          <td>${r.class_rank && r.class_size ? r.class_rank + " of " + r.class_size : "-"}</td>
          <td style="font-size:9pt;color:#555;max-width:120px;">${r.teacher_comment || "-"}</td>
        </tr>`
        )
        .join("")}
      <tr class="total-row">
        <td colspan="2">Overall</td>
        <td><strong>${props.averageMark}%</strong> (Total: ${totalMarks})</td>
        <td><strong>${props.averageGrade}</strong></td>
        <td>${props.overallRank ? props.overallRank.rank + " of " + props.overallRank.total : "-"}</td>
        <td>${props.results.length} subjects</td>
      </tr>
    </tbody>
  </table>

  <div class="summary-grid">
    <div class="summary-box">
      <h3>Academic Summary</h3>
      <div class="summary-row"><span>Subjects Taken:</span><span class="val">${props.results.length}</span></div>
      <div class="summary-row"><span>Average Mark:</span><span class="val">${props.averageMark}%</span></div>
      <div class="summary-row"><span>Overall Grade:</span><span class="val">${props.averageGrade}</span></div>
      <div class="summary-row"><span>Class Position:</span><span class="val">${props.overallRank ? props.overallRank.rank + " of " + props.overallRank.total : "N/A"}</span></div>
    </div>
    <div class="summary-box">
      <h3>Attendance Summary</h3>
      <div class="summary-row"><span>Days Recorded:</span><span class="val">${attendanceSummary.total}</span></div>
      <div class="summary-row"><span>Days Present:</span><span class="val">${attendanceSummary.present}</span></div>
      <div class="summary-row"><span>Days Late:</span><span class="val">${attendanceSummary.late}</span></div>
      <div class="summary-row"><span>Days Absent:</span><span class="val">${attendanceSummary.absent}</span></div>
      <div class="summary-row"><span>Attendance Rate:</span><span class="val">${attendanceRate}%</span></div>
    </div>
  </div>

  <div class="grading-key">
    <h3>ZIMSEC Grading Key</h3>
    <div class="grading-key-grid">
      ${gradingKeyHtml()}
    </div>
  </div>

  <div class="signatures">
    <div class="sig-block"><div class="sig-line">Class Teacher</div></div>
    <div class="sig-block"><div class="sig-line">Head of Department</div></div>
    <div class="sig-block"><div class="sig-line">Headmaster</div></div>
  </div>

  <div class="footer">
    <p>${SCHOOL_NAME} · ${SCHOOL_CONTACT_LINE}</p>
    <p>Generated on ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
  </div>
</div>
</body>
</html>`;

    await downloadHtmlDocument(html, `report-card-${props.admissionNumber}`);
    setGenerating(false);
  };

  if (props.results.length === 0) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleDownload}
      disabled={generating}
      className="gap-1.5"
    >
      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
      Download Report Card
    </Button>
  );
}
