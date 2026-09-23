import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Megaphone, Paperclip } from "lucide-react";
import { format } from "date-fns";

interface Props {
  announcements: any[];
  limit?: number;
}

export default function StudentAnnouncementsSection({ announcements, limit }: Props) {
  const list = limit ? announcements.slice(0, limit) : announcements;

  if (list.length === 0) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <Megaphone className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-sm text-muted-foreground">No announcements right now.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {list.map((a) => (
        <Card key={a.id}>
          <CardContent className="p-3">
            <div className="flex items-start gap-2">
              <Megaphone className="h-4 w-4 text-secondary mt-0.5 flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-tight">{a.title}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{a.content}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className="text-[10px] text-muted-foreground">
                    {format(new Date(a.created_at), "MMM d, yyyy")}
                  </span>
                  {a.file_attachments && a.file_attachments.length > 0 && (
                    <Badge variant="outline" className="text-[9px] px-1">
                      <Paperclip className="h-2.5 w-2.5 mr-0.5" />
                      {a.file_attachments.length}
                    </Badge>
                  )}
                </div>
                {a.file_attachments && a.file_attachments.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {a.file_attachments.map((url: string, i: number) => (
                      <a
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[11px] text-secondary underline"
                      >
                        Attachment {i + 1}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
