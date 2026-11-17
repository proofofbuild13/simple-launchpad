const steps = [
  { n: "01", title: "Define the challenge", body: "Describe the problem, deliverables, timeline, and what a strong solution should demonstrate." },
  { n: "02", title: "Review submitted work", body: "Builders share prototypes, repositories, demos, and walkthroughs relevant to your challenge." },
  { n: "03", title: "Compare the evidence", body: "Assess submissions against your brief, shortlist candidates, and interview where useful." },
  { n: "04", title: "Agree the next step", body: "Choose a builder and agree on scope, milestones, and contract terms for the work ahead." },
];

export const HowItWorks = () => (
  <section id="how" className="container py-24 md:py-32 border-t border-border">
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-16">
      <div>
        <div className="font-mono text-xs text-signal uppercase tracking-widest mb-3">The loop</div>
        <h2 className="font-display text-5xl md:text-6xl max-w-2xl text-balance">From a real challenge to an informed hiring decision.</h2>
      </div>
      <p className="text-muted-foreground max-w-sm">A clear brief, reviewable work, and a direct path to choosing the right builder.</p>
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
