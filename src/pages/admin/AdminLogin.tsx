import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { logAudit } from "@/lib/audit";

const ADMIN_EMAIL = "vigneshv@admin.local";
const ADMIN_PASSWORD = "Vig@13";

export default function AdminLogin() {
  const nav = useNavigate();
  const [adminId, setAdminId] = useState("vigneshv");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [bootstrapBusy, setBootstrapBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminId !== "vigneshv" || password !== ADMIN_PASSWORD) {
      toast.error("Invalid admin credentials");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
    });
    if (error || !data.user) {
      setBusy(false);
      toast.error("Admin account not provisioned. Use first-time setup below.");
      return;
    }
    const { data: rd } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", data.user.id)
      .maybeSingle();
    const r = rd?.role;
    if (r !== "admin" && r !== "super_admin") {
      await supabase.auth.signOut();
      setBusy(false);
      toast.error("Account does not have admin role");
      return;
    }
    await logAudit("admin_login", "user_roles", data.user.id);
    toast.success("Welcome, Admin");
    nav("/admin", { replace: true });
  };

  const bootstrap = async () => {
    setBootstrapBusy(true);
    // Try sign-in first, else sign up
    let signIn = await supabase.auth.signInWithPassword({
      email: ADMIN_EMAIL, password: ADMIN_PASSWORD,
    });
    if (signIn.error || !signIn.data.user) {
      const signUp = await supabase.auth.signUp({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        options: { emailRedirectTo: window.location.origin + "/admin/login" },
      });
      if (signUp.error) {
        setBootstrapBusy(false);
        toast.error(signUp.error.message);
        return;
      }
      signIn = await supabase.auth.signInWithPassword({
        email: ADMIN_EMAIL, password: ADMIN_PASSWORD,
      });
      if (signIn.error) {
        setBootstrapBusy(false);
        toast.error("Account created. Confirm email if required, then login.");
        return;
      }
    }
    const { data: granted, error: grantErr } = await supabase.rpc("bootstrap_admin");
    if (grantErr) {
      setBootstrapBusy(false);
      toast.error(grantErr.message);
      return;
    }
    if (!granted) {
      setBootstrapBusy(false);
      toast.error("An admin already exists. Sign in instead.");
      await supabase.auth.signOut();
      return;
    }
    toast.success("Admin provisioned. Redirecting…");
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
              <Label>Admin ID</Label>
              <Input value={adminId} onChange={(e) => setAdminId(e.target.value)} placeholder="vigneshv" required />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} Sign in
            </Button>
          </form>
          <div className="mt-6 pt-6 border-t space-y-3">
            <div className="flex items-start gap-2 text-xs text-muted-foreground">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <p>First-time setup provisions the admin account using the MVP credentials and grants super-admin role.</p>
            </div>
            <Button variant="outline" className="w-full" onClick={bootstrap} disabled={bootstrapBusy}>
              {bootstrapBusy && <Loader2 className="h-4 w-4 animate-spin mr-2" />} First-time setup
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
