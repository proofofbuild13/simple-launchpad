import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function RegisterStartup() {
  const [form, setForm] = useState({
    company_name: "",
    founder_name: "",
    email: "",
    password: "",
    stage: "",
    website: "",
    industry: "",
  });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const redirect = sp.get("redirect") || "/dashboard";

  const set = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: {
        emailRedirectTo: `${window.location.origin}${redirect}`,
        data: { full_name: form.founder_name },
      },
    });
    if (error || !data.user) {
      setLoading(false);
      toast.error(error?.message ?? "Signup failed");
      return;
    }
    const uid = data.user.id;
    await supabase.from("user_roles").insert({ user_id: uid, role: "startup" });
    await supabase.from("startup_profiles").insert({
      id: uid,
      company_name: form.company_name,
      founder_name: form.founder_name,
      stage: form.stage || null,
      website: form.website || null,
      industry: form.industry || null,
    });
    setLoading(false);
    toast.success("Account created");
    navigate(redirect);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">Register as a Web3 Startup</h1>
          <p className="text-sm text-muted-foreground">Post your first onchain challenge in minutes.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Company name</Label>
                <Input required value={form.company_name} onChange={(e) => set("company_name", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Founder name</Label>
                <Input required value={form.founder_name} onChange={(e) => set("founder_name", e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" required minLength={6} value={form.password} onChange={(e) => set("password", e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Startup stage</Label>
                <Select value={form.stage} onValueChange={(v) => set("stage", v)}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="idea">Idea</SelectItem>
                    <SelectItem value="pre-seed">Pre-seed</SelectItem>
                    <SelectItem value="seed">Seed</SelectItem>
                    <SelectItem value="series-a">Series A+</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Industry</Label>
                <Input value={form.industry} onChange={(e) => set("industry", e.target.value)} placeholder="e.g. DeFi, Infra, DAO tooling" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Website</Label>
              <Input type="url" value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create startup account
            </Button>
            <p className="text-xs text-center text-muted-foreground">
              <Link to="/register" className="text-primary hover:underline">← Choose a different role</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
