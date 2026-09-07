import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CalendarDays, Users } from "lucide-react";
import {
  fetchActiveCommunityChallenge,
  fetchCommunitySubmissionCount,
  submitToCommunityChallenge,
} from "@/lib/collective";

export function WeeklyChallengeCard() {
  const [challenge, setChallenge] = useState<any>(null);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");

  const refresh = async () => {
    const c = await fetchActiveCommunityChallenge();
    setChallenge(c);
    if (c) setCount(await fetchCommunitySubmissionCount(c.id));
  };

  useEffect(() => {
    refresh();
  }, []);

  if (!challenge) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Weekly community challenge</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          No challenge running this week. Check back soon.
        </CardContent>
      </Card>
    );
  }

  const submit = async () => {
    if (!title.trim()) return;
    const { error } = await submitToCommunityChallenge(challenge.id, title.trim(), url.trim());
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Build submitted");
    setOpen(false);
    setTitle("");
    setUrl("");
    refresh();
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">This week</CardTitle>
          <Badge variant="outline">Reputation only</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <h3 className="font-semibold leading-tight">{challenge.title}</h3>
          {challenge.description && (
            <p className="text-sm text-muted-foreground mt-1">{challenge.description}</p>
          )}
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="h-3 w-3" />
            ends {new Date(challenge.end_date).toLocaleDateString()}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" />
            {count} submissions
          </span>
        </div>
        {open ? (
          <div className="space-y-2">
            <Input placeholder="Build title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <Input placeholder="Link (repo or demo)" value={url} onChange={(e) => setUrl(e.target.value)} />
            <div className="flex gap-2">
              <Button size="sm" onClick={submit}>Submit</Button>
              <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <Button className="w-full" onClick={() => setOpen(true)}>
            Submit your build
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
