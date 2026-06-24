import { Button } from "@/components/ui/button";
import { ArrowUpRight, Check } from "lucide-react";
import { Link } from "react-router-dom";

const founders = {
  tag: "For founders",
  title: "Hire the builder who already shipped it.",
  bullets: [
    "Post a real challenge in under 5 minutes",
    "Review working prototypes side-by-side",
    "Pay only when a milestone is signed off",
    "Convert winners to 3 / 6 / 12-month contracts",
  ],
  cta: { label: "Post a project", to: "/register/startup" },
};

const builders = {
  tag: "For builders",
  title: "Get hired on the strength of what you build.",
  bullets: [
    "Browse paid challenges from real founders",
    "Show repos, live demos and walkthroughs",
    "Escrow-protected milestones — no chasing invoices",
    "Land long-term contracts without re-interviewing",
  ],
  cta: { label: "Apply as a builder", to: "/register/builder" },
};

const Card = ({ data, dark }: { data: typeof founders; dark?: boolean }) => (
  <article
    className={
      dark
        ? "bg-ink text-ink-foreground rounded-3xl p-10 md:p-12 border border-ink-foreground/10 flex flex-col"
        : "bg-card rounded-3xl p-10 md:p-12 border border-border shadow-card flex flex-col"
    }
  >
    <div className={`font-mono text-xs uppercase tracking-widest mb-4 ${dark ? "text-signal" : "text-signal"}`}>
      {data.tag}
    </div>
    <h3 className="font-display text-4xl md:text-5xl leading-[1.05] text-balance mb-8">{data.title}</h3>
    <ul className={`space-y-3 mb-10 ${dark ? "text-ink-foreground/80" : "text-foreground/80"}`}>
      {data.bullets.map((b) => (
        <li key={b} className="flex items-start gap-3">
          <Check className="h-4 w-4 mt-1 text-signal shrink-0" strokeWidth={2.5} />
          <span className="text-[15px]">{b}</span>
        </li>
      ))}
    </ul>
    <div className="mt-auto">
      <Link to={data.cta.to}>
        <Button
          size="lg"
          className={
            dark
              ? "bg-ink-foreground text-ink hover:bg-ink-foreground/90 h-12 px-6 text-base"
              : "bg-ink text-ink-foreground hover:bg-ink/90 h-12 px-6 text-base"
          }
        >
          {data.cta.label} <ArrowUpRight className="ml-1 h-4 w-4" />
        </Button>
      </Link>
    </div>
  </article>
);

export const AudienceSplit = () => (
  <section className="container py-24 md:py-32 border-t border-border">
    <div className="max-w-3xl mb-16">
      <div className="font-mono text-xs text-signal uppercase tracking-widest mb-3">Two sides, one loop</div>
      <h2 className="font-display text-5xl md:text-6xl text-balance">Built for both sides of the table.</h2>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card data={founders} />
      <Card data={builders} dark />
    </div>
  </section>
);
