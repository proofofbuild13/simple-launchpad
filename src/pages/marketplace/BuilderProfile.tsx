import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  MapPin,
  Star,
  Github,
  Linkedin,
  ExternalLink,
  MessageSquare,
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  Briefcase,
  Clock,
  Target,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { MessageButton } from "@/components/messaging/MessageButton";
import { PublicExperience } from "@/components/profile/PublicExperience";
import { InviteToProjectModal } from "@/components/workflow/InviteToProjectModal";
import { ResumeViewModal } from "@/components/profile/ResumeViewModal";

export default function BuilderProfile() {
  const { id } = useParams();
  const { user, role } = useAuth();
  const [b, setB] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [submissions, setSubmissions] = useState<any[]>([]);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [latestResume, setLatestResume] = useState<any>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: profile } = await supabase
        .from("builder_profiles").select(BUILDER_PROFILE_PUBLIC_COLUMNS).eq("id", id).maybeSingle();
      setB(profile);

      const [{ data: rev }, { data: contr }, { data: subs }, { data: res }] = await Promise.all([
        supabase.from("contract_reviews").select("*").eq("reviewee_id", id).order("created_at", { ascending: false }),
        supabase.from("contracts").select("id,project_id,status,created_at").eq("builder_id", id),
        supabase.from("submissions").select("id,title,project_id,status,created_at").eq("builder_id", id).limit(6),
        supabase.from("resume_applications").select("*").eq("builder_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      setReviews(rev ?? []);
      setContracts(contr ?? []);
      setSubmissions(subs ?? []);
      if (res) {
        setLatestResume(res);
      }

      if (user && role === "startup") {
        const { data: sv } = await supabase
          .from("saved_builders").select("id").eq("founder_id", user.id).eq("builder_id", id).maybeSingle();
        setSaved(!!sv);
      }
      setLoading(false);
    })();
  }, [id, user, role]);

  const toggleSave = async () => {
    if (!user || !id) return;
    if (saved) {
      await supabase.from("saved_builders").delete().eq("founder_id", user.id).eq("builder_id", id);
      setSaved(false);
      toast.success("Removed from saved");
    } else {
      await supabase.from("saved_builders").insert({ founder_id: user.id, builder_id: id });
      setSaved(true);
      toast.success("Builder saved ✓");
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  if (!b) return <p className="text-center text-muted-foreground py-20">Builder not found.</p>;

  const initials = (b.full_name ?? "B").slice(0, 1).toUpperCase();
  const avgRating = reviews.length ? reviews.reduce((s, r) => s + (r.rating ?? 0), 0) / reviews.length : (b.rating ?? 0);
  const isOwn = user?.id === b.id;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Card className="overflow-hidden">
        <div className="h-40 bg-gradient-to-br from-primary/30 via-primary/10 to-accent/20" />
        <CardContent className="pt-0 -mt-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="flex items-end gap-4">
              <Avatar className="h-24 w-24 ring-4 ring-background">
                <AvatarImage src={b.avatar_url} />
                <AvatarFallback className="text-xl">{initials}</AvatarFallback>
              </Avatar>
              <div className="pb-2">
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-semibold">{b.full_name}</h1>
                  {b.verified && <CheckCircle2 className="h-5 w-5 text-primary" />}
                </div>
                <p className="text-sm text-muted-foreground">{b.title ?? "Builder"}</p>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                  {b.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{b.location}</span>}
                  {b.available && <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200">Available</Badge>}
                  <span className="flex items-center gap-1"><Star className="h-3 w-3 fill-amber-400 text-amber-400" />{Number(avgRating).toFixed(1)}</span>
                </div>
              </div>
            </div>
            {!isOwn && (
              <div className="flex flex-wrap gap-2">
                <MessageButton recipientId={b.id} variant="outline" size="sm" />
                {role === "startup" && (
                  <>
                    {latestResume && <ResumeViewModal resumeApp={latestResume} />}
                    <Button variant="outline" size="sm" onClick={toggleSave}>
                      {saved ? (
                        <><BookmarkCheck className="h-4 w-4 mr-2 fill-current" />Saved ✓</>
                      ) : (
                        <><Bookmark className="h-4 w-4 mr-2" />Save Profile</>
                      )}
                    </Button>
                    <Button size="sm" onClick={() => setInviteOpen(true)}>
                      <Send className="h-4 w-4 mr-2" />Invite to Project
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-4 gap-3">
        <Stat icon={Briefcase} label="Projects" value={b.total_projects ?? contracts.length} />
        <Stat icon={Target} label="Completion" value={`${b.completion_rate ?? 0}%`} />
        <Stat icon={Clock} label="Response" value={b.response_time_hours ? `${b.response_time_hours}h` : "—"} />
        <Stat icon={Star} label="Rating" value={Number(avgRating).toFixed(1)} />
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <Section title="About">
            <p className="text-sm whitespace-pre-wrap text-foreground/80">{b.bio || "No bio yet."}</p>
          </Section>

          <PublicExperience userId={b.id} />

          <Section title="Skills">
            <div className="flex flex-wrap gap-2">
              {(b.skills ?? []).map((s: string) => (
                <Badge key={s} variant="secondary">{s}</Badge>
              ))}
              {(!b.skills || b.skills.length === 0) && <p className="text-sm text-muted-foreground">No skills listed.</p>}
            </div>
          </Section>

          <Section title="Recent Submissions">
            {submissions.length === 0 && <p className="text-sm text-muted-foreground">No submissions yet.</p>}
            <div className="space-y-2">
              {submissions.map((s) => (
                <Link key={s.id} to={`/submissions/${s.id}`} className="block p-3 rounded-md border hover:bg-muted/40">
                  <div className="flex items-center justify-between">
                    <div className="font-medium text-sm">{s.title}</div>
                    <Badge variant="outline" className="text-[10px]">{s.status}</Badge>
                  </div>
                </Link>
              ))}
            </div>
          </Section>

          <Section title="Reviews">
            {reviews.length === 0 && <p className="text-sm text-muted-foreground">No reviews yet.</p>}
            <div className="space-y-3">
              {reviews.map((r) => (
                <div key={r.id} className="p-3 rounded-md border">
                  <div className="flex items-center gap-1 text-xs">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} className={`h-3 w-3 ${i < r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                    ))}
                  </div>
                  <p className="text-sm mt-1">{r.comment}</p>
                </div>
              ))}
            </div>
          </Section>
        </div>

        <div className="space-y-4">
          <Section title="Links">
            <div className="space-y-2 text-sm">
              {b.portfolio && <LinkRow icon={ExternalLink} href={b.portfolio} label="Portfolio" />}
              {b.github && <LinkRow icon={Github} href={b.github} label="GitHub" />}
              {b.linkedin && <LinkRow icon={Linkedin} href={b.linkedin} label="LinkedIn" />}
              {!b.portfolio && !b.github && !b.linkedin && <p className="text-xs text-muted-foreground">No links provided.</p>}
            </div>
          </Section>
          <Section title="Details">
            <dl className="text-sm space-y-1.5">
              <Row k="Experience" v={b.experience_level ?? "—"} />
              <Row k="Hourly rate" v={b.hourly_rate ? `$${b.hourly_rate}/hr` : "—"} />
              <Row k="Work" v={b.work_preference ?? "—"} />
            </dl>
          </Section>
        </div>
      </div>

      {/* Invite to Project Modal */}
      <InviteToProjectModal
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        builderId={b.id}
        builderName={b.full_name}
      />
    </div>
  );
}

function Stat({ icon: Icon, label, value }: any) {
  return (
    <Card><CardContent className="pt-4 pb-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="h-3 w-3" />{label}</div>
      <div className="text-xl font-semibold mt-1">{value}</div>
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
function LinkRow({ icon: Icon, href, label }: any) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-2 hover:text-primary">
      <Icon className="h-3.5 w-3.5" /> {label}
    </a>
  );
}
function Row({ k, v }: any) {
  return <div className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="capitalize">{v}</dd></div>;
}
