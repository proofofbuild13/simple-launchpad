import { ShieldCheck, Workflow, Coins, GitBranch } from "lucide-react";

const pillars = [
  { icon: Workflow, title: "Proof-of-work, not promises", body: "Every hire is backed by a working prototype you've already reviewed and used." },
  { icon: ShieldCheck, title: "Escrow & contracts built-in", body: "NDA, IP assignment, contractor agreements and milestone escrow — handled by the platform." },
  { icon: Coins, title: "Convert to long-term", body: "Turn winning builders into 3, 6, or 12-month contracts in one click. No re-negotiation." },
  { icon: GitBranch, title: "Teams, not just freelancers", body: "Form pre-built squads on the platform — design, eng, growth — for bigger challenges." },
];

export const Pillars = () => (
  <section className="bg-ink text-ink-foreground py-24 md:py-32 relative overflow-hidden">
    <div className="absolute inset-0 bg-grid opacity-[0.04]" />
    <div className="container relative">
      <div className="max-w-3xl mb-16">
        <div className="font-mono text-xs text-signal uppercase tracking-widest mb-3">Why it works</div>
        <h2 className="font-display text-5xl md:text-6xl text-balance">Hire the people who've already solved your problem.</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-ink-foreground/10 rounded-2xl overflow-hidden border border-ink-foreground/10">
        {pillars.map(({ icon: Icon, title, body }) => (
          <div key={title} className="bg-ink p-10 hover:bg-ink-foreground/[0.03] transition-colors">
            <Icon className="h-7 w-7 text-signal mb-8" strokeWidth={1.5} />
            <h3 className="font-display text-3xl mb-3">{title}</h3>
            <p className="text-ink-foreground/60 leading-relaxed">{body}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);
