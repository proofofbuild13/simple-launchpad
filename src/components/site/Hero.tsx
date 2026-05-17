import { Button } from "@/components/ui/button";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export const Hero = () => (
  <section className="relative overflow-hidden">
    <div className="absolute inset-0 bg-grid opacity-60 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
    <div className="absolute inset-0 bg-gradient-hero" />
    <div className="container relative pt-24 pb-32 md:pt-36 md:pb-44">
      <div className="max-w-4xl">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 backdrop-blur px-3 py-1 text-xs font-mono text-muted-foreground animate-fade-up">
          <Sparkles className="h-3 w-3 text-signal" />
          <span>Execution-based hiring · invite-only beta</span>
        </div>
        <h1 className="mt-6 font-display text-6xl md:text-8xl leading-[0.95] text-balance animate-fade-up" style={{ animationDelay: '60ms' }}>
          Build <em className="text-signal not-italic font-light italic">before</em> you hire.
        </h1>
        <p className="mt-8 max-w-2xl text-lg md:text-xl text-muted-foreground text-balance animate-fade-up" style={{ animationDelay: '120ms' }}>
          Founders post a real challenge. Builders ship working prototypes. You hire the people whose work
          you've already seen — with escrow, contracts, and conversion to long-term roles built in.
        </p>
        <div className="mt-10 flex flex-wrap gap-3 animate-fade-up" style={{ animationDelay: '180ms' }}>
          <Link to="/register/startup">
            <Button size="lg" className="bg-ink text-ink-foreground hover:bg-ink/90 h-12 px-6 text-base shadow-card">
              Post a project <ArrowUpRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/browse">
            <Button size="lg" variant="outline" className="h-12 px-6 text-base border-foreground/20 hover:bg-secondary">
              Find projects
            </Button>
          </Link>
        </div>
        <div className="mt-12 flex items-center gap-6 text-xs font-mono text-muted-foreground animate-fade-up" style={{ animationDelay: '240ms' }}>
          <div><span className="text-foreground font-semibold">2,400+</span> builders</div>
          <div className="h-3 w-px bg-border" />
          <div><span className="text-foreground font-semibold">$1.2M</span> in escrow paid</div>
          <div className="h-3 w-px bg-border" />
          <div><span className="text-foreground font-semibold">96%</span> on-time</div>
        </div>
      </div>
    </div>
  </section>
);
