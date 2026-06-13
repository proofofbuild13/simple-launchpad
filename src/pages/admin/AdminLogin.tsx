import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Shield, Loader2, Info, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

export default function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  // Create-first-admin dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "", full_name: "" });
  const [adminExists, setAdminExists] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase.rpc("any_admin_exists");
      if (!cancelled) setAdminExists(error ? false : Boolean(data));
    })();
    return () => { cancelled = true; };
  }, []);


  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (error || !data.user) {
      setBusy(false);
      const msg = error?.message ?? "Sign-in failed";
      if (/invalid login credentials/i.test(msg)) {
        toast.error("Wrong email or password, or the email is not confirmed yet.");
      } else if (/email not confirmed/i.test(msg)) {
        toast.error("This account's email is not confirmed.");
      } else {
        toast.error(msg);
      }
      return;
    }
    const { data: rd, error: roleErr } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .in("role", ["admin", "super_admin"])
      .maybeSingle();
    if (roleErr) {
      await supabase.auth.signOut();
      setBusy(false);
      toast.error("Could not verify admin role. Try again.");
      return;
    }
    if (!rd) {
      await supabase.auth.signOut();
      setBusy(false);
      toast.error("This account does not have an admin role. Use 'Create first admin' if no admin exists yet.");
      return;
    }
    await logAudit("admin_login", "user_roles", data.user.id);
    toast.success("Welcome, Admin");
    nav("/admin", { replace: true });
  };

  const createFirstAdmin = async () => {
    const e = form.email.trim().toLowerCase();
    if (!e || !form.password) return toast.error("Email and password are required");
    if (form.password.length < 8) return toast.error("Password must be at least 8 characters");
    setCreateBusy(true);

    // 1. Sign up the new user (auto-confirm must be enabled in Supabase Auth settings)
    const { data: signUp, error: signUpErr } = await supabase.auth.signUp({
      email: e,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}/admin/login`,
        data: form.full_name ? { full_name: form.full_name } : undefined,
      },
    });

    if (signUpErr) {
      setCreateBusy(false);
      // If user already exists, try sign in instead
      if (/already registered|already exists|user already/i.test(signUpErr.message)) {
        toast.error("That email is already registered. Sign in below, then click 'Create first admin' again to grant super-admin.");
        return;
      }
      return toast.error(signUpErr.message);
    }

    // 2. If no session (email confirmation required), sign in immediately
    let session = signUp.session;
    if (!session) {
      const { data: si, error: siErr } = await supabase.auth.signInWithPassword({ email: e, password: form.password });
      if (siErr || !si.session) {
        setCreateBusy(false);
        toast.error(
          "Account created but cannot sign in yet — email confirmation is enabled. Disable 'Confirm email' in Supabase Auth settings, or confirm the email, then come back."
        );
        return;
      }
      session = si.session;
    }

    // 3. Bootstrap as super_admin (works only if no admin exists yet)
    const { data: granted, error: grantErr } = await supabase.rpc("bootstrap_admin");
    if (grantErr) {
      setCreateBusy(false);
      toast.error(grantErr.message);
      return;
    }
    if (!granted) {
      setCreateBusy(false);
      await supabase.auth.signOut();
      toast.error("An admin already exists. Ask a super-admin to create your account from the admin panel.");
      return;
    }

    toast.success("Super-admin created. Redirecting to admin panel…");
    setCreateOpen(false);
    setTimeout(() => nav("/admin", { replace: true }), 600);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-6">
      <Card className="w-full max-w-md border-2">
        <CardHeader className="text-center space-y-3">
          <div className="mx-auto w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <CardTitle className="text-2xl">Admin Control Panel</CardTitle>
          <p className="text-xs text-muted-foreground">Restricted access · audited</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Sign in
            </Button>
          </form>

          <div className="mt-6 pt-6 border-t space-y-3">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>
                No admin yet? Create the first super-admin account. This only works while the platform has zero admins —
                afterwards new admins must be added from the admin panel.
              </p>
            </div>
            <Button variant="outline" className="w-full" onClick={() => setCreateOpen(true)}>
              <UserPlus className="h-4 w-4 mr-2" /> Create first admin
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create first super-admin</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="fe">Email</Label>
              <Input id="fe" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="you@yourcompany.com" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fn">Full name (optional)</Label>
              <Input id="fn" value={form.full_name} onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))} placeholder="Jane Admin" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fp">Password</Label>
              <Input id="fp" type="password" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" />
            </div>
            <p className="text-xs text-muted-foreground">
              Tip: in Supabase Auth settings, disable "Confirm email" so the account can sign in immediately. Otherwise
              confirm the email from your inbox before returning here.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={createFirstAdmin} disabled={createBusy}>
              {createBusy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Create super-admin
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
