import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Trash2, CheckCircle2, Star, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export default function Profile() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  if (!user) return null;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">Profile</h1>
          <p className="text-sm text-muted-foreground">
            Manage your public profile, work history and payment details.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => navigate(role === "startup" ? `/startups/${user.id}` : `/builders/${user.id}`)}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          View Public Profile
        </Button>
      </div>

      <Tabs defaultValue="personal">
        <TabsList className="w-full flex overflow-x-auto scrollbar-none h-auto flex-wrap gap-1 justify-start bg-muted/50 p-1">
          <TabsTrigger value="personal" className="text-xs sm:text-sm whitespace-nowrap">Personal Details</TabsTrigger>
          {role === "builder" && <TabsTrigger value="experience" className="text-xs sm:text-sm whitespace-nowrap">Experience</TabsTrigger>}
          {role === "builder" && <TabsTrigger value="education" className="text-xs sm:text-sm whitespace-nowrap">Education</TabsTrigger>}
          {role === "builder" && <TabsTrigger value="skills" className="text-xs sm:text-sm whitespace-nowrap">Skills & Portfolio</TabsTrigger>}
          {role === "builder" && <TabsTrigger value="payments" className="text-xs sm:text-sm whitespace-nowrap">Payment methods</TabsTrigger>}
        </TabsList>

        <TabsContent value="personal" className="mt-4"><PersonalTab /></TabsContent>
        {role === "builder" && <>
          <TabsContent value="experience" className="mt-4"><ExperienceTab userId={user.id} /></TabsContent>
          <TabsContent value="education" className="mt-4"><EducationTab userId={user.id} /></TabsContent>
          <TabsContent value="skills" className="mt-4"><SkillsTab /></TabsContent>
          <TabsContent value="payments" className="mt-4"><PaymentMethodsTab userId={user.id} /></TabsContent>
        </>}
      </Tabs>
    </div>
  );
}

/* ───────── Personal ───────── */
function PersonalTab() {
  const { user, role } = useAuth();
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const table = role === "startup" ? "startup_profiles" : "builder_profiles";

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: row } = await supabase.from(table).select("*").eq("id", user.id).maybeSingle();
      setData(row ?? {});
      setLoading(false);
    })();
  }, [user, table]);

  const set = (k: string, v: any) => setData((d: any) => ({ ...d, [k]: v }));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const payload: any = { ...data, id: user.id, updated_at: new Date().toISOString() };
    const { error } = await supabase.from(table).upsert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
  };

  if (loading) return <Spinner />;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Personal information</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {role === "builder" ? (
          <>
            <Field label="Full name"><Input value={data.full_name ?? ""} onChange={(e) => set("full_name", e.target.value)} /></Field>
            <Field label="Title"><Input value={data.title ?? ""} placeholder="Senior Full-stack Engineer" onChange={(e) => set("title", e.target.value)} /></Field>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Location"><Input value={data.location ?? ""} onChange={(e) => set("location", e.target.value)} /></Field>
              <Field label="Phone"><Input value={data.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Avatar URL"><Input value={data.avatar_url ?? ""} onChange={(e) => set("avatar_url", e.target.value)} /></Field>
              <Field label="Banner image URL"><Input value={data.banner_image ?? ""} onChange={(e) => set("banner_image", e.target.value)} /></Field>
            </div>
            <Field label="Bio"><Textarea rows={4} value={data.bio ?? ""} onChange={(e) => set("bio", e.target.value)} /></Field>
            <div className="flex items-center justify-between p-3 rounded-md border">
              <div>
                <div className="text-sm font-medium">Available for work</div>
                <div className="text-xs text-muted-foreground">Show the "Available" badge on your profile.</div>
              </div>
              <Switch checked={!!data.available} onCheckedChange={(v) => set("available", v)} />
            </div>
          </>
        ) : (
          <>
            <Field label="Company name"><Input value={data.company_name ?? ""} onChange={(e) => set("company_name", e.target.value)} /></Field>
            <Field label="Founder name"><Input value={data.founder_name ?? ""} onChange={(e) => set("founder_name", e.target.value)} /></Field>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Industry"><Input value={data.industry ?? ""} onChange={(e) => set("industry", e.target.value)} /></Field>
              <Field label="Stage"><Input value={data.stage ?? ""} placeholder="idea / seed / series-a" onChange={(e) => set("stage", e.target.value)} /></Field>
              <Field label="Team size"><Input value={data.team_size ?? ""} placeholder="1-10" onChange={(e) => set("team_size", e.target.value)} /></Field>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Location"><Input value={data.location ?? ""} onChange={(e) => set("location", e.target.value)} /></Field>
              <Field label="Website"><Input value={data.website ?? ""} onChange={(e) => set("website", e.target.value)} /></Field>
            </div>
            <Field label="Mission"><Textarea rows={2} value={data.mission ?? ""} onChange={(e) => set("mission", e.target.value)} /></Field>
            <Field label="About"><Textarea rows={4} value={data.bio ?? ""} onChange={(e) => set("bio", e.target.value)} /></Field>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Logo URL"><Input value={data.logo_url ?? ""} onChange={(e) => set("logo_url", e.target.value)} /></Field>
              <Field label="Banner image URL"><Input value={data.banner_image ?? ""} onChange={(e) => set("banner_image", e.target.value)} /></Field>
            </div>
            <div className="flex items-center justify-between p-3 rounded-md border">
              <div>
                <div className="text-sm font-medium">Actively hiring</div>
                <div className="text-xs text-muted-foreground">Display the "Hiring" badge in the Marketplace.</div>
              </div>
              <Switch
                checked={(data.hiring_status ?? "open") !== "closed"}
                onCheckedChange={(v) => set("hiring_status", v ? "open" : "closed")}
              />
            </div>
          </>
        )}
        <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
      </CardContent>
    </Card>
  );
}

/* ───────── Experience ───────── */
function ExperienceTab({ userId }: { userId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    const { data } = await supabase.from("experiences").select("*").eq("user_id", userId).order("start_date", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [userId]);

  const save = async () => {
    if (!editing?.company_name || !editing?.role) return toast.error("Company and role are required");
    const payload = { ...editing, user_id: userId };
    const { error } = editing.id
      ? await supabase.from("experiences").update(payload).eq("id", editing.id)
      : await supabase.from("experiences").insert(payload);
    if (error) return toast.error(error.message);
    setEditing(null);
    load();
    toast.success("Saved");
  };

  const remove = async (id: string) => {
    await supabase.from("experiences").delete().eq("id", id);
    load();
  };

  if (loading) return <Spinner />;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Work experience</CardTitle>
        <Button size="sm" onClick={() => setEditing({})}><Plus className="h-4 w-4 mr-1" />Add</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && !editing && <p className="text-sm text-muted-foreground">No experience added yet.</p>}
        {items.map((it) => (
          <div key={it.id} className="p-3 border rounded-md flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="font-medium text-sm">{it.role} · {it.company_name}</div>
              <div className="text-xs text-muted-foreground">{it.employment_type} · {it.start_date ?? ""} → {it.is_current ? "Present" : (it.end_date ?? "")}</div>
              {it.description && <p className="text-xs text-foreground/80 whitespace-pre-wrap">{it.description}</p>}
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setEditing(it)}>Edit</Button>
              <Button variant="ghost" size="icon" onClick={() => remove(it.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {editing && (
          <div className="p-3 border rounded-md space-y-3 bg-muted/30">
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Company"><Input value={editing.company_name ?? ""} onChange={(e) => setEditing({ ...editing, company_name: e.target.value })} /></Field>
              <Field label="Role"><Input value={editing.role ?? ""} onChange={(e) => setEditing({ ...editing, role: e.target.value })} /></Field>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Type">
                <Select value={editing.employment_type ?? ""} onValueChange={(v) => setEditing({ ...editing, employment_type: v })}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {["Full-time","Part-time","Contract","Freelance","Internship","Founder"].map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Start"><Input type="date" value={editing.start_date ?? ""} onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} /></Field>
              <Field label="End"><Input type="date" value={editing.end_date ?? ""} disabled={editing.is_current} onChange={(e) => setEditing({ ...editing, end_date: e.target.value })} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={!!editing.is_current} onCheckedChange={(v) => setEditing({ ...editing, is_current: v, end_date: v ? null : editing.end_date })} />
              I currently work here
            </label>
            <Field label="Description"><Textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <Field label="Achievements"><Textarea rows={2} value={editing.achievements ?? ""} onChange={(e) => setEditing({ ...editing, achievements: e.target.value })} /></Field>
            <div className="flex gap-2">
              <Button onClick={save}>Save</Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ───────── Education ───────── */
function EducationTab({ userId }: { userId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    const { data } = await supabase.from("educations").select("*").eq("user_id", userId).order("start_year", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [userId]);

  const save = async () => {
    if (!editing?.institution) return toast.error("Institution is required");
    const payload = { ...editing, user_id: userId };
    const { error } = editing.id
      ? await supabase.from("educations").update(payload).eq("id", editing.id)
      : await supabase.from("educations").insert(payload);
    if (error) return toast.error(error.message);
    setEditing(null);
    load();
    toast.success("Saved");
  };

  const remove = async (id: string) => {
    await supabase.from("educations").delete().eq("id", id);
    load();
  };

  if (loading) return <Spinner />;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Education</CardTitle>
        <Button size="sm" onClick={() => setEditing({})}><Plus className="h-4 w-4 mr-1" />Add</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && !editing && <p className="text-sm text-muted-foreground">No education added yet.</p>}
        {items.map((it) => (
          <div key={it.id} className="p-3 border rounded-md flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="font-medium text-sm">{it.degree ?? "Degree"} · {it.institution}</div>
              <div className="text-xs text-muted-foreground">{it.specialization} · {it.start_year ?? ""} → {it.end_year ?? "Present"} {it.grade && `· ${it.grade}`}</div>
              {it.achievements && <p className="text-xs text-foreground/80">{it.achievements}</p>}
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setEditing(it)}>Edit</Button>
              <Button variant="ghost" size="icon" onClick={() => remove(it.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {editing && (
          <div className="p-3 border rounded-md space-y-3 bg-muted/30">
            <Field label="Institution"><Input value={editing.institution ?? ""} onChange={(e) => setEditing({ ...editing, institution: e.target.value })} /></Field>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label="Degree"><Input value={editing.degree ?? ""} onChange={(e) => setEditing({ ...editing, degree: e.target.value })} /></Field>
              <Field label="Specialization"><Input value={editing.specialization ?? ""} onChange={(e) => setEditing({ ...editing, specialization: e.target.value })} /></Field>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label="Start year"><Input type="number" value={editing.start_year ?? ""} onChange={(e) => setEditing({ ...editing, start_year: Number(e.target.value) || null })} /></Field>
              <Field label="End year"><Input type="number" value={editing.end_year ?? ""} onChange={(e) => setEditing({ ...editing, end_year: Number(e.target.value) || null })} /></Field>
              <Field label="Grade / GPA"><Input value={editing.grade ?? ""} onChange={(e) => setEditing({ ...editing, grade: e.target.value })} /></Field>
            </div>
            <Field label="Achievements"><Textarea rows={2} value={editing.achievements ?? ""} onChange={(e) => setEditing({ ...editing, achievements: e.target.value })} /></Field>
            <div className="flex gap-2">
              <Button onClick={save}>Save</Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ───────── Skills & Portfolio ───────── */
function SkillsTab() {
  const { user } = useAuth();
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: row } = await supabase.from("builder_profiles").select("*").eq("id", user.id).maybeSingle();
      setData(row ?? {});
      setLoading(false);
    })();
  }, [user]);

  const set = (k: string, v: any) => setData((d: any) => ({ ...d, [k]: v }));
  const save = async () => {
    if (!user) return;
    setSaving(true);
    const payload: any = { ...data, id: user.id, updated_at: new Date().toISOString() };
    payload.skills = typeof data.skills === "string"
      ? data.skills.split(",").map((s: string) => s.trim()).filter(Boolean)
      : data.skills ?? [];
    const { error } = await supabase.from("builder_profiles").upsert(payload);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Saved");
  };

  if (loading) return <Spinner />;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Skills & portfolio</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Field label="Skills (comma separated)">
          <Input
            value={Array.isArray(data.skills) ? data.skills.join(", ") : (data.skills ?? "")}
            onChange={(e) => set("skills", e.target.value)}
          />
        </Field>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Experience level">
            <Select value={data.experience_level ?? ""} onValueChange={(v) => set("experience_level", v)}>
              <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
              <SelectContent>{["junior","mid","senior","expert"].map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Hourly rate (USD)"><Input type="number" value={data.hourly_rate ?? ""} onChange={(e) => set("hourly_rate", Number(e.target.value) || null)} /></Field>
          <Field label="Work preference"><Input value={data.work_preference ?? ""} placeholder="remote / hybrid / onsite" onChange={(e) => set("work_preference", e.target.value)} /></Field>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label="Portfolio URL"><Input value={data.portfolio ?? ""} onChange={(e) => set("portfolio", e.target.value)} /></Field>
          <Field label="GitHub"><Input value={data.github ?? ""} onChange={(e) => set("github", e.target.value)} /></Field>
          <Field label="LinkedIn"><Input value={data.linkedin ?? ""} onChange={(e) => set("linkedin", e.target.value)} /></Field>
        </div>
        <Button onClick={save} disabled={saving}>{saving ? "Saving..." : "Save"}</Button>
      </CardContent>
    </Card>
  );
}

/* ───────── Payment Methods ───────── */
function PaymentMethodsTab({ userId }: { userId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);

  const load = async () => {
    const { data } = await supabase.from("payment_methods").select("*").eq("user_id", userId).order("is_default", { ascending: false });
    setItems(data ?? []);
    setLoading(false);
  };
  useEffect(() => { load(); }, [userId]);

  const save = async () => {
    if (!editing?.method_type) return toast.error("Pick a method type");
    const payload = { ...editing, user_id: userId };
    const { error } = editing.id
      ? await supabase.from("payment_methods").update(payload).eq("id", editing.id)
      : await supabase.from("payment_methods").insert(payload);
    if (error) return toast.error(error.message);
    setEditing(null);
    load();
    toast.success("Saved. Founders on your active contracts have been notified.");
  };

  const remove = async (id: string) => {
    await supabase.from("payment_methods").delete().eq("id", id);
    load();
  };

  const setDefault = async (id: string) => {
    await supabase.from("payment_methods").update({ is_default: true }).eq("id", id);
    load();
    toast.success("Default updated");
  };

  if (loading) return <Spinner />;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">Payment methods</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">Founders on your active contracts will see your default method (masked).</p>
        </div>
        <Button size="sm" onClick={() => setEditing({ method_type: "upi", is_default: items.length === 0 })}><Plus className="h-4 w-4 mr-1" />Add</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && !editing && <p className="text-sm text-muted-foreground">No payment methods yet.</p>}
        {items.map((m) => (
          <div key={m.id} className="p-3 border rounded-md flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm uppercase">{m.method_type}</span>
                {m.is_default && <Badge variant="secondary"><Star className="h-3 w-3 mr-1" />Default</Badge>}
                {m.verified && <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" />Verified</Badge>}
              </div>
              {m.method_type === "upi" ? (
                <div className="text-xs text-muted-foreground">UPI: {m.upi_id}</div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  {m.bank_name} · {m.account_holder} · ••••{(m.account_number ?? "").slice(-4)} · IFSC {m.ifsc}
                </div>
              )}
            </div>
            <div className="flex gap-1">
              {!m.is_default && <Button variant="ghost" size="sm" onClick={() => setDefault(m.id)}>Make default</Button>}
              <Button variant="ghost" size="sm" onClick={() => setEditing(m)}>Edit</Button>
              <Button variant="ghost" size="icon" onClick={() => remove(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {editing && (
          <div className="p-3 border rounded-md space-y-3 bg-muted/30">
            <Field label="Method type">
              <Select value={editing.method_type} onValueChange={(v) => setEditing({ ...editing, method_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="upi">UPI</SelectItem>
                  <SelectItem value="bank">Bank account</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {editing.method_type === "upi" ? (
              <Field label="UPI ID"><Input value={editing.upi_id ?? ""} placeholder="name@bank" onChange={(e) => setEditing({ ...editing, upi_id: e.target.value })} /></Field>
            ) : (
              <>
                <div className="grid md:grid-cols-2 gap-3">
                  <Field label="Account holder"><Input value={editing.account_holder ?? ""} onChange={(e) => setEditing({ ...editing, account_holder: e.target.value })} /></Field>
                  <Field label="Bank name"><Input value={editing.bank_name ?? ""} onChange={(e) => setEditing({ ...editing, bank_name: e.target.value })} /></Field>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <Field label="Account number"><Input value={editing.account_number ?? ""} onChange={(e) => setEditing({ ...editing, account_number: e.target.value })} /></Field>
                  <Field label="IFSC"><Input value={editing.ifsc ?? ""} onChange={(e) => setEditing({ ...editing, ifsc: e.target.value })} /></Field>
                </div>
              </>
            )}
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={!!editing.is_default} onCheckedChange={(v) => setEditing({ ...editing, is_default: v })} />
              Set as default
            </label>
            <div className="flex gap-2">
              <Button onClick={save}>Save</Button>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ───────── helpers ───────── */
function Field({ label, children }: any) {
  return <div className="space-y-1.5"><Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>{children}</div>;
}
function Spinner() {
  return <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
}
