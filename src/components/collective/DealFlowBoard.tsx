import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Handshake } from "lucide-react";

const placeholders = [
  { stage: "Pre-seed", seeking: "cash", content: "Building an intent-based swap router. Looking for a Solidity partner for the MEV-aware settlement layer." },
  { stage: "Seed", seeking: "token", content: "Restaking dashboard live with 4k weekly users. Opening a token-aligned builder slot for indexer work." },
  { stage: "Bootstrapped", seeking: "equity", content: "RWA tokenization rails for Indian SMEs. Looking for a founding engineer, equity-first." },
];

export function DealFlowBoard() {
  return (
    <div className="space-y-4">
      <Card className="border-dashed">
        <CardContent className="p-4 text-sm text-muted-foreground">
          Preview — founders will post building-in-public updates here and builders can raise a hand.
          Posting goes live in the next pass.
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-2">
        {placeholders.map((p, i) => (
          <Card key={i} className="opacity-80">
            <CardContent className="p-5 space-y-3">
              <div className="flex items-center gap-2">
                <Badge variant="outline">{p.stage}</Badge>
                <Badge className="uppercase text-[10px]">{p.seeking}</Badge>
              </div>
              <p className="text-sm">{p.content}</p>
              <Button size="sm" variant="outline" disabled className="gap-2">
                <Handshake className="h-4 w-4" /> I'm interested
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
