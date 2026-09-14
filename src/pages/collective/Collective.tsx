import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ProofFeed } from "@/components/collective/ProofFeed";
import { FounderRooms } from "@/components/collective/FounderRooms";
import { WeeklyChallengeCard } from "@/components/collective/WeeklyChallengeCard";
import { SuperFeed } from "@/components/collective/SuperFeed";
import { CollectivePerspective } from "@/components/collective/CollectiveCards";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  MessageCircle,
  Radio,
  Sparkles,
  LayoutGrid,
  Layers,
} from "lucide-react";

const sections = [
  { value: "super", label: "Super Feed", icon: LayoutGrid },
  { value: "projects", label: "Projects", icon: Layers },
  { value: "rooms", label: "Rooms", icon: MessageCircle },
  { value: "feed", label: "Proof feed", icon: Radio },
  { value: "weekly", label: "Weekly challenge", icon: Sparkles },
];

export default function Collective() {
  const { user, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state synced with URL query param
  const tabParam = searchParams.get("tab");
  const initialTab =
    tabParam && sections.some((s) => s.value === tabParam) ? tabParam : "super";
  const [activeTab, setActiveTab] = useState(initialTab);

  // Sync state if URL changes
  useEffect(() => {
    if (tabParam && sections.some((s) => s.value === tabParam)) {
      setActiveTab(tabParam);
    }
  }, [tabParam]);

  const handleTabChange = (val: string) => {
    setActiveTab(val);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (val === "super") {
        next.delete("tab");
      } else {
        next.set("tab", val);
      }
      return next;
    });
  };

  // Perspective is automatically determined by account role:
  // - Startup account => "founder" view
  // - Builder account => "builder" view
  const [perspective, setPerspective] = useState<CollectivePerspective>(() => {
    return role === "startup" ? "founder" : "builder";
  });

  useEffect(() => {
    if (role === "startup") {
      setPerspective("founder");
    } else {
      setPerspective("builder");
    }
  }, [role]);

  // Query user_roles directly on mount/user change to avoid any auth delay
  useEffect(() => {
    if (user) {
      supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.role === "startup") {
            setPerspective("founder");
          } else if (data?.role === "builder") {
            setPerspective("builder");
          }
        });
    }
  }, [user]);

  return (
    <div className="collective-shell space-y-6">
      <Helmet>
        <title>Collective — ProofBuild community for web3 builders</title>
        <meta
          name="description"
          content="Proof feed, founder rooms, project bounties and weekly community challenges for web3, DeFi and DAO builders on ProofBuild."
        />
      </Helmet>

      {/* Header with Title & Context description */}
      <div className="border-b border-border/80 pb-4 space-y-1">
        <h1 className="collective-heading text-2xl font-bold tracking-tight">Collective</h1>
        <p className="text-xs text-muted-foreground">
          {perspective === "founder"
            ? "Founder view — Review project submissions, start discussions in topic rooms, and inspect shipped builds."
            : "Builder view — Discover open projects to build, join founder discussions, and submit verified proofs of work."}
        </p>
      </div>

      {/* Navigation: 5 top tabs only (duplicate chip rows removed) */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-0 space-y-6">
        <TabsList className="h-10 justify-start gap-1 rounded-full border bg-muted/40 p-1 flex-wrap w-fit">
          {sections.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="h-8 gap-2 rounded-full px-3.5 text-xs text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── 1. Super Feed (Unified stream of all four card types) ── */}
        <TabsContent value="super" className="m-0 min-w-0 focus-visible:outline-none">
          <SuperFeed perspective={perspective} onSwitchTab={handleTabChange} />
        </TabsContent>

        {/* ── 2. Projects (Filtered to projects with ProjectFeedCards & engagement bar) ── */}
        <TabsContent value="projects" className="m-0 min-w-0 focus-visible:outline-none">
          <SuperFeed perspective={perspective} contentType="project" onSwitchTab={handleTabChange} />
        </TabsContent>

        {/* ── 3. Founder Rooms (Filtered to room discussions with RoomFeedCards & engagement bar) ── */}
        <TabsContent value="rooms" className="m-0 min-w-0 focus-visible:outline-none">
          <FounderRooms perspective={perspective} />
        </TabsContent>

        {/* ── 4. Proof Feed (Filtered to shipped proofs with ProofFeedCards & engagement bar) ── */}
        <TabsContent value="feed" className="m-0 min-w-0 focus-visible:outline-none">
          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            <ProofFeed />
            <aside className="order-first space-y-4 lg:order-last">
              <WeeklyChallengeCard perspective={perspective} />
            </aside>
          </div>
        </TabsContent>

        {/* ── 5. Weekly Challenge (Standalone view with warm amber styling & engagement bar) ── */}
        <TabsContent value="weekly" className="m-0 min-w-0 max-w-2xl focus-visible:outline-none">
          <WeeklyChallengeCard perspective={perspective} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
