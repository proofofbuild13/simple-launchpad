import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ProofFeed } from "@/components/collective/ProofFeed";
import { FounderRooms } from "@/components/collective/FounderRooms";
import { WeeklyChallengeCard } from "@/components/collective/WeeklyChallengeCard";
import { DealFlowBoard } from "@/components/collective/DealFlowBoard";
import { CircleUserRound, Handshake, MessageCircle, Radio, Sparkles } from "lucide-react";

const sections = [
  { value: "feed", label: "Proof feed", description: "See what shipped", icon: Radio },
  { value: "rooms", label: "Founder rooms", description: "Talk with peers", icon: MessageCircle },
  { value: "weekly", label: "Weekly challenge", description: "Build reputation", icon: Sparkles },
  { value: "dealflow", label: "Deal flow", description: "Find opportunities", icon: Handshake },
];

export default function Collective() {
  return (
    <div className="collective-shell">
      <Helmet>
        <title>Collective — ProofBuild community for web3 builders</title>
        <meta
          name="description"
          content="Proof feed, founder rooms, weekly community challenges and deal flow for web3, DeFi and DAO builders on ProofBuild."
        />
      </Helmet>

      <div className="flex items-center justify-between border-b border-border/80 pb-4">
        <h1 className="collective-heading text-2xl font-semibold">Collective</h1>
        <Button asChild variant="ghost" size="icon" className="h-9 w-9" title="Your profile">
          <Link to="/profile" aria-label="Open your profile">
            <CircleUserRound className="h-5 w-5" />
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="feed" className="mt-5 grid items-start gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-none border-b bg-transparent p-0 lg:sticky lg:top-6 lg:flex-col lg:overflow-visible lg:border-b-0 lg:border-r lg:pr-5">
          {sections.map(({ value, label, description, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="group h-11 shrink-0 justify-start gap-3 rounded-md border border-transparent px-3 text-muted-foreground shadow-none data-[state=active]:border-border data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-none lg:h-14 lg:w-full"
            >
              <Icon className="h-4 w-4 shrink-0 group-data-[state=active]:text-primary" />
              <span className="text-left">
                <span className="block text-sm font-medium">{label}</span>
                <span className="hidden text-xs font-normal text-muted-foreground lg:block">{description}</span>
              </span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="feed" className="m-0 min-w-0">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <ProofFeed />
            <aside className="order-first space-y-4 lg:order-last">
              <WeeklyChallengeCard />
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="rooms" className="m-0 min-w-0">
          <FounderRooms />
        </TabsContent>

        <TabsContent value="weekly" className="m-0 min-w-0 max-w-2xl">
          <WeeklyChallengeCard />
        </TabsContent>

        <TabsContent value="dealflow" className="m-0 min-w-0">
          <DealFlowBoard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
