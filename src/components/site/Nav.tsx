import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { useEffect, useState } from "react";

export const Nav = () => {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "backdrop-blur-xl bg-background/85 border-b border-border shadow-sm"
          : "backdrop-blur-xl bg-background/60 border-b border-border/40"
      }`}
    >
      <nav
        className={`container flex items-center justify-between transition-all duration-300 ${
          scrolled ? "h-12" : "h-16"
        }`}
      >
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/logo.png"
            alt="proof_of_Build"
            className={`object-contain transition-all duration-300 ${scrolled ? "h-6 w-6" : "h-8 w-8"}`}
          />
          <span
            className={`font-display transition-all duration-300 ${scrolled ? "text-base" : "text-xl"}`}
          >
            proof_of_Build
          </span>
        </Link>
        <div
          className={`hidden md:flex items-center text-muted-foreground transition-all duration-300 ${
            scrolled ? "gap-6 text-xs" : "gap-8 text-sm"
          }`}
        >
          <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
          <a href="#projects" className="hover:text-foreground transition-colors">Projects</a>
          <a href="#builders" className="hover:text-foreground transition-colors">Builders</a>
          <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/login">
            <Button variant="ghost" size="sm" className={scrolled ? "h-8 text-xs" : ""}>
              Sign in
            </Button>
          </Link>
          <Link to="/register">
            <Button
              variant="default"
              size="sm"
              className={`bg-ink text-ink-foreground hover:bg-ink/90 ${scrolled ? "h-8 text-xs" : ""}`}
            >
              Get started
            </Button>
          </Link>
        </div>
      </nav>
    </header>
  );
};
