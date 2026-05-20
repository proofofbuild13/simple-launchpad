import { Link, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Building2, Code2 } from "lucide-react";

export default function Register() {
  const [sp] = useSearchParams();
  const qs = sp.get("redirect") ? `?redirect=${encodeURIComponent(sp.get("redirect")!)}` : "";
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5 p-4">
      <div className="w-full max-w-3xl space-y-6">
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center justify-center gap-2">
            <img src="/logo.png" alt="proof_of_Build" className="h-8 w-8 object-contain" />
            <span className="font-semibold">proof_of_Build</span>
          </Link>
          <h1 className="text-3xl font-semibold">Choose your account type</h1>
          <p className="text-muted-foreground">Build before you hire — pick your side.</p>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <Link to="/register/startup">
            <Card className="hover:border-primary transition cursor-pointer h-full">
              <CardHeader>
                <Building2 className="h-8 w-8 text-primary" />
              </CardHeader>
              <CardContent className="space-y-1">
                <h2 className="font-semibold">I'm a Startup / Founder</h2>
                <p className="text-sm text-muted-foreground">Post challenges, review submitted MVPs, and hire builders based on real proof-of-work.</p>
              </CardContent>
            </Card>
          </Link>
          <Link to="/register/builder">
            <Card className="hover:border-primary transition cursor-pointer h-full">
              <CardHeader>
                <Code2 className="h-8 w-8 text-primary" />
              </CardHeader>
              <CardContent className="space-y-1">
                <h2 className="font-semibold">I'm a Builder</h2>
                <p className="text-sm text-muted-foreground">Browse startup challenges, ship working solutions, and convert into long-term contracts.</p>
              </CardContent>
            </Card>
          </Link>
        </div>
        <p className="text-xs text-center text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="text-primary hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
