import { Check, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const includes = [
  "Unlimited project posts & submissions",
  "AI-scored evaluation on every submission",
  "Side-by-side prototype review",
  "Milestone escrow with admin-mediated disputes",
  "Auto-generated 3 / 6 / 12-milestone contracts",
  "NDA + IP-assignment built into signing",
  "In-platform messaging, interviews & offers",
  "One-click conversion to long-term or full-time",
];

const tiers = [
  {
    type: "Posting & submissions",
    fee: "Free",
    unit: "",
    desc: "Post unlimited challenges, receive unlimited submissions, run AI evaluation and interviews — all at no cost. You only pay when you successfully onboard a builder.",
  },
  {
    type: "Milestone contracts",
    fee: "15%",
    unit: "per release",
    desc: "Flat platform commission deducted from each milestone escrow release. Shown on every offer before you accept — invoiced automatically with a 7-day due window.",
  },
  {
    type: "Full-time placement",
    fee: "8.33%",
    unit: "one-time",
    desc: "One-month equivalent of first-year base salary, charged once when a builder accepts a full-time employment offer. No fee if the offer isn't accepted.",
  },
];

export const Pricing = () => (
  <section id="pricing" className="container py-24 md:py-32 border-t border-border">
    <div className="max-w-3xl mb-14">
      <div className="font-mono text-xs text-signal uppercase tracking-widest mb-3">Pricing</div>
      <h2 className="font-display text-5xl md:text-6xl text-balance leading-[1.02]">
        Free to post. <em className="text-signal not-italic italic font-light">Pay only when a builder is onboarded.</em>
      </h2>
      <p className="mt-6 text-muted-foreground max-w-2xl text-lg">
        No subscriptions. No per-seat fees. No charge to post, review, or interview. The platform earns a
        transparent commission only when work is signed off and money actually moves to the builder.
      </p>
    </div>

    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-12">
      {tiers.map((t, i) => (
        <div
          key={t.type}
          className={
            i === 1
              ? "relative bg-ink text-ink-foreground rounded-3xl p-8 md:p-10 border border-ink-foreground/10 shadow-card"
              : "bg-card rounded-3xl p-8 md:p-10 border border-border"
          }
        >
          {i === 1 && (
            <span className="absolute -top-3 left-8 font-mono text-[10px] uppercase tracking-widest bg-signal text-ink px-2.5 py-1 rounded-full">
              Most common
            </span>
          )}
          <div className="font-mono text-[11px] uppercase tracking-widest mb-3 text-signal">
            {t.type}
          </div>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="font-display text-6xl md:text-7xl leading-none">{t.fee}</span>
            {t.unit && (
              <span className={`font-mono text-xs ${i === 1 ? "text-ink-foreground/60" : "text-muted-foreground"}`}>
                {t.unit}
              </span>
            )}
          </div>
          <p className={`text-sm leading-relaxed ${i === 1 ? "text-ink-foreground/70" : "text-muted-foreground"}`}>
            {t.desc}
          </p>
        </div>
      ))}
    </div>

    <div className="rounded-3xl border border-border bg-card p-8 md:p-12 grid grid-cols-1 lg:grid-cols-12 gap-10">
      <div className="lg:col-span-5">
        <h3 className="font-display text-3xl md:text-4xl leading-tight mb-4">
          What every contract includes.
        </h3>
        <p className="text-muted-foreground mb-8">
          One commission covers the whole lifecycle — from posting the challenge through escrow release,
          dispute mediation, and conversion. No hidden processing fees, no add-ons.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link to="/register/startup">
            <Button size="lg" className="bg-ink text-ink-foreground hover:bg-ink/90 h-12 px-6 text-base">
              Post a project <ArrowUpRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
          <a href="#faq">
            <Button size="lg" variant="outline" className="h-12 px-6 text-base">
              See the FAQ
            </Button>
          </a>
        </div>
      </div>
      <ul className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-3">
        {includes.map((i) => (
          <li key={i} className="flex items-start gap-3 text-[15px] text-foreground/85">
            <Check className="h-4 w-4 mt-1 text-signal shrink-0" strokeWidth={2.5} />
            <span>{i}</span>
          </li>
        ))}
      </ul>
    </div>

    <p className="mt-8 text-center font-mono text-xs text-muted-foreground">
      Commission applies only on successfully onboarded builders. No hire = no fee, ever.
    </p>
  </section>
);
