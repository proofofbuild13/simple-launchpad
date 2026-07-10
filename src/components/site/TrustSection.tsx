import { Lock, Scale, Sparkles, FileSignature, Wallet, ShieldCheck } from "lucide-react";

const pillars = [
  {
    icon: Wallet,
    title: "Milestone escrow, not promises",
    body: "Funds for every milestone sit in platform escrow before work begins. Releases happen only after the founder signs off — and every movement is recorded in an immutable ledger.",
    tag: "Escrow ledger",
  },
  {
    icon: Sparkles,
    title: "AI evaluation on every submission",
    body: "Gemini-powered scoring grades each submission against the brief — code quality, completeness, fit — so founders can shortlist in minutes instead of weeks of manual review.",
    tag: "Gemini 3 Flash",
  },
  {
    icon: FileSignature,
    title: "IP & NDA, automated at signing",
    body: "Contractor agreement, NDA and IP-assignment are generated and counter-signed as part of the contract flow. Ownership transfers cleanly the moment work is paid for.",
    tag: "Auto-generated",
  },
  {
    icon: Scale,
    title: "Disputes mediated by humans",
    body: "If a milestone goes sideways, our admin team reviews the contract artifacts, escrow state and message history — and resolves with a documented, audited decision.",
    tag: "Admin-mediated",
  },
  {
    icon: Lock,
    title: "Built on row-level security",
    body: "Every record — projects, submissions, payments, messages — is gated by Postgres RLS. No client-side trust, no privilege escalation, no shared role tables.",
    tag: "RLS-enforced",
  },
  {
    icon: ShieldCheck,
    title: "Audited admin actions",
    body: "Every privileged action by our team — status changes, payouts, dispute rulings — is written to an append-only audit log you can request at any time.",
    tag: "Append-only logs",
  },
];

export const TrustSection = () => (
  <section id="trust" className="container py-24 md:py-32 border-t border-border">
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-16">
      <div className="lg:col-span-5">
        <div className="font-mono text-xs text-signal uppercase tracking-widest mb-3">Trust & safety</div>
        <h2 className="font-display text-5xl md:text-6xl text-balance leading-[1.02]">
          Six guarantees behind every <em className="text-signal not-italic italic font-light">onchain contract</em>.
        </h2>
      </div>
      <p className="lg:col-span-6 lg:col-start-7 text-muted-foreground text-lg leading-relaxed self-end">
        Hiring pseudonymous builders on the internet to ship production Web3 code is a trust problem. We've
        built the platform so neither side has to take the other purely on faith — money, IP and reputation
        are all protected by the system, not the handshake.
      </p>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border rounded-2xl overflow-hidden border border-border">
      {pillars.map(({ icon: Icon, title, body, tag }) => (
        <article key={title} className="bg-card p-8 md:p-10 flex flex-col">
          <div className="flex items-center justify-between mb-8">
            <div className="h-10 w-10 rounded-xl bg-ink text-signal flex items-center justify-center">
              <Icon className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground border border-border rounded-full px-2.5 py-1">
              {tag}
            </span>
          </div>
          <h3 className="font-display text-2xl leading-tight mb-3">{title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
        </article>
      ))}
    </div>
  </section>
);
