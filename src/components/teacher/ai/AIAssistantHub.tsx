import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, BarChart3, BookOpen, ClipboardList, Info, MessageSquareQuote, Ruler, Sparkles, Users } from "lucide-react";
import LessonPlanGenerator from "./LessonPlanGenerator";
import WorksheetGenerator from "./WorksheetGenerator";
import RubricGenerator from "./RubricGenerator";
import FeedbackDrafter from "./FeedbackDrafter";
import ParentMessageDrafter from "./ParentMessageDrafter";
import AtRiskStudents from "./AtRiskStudents";
import TeacherInsights from "./TeacherInsights";

interface Props {
  students?: { id: string; full_name?: string; name?: string; form?: string; class?: string }[];
}

export default function AIAssistantHub({ students = [] }: Props) {
  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-background to-accent/5">
      <CardHeader>
        <CardTitle className="font-heading flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" /> AI Assistant
          <Badge variant="secondary">ZIMSEC aligned</Badge>
        </CardTitle>
        <CardDescription>
          Plan lessons, build worksheets and rubrics, draft feedback and parent messages, and see which students and
          topics need attention. Everything is editable before you save or send.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-start gap-1.5 rounded-md bg-muted/40 p-2 text-[11px] text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span><strong>DEMO MODE:</strong> AI output is real, but saved plans, worksheets, rubrics and risk flags stay in this browser only.</span>
        </div>

        <Tabs defaultValue="lesson" className="w-full">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1">
            <TabsTrigger value="lesson" className="text-xs"><BookOpen className="mr-1 h-3.5 w-3.5" /> Lesson plans</TabsTrigger>
            <TabsTrigger value="worksheet" className="text-xs"><ClipboardList className="mr-1 h-3.5 w-3.5" /> Worksheets</TabsTrigger>
            <TabsTrigger value="rubric" className="text-xs"><Ruler className="mr-1 h-3.5 w-3.5" /> Rubrics</TabsTrigger>
            <TabsTrigger value="feedback" className="text-xs"><MessageSquareQuote className="mr-1 h-3.5 w-3.5" /> Feedback</TabsTrigger>
            <TabsTrigger value="parent" className="text-xs"><Users className="mr-1 h-3.5 w-3.5" /> Parent messages</TabsTrigger>
            <TabsTrigger value="risk" className="text-xs"><AlertTriangle className="mr-1 h-3.5 w-3.5" /> At-risk</TabsTrigger>
            <TabsTrigger value="insights" className="text-xs"><BarChart3 className="mr-1 h-3.5 w-3.5" /> Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="lesson" className="mt-4"><LessonPlanGenerator /></TabsContent>
          <TabsContent value="worksheet" className="mt-4"><WorksheetGenerator /></TabsContent>
          <TabsContent value="rubric" className="mt-4"><RubricGenerator /></TabsContent>
          <TabsContent value="feedback" className="mt-4"><FeedbackDrafter students={students} /></TabsContent>
          <TabsContent value="parent" className="mt-4"><ParentMessageDrafter students={students} /></TabsContent>
          <TabsContent value="risk" className="mt-4"><AtRiskStudents students={students} /></TabsContent>
          <TabsContent value="insights" className="mt-4"><TeacherInsights /></TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
