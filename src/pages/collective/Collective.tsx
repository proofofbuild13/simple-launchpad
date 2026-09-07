import { Helmet } from "react-helmet-async";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BuilderIdentityHeader } from "@/components/collective/BuilderIdentityHeader";
import { ProofFeed } from "@/components/collective/ProofFeed";
import { FounderRooms } from "@/components/collective/FounderRooms";
import { WeeklyChallengeCard } from "@/components/collective/WeeklyChallengeCard";
import { DealFlowBoard } from "@/components/collective/DealFlowBoard";

export default function Collective() {
  return (
    <div className="space-y-6">
      <Helmet>
        <title>Collective — ProofBuild community for web3 builders</title>
        <meta
          name="description"
          content="Proof feed, founder rooms, weekly community challenges and deal flow for web3, DeFi and DAO builders on ProofBuild."
        />
      </Helmet>

      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Collective</h1>
        <p className="text-muted-foreground mt-1">
          Where web3 founders and builders talk, ship and get seen.
        </p>
      </div>

      <BuilderIdentityHeader />

      <Tabs defaultValue="feed">
        <TabsList>
          <TabsTrigger value="feed">Feed</TabsTrigger>
          <TabsTrigger value="rooms">Rooms</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="dealflow">Deal flow</TabsTrigger>
        </TabsList>

        <TabsContent value="feed" className="mt-5">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
            <ProofFeed />
            <aside className="space-y-4 order-first lg:order-last">
              <WeeklyChallengeCard />
            </aside>
          </div>
        </TabsContent>

        <TabsContent value="rooms" className="mt-5">
          <FounderRooms />
        </TabsContent>

        <TabsContent value="weekly" className="mt-5 max-w-xl">
          <WeeklyChallengeCard />
        </TabsContent>

        <TabsContent value="dealflow" className="mt-5">
          <DealFlowBoard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
