import { useEffect, useRef, useState } from "react";
import { Zap, ShieldCheck, Award } from "lucide-react";

type Metric = {
  value: number;
  suffix?: string;
  prefix?: string;
  format?: "int" | "money" | "decimal";
  label: string;
  caption: string;
};

const metrics: Metric[] = [
  { value: 2400, suffix: "+", format: "int", label: "Active builders", caption: "Vetted by shipped work, not résumés." },
  { value: 1.2, prefix: "$", suffix: "M", format: "decimal", label: "Paid through escrow", caption: "Every release tied to a milestone." },
  { value: 96, suffix: "%", format: "int", label: "On-time delivery", caption: "Tracked across every contract." },
  { value: 7, suffix: " days", format: "int", label: "To first prototype", caption: "Median time from post to demo." },
  { value: 48, suffix: " hrs", format: "int", label: "Founder response", caption: "Median time to first reply." },
  { value: 38, format: "int", label: "Countries", caption: "A genuinely global builder pool." },
];

function useCountUp(target: number, start: boolean, duration = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [start, target, duration]);
  return value;
}

function format(v: number, m: Metric) {
  if (m.format === "decimal") return v.toFixed(1);
  if (m.format === "money") return Math.round(v).toLocaleString();
  return Math.round(v).toLocaleString();
}

const MetricCell = ({ m, start }: { m: Metric; start: boolean }) => {
  const v = useCountUp(m.value, start);
  return (
    <div className="p-8 md:p-10 border-r border-b border-ink-foreground/10 last:border-r-0">
      <div className="font-display text-5xl md:text-6xl leading-none tracking-tight">
        {m.prefix}
        {format(v, m)}
        {m.suffix}
      </div>
      <div className="mt-4 font-mono text-[11px] uppercase tracking-widest text-signal">{m.label}</div>
      <p className="mt-2 text-sm text-ink-foreground/60 leading-relaxed">{m.caption}</p>
    </div>
  );
};

const practice = [
  { icon: Zap, title: "Faster than a recruiter cycle", body: "Weeks of sourcing collapse into days of side-by-side prototypes." },
  { icon: ShieldCheck, title: "Backed by milestone escrow", body: "Money only moves when a milestone is signed off — both sides protected." },
  { icon: Award, title: "Outcomes over interviews", body: "You decide on real artifacts: repos, live URLs, video walkthroughs." },
];

export const MetricsBand = () => {
  const ref = useRef<HTMLDivElement>(null);
  const [start, setStart] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setStart(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section ref={ref} className="bg-ink text-ink-foreground py-24 md:py-32 relative overflow-hidden border-t border-border">
      <div className="absolute inset-0 bg-grid opacity-[0.04]" />
      <div className="container relative">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-14">
          <div>
            <div className="font-mono text-xs text-signal uppercase tracking-widest mb-3">By the numbers</div>
            <h2 className="font-display text-5xl md:text-6xl text-balance max-w-2xl">
              Proof, in <em className="text-signal not-italic italic font-light">numbers</em>.
            </h2>
          </div>
          <p className="text-ink-foreground/60 max-w-sm">
            Pulled from live contracts, escrow releases and builder activity across the platform.
          </p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 border-t border-l border-ink-foreground/10 rounded-2xl overflow-hidden bg-ink/40">
          {metrics.map((m) => (
            <MetricCell key={m.label} m={m} start={start} />
          ))}
        </div>

        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-px bg-ink-foreground/10 rounded-2xl overflow-hidden border border-ink-foreground/10">
          {practice.map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-ink p-8">
              <Icon className="h-6 w-6 text-signal mb-6" strokeWidth={1.5} />
              <h3 className="font-display text-xl mb-2">{title}</h3>
              <p className="text-sm text-ink-foreground/60 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
