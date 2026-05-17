import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

export const Nav = () => (
  <header className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/60">
    <nav className="container flex h-16 items-center justify-between">
      <Link to="/" className="flex items-center gap-2">
        <img src="/logo.png" alt="proof_of_Build" className="h-8 w-8 object-contain" />
        <span className="font-display text-xl">proof_of_Build</span>
      </Link>
      <div className="hidden md:flex items-center gap-8 text-sm text-muted-foreground">
        <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
        <a href="#projects" className="hover:text-foreground transition-colors">Projects</a>
        <a href="#builders" className="hover:text-foreground transition-colors">Builders</a>
        <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
      </div>
      <div className="flex items-center gap-2">
        <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
        <Link to="/register">
          <Button variant="default" size="sm" className="bg-ink text-ink-foreground hover:bg-ink/90">
            Get started
          </Button>
        </Link>
      </div>
    </nav>
  </header>
);
