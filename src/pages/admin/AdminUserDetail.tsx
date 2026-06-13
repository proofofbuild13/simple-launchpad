import { useEffect, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, User, Flag, Ban, ShieldCheck, Loader2, Mail, Calendar, Clock, Pencil, Trash2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { UserStatusDialog } from "@/components/admin/UserStatusDialog";

type Status = "active" | "flagged" | "suspended" | "banned" | "under_review";

const fmt = (d?: string | null) => (d ? new Date(d).toLocaleString() : "—");
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "—");
const money = (n?: number | null) => (n == null ? "—" : "₹" + Number(n).toLocaleString());

export default function AdminUserDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { role: myRole, user: me } = useAuth();
  const isSuper = myRole === "super_admin";
  const isAdmin = isSuper || myRole === "admin";

  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [newRole, setNewRole] = useState<string>("");
  const [savingRole, setSavingRole] = useState(false);
  const [statusDialog, setStatusDialog] = useState<{ open: boolean; status: Status | null }>({ open: false, status: null });

  // edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editBusy, setEditBusy] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});

  // delete dialog
  const [delOpen, setDelOpen] = useState(false);
  const [delBusy, setDelBusy] = useState(false);
  const [delBlockers, setDelBlockers] = useState<string[] | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const { data: full, error } = await supabase.rpc("admin_get_user_full", { _user_id: id });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    setData(full);
    setNewRole((full as any)?.role ?? "");
    setDelBlockers(null);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const saveRole = async () => {
    if (!id || !newRole || newRole === data?.role) return;
    setSavingRole(true);
    const { error } = await supabase.rpc("admin_set_user_role", { _user_id: id, _role: newRole as any });
    setSavingRole(false);
    if (error) return toast.error(error.message);
    toast.success("Role updated");
    load();
  };

  const openEdit = () => {
    const identity = data?.identity ?? {};
    const bp = data?.builder_profile?.profile ?? {};
    const sp = data?.startup_profile?.profile ?? {};
    setEditForm({
      full_name: identity.full_name ?? "",
      // builder
      title: bp.title ?? "", domain: bp.domain ?? "", location: bp.location ?? "",
      bio: bp.bio ?? "", linkedin: bp.linkedin ?? "", github: bp.github ?? "", portfolio: bp.portfolio ?? "",
      experience_level: bp.experience_level ?? "", work_preference: bp.work_preference ?? "",
      hourly_rate: bp.hourly_rate ?? "",
      // startup
      company_name: sp.company_name ?? "", founder_name: sp.founder_name ?? "", website: sp.website ?? "",
      industry: sp.industry ?? "", stage: sp.stage ?? "", mission: sp.mission ?? "",
      hiring_status: sp.hiring_status ?? "", team_size: sp.team_size ?? "",
      sp_bio: sp.bio ?? "", sp_location: sp.location ?? "",
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!id) return;
    setEditBusy(true);
    const patch: Record<string, any> = { full_name: editForm.full_name || null };
    if (data?.role === "builder") {
      Object.assign(patch, {
        title: editForm.title || null, domain: editForm.domain || null, location: editForm.location || null,
        bio: editForm.bio || null, linkedin: editForm.linkedin || null, github: editForm.github || null,
        portfolio: editForm.portfolio || null, experience_level: editForm.experience_level || null,
        work_preference: editForm.work_preference || null,
        hourly_rate: editForm.hourly_rate === "" ? null : Number(editForm.hourly_rate),
      });
    }
    if (data?.role === "startup") {
      Object.assign(patch, {
        company_name: editForm.company_name || null, founder_name: editForm.founder_name || null,
        website: editForm.website || null, industry: editForm.industry || null, stage: editForm.stage || null,
        mission: editForm.mission || null, hiring_status: editForm.hiring_status || null,
        team_size: editForm.team_size || null, bio: editForm.sp_bio || null, location: editForm.sp_location || null,
      });
    }
    const { error } = await supabase.rpc("admin_update_user_profile", { _user_id: id, _patch: patch });
    setEditBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Profile updated");
    setEditOpen(false);
    load();
  };

  const tryDelete = async () => {
    if (!id) return;
    setDelBusy(true);
    const { data: res, error } = await supabase.functions.invoke("admin-delete-user", { body: { user_id: id } });
    setDelBusy(false);
    if (error) return toast.error(error.message);
    const r = res as any;
    if (r?.blocked) {
      setDelBlockers(r.reasons ?? []);
      return;
    }
    if (r?.error) return toast.error(r.error);
    toast.success("User deleted");
    setDelOpen(false);
    navigate("/admin/users");
  };

  if (loading || !data) {
    return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const identity = data.identity ?? {};
  const status = data.status;
  const role = data.role ?? "—";
  const roleOptions = isSuper ? ["startup","builder","admin","super_admin"] : ["startup","builder"];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      <Button asChild variant="ghost" size="sm">
        <Link to="/admin/users"><ArrowLeft className="h-4 w-4 mr-1" /> Users</Link>
      </Button>

      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-start gap-4 flex-wrap">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center overflow-hidden">
              {identity.avatar_url
                ? <img src={identity.avatar_url} alt="" className="h-full w-full object-cover" />
                : <User className="h-7 w-7 text-primary" />}
            </div>
            <div className="min-w-[200px]">
              <CardTitle className="text-xl">{identity.full_name ?? "—"}</CardTitle>
              <p className="text-xs text-muted-foreground font-mono">{id}</p>
              <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" /> {identity.email ?? "—"}</span>
                <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" /> Joined {fmtDate(identity.auth_created_at ?? identity.created_at)}</span>
                <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Last sign-in {fmt(identity.last_sign_in_at)}</span>
              </div>
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <Badge variant="outline">{role}</Badge>
              <Badge variant={(!status || status.status === "active") ? "outline" : "destructive"}>{status?.status ?? "active"}</Badge>
              {identity.email_confirmed_at
                ? <Badge variant="outline" className="text-emerald-600 border-emerald-600/30">Email verified</Badge>
                : <Badge variant="secondary">Email unverified</Badge>}
            </div>
          </div>
        </CardHeader>
        {status?.reason && (
          <CardContent className="text-sm">
            <p className="text-xs text-muted-foreground">Status reason</p>
            <p>{status.reason}</p>
          </CardContent>
        )}
      </Card>

      {/* Action bar */}
      <div className="flex flex-wrap gap-2">
        {isAdmin && <Button size="sm" variant="outline" onClick={openEdit}><Pencil className="h-3.5 w-3.5 mr-1" /> Edit profile</Button>}
        <Button size="sm" variant="outline" onClick={() => setStatusDialog({ open: true, status: "flagged" })}><Flag className="h-3.5 w-3.5 mr-1 text-amber-500" /> Flag</Button>
        <Button size="sm" variant="outline" onClick={() => setStatusDialog({ open: true, status: "under_review" })}>Under review</Button>
        <Button size="sm" variant="outline" onClick={() => setStatusDialog({ open: true, status: "suspended" })}><Ban className="h-3.5 w-3.5 mr-1 text-destructive" /> Suspend</Button>
        <Button size="sm" variant="outline" onClick={() => setStatusDialog({ open: true, status: "banned" })}><Ban className="h-3.5 w-3.5 mr-1 text-destructive" /> Ban</Button>
        <Button size="sm" variant="outline" onClick={() => setStatusDialog({ open: true, status: "active" })}><ShieldCheck className="h-3.5 w-3.5 mr-1 text-emerald-500" /> Activate</Button>
        {isSuper && id !== me?.id && (
          <Button size="sm" variant="destructive" className="ml-auto" onClick={() => { setDelBlockers(null); setDelOpen(true); }}>
            <Trash2 className="h-3.5 w-3.5 mr-1" /> Delete user
          </Button>
        )}
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
          <TabsTrigger value="payments">Payments</TabsTrigger>
          <TabsTrigger value="disputes">Disputes</TabsTrigger>
          <TabsTrigger value="audit">Audit trail</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader><CardTitle className="text-base">Role</CardTitle></CardHeader>
            <CardContent className="flex items-center gap-2">
              <Select value={newRole} onValueChange={setNewRole}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select role" /></SelectTrigger>
                <SelectContent>{roleOptions.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
              </Select>
              <Button size="sm" onClick={saveRole} disabled={savingRole || !newRole || newRole === role}>Save</Button>
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="text-base">Counts</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 text-sm">
              <Stat label="Contracts" value={data.contracts?.length ?? 0} />
              <Stat label="Offers" value={data.offers?.length ?? 0} />
              <Stat label="Payments" value={data.payment_records?.length ?? 0} />
              <Stat label="Disputes" value={data.disputes?.length ?? 0} />
              <Stat label="Interviews" value={data.interviews?.length ?? 0} />
              <Stat label="Notifications" value={data.counts?.notifications ?? 0} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* PROFILE */}
        <TabsContent value="profile" className="space-y-4">
          {role === "builder" && data.builder_profile && (
            <BuilderProfileView bp={data.builder_profile} />
          )}
          {role === "startup" && data.startup_profile && (
            <StartupProfileView sp={data.startup_profile} />
          )}
          {role !== "builder" && role !== "startup" && (
            <Card><CardContent className="text-sm text-muted-foreground py-6">No domain profile for role: {role}</CardContent></Card>
          )}
        </TabsContent>

        {/* ACTIVITY */}
        <TabsContent value="activity" className="grid gap-4">
          <ListCard title={`Contracts (${data.contracts?.length ?? 0})`} rows={data.contracts ?? []}
            cols={["status","escrow_amount","created_at"]} linkFn={(r) => `/contracts/${r.id}`} />
          <ListCard title={`Offers (${data.offers?.length ?? 0})`} rows={data.offers ?? []}
            cols={["status","compensation","created_at"]} linkFn={(r) => `/offers/${r.id}`} />
          <ListCard title={`Interviews (${data.interviews?.length ?? 0})`} rows={data.interviews ?? []}
            cols={["status","scheduled_at"]} />
          {role === "startup" && (
            <ListCard title={`Projects (${data.startup_profile?.projects?.length ?? 0})`}
              rows={data.startup_profile?.projects ?? []}
              cols={["title","status","created_at"]} linkFn={(r) => `/projects/${r.id}`} />
          )}
        </TabsContent>

        {/* PAYMENTS */}
        <TabsContent value="payments" className="grid gap-4">
          <ListCard title={`Payment records (${data.payment_records?.length ?? 0})`} rows={data.payment_records ?? []}
            cols={["status","declared_amount","confirmed_amount","declared_at"]} />
          <ListCard title={`Commission invoices (${data.commission_invoices?.length ?? 0})`} rows={data.commission_invoices ?? []}
            cols={["invoice_number","commission_amount","status","due_date"]} />
          <ListCard title={`Placement fees (${data.placement_fees?.length ?? 0})`} rows={data.placement_fees ?? []}
            cols={["invoice_number","fee_amount","status","due_date"]} />
          {role === "builder" && (
            <Card>
              <CardHeader><CardTitle className="text-base">Payment methods</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {(data.builder_profile?.payment_methods ?? []).map((pm: any) => (
                  <div key={pm.id} className="p-2 rounded-md bg-muted/30 flex justify-between flex-wrap gap-2">
                    <div>
                      <div className="font-medium">{pm.method_type}{pm.is_default && <Badge variant="outline" className="ml-2">default</Badge>}</div>
                      <div className="text-xs text-muted-foreground">
                        {pm.upi_id ?? `${pm.bank_name ?? ""} ${pm.account_number_masked ?? ""} ${pm.ifsc ?? ""}`}
                      </div>
                    </div>
                    <Badge variant={pm.verified ? "outline" : "secondary"}>{pm.verified ? "Verified" : "Unverified"}</Badge>
                  </div>
                ))}
                {!data.builder_profile?.payment_methods?.length && <p className="text-xs text-muted-foreground">None</p>}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* DISPUTES */}
        <TabsContent value="disputes" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-base">Disputes ({data.disputes?.length ?? 0})</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              {(data.disputes ?? []).map((d: any) => (
                <div key={d.id} className="text-sm p-2 rounded-md bg-muted/30">
                  <div className="flex justify-between"><Badge variant="destructive">{d.status}</Badge><span className="text-xs text-muted-foreground">{fmt(d.created_at)}</span></div>
                  <p className="text-xs mt-1">{d.reason}</p>
                </div>
              ))}
              {!data.disputes?.length && <p className="text-xs text-muted-foreground">None</p>}
            </CardContent>
          </Card>
        </TabsContent>

        {/* AUDIT */}
        <TabsContent value="audit" className="grid gap-4 md:grid-cols-2">
          <AuditCard title="Actions taken by this user" rows={data.audit_as_actor ?? []} />
          <AuditCard title="Actions taken on this user" rows={data.audit_as_entity ?? []} />
        </TabsContent>
      </Tabs>

      <UserStatusDialog
        open={statusDialog.open}
        userId={id ?? null}
        status={statusDialog.status}
        onOpenChange={(open) => setStatusDialog((d) => ({ ...d, open }))}
        onDone={load}
      />

      {/* Edit dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit user profile</DialogTitle>
            <DialogDescription>Changes are audit-logged.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Full name" value={editForm.full_name} onChange={(v) => setEditForm((f) => ({ ...f, full_name: v }))} />
            {role === "builder" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Title" value={editForm.title} onChange={(v) => setEditForm((f) => ({ ...f, title: v }))} />
                  <Field label="Domain" value={editForm.domain} onChange={(v) => setEditForm((f) => ({ ...f, domain: v }))} />
                  <Field label="Location" value={editForm.location} onChange={(v) => setEditForm((f) => ({ ...f, location: v }))} />
                  <Field label="Experience level" value={editForm.experience_level} onChange={(v) => setEditForm((f) => ({ ...f, experience_level: v }))} />
                  <Field label="Work preference" value={editForm.work_preference} onChange={(v) => setEditForm((f) => ({ ...f, work_preference: v }))} />
                  <Field label="Hourly rate" type="number" value={editForm.hourly_rate} onChange={(v) => setEditForm((f) => ({ ...f, hourly_rate: v }))} />
                  <Field label="LinkedIn" value={editForm.linkedin} onChange={(v) => setEditForm((f) => ({ ...f, linkedin: v }))} />
                  <Field label="GitHub" value={editForm.github} onChange={(v) => setEditForm((f) => ({ ...f, github: v }))} />
                  <Field label="Portfolio" value={editForm.portfolio} onChange={(v) => setEditForm((f) => ({ ...f, portfolio: v }))} />
                </div>
                <TextField label="Bio" value={editForm.bio} onChange={(v) => setEditForm((f) => ({ ...f, bio: v }))} />
              </>
            )}
            {role === "startup" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Company name" value={editForm.company_name} onChange={(v) => setEditForm((f) => ({ ...f, company_name: v }))} />
                  <Field label="Founder name" value={editForm.founder_name} onChange={(v) => setEditForm((f) => ({ ...f, founder_name: v }))} />
                  <Field label="Website" value={editForm.website} onChange={(v) => setEditForm((f) => ({ ...f, website: v }))} />
                  <Field label="Industry" value={editForm.industry} onChange={(v) => setEditForm((f) => ({ ...f, industry: v }))} />
                  <Field label="Stage" value={editForm.stage} onChange={(v) => setEditForm((f) => ({ ...f, stage: v }))} />
                  <Field label="Hiring status" value={editForm.hiring_status} onChange={(v) => setEditForm((f) => ({ ...f, hiring_status: v }))} />
                  <Field label="Team size" value={editForm.team_size} onChange={(v) => setEditForm((f) => ({ ...f, team_size: v }))} />
                  <Field label="Location" value={editForm.sp_location} onChange={(v) => setEditForm((f) => ({ ...f, sp_location: v }))} />
                </div>
                <TextField label="Mission" value={editForm.mission} onChange={(v) => setEditForm((f) => ({ ...f, mission: v }))} />
                <TextField label="Bio" value={editForm.sp_bio} onChange={(v) => setEditForm((f) => ({ ...f, sp_bio: v }))} />
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={editBusy}>
              {editBusy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete dialog */}
      <Dialog open={delOpen} onOpenChange={setDelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Delete user</DialogTitle>
            <DialogDescription>
              This permanently removes the user's profile, role, payment methods, saved items, and their auth account. Contracts, payments, and disputes are preserved for record-keeping but their references will remain.
            </DialogDescription>
          </DialogHeader>
          {delBlockers && delBlockers.length > 0 && (
            <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm">
              <p className="font-medium mb-1">Cannot delete — resolve first:</p>
              <ul className="list-disc list-inside text-xs space-y-0.5">
                {delBlockers.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDelOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={tryDelete} disabled={delBusy}>
              {delBusy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Permanently delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md bg-muted/30 p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg font-semibold">{value}</div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }: any) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
function TextField({ label, value, onChange }: any) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{label}</Label>
      <Textarea rows={3} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function ListCard({ title, rows, cols, linkFn }: { title: string; rows: any[]; cols: string[]; linkFn?: (r: any) => string }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? <p className="text-xs text-muted-foreground">None</p> : (
          <Table>
            <TableHeader><TableRow>{cols.map((c) => <TableHead key={c} className="capitalize">{c.replace(/_/g," ")}</TableHead>)}{linkFn && <TableHead></TableHead>}</TableRow></TableHeader>
            <TableBody>
              {rows.map((r: any, i: number) => (
                <TableRow key={r.id ?? i}>
                  {cols.map((c) => {
                    let v: any = r[c];
                    if (typeof v === "string" && /at$|_at$|date$/i.test(c) && /\d{4}-\d{2}-\d{2}/.test(v)) v = fmt(v);
                    if (typeof v === "number" && /amount|rate|compensation|fee/i.test(c)) v = money(v);
                    return <TableCell key={c} className="text-sm">{v ?? "—"}</TableCell>;
                  })}
                  {linkFn && <TableCell><Button asChild size="sm" variant="ghost"><Link to={linkFn(r)}>Open</Link></Button></TableCell>}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function AuditCard({ title, rows }: { title: string; rows: any[] }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent className="space-y-1.5 max-h-[420px] overflow-y-auto">
        {rows.length === 0 ? <p className="text-xs text-muted-foreground">None</p> : rows.map((l: any) => (
          <div key={l.id} className="text-xs p-2 rounded-md bg-muted/30">
            <div className="font-medium">{l.action_type} <span className="text-muted-foreground">· {l.entity_type ?? "—"}</span></div>
            <div className="text-muted-foreground">{fmt(l.created_at)}</div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function BuilderProfileView({ bp }: { bp: any }) {
  const p = bp.profile ?? {};
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Builder profile</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Username" value={p.username} />
          <Info label="Title" value={p.title} />
          <Info label="Domain" value={p.domain} />
          <Info label="Location" value={p.location} />
          <Info label="Experience" value={p.experience_level} />
          <Info label="Hourly rate" value={p.hourly_rate ? money(p.hourly_rate) : null} />
          <Info label="Work preference" value={p.work_preference} />
          <Info label="Available" value={String(p.available ?? false)} />
          <Info label="Verified" value={String(p.verified ?? false)} />
          <Info label="LinkedIn" value={p.linkedin} link />
          <Info label="GitHub" value={p.github} link />
          <Info label="Portfolio" value={p.portfolio} link />
          <Info label="Skills" value={(p.skills ?? []).join(", ")} className="col-span-2" />
          <Info label="Bio" value={p.bio} className="col-span-2" />
        </CardContent>
      </Card>
      <ListCard title={`Experiences (${bp.experiences?.length ?? 0})`} rows={bp.experiences ?? []}
        cols={["company","title","start_date","end_date"]} />
      <ListCard title={`Educations (${bp.educations?.length ?? 0})`} rows={bp.educations ?? []}
        cols={["institution","degree","start_year","end_year"]} />
      <ListCard title={`Certifications (${bp.certifications?.length ?? 0})`} rows={bp.certifications ?? []}
        cols={["name","issuer","issue_date"]} />
    </div>
  );
}

function StartupProfileView({ sp }: { sp: any }) {
  const p = sp.profile ?? {};
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader><CardTitle className="text-base">Startup profile</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-2 gap-3 text-sm">
          <Info label="Company" value={p.company_name} />
          <Info label="Founder" value={p.founder_name} />
          <Info label="Website" value={p.website} link />
          <Info label="Industry" value={p.industry} />
          <Info label="Stage" value={p.stage} />
          <Info label="Hiring status" value={p.hiring_status} />
          <Info label="Team size" value={p.team_size} />
          <Info label="Location" value={p.location} />
          <Info label="Projects" value={String(sp.projects_count ?? 0)} />
          <Info label="Followers" value={String(sp.followers_count ?? 0)} />
          <Info label="Mission" value={p.mission} className="col-span-2" />
          <Info label="Bio" value={p.bio} className="col-span-2" />
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value, link, className }: { label: string; value?: any; link?: boolean; className?: string }) {
  return (
    <div className={className}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-sm break-words">
        {value
          ? (link ? <a className="text-primary hover:underline" href={value} target="_blank" rel="noreferrer">{value}</a> : String(value))
          : <span className="text-muted-foreground">—</span>}
      </div>
    </div>
  );
}
