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
  Sparkles,
  Layers,
} from "lucide-react";

const sections = [
  { value: "projects", label: "Projects", icon: Layers },
  { value: "rooms", label: "Rooms", icon: MessageCircle },
  { value: "weekly", label: "Weekly challenge", icon: Sparkles },
];

export default function Collective() {
  const { user, role } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab state synced with URL query param
  const tabParam = searchParams.get("tab");
  const initialTab =
    tabParam && sections.some((s) => s.value === tabParam) ? tabParam : "projects";
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
      if (val === "projects") {
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

      {/* Header */}
      <div className="border-b border-border/80 pb-4">
        <h1 className="collective-heading text-2xl font-bold tracking-tight">Collective</h1>
      </div>

      {/* Navigation tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-0 space-y-6">
        <TabsList className="h-10 justify-between sm:justify-start gap-1 rounded-full border bg-muted/40 p-1 w-full sm:w-fit">
          {sections.map(({ value, label, icon: Icon }) => (
            <TabsTrigger
              key={value}
              value={value}
              title={label}
              aria-label={label}
              className="h-8 flex-1 sm:flex-none gap-2 rounded-full px-3 sm:px-3.5 text-xs text-muted-foreground data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-xs"
            >
              <Icon className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ── 1. Projects ── */}
        <TabsContent value="projects" className="m-0 min-w-0 focus-visible:outline-none">
          <SuperFeed perspective={perspective} contentType="project" onSwitchTab={handleTabChange} />
        </TabsContent>

        {/* ── 2. Founder Rooms ── */}
        <TabsContent value="rooms" className="m-0 min-w-0 focus-visible:outline-none">
          <FounderRooms perspective={perspective} />
        </TabsContent>

        {/* ── 3. Proof Feed ── */}
        <TabsContent value="feed" className="m-0 min-w-0 focus-visible:outline-none">
          <ProofFeed />
        </TabsContent>

        {/* ── 4. Weekly Challenge ── */}
        <TabsContent value="weekly" className="m-0 min-w-0 max-w-2xl focus-visible:outline-none">
          <WeeklyChallengeCard perspective={perspective} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
