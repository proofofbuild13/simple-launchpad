const steps = [
  { n: "01", title: "Post the onchain challenge", body: "Describe the contract, indexer, dApp or DAO tool you need. Set deliverables, timeline and bounty. Public, unlisted, or invite-only." },
  { n: "02", title: "Builders ship dApps", body: "Solidity, Rust, Move and fullstack Web3 builders submit working prototypes — repo, verified contracts on testnet, live URL, walkthrough." },
  { n: "03", title: "Review side-by-side", body: "Score on code quality, UX, gas, security posture and fit. Shortlist, interview, pick the builder who already solved it." },
  { n: "04", title: "Hire with escrow", body: "Fund milestones in escrow, sign the contract, convert winners into 3, 6 or 12-month engagements." },
];

export const HowItWorks = () => (
  <section id="how" className="container py-24 md:py-32 border-t border-border">
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
      <div>
        <div className="font-mono text-xs text-signal uppercase tracking-widest mb-3">The loop</div>
        <h2 className="font-display text-5xl md:text-6xl max-w-2xl text-balance">A hiring funnel that ships onchain.</h2>
      </div>
      <p className="text-muted-foreground max-w-sm">Four steps from a vague onchain idea to a shipped protocol and a Web3 team that's already proven they can deliver.</p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-border rounded-2xl overflow-hidden border border-border shadow-card">
      {steps.map((s) => (
        <div key={s.n} className="bg-card p-8 hover:bg-secondary/40 transition-colors group">
          <div className="font-mono text-xs text-muted-foreground mb-12 group-hover:text-signal transition-colors">{s.n}</div>
          <h3 className="font-display text-2xl mb-3">{s.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{s.body}</p>
        </div>
      ))}
    </div>
  </section>
);
