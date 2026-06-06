import { BUILDER_PROFILE_PUBLIC_COLUMNS } from "@/lib/builderProfileFields";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Search,
  MapPin,
  Star,
  Briefcase,
  Building2,
  Globe,
  Users,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

type Builder = any;
type Startup = any;

export default function Marketplace() {
  const [builders, setBuilders] = useState<Builder[]>([]);
  const [startups, setStartups] = useState<Startup[]>([]);
  const [q, setQ] = useState("");
  const [exp, setExp] = useState<string>("any");
  const [avail, setAvail] = useState<string>("any");
  const [stage, setStage] = useState<string>("any");
  const [hiring, setHiring] = useState<string>("any");

  useEffect(() => {
    (async () => {
      const [{ data: b }, { data: s }] = await Promise.all([
        supabase.from("builder_profiles").select(BUILDER_PROFILE_PUBLIC_COLUMNS).order("rating", { ascending: false }),
        supabase.from("startup_profiles").select("*").order("rating", { ascending: false }),
      ]);
      setBuilders(b ?? []);
      setStartups(s ?? []);
    })();
  }, []);

  const filteredBuilders = useMemo(() => {
    return builders.filter((b) => {
      const text = `${b.full_name ?? ""} ${b.title ?? ""} ${(b.skills ?? []).join(" ")}`.toLowerCase();
      if (q && !text.includes(q.toLowerCase())) return false;
      if (exp !== "any" && b.experience_level !== exp) return false;
      if (avail === "available" && !b.available) return false;
      return true;
    });
  }, [builders, q, exp, avail]);

  const filteredStartups = useMemo(() => {
    return startups.filter((s) => {
      const text = `${s.company_name ?? ""} ${s.industry ?? ""} ${s.bio ?? ""}`.toLowerCase();
      if (q && !text.includes(q.toLowerCase())) return false;
      if (stage !== "any" && s.stage !== stage) return false;
      if (hiring !== "any" && (s.hiring_status ?? "open") !== hiring) return false;
      return true;
    });
  }, [startups, q, stage, hiring]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase tracking-wider">
          <Sparkles className="h-3 w-3" /> Discovery
        </div>
        <h1 className="text-3xl font-semibold mt-1">Marketplace</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Discover builders and startups across the ecosystem.
        </p>
      </div>

      <Tabs defaultValue="builders" className="space-y-6">
        <TabsList>
          <TabsTrigger value="builders">
            <Briefcase className="h-4 w-4 mr-2" /> Builders
          </TabsTrigger>
          <TabsTrigger value="startups">
            <Building2 className="h-4 w-4 mr-2" /> Startups
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builders" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr,180px,180px]">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search by name, skill, role..."
                className="pl-9"
              />
            </div>
            <Select value={exp} onValueChange={setExp}>
              <SelectTrigger><SelectValue placeholder="Experience" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any experience</SelectItem>
                <SelectItem value="junior">Junior</SelectItem>
                <SelectItem value="mid">Mid</SelectItem>
                <SelectItem value="senior">Senior</SelectItem>
                <SelectItem value="expert">Expert</SelectItem>
              </SelectContent>
            </Select>
            <Select value={avail} onValueChange={setAvail}>
              <SelectTrigger><SelectValue placeholder="Availability" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any availability</SelectItem>
                <SelectItem value="available">Available now</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredBuilders.map((b) => (
              <BuilderCard key={b.id} b={b} />
            ))}
            {filteredBuilders.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full text-center py-12">
                No builders match your filters yet.
              </p>
            )}
          </div>
        </TabsContent>

        <TabsContent value="startups" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr,180px,180px]">
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search startups, industries..."
                className="pl-9"
              />
            </div>
            <Select value={stage} onValueChange={setStage}>
              <SelectTrigger><SelectValue placeholder="Stage" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any stage</SelectItem>
                <SelectItem value="idea">Idea</SelectItem>
                <SelectItem value="pre-seed">Pre-seed</SelectItem>
                <SelectItem value="seed">Seed</SelectItem>
                <SelectItem value="series-a">Series A</SelectItem>
                <SelectItem value="growth">Growth</SelectItem>
              </SelectContent>
            </Select>
            <Select value={hiring} onValueChange={setHiring}>
              <SelectTrigger><SelectValue placeholder="Hiring" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any status</SelectItem>
                <SelectItem value="open">Actively hiring</SelectItem>
                <SelectItem value="closed">Not hiring</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredStartups.map((s) => (
              <StartupCard key={s.id} s={s} />
            ))}
            {filteredStartups.length === 0 && (
              <p className="text-sm text-muted-foreground col-span-full text-center py-12">
                No startups match your filters yet.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function BuilderCard({ b }: { b: any }) {
  const initials = (b.full_name ?? "B").slice(0, 1).toUpperCase();
  return (
    <Card className="group hover:shadow-lg hover:-translate-y-0.5 transition-all">
      <div className="h-16 bg-gradient-to-br from-primary/20 to-primary/5 rounded-t-lg" />
      <CardContent className="pt-0 -mt-8 space-y-3">
        <div className="flex items-end justify-between">
          <Avatar className="h-16 w-16 ring-4 ring-background">
            <AvatarImage src={b.avatar_url} />
            <AvatarFallback className="bg-primary/10">{initials}</AvatarFallback>
          </Avatar>
          {b.available && <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Available</Badge>}
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <div className="font-semibold leading-tight">{b.full_name}</div>
            {b.verified && <CheckCircle2 className="h-4 w-4 text-primary" />}
          </div>
          <div className="text-xs text-muted-foreground">{b.title ?? "Builder"}</div>
        </div>
        {b.location && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />{b.location}
          </div>
        )}
        <div className="flex flex-wrap gap-1">
          {(b.skills ?? []).slice(0, 4).map((s: string) => (
            <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{Number(b.rating ?? 0).toFixed(1)}</div>
          <div>{b.total_projects ?? 0} projects</div>
          <div className="capitalize">{b.experience_level ?? "—"}</div>
        </div>
        <Link to={`/builders/${b.id}`} className="block">
          <Button className="w-full" variant="outline" size="sm">View Profile</Button>
        </Link>
      </CardContent>
    </Card>
  );
}

function StartupCard({ s }: { s: any }) {
  const initials = (s.company_name ?? "S").slice(0, 1).toUpperCase();
  return (
    <Card className="group hover:shadow-lg hover:-translate-y-0.5 transition-all">
      <div className="h-16 bg-gradient-to-br from-accent/30 to-accent/5 rounded-t-lg" />
      <CardContent className="pt-0 -mt-8 space-y-3">
        <div className="flex items-end justify-between">
          <Avatar className="h-16 w-16 ring-4 ring-background rounded-md">
            <AvatarImage src={s.logo_url} />
            <AvatarFallback className="bg-accent/30 rounded-md">{initials}</AvatarFallback>
          </Avatar>
          <Badge variant={s.hiring_status === "closed" ? "outline" : "default"}>
            {s.hiring_status === "closed" ? "Not hiring" : "Hiring"}
          </Badge>
        </div>
        <div>
          <div className="font-semibold leading-tight">{s.company_name}</div>
          <div className="text-xs text-muted-foreground">{s.founder_name ?? "Founder"}</div>
        </div>
        <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
          {s.mission || s.bio || "Building the future."}
        </p>
        <div className="flex flex-wrap gap-1">
          {s.industry && <Badge variant="secondary" className="text-[10px]">{s.industry}</Badge>}
          {s.stage && <Badge variant="outline" className="text-[10px]">{s.stage}</Badge>}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
          <div className="flex items-center gap-1"><Users className="h-3 w-3" />{s.team_size ?? "—"}</div>
          <div className="flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{Number(s.rating ?? 0).toFixed(1)}</div>
          {s.website && <Globe className="h-3 w-3" />}
        </div>
        <Link to={`/startups/${s.id}`} className="block">
          <Button className="w-full" variant="outline" size="sm">View Startup</Button>
        </Link>
      </CardContent>
    </Card>
  );
}
