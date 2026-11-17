const steps = [
  { number: "01", title: "Set the brief", body: "Define the problem, deliverables, and what a good result should show." },
  { number: "02", title: "See the work", body: "Compare prototypes and supporting materials submitted for your challenge." },
  { number: "03", title: "Choose with context", body: "Use the work, your criteria, and conversations to guide your decision." },
];

export const MetricsBand = () => {
  return (
    <section className="bg-ink text-ink-foreground py-24 md:py-32 relative overflow-hidden border-t border-border">
      <div className="absolute inset-0 bg-grid opacity-[0.04]" />
      <div className="container relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
          <div>
            <div className="font-mono text-xs text-signal uppercase tracking-widest mb-3">Proof of work</div>
            <h2 className="font-display text-5xl md:text-6xl text-balance max-w-2xl">
              Make the work <em className="text-signal not-italic italic font-light">the proof.</em>
            </h2>
          </div>
          <p className="text-ink-foreground/60 max-w-sm">
            Make the challenge and the submitted work the center of the hiring conversation.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-ink-foreground/10 rounded-2xl overflow-hidden border border-ink-foreground/10">
          {steps.map((step) => (
            <div key={step.number} className="bg-ink p-8 md:p-10">
              <span className="font-mono text-xs text-signal">{step.number}</span>
              <h3 className="font-display text-2xl mt-8 mb-3">{step.title}</h3>
              <p className="text-sm text-ink-foreground/60 leading-relaxed">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
