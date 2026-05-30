import { BUILDER_PROFILE_PUBLIC_COLUMNS } from "@/lib/builderProfileFields";
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
import { useTranslation } from "react-i18next";

export default function Profile() {
  const { user, role } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  if (!user) return null;

  return (
    <div className="w-full max-w-4xl mx-auto space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold">{t("profile.title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("profile.description")}
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          onClick={() => navigate(role === "startup" ? `/startups/${user.id}` : `/builders/${user.id}`)}
        >
          <ExternalLink className="h-4 w-4 mr-2" />
          {t("profile.viewPublicProfile")}
        </Button>
      </div>

      <Tabs defaultValue="personal">
        <TabsList className="w-full flex overflow-x-auto scrollbar-none h-auto flex-wrap gap-1 justify-start bg-muted/50 p-1">
          <TabsTrigger value="personal" className="text-xs sm:text-sm whitespace-nowrap">{t("profile.tabs.personal")}</TabsTrigger>
          {role === "builder" && <TabsTrigger value="experience" className="text-xs sm:text-sm whitespace-nowrap">{t("profile.tabs.experience")}</TabsTrigger>}
          {role === "builder" && <TabsTrigger value="education" className="text-xs sm:text-sm whitespace-nowrap">{t("profile.tabs.education")}</TabsTrigger>}
          {role === "builder" && <TabsTrigger value="skills" className="text-xs sm:text-sm whitespace-nowrap">{t("profile.tabs.skills")}</TabsTrigger>}
          {role === "builder" && <TabsTrigger value="payments" className="text-xs sm:text-sm whitespace-nowrap">{t("profile.tabs.payments")}</TabsTrigger>}
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
  const { t } = useTranslation();
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const table = role === "startup" ? "startup_profiles" : "builder_profiles";

  useEffect(() => {
    if (!user) return;
    (async () => {
      const builderCols = "id,full_name,username,title,domain,location,avatar_url,banner_image,bio,linkedin,github,portfolio,skills,experience_level,hourly_rate,work_preference,open_to_full_time,available,verified,featured_projects,rating,total_projects,completion_rate,response_time_hours";
      const sel = role === "builder" ? builderCols : "*";
      const { data: row } = await supabase.from(table).select(sel).eq("id", user.id).maybeSingle();
      let merged: any = row ?? {};
      if (role === "builder") {
        const { data: ph } = await supabase.rpc("get_my_builder_phone");
        merged = { ...merged, phone: ph ?? "" };
      }
      setData(merged);
      setLoading(false);
    })();
  }, [user, table, role]);

  const set = (k: string, v: any) => setData((d: any) => ({ ...d, [k]: v }));

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { phone, ...rest } = data ?? {};
    const payload: any = { ...rest, id: user.id, updated_at: new Date().toISOString() };
    const { error } = await supabase.from(table).upsert(payload);
    if (!error && role === "builder") {
      await supabase.rpc("set_my_builder_phone", { _phone: phone ?? null });
    }
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(t("profile.personal.updated"));
  };

  if (loading) return <Spinner />;

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t("profile.personal.title")}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        {role === "builder" ? (
          <>
            <Field label={t("profile.personal.fields.fullName")}><Input value={data.full_name ?? ""} onChange={(e) => set("full_name", e.target.value)} /></Field>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label={t("profile.personal.fields.domain")}>
                <Select value={data.domain ?? ""} onValueChange={(v) => set("domain", v)}>
                  <SelectTrigger><SelectValue placeholder={t("profile.personal.fields.domainPlaceholder")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Frontend Development">{t("profile.domains.Frontend Development")}</SelectItem>
                    <SelectItem value="Backend Development">{t("profile.domains.Backend Development")}</SelectItem>
                    <SelectItem value="Full-stack Development">{t("profile.domains.Full-stack Development")}</SelectItem>
                    <SelectItem value="Mobile Development">{t("profile.domains.Mobile Development")}</SelectItem>
                    <SelectItem value="AI / Machine Learning">{t("profile.domains.AI / Machine Learning")}</SelectItem>
                    <SelectItem value="Data Science & Engineering">{t("profile.domains.Data Science & Engineering")}</SelectItem>
                    <SelectItem value="Data/Business Analyst">{t("profile.domains.Data/Business Analyst")}</SelectItem>
                    <SelectItem value="DevOps & Cloud">{t("profile.domains.DevOps & Cloud")}</SelectItem>
                    <SelectItem value="UI/UX Design">{t("profile.domains.UI/UX Design")}</SelectItem>
                    <SelectItem value="Blockchain / Web3">{t("profile.domains.Blockchain / Web3")}</SelectItem>
                    <SelectItem value="Other">{t("profile.domains.Other")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("profile.personal.fields.titleLabel")}><Input value={data.title ?? ""} placeholder={t("profile.personal.fields.titlePlaceholder")} onChange={(e) => set("title", e.target.value)} /></Field>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label={t("profile.personal.fields.location")}><Input value={data.location ?? ""} onChange={(e) => set("location", e.target.value)} /></Field>
              <Field label={t("profile.personal.fields.phone")}><Input value={data.phone ?? ""} onChange={(e) => set("phone", e.target.value)} /></Field>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label={t("profile.personal.fields.avatarUrl")}><Input value={data.avatar_url ?? ""} onChange={(e) => set("avatar_url", e.target.value)} /></Field>
              <Field label={t("profile.personal.fields.bannerUrl")}><Input value={data.banner_image ?? ""} onChange={(e) => set("banner_image", e.target.value)} /></Field>
            </div>
            <Field label={t("profile.personal.fields.bio")}><Textarea rows={4} value={data.bio ?? ""} onChange={(e) => set("bio", e.target.value)} /></Field>
            <div className="flex items-center justify-between p-3 rounded-md border">
              <div>
                <div className="text-sm font-medium">{t("profile.personal.fields.availableForWork")}</div>
                <div className="text-xs text-muted-foreground">{t("profile.personal.fields.availableDescription")}</div>
              </div>
              <Switch checked={!!data.available} onCheckedChange={(v) => set("available", v)} />
            </div>
          </>
        ) : (
          <>
            <Field label={t("profile.personal.fields.companyName")}><Input value={data.company_name ?? ""} onChange={(e) => set("company_name", e.target.value)} /></Field>
            <Field label={t("profile.personal.fields.founderName")}><Input value={data.founder_name ?? ""} onChange={(e) => set("founder_name", e.target.value)} /></Field>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label={t("profile.personal.fields.industry")}><Input value={data.industry ?? ""} onChange={(e) => set("industry", e.target.value)} /></Field>
              <Field label={t("profile.personal.fields.stage")}><Input value={data.stage ?? ""} placeholder={t("profile.personal.fields.stagePlaceholder")} onChange={(e) => set("stage", e.target.value)} /></Field>
              <Field label={t("profile.personal.fields.teamSize")}><Input value={data.team_size ?? ""} placeholder={t("profile.personal.fields.teamSizePlaceholder")} onChange={(e) => set("team_size", e.target.value)} /></Field>
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label={t("profile.personal.fields.location")}><Input value={data.location ?? ""} onChange={(e) => set("location", e.target.value)} /></Field>
              <Field label={t("profile.personal.fields.website")}><Input value={data.website ?? ""} onChange={(e) => set("website", e.target.value)} /></Field>
            </div>
            <Field label={t("profile.personal.fields.mission")}><Textarea rows={2} value={data.mission ?? ""} onChange={(e) => set("mission", e.target.value)} /></Field>
            <Field label={t("profile.personal.fields.about")}><Textarea rows={4} value={data.bio ?? ""} onChange={(e) => set("bio", e.target.value)} /></Field>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label={t("profile.personal.fields.logoUrl")}><Input value={data.logo_url ?? ""} onChange={(e) => set("logo_url", e.target.value)} /></Field>
              <Field label={t("profile.personal.fields.bannerUrl")}><Input value={data.banner_image ?? ""} onChange={(e) => set("banner_image", e.target.value)} /></Field>
            </div>
            <div className="flex items-center justify-between p-3 rounded-md border">
              <div>
                <div className="text-sm font-medium">{t("profile.personal.fields.activelyHiring")}</div>
                <div className="text-xs text-muted-foreground">{t("profile.personal.fields.hiringDescription")}</div>
              </div>
              <Switch
                checked={(data.hiring_status ?? "open") !== "closed"}
                onCheckedChange={(v) => set("hiring_status", v ? "open" : "closed")}
              />
            </div>
          </>
        )}
        <Button onClick={save} disabled={saving}>{saving ? t("profile.personal.saving") : t("profile.personal.save")}</Button>
      </CardContent>
    </Card>
  );
}

/* ───────── Experience ───────── */
function ExperienceTab({ userId }: { userId: string }) {
  const { t } = useTranslation();
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
    if (!editing?.company_name || !editing?.role) return toast.error(t("profile.experience.requiredError"));
    const payload = { ...editing, user_id: userId };
    const { error } = editing.id
      ? await supabase.from("experiences").update(payload).eq("id", editing.id)
      : await supabase.from("experiences").insert(payload);
    if (error) return toast.error(error.message);
    setEditing(null);
    load();
    toast.success(t("profile.experience.saved"));
  };

  const remove = async (id: string) => {
    await supabase.from("experiences").delete().eq("id", id);
    load();
  };

  if (loading) return <Spinner />;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t("profile.experience.title")}</CardTitle>
        <Button size="sm" onClick={() => setEditing({})}><Plus className="h-4 w-4 mr-1" />{t("profile.experience.add")}</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && !editing && <p className="text-sm text-muted-foreground">{t("profile.experience.noExperience")}</p>}
        {items.map((it) => (
          <div key={it.id} className="p-3 border rounded-md flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="font-medium text-sm">{it.role} · {it.company_name}</div>
              <div className="text-xs text-muted-foreground">{t(`profile.experience.employmentTypes.${it.employment_type}`, it.employment_type)} · {it.start_date ?? ""} → {it.is_current ? t("profile.experience.present") : (it.end_date ?? "")}</div>
              {it.description && <p className="text-xs text-foreground/80 whitespace-pre-wrap">{it.description}</p>}
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setEditing(it)}>{t("profile.experience.edit")}</Button>
              <Button variant="ghost" size="icon" onClick={() => remove(it.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {editing && (
          <div className="p-3 border rounded-md space-y-3 bg-muted/30">
            <div className="grid md:grid-cols-2 gap-3">
              <Field label={t("profile.experience.fields.company")}><Input value={editing.company_name ?? ""} onChange={(e) => setEditing({ ...editing, company_name: e.target.value })} /></Field>
              <Field label={t("profile.experience.fields.role")}><Input value={editing.role ?? ""} onChange={(e) => setEditing({ ...editing, role: e.target.value })} /></Field>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label={t("profile.experience.fields.type")}>
                <Select value={editing.employment_type ?? ""} onValueChange={(v) => setEditing({ ...editing, employment_type: v })}>
                  <SelectTrigger><SelectValue placeholder={t("profile.experience.fields.typePlaceholder")} /></SelectTrigger>
                  <SelectContent>
                    {["Full-time","Part-time","Contract","Freelance","Internship","Founder"].map((type) => (
                      <SelectItem key={type} value={type}>
                        {t(`profile.experience.employmentTypes.${type}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("profile.experience.fields.start")}><Input type="date" value={editing.start_date ?? ""} onChange={(e) => setEditing({ ...editing, start_date: e.target.value })} /></Field>
              <Field label={t("profile.experience.fields.end")}><Input type="date" value={editing.end_date ?? ""} disabled={editing.is_current} onChange={(e) => setEditing({ ...editing, end_date: e.target.value })} /></Field>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={!!editing.is_current} onCheckedChange={(v) => setEditing({ ...editing, is_current: v, end_date: v ? null : editing.end_date })} />
              {t("profile.experience.fields.currentWork")}
            </label>
            <Field label={t("profile.experience.fields.description")}><Textarea rows={3} value={editing.description ?? ""} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></Field>
            <Field label={t("profile.experience.fields.achievements")}><Textarea rows={2} value={editing.achievements ?? ""} onChange={(e) => setEditing({ ...editing, achievements: e.target.value })} /></Field>
            <div className="flex gap-2">
              <Button onClick={save}>{t("profile.experience.save")}</Button>
              <Button variant="outline" onClick={() => setEditing(null)}>{t("profile.experience.cancel")}</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ───────── Education ───────── */
function EducationTab({ userId }: { userId: string }) {
  const { t } = useTranslation();
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
    if (!editing?.institution) return toast.error(t("profile.education.requiredError"));
    const payload = { ...editing, user_id: userId };
    const { error } = editing.id
      ? await supabase.from("educations").update(payload).eq("id", editing.id)
      : await supabase.from("educations").insert(payload);
    if (error) return toast.error(error.message);
    setEditing(null);
    load();
    toast.success(t("profile.education.saved"));
  };

  const remove = async (id: string) => {
    await supabase.from("educations").delete().eq("id", id);
    load();
  };

  if (loading) return <Spinner />;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">{t("profile.education.title")}</CardTitle>
        <Button size="sm" onClick={() => setEditing({})}><Plus className="h-4 w-4 mr-1" />{t("profile.education.add")}</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && !editing && <p className="text-sm text-muted-foreground">{t("profile.education.noEducation")}</p>}
        {items.map((it) => (
          <div key={it.id} className="p-3 border rounded-md flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="font-medium text-sm">{it.degree ?? t("profile.education.fields.degree")} · {it.institution}</div>
              <div className="text-xs text-muted-foreground">{it.specialization} · {it.start_year ?? ""} → {it.end_year ?? t("profile.education.present")} {it.grade && `· ${it.grade}`}</div>
              {it.achievements && <p className="text-xs text-foreground/80">{it.achievements}</p>}
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => setEditing(it)}>{t("profile.education.edit")}</Button>
              <Button variant="ghost" size="icon" onClick={() => remove(it.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {editing && (
          <div className="p-3 border rounded-md space-y-3 bg-muted/30">
            <Field label={t("profile.education.fields.institution")}><Input value={editing.institution ?? ""} onChange={(e) => setEditing({ ...editing, institution: e.target.value })} /></Field>
            <div className="grid md:grid-cols-2 gap-3">
              <Field label={t("profile.education.fields.degree")}><Input value={editing.degree ?? ""} onChange={(e) => setEditing({ ...editing, degree: e.target.value })} /></Field>
              <Field label={t("profile.education.fields.specialization")}><Input value={editing.specialization ?? ""} onChange={(e) => setEditing({ ...editing, specialization: e.target.value })} /></Field>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              <Field label={t("profile.education.fields.startYear")}><Input type="number" value={editing.start_year ?? ""} onChange={(e) => setEditing({ ...editing, start_year: Number(e.target.value) || null })} /></Field>
              <Field label={t("profile.education.fields.endYear")}><Input type="number" value={editing.end_year ?? ""} onChange={(e) => setEditing({ ...editing, end_year: Number(e.target.value) || null })} /></Field>
              <Field label={t("profile.education.fields.grade")}><Input value={editing.grade ?? ""} onChange={(e) => setEditing({ ...editing, grade: e.target.value })} /></Field>
            </div>
            <Field label={t("profile.education.fields.achievements")}><Textarea rows={2} value={editing.achievements ?? ""} onChange={(e) => setEditing({ ...editing, achievements: e.target.value })} /></Field>
            <div className="flex gap-2">
              <Button onClick={save}>{t("profile.education.save")}</Button>
              <Button variant="outline" onClick={() => setEditing(null)}>{t("profile.education.cancel")}</Button>
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
  const { t } = useTranslation();
  const [data, setData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: row } = await supabase.from("builder_profiles").select(BUILDER_PROFILE_PUBLIC_COLUMNS).eq("id", user.id).maybeSingle();
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
    toast.success(t("profile.skills.saved"));
  };

  if (loading) return <Spinner />;
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{t("profile.skills.title")}</CardTitle></CardHeader>
      <CardContent className="space-y-4">
        <Field label={t("profile.skills.fields.skillsLabel")}>
          <Input
            value={Array.isArray(data.skills) ? data.skills.join(", ") : (data.skills ?? "")}
            onChange={(e) => set("skills", e.target.value)}
          />
        </Field>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label={t("profile.skills.fields.expLevel")}>
            <Select value={data.experience_level ?? ""} onValueChange={(v) => set("experience_level", v)}>
              <SelectTrigger><SelectValue placeholder={t("profile.skills.fields.expLevelPlaceholder")} /></SelectTrigger>
              <SelectContent>
                {["junior","mid","senior","expert"].map(l => (
                  <SelectItem key={l} value={l}>
                    {t(`profile.skills.experienceLevels.${l}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label={t("profile.skills.fields.hourlyRate")}><Input type="number" value={data.hourly_rate ?? ""} onChange={(e) => set("hourly_rate", Number(e.target.value) || null)} /></Field>
          <Field label={t("profile.skills.fields.workPreference")}><Input value={data.work_preference ?? ""} placeholder={t("profile.skills.fields.workPrefPlaceholder")} onChange={(e) => set("work_preference", e.target.value)} /></Field>
        </div>
        <div className="grid md:grid-cols-3 gap-3">
          <Field label={t("profile.skills.fields.portfolio")}><Input value={data.portfolio ?? ""} onChange={(e) => set("portfolio", e.target.value)} /></Field>
          <Field label={t("profile.skills.fields.github")}><Input value={data.github ?? ""} onChange={(e) => set("github", e.target.value)} /></Field>
          <Field label={t("profile.skills.fields.linkedin")}><Input value={data.linkedin ?? ""} onChange={(e) => set("linkedin", e.target.value)} /></Field>
        </div>
        <Button onClick={save} disabled={saving}>{saving ? t("profile.skills.saving") : t("profile.skills.save")}</Button>
      </CardContent>
    </Card>
  );
}

/* ───────── Payment Methods ───────── */
function PaymentMethodsTab({ userId }: { userId: string }) {
  const { t } = useTranslation();
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
    if (!editing?.method_type) return toast.error(t("profile.payments.typeError"));
    const payload = { ...editing, user_id: userId };
    const { error } = editing.id
      ? await supabase.from("payment_methods").update(payload).eq("id", editing.id)
      : await supabase.from("payment_methods").insert(payload);
    if (error) return toast.error(error.message);
    setEditing(null);
    load();
    toast.success(t("profile.payments.saved"));
  };

  const remove = async (id: string) => {
    await supabase.from("payment_methods").delete().eq("id", id);
    load();
  };

  const setDefault = async (id: string) => {
    await supabase.from("payment_methods").update({ is_default: true }).eq("id", id);
    load();
    toast.success(t("profile.payments.defaultUpdated"));
  };

  if (loading) return <Spinner />;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base">{t("profile.payments.title")}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{t("profile.payments.subTitle")}</p>
        </div>
        <Button size="sm" onClick={() => setEditing({ method_type: "upi", is_default: items.length === 0 })}><Plus className="h-4 w-4 mr-1" />{t("profile.payments.add")}</Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && !editing && <p className="text-sm text-muted-foreground">{t("profile.payments.noMethods")}</p>}
        {items.map((m) => (
          <div key={m.id} className="p-3 border rounded-md flex items-start justify-between gap-3">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm uppercase">{m.method_type === "upi" ? t("profile.payments.methodTypes.upi") : t("profile.payments.methodTypes.bank")}</span>
                {m.is_default && <Badge variant="secondary"><Star className="h-3 w-3 mr-1" />{t("profile.payments.default")}</Badge>}
                {m.verified && <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" />{t("profile.payments.verified")}</Badge>}
              </div>
              {m.method_type === "upi" ? (
                <div className="text-xs text-muted-foreground">{t("profile.payments.upiPrefix")}{m.upi_id}</div>
              ) : (
                <div className="text-xs text-muted-foreground">
                  {m.bank_name} · {m.account_holder} · ••••{(m.account_number ?? "").slice(-4)} · IFSC {m.ifsc}
                </div>
              )}
            </div>
            <div className="flex gap-1">
              {!m.is_default && <Button variant="ghost" size="sm" onClick={() => setDefault(m.id)}>{t("profile.payments.makeDefault")}</Button>}
              <Button variant="ghost" size="sm" onClick={() => setEditing(m)}>{t("profile.payments.edit")}</Button>
              <Button variant="ghost" size="icon" onClick={() => remove(m.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>
        ))}
        {editing && (
          <div className="p-3 border rounded-md space-y-3 bg-muted/30">
            <Field label={t("profile.payments.fields.methodType")}>
              <Select value={editing.method_type} onValueChange={(v) => setEditing({ ...editing, method_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="upi">{t("profile.payments.methodTypes.upi")}</SelectItem>
                  <SelectItem value="bank">{t("profile.payments.methodTypes.bank")}</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            {editing.method_type === "upi" ? (
              <Field label={t("profile.payments.fields.upiId")}><Input value={editing.upi_id ?? ""} placeholder={t("profile.payments.fields.upiIdPlaceholder")} onChange={(e) => setEditing({ ...editing, upi_id: e.target.value })} /></Field>
            ) : (
              <>
                <div className="grid md:grid-cols-2 gap-3">
                  <Field label={t("profile.payments.fields.accountHolder")}><Input value={editing.account_holder ?? ""} onChange={(e) => setEditing({ ...editing, account_holder: e.target.value })} /></Field>
                  <Field label={t("profile.payments.fields.bankName")}><Input value={editing.bank_name ?? ""} onChange={(e) => setEditing({ ...editing, bank_name: e.target.value })} /></Field>
                </div>
                <div className="grid md:grid-cols-2 gap-3">
                  <Field label={t("profile.payments.fields.accountNumber")}><Input value={editing.account_number ?? ""} onChange={(e) => setEditing({ ...editing, account_number: e.target.value })} /></Field>
                  <Field label={t("profile.payments.fields.ifsc")}><Input value={editing.ifsc ?? ""} onChange={(e) => setEditing({ ...editing, ifsc: e.target.value })} /></Field>
                </div>
              </>
            )}
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={!!editing.is_default} onCheckedChange={(v) => setEditing({ ...editing, is_default: v })} />
              {t("profile.payments.fields.setDefault")}
            </label>
            <div className="flex gap-2">
              <Button onClick={save}>{t("profile.payments.save")}</Button>
              <Button variant="outline" onClick={() => setEditing(null)}>{t("profile.payments.cancel")}</Button>
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
