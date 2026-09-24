// At-risk rules for the school monitoring agent. Rules decide who is flagged; AI only
// explains. Thresholds follow the MavingTech proposal and must be approved by the
// Ministry and checked for fairness before production use.
export const RISK_RULES = {
  attendanceDropPoints: { over: 20, points: 2 }, // attendance fell by more than 20 percentage points
  gradeDropPoints: { over: 10, subjects: 2, points: 2 }, // marks fell by more than 10 points in 2+ subjects
  missedWorkPoints: { over: 0.3, points: 1 }, // more than 30% of homework not handed in
  flagAt: 2, // points needed before a learner is flagged
  highAt: 4, // points for a high-priority flag
} as const;

export type SubjectTrend = { subject: string; before: number; recent: number };
export type LearnerSignals = {
  attendance_before: number | null;
  attendance_recent: number | null;
  subjects: SubjectTrend[];
  assignments_due: number;
  assignments_missed: number;
};

export type RiskResult = {
  points: number;
  severity: "low" | "medium" | "high" | null;
  reasons: string[];
  attendanceDrop: number | null;
  declining: SubjectTrend[];
  missedRate: number | null;
};

export function scoreLearner(s: LearnerSignals): RiskResult {
  let points = 0;
  const reasons: string[] = [];

  const attendanceDrop = s.attendance_before != null && s.attendance_recent != null
    ? Math.round((s.attendance_before - s.attendance_recent) * 10) / 10 : null;
  if (attendanceDrop != null && attendanceDrop > RISK_RULES.attendanceDropPoints.over) {
    points += RISK_RULES.attendanceDropPoints.points;
    reasons.push(`Attendance fell from ${s.attendance_before}% to ${s.attendance_recent}% in the last four weeks`);
  }

  const declining = s.subjects.filter((t) => t.before - t.recent > RISK_RULES.gradeDropPoints.over);
  if (declining.length >= RISK_RULES.gradeDropPoints.subjects) {
    points += RISK_RULES.gradeDropPoints.points;
    reasons.push(`Marks dropped by more than ${RISK_RULES.gradeDropPoints.over} points in ${declining.map((d) => d.subject).join(", ")}`);
  }

  const missedRate = s.assignments_due > 0 ? s.assignments_missed / s.assignments_due : null;
  if (missedRate != null && missedRate > RISK_RULES.missedWorkPoints.over) {
    points += RISK_RULES.missedWorkPoints.points;
    reasons.push(`${s.assignments_missed} of ${s.assignments_due} homework tasks not handed in`);
  }

  const severity = points >= RISK_RULES.highAt ? "high" : points >= RISK_RULES.flagAt ? "medium" : points > 0 ? "low" : null;
  return { points, severity, reasons, attendanceDrop, declining, missedRate };
}

/** Plain-language explanation and next steps when AI is not available. */
export function ruleExplanation(r: RiskResult): { explanation: string; actions: string[] } {
  const actions: string[] = [];
  if (r.attendanceDrop != null && r.attendanceDrop > RISK_RULES.attendanceDropPoints.over) {
    actions.push("Check in with the learner about recent absences and contact the parent or guardian.");
  }
  if (r.declining.length >= RISK_RULES.gradeDropPoints.subjects) {
    actions.push("Ask the subject teachers what has changed and arrange extra support in the weakest subject.");
  }
  if (r.missedRate != null && r.missedRate > RISK_RULES.missedWorkPoints.over) {
    actions.push("Agree a plan to catch up on missing homework, with a follow-up date.");
  }
  return { explanation: `${r.reasons.join(". ")}.`, actions: actions.slice(0, 3) };
}
