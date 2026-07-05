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
      className={`sticky z-50 transition-all duration-500 ease-out ${
        scrolled ? "top-4 px-4" : "top-0 px-0"
      }`}
    >
      <nav
        className={`mx-auto flex items-center justify-between transition-all duration-500 ease-out ${
          scrolled
            ? "max-w-4xl h-14 px-4 rounded-full bg-ink text-ink-foreground shadow-2xl shadow-ink/20 border border-ink/40"
            : "container h-16 rounded-none bg-background/60 backdrop-blur-xl border-b border-border/40"
        }`}
      >
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <img
            src="/logo.png"
            alt="proof_of_Build"
            className={`object-contain transition-all duration-500 ${
              scrolled ? "h-6 w-6 invert" : "h-8 w-8"
            }`}
          />
          <span
            className={`font-display transition-all duration-500 ${
              scrolled ? "text-sm" : "text-xl"
            }`}
          >
            proof_of_Build
          </span>
        </Link>
        <div
          className={`hidden md:flex items-center transition-all duration-500 ${
            scrolled
              ? "gap-6 text-xs text-ink-foreground/70"
              : "gap-8 text-sm text-muted-foreground"
          }`}
        >
          <a href="#how" className="hover:opacity-100 transition-opacity">How it works</a>
          <a href="#projects" className="hover:opacity-100 transition-opacity">Projects</a>
          <a href="#builders" className="hover:opacity-100 transition-opacity">Builders</a>
          <a href="#pricing" className="hover:opacity-100 transition-opacity">Pricing</a>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!scrolled && (
            <Link to="/login">
              <Button variant="ghost" size="sm">
                Sign in
              </Button>
            </Link>
          )}
          <Link to="/register">
            <Button
              size="sm"
              className={
                scrolled
                  ? "h-9 rounded-full bg-background text-foreground hover:bg-background/90 text-xs px-4"
                  : "bg-ink text-ink-foreground hover:bg-ink/90"
              }
            >
              Get started
            </Button>
          </Link>
        </div>
      </nav>
    </header>
  );
};
