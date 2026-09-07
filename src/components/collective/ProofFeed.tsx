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

export function ProofFeed() {
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
                <div className="flex items-start gap-3">
                  <Avatar className="h-9 w-9">
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
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {it.summary || it.submission_title}
                    </p>
                    <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{new Date(it.created_at).toLocaleDateString()}</span>
                      <Link
                        to={`/submissions/${it.submission_id}`}
                        className="text-foreground hover:underline"
                      >
                        View submission
                      </Link>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
