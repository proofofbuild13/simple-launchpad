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

export default function AdminLogin() {
  const nav = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [bootstrapBusy, setBootstrapBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      setBusy(false);
      toast.error(error?.message ?? "Sign-in failed");
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
    if (!email || !password) {
      toast.error("Sign in first, then click first-time setup to grant super-admin");
      return;
    }
    setBootstrapBusy(true);
    const signIn = await supabase.auth.signInWithPassword({ email, password });
    if (signIn.error || !signIn.data.user) {
      setBootstrapBusy(false);
      toast.error(signIn.error?.message ?? "Sign-in failed");
      return;
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
              <p>First-time setup signs in with the credentials above and grants super-admin if no admin exists yet.</p>
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
