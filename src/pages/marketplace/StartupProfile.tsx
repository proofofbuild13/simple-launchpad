import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2, MapPin, Star, Globe, MessageSquare, UserPlus, Building2, Users, Briefcase,
} from "lucide-react";
import { toast } from "sonner";
import { MessageButton } from "@/components/messaging/MessageButton";

export default function StartupProfile() {
  const { id } = useParams();
  const { user, role } = useAuth();
  const [s, setS] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [following, setFollowing] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: profile } = await supabase
        .from("startup_profiles").select("*").eq("id", id).maybeSingle();
      setS(profile);
      const { data: pj } = await supabase
        .from("projects").select("*").eq("founder_id", id).eq("visibility", "public").order("created_at", { ascending: false });
      setProjects(pj ?? []);

      if (user && role === "builder") {
        const { data: f } = await supabase
          .from("followed_startups").select("id").eq("builder_id", user.id).eq("startup_id", id).maybeSingle();
        setFollowing(!!f);
      }
      setLoading(false);
    })();
  }, [id, user, role]);

  const toggleFollow = async () => {
    if (!user || !id) return;
    if (following) {
      await supabase.from("followed_startups").delete().eq("builder_id", user.id).eq("startup_id", id);
      setFollowing(false);
      toast.success("Unfollowed");
    } else {
      await supabase.from("followed_startups").insert({ builder_id: user.id, startup_id: id });
      setFollowing(true);
      toast.success("Following");
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!s) return <p className="text-center text-muted-foreground py-20">Startup not found.</p>;

  const initials = (s.company_name ?? "S").slice(0, 1).toUpperCase();
  const isOwn = user?.id === s.id;
  const openProjects = projects.filter((p) => p.status === "open" || p.status === "active");

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Card className="overflow-hidden">
        <div className="h-40 bg-gradient-to-br from-accent/40 via-accent/15 to-primary/20" />
        <CardContent className="pt-0 -mt-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <Avatar className="h-24 w-24 ring-4 ring-background rounded-lg">
                <AvatarImage src={s.logo_url} />
                <AvatarFallback className="text-xl rounded-lg">{initials}</AvatarFallback>
              </Avatar>
              <div className="pb-2">
                <h1 className="text-2xl font-semibold">{s.company_name}</h1>
                <p className="text-sm text-muted-foreground">{s.founder_name ?? "Founder"}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  {s.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{s.location}</span>}
                  {s.industry && <Badge variant="secondary" className="text-[10px]">{s.industry}</Badge>}
                  {s.stage && <Badge variant="outline" className="text-[10px]">{s.stage}</Badge>}
                  <Badge variant={s.hiring_status === "closed" ? "outline" : "default"}>
                    {s.hiring_status === "closed" ? "Not hiring" : "Hiring"}
                  </Badge>
                </div>
              </div>
            </div>
            {!isOwn && (
              <div className="flex flex-wrap gap-2">
                <MessageButton recipientId={s.id} variant="outline" size="sm" />
                {role === "builder" && (
                  <Button size="sm" onClick={toggleFollow}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    {following ? "Following" : "Follow"}
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-4 gap-3">
        <Stat icon={Briefcase} label="Projects" value={projects.length} />
        <Stat icon={Building2} label="Stage" value={s.stage ?? "—"} />
        <Stat icon={Users} label="Team" value={s.team_size ?? "—"} />
        <Stat icon={Star} label="Rating" value={Number(s.rating ?? 0).toFixed(1)} />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <Section title="Mission">
            <p className="text-sm whitespace-pre-wrap text-foreground/80">{s.mission || "—"}</p>
          </Section>
          <Section title="About the company">
            <p className="text-sm whitespace-pre-wrap text-foreground/80">{s.bio || "No description yet."}</p>
          </Section>

          <Section title="Open projects">
            {openProjects.length === 0 && <p className="text-sm text-muted-foreground">No open projects.</p>}
            <div className="space-y-2">
              {openProjects.map((p) => (
                <Link key={p.id} to={`/projects/${p.id}`} className="block p-3 rounded-md border hover:bg-muted/40">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">{p.title}</div>
                    <Badge variant="outline" className="text-[10px]">{p.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-1">{p.short_description}</p>
                </Link>
              ))}
            </div>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Links">
            <div className="space-y-2 text-sm">
              {s.website && (
                <a href={s.website} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-primary">
                  <Globe className="h-3.5 w-3.5" /> Website
                </a>
              )}
              {!s.website && <p className="text-xs text-muted-foreground">No links yet.</p>}
            </div>
          </Section>
          <Section title="Details">
            <dl className="text-sm space-y-1.5">
              <Row k="Industry" v={s.industry ?? "—"} />
              <Row k="Stage" v={s.stage ?? "—"} />
              <Row k="Team size" v={s.team_size ?? "—"} />
              <Row k="Hiring" v={s.hiring_status ?? "open"} />
            </dl>
          </Section>
        </div>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value }: any) {
  return (
    <Card><CardContent className="pt-4 pb-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3 w-3" />{label}</div>
      <div className="text-xl font-semibold mt-1 capitalize">{value}</div>
    </CardContent></Card>
  );
}
function Section({ title, children }: any) {
  return (
    <Card>
      <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}
function Row({ k, v }: any) {
  return <div className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="capitalize">{v}</dd></div>;
}
