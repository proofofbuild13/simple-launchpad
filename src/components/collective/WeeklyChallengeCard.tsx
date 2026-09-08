import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CalendarDays, Users, Plus, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  createCommunityChallenge,
  fetchActiveCommunityChallenge,
  fetchCommunitySubmissionCount,
  submitToCommunityChallenge,
} from "@/lib/collective";

export function WeeklyChallengeCard() {
  const { role } = useAuth();
  const [challenge, setChallenge] = useState<any>(null);
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newStart, setNewStart] = useState(() => new Date().toISOString().slice(0, 10));
  const [newEnd, setNewEnd] = useState(() =>
    new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
  );

  const refresh = async () => {
    const c = await fetchActiveCommunityChallenge();
    setChallenge(c);
    if (c) setCount(await fetchCommunitySubmissionCount(c.id));
  };

  useEffect(() => {
    refresh();
  }, []);

  const create = async () => {
    if (!newTitle.trim() || !newStart || !newEnd) return;
    setBusy(true);
    const { error } = await createCommunityChallenge({
      title: newTitle.trim(),
      description: newDesc.trim(),
      start_date: newStart,
      end_date: newEnd,
    });
    setBusy(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Challenge posted");
    setCreating(false);
    setNewTitle("");
    setNewDesc("");
    refresh();
  };

  const createBlock = creating ? (
    <div className="space-y-2">
      <Input
        placeholder="Challenge title"
        value={newTitle}
        onChange={(e) => setNewTitle(e.target.value)}
      />
      <Textarea
        placeholder="What should builders ship this week?"
        rows={2}
        value={newDesc}
        onChange={(e) => setNewDesc(e.target.value)}
      />
      <div className="grid grid-cols-2 gap-2">
        <Input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
        <Input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <Button size="sm" disabled={busy || !newTitle.trim()} onClick={create}>
          {busy && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Post challenge
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setCreating(false)}>
          Cancel
        </Button>
      </div>
    </div>
  ) : (
    <Button variant="outline" className="w-full" onClick={() => setCreating(true)}>
      <Plus className="h-4 w-4 mr-2" /> New weekly challenge
    </Button>
  );

  if (!challenge) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Weekly community challenge</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>No challenge running this week. Check back soon.</p>
          {role === "startup" && createBlock}
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
        {role === "startup" && createBlock}
      </CardContent>
    </Card>
  );
}
