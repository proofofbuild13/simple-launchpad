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

export default function RegisterBuilder() {
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    password: "",
    skills: "",
    github: "",
    portfolio: "",
    linkedin: "",
    experience_level: "",
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
        data: { full_name: form.full_name },
      },
    });
    if (error || !data.user) {
      setLoading(false);
      toast.error(error?.message ?? "Signup failed");
      return;
    }
    const uid = data.user.id;
    await supabase.from("user_roles").insert({ user_id: uid, role: "builder" });
    await supabase.from("builder_profiles").insert({
      id: uid,
      full_name: form.full_name,
      skills: form.skills.split(",").map((s) => s.trim()).filter(Boolean),
      github: form.github || null,
      portfolio: form.portfolio || null,
      linkedin: form.linkedin || null,
      experience_level: form.experience_level || null,
    });
    setLoading(false);
    toast.success("Builder profile created");
    navigate(redirect);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center space-y-2">
          <h1 className="text-2xl font-semibold">Register as a Builder</h1>
          <p className="text-sm text-muted-foreground">Showcase your work and ship for great startups.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="space-y-1.5">
              <Label>Full name</Label>
              <Input required value={form.full_name} onChange={(e) => set("full_name", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input type="email" required value={form.email} onChange={(e) => set("email", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Password</Label>
              <Input type="password" required minLength={6} value={form.password} onChange={(e) => set("password", e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Skills (comma separated)</Label>
              <Input value={form.skills} onChange={(e) => set("skills", e.target.value)} placeholder="React, Node, Postgres" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>GitHub</Label>
                <Input value={form.github} onChange={(e) => set("github", e.target.value)} placeholder="https://github.com/you" />
              </div>
              <div className="space-y-1.5">
                <Label>LinkedIn</Label>
                <Input value={form.linkedin} onChange={(e) => set("linkedin", e.target.value)} placeholder="https://linkedin.com/in/you" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Portfolio</Label>
              <Input value={form.portfolio} onChange={(e) => set("portfolio", e.target.value)} placeholder="https://" />
            </div>
            <div className="space-y-1.5">
              <Label>Experience</Label>
              <Select value={form.experience_level} onValueChange={(v) => set("experience_level", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="junior">Junior (0-2 yrs)</SelectItem>
                  <SelectItem value="mid">Mid (2-5 yrs)</SelectItem>
                  <SelectItem value="senior">Senior (5-10 yrs)</SelectItem>
                  <SelectItem value="lead">Lead (10+ yrs)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create builder account
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
