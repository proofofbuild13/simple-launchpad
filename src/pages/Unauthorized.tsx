import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export default function Unauthorized() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-6">
      <div className="max-w-md text-center space-y-4">
        <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldAlert className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="text-3xl font-semibold">403 — Unauthorized</h1>
        <p className="text-sm text-muted-foreground">
          You do not have permission to access this area. Admin access only.
        </p>
        <div className="flex gap-2 justify-center">
          <Button asChild variant="outline"><Link to="/dashboard">Back to dashboard</Link></Button>
          <Button asChild><Link to="/admin/login">Admin login</Link></Button>
        </div>
      </div>
    </div>
  );
}
