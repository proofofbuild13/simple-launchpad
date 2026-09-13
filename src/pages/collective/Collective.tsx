import { Helmet } from "react-helmet-async";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProofFeed } from "@/components/collective/ProofFeed";
import { FounderRooms } from "@/components/collective/FounderRooms";
import { WeeklyChallengeCard } from "@/components/collective/WeeklyChallengeCard";
import { MessageCircle, Radio, Sparkles } from "lucide-react";

const sections = [
  { value: "feed", label: "Proof feed", icon: Radio },
  { value: "rooms", label: "Founder rooms", icon: MessageCircle },
  { value: "weekly", label: "Weekly challenge", icon: Sparkles },
];

export default function Collective() {
  return (
    <div className="collective-shell">
      <Helmet>
        <title>Collective — ProofBuild community for web3 builders</title>
        <meta
          name="description"
          content="Proof feed, founder rooms and weekly community challenges for web3, DeFi and DAO builders on ProofBuild."
        />
      </Helmet>

      <Tabs defaultValue="feed" className="mt-1">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-b border-border/80 pb-3">
          <h1 className="collective-heading text-2xl font-semibold">Collective</h1>
          <TabsList className="h-10 justify-start gap-1 rounded-full border bg-muted/40 p-1">
            {sections.map(({ value, label, icon: Icon }) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-8 gap-2 rounded-full px-3 text-sm text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm"
              >
                <Icon className="h-4 w-4" />
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="feed" className="m-0 mt-6 min-w-0">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <ProofFeed />
            <aside className="order-first space-y-4 lg:order-last">
              <WeeklyChallengeCard />
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="rooms" className="m-0 mt-6 min-w-0">
          <FounderRooms />
        </TabsContent>

        <TabsContent value="weekly" className="m-0 mt-6 min-w-0 max-w-2xl">
          <WeeklyChallengeCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
