import { useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Clock, Lightbulb, Loader2, Sparkles, TrendingDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { callTeacherAi } from "@/lib/teacherAi";
import { errorMessage } from "@/lib/errors";

interface Props {
  /** Optional real marks: { topic, score } */
  topicScores?: { topic: string; score: number }[];
  /** Optional marking turnaround in days per assignment */
  turnaroundDays?: number[];
}

const DEMO_TOPICS = [
  { topic: "Simultaneous equations", score: 48 },
  { topic: "Trigonometry", score: 54 },
  { topic: "Statistics", score: 71 },
  { topic: "Geometry", score: 66 },
  { topic: "Algebraic fractions", score: 43 },
];

const DEMO_TURNAROUND = [3, 4, 6, 8, 9];

export default function TeacherInsights({ topicScores, turnaroundDays }: Props) {
  const { toast } = useToast();
  const topics = topicScores?.length ? topicScores : DEMO_TOPICS;
  const turnaround = turnaroundDays?.length ? turnaroundDays : DEMO_TURNAROUND;
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<{ summary: string; suggestions: string[] } | null>(null);

  const avgTurnaround = useMemo(
    () => Math.round((turnaround.reduce((a, b) => a + b, 0) / turnaround.length) * 10) / 10,
    [turnaround],
  );
  const recent = turnaround.slice(-2).reduce((a, b) => a + b, 0) / Math.min(2, turnaround.length);
  const trendingSlow = recent > avgTurnaround + 1;
  const weakest = [...topics].sort((a, b) => a.score - b.score);

  const explain = async () => {
    setLoading(true);
    try {
      const res = await callTeacherAi<{ summary: string; suggestions: string[] }>("insights", {
        data: { topics, average_marking_turnaround_days: avgTurnaround, recent_turnaround_days: recent },
      });
      setSummary(res);
    } catch (e) {
      toast({ title: "Could not build insights", description: errorMessage(e), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-primary" /> Where the class is struggling
          </CardTitle>
          <CardDescription>Average class score per topic, weakest first. A nudge, not a performance review.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {weakest.map((t) => (
            <div key={t.topic} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span>{t.topic}</span>
                <span className={t.score < 50 ? "font-semibold text-destructive" : "text-muted-foreground"}>{t.score}%</span>
              </div>
              <Progress value={t.score} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Clock className="h-5 w-5 text-primary" /> Marking turnaround
            {trendingSlow && <Badge variant="secondary">Trending slower</Badge>}
          </CardTitle>
          <CardDescription>Average days between an assignment's due date and marks being entered.</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{avgTurnaround} days</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {trendingSlow
              ? `Your last few sets took about ${recent} days — a little slower than usual. Learners benefit most from marks returned within a week.`
              : "You are keeping pace with your usual turnaround. Nicely done."}
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="font-heading flex items-center gap-2">
            <Lightbulb className="h-5 w-5 text-primary" /> Suggested focus
          </CardTitle>
          <CardDescription>A short, supportive summary of what to reteach next.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button onClick={explain} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
            Build my insight summary
          </Button>
          {summary && (
            <div className="space-y-2 rounded-md border p-3 text-sm">
              <p>{summary.summary}</p>
              {summary.suggestions?.length > 0 && (
                <ul className="ml-5 list-disc">{summary.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
