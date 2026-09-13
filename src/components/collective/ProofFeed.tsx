import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PROOF_CATEGORIES,
  ProofCategory,
  ProofFeedItem,
  fetchProofFeed,
} from "@/lib/collective";
import { HelpCircle, Rocket } from "lucide-react";
import { CardEngagementBar } from "./CardEngagementBar";

const GUIDE_STEPS = [
  {
    title: "Pick a challenge or project",
    body: "Browse open projects and choose one that fits what you can ship.",
  },
  {
    title: "Build and submit your work",
    body: "Add your demo link, repo and a short write-up in the submission form.",
  },
  {
    title: "Get reviewed",
    body: "Your submission is scored automatically and the founder reviews it.",
  },
  {
    title: "Marked complete, posted to the feed",
    body: "Once the founder accepts or completes it, your build shows up here for everyone.",
  },
];

export function ProofFeed() {
  const [guide, setGuide] = useState(false);
  const [cat, setCat] = useState<ProofCategory>("All");
  const [items, setItems] = useState<ProofFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchProofFeed(cat).then((rows) => {
      if (!active) return;
      setItems(rows);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [cat]);

  return (
    <div className="space-y-4">
      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-sm font-semibold">Shipped something? Put it on the feed.</h2>
            <p className="text-xs text-muted-foreground">
              Completed builds appear here automatically once your work is marked complete.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <Link to="/browse">
                <Rocket className="mr-2 h-4 w-4" /> Post a completed build
              </Link>
            </Button>
            <Button size="sm" variant="outline" onClick={() => setGuide((g) => !g)}>
              <HelpCircle className="mr-2 h-4 w-4" /> How it works
            </Button>
          </div>
        </CardContent>
        {guide && (
          <CardContent className="border-t pt-4">
            <ol className="space-y-3 text-sm">
              {GUIDE_STEPS.map((s, i) => (
                <li key={s.title} className="flex gap-3">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block font-medium">{s.title}</span>
                    <span className="block text-muted-foreground">{s.body}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild size="sm" variant="secondary">
                <Link to="/browse">Find a challenge</Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link to="/submissions">My submissions</Link>
              </Button>
            </div>
          </CardContent>
        )}
      </Card>

      <div className="flex flex-wrap gap-2">

        {PROOF_CATEGORIES.map((c) => (
          <Button
            key={c}
            size="sm"
            variant={cat === c ? "default" : "outline"}
            onClick={() => setCat(c)}
            className="rounded-full"
          >
            {c}
          </Button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            No proof yet in this category. Completed builds show up here.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((it) => (
            <Card key={it.submission_id} className="hover:shadow-sm transition-shadow">
              <CardContent className="p-5">
                {/* Engagement bar — top right */}
                <div className="flex items-start justify-between gap-2 mb-3">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <Avatar className="h-9 w-9 shrink-0">
                      <AvatarImage src={it.builder_avatar ?? undefined} alt={it.builder_name} />
                      <AvatarFallback>{it.builder_name[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{it.builder_name}</span>
                        <span className="text-xs text-muted-foreground">shipped</span>
                        {it.category && (
                          <Badge variant="outline" className="text-[10px] uppercase">
                            {it.category}
                          </Badge>
                        )}
                      </div>
                      <h3 className="mt-1 font-semibold leading-tight">{it.project_title}</h3>
                    </div>
                  </div>
                  <CardEngagementBar
                    shareUrl={`${window.location.origin}/submissions/${it.submission_id}`}
                    className="shrink-0"
                  />
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2 pl-12">
                  {it.summary || it.submission_title}
                </p>
                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground pl-12">
                  <span>{new Date(it.created_at).toLocaleDateString()}</span>
                  <Link
                    to={`/submissions/${it.submission_id}`}
                    className="text-foreground hover:underline"
                  >
                    View submission →
                  </Link>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
