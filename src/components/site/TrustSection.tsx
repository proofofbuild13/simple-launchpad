import { Lock, Scale, Sparkles, FileSignature, Wallet, ShieldCheck } from "lucide-react";

const pillars = [
  {
    icon: Wallet,
    title: "Milestone-based payments",
    body: "Set milestones in the contract and review the work before signing off on a release. The platform's payment flow is described in the contract terms.",
    tag: "Milestones",
  },
  {
    icon: Sparkles,
    title: "AI-assisted submission assessment",
    body: "AI can assess the project details and submission descriptions to surface considerations. It does not inspect linked repositories or replace a technical review.",
    tag: "AI-assisted",
  },
  {
    icon: FileSignature,
    title: "Clear written agreements",
    body: "Review the confidentiality, ownership, and delivery terms in the agreement before signing. Make sure the scope reflects what both sides expect.",
    tag: "Agreements",
  },
  {
    icon: Scale,
    title: "A process for disagreements",
    body: "If there is a disagreement, refer to the signed terms and use the platform's dispute process to request review.",
    tag: "Dispute process",
  },
  {
    icon: Lock,
    title: "Access controls",
    body: "Project, submission, and account access is governed by platform permissions. Only share information you intend to include in your project or submission.",
    tag: "Permissions",
  },
  {
    icon: ShieldCheck,
    title: "A record of your work",
    body: "Keep project details, submissions, messages, and signed terms together as you review work and discuss an engagement.",
    tag: "Project history",
  },
];

export const TrustSection = () => (
  <section id="trust" className="container py-24 md:py-32 border-t border-border">
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-16">
      <div className="lg:col-span-5">
        <div className="font-mono text-xs text-signal uppercase tracking-widest mb-3">Trust & safety</div>
        <h2 className="font-display text-5xl md:text-6xl text-balance leading-[1.02]">
          Clear expectations for <em className="text-signal not-italic italic font-light">both sides.</em>
        </h2>
      </div>
      <p className="lg:col-span-6 lg:col-start-7 text-muted-foreground text-lg leading-relaxed self-end">
        Technical hiring calls for a clear scope, reviewable submissions, and agreed responsibilities. Those
        basics matter whether the work is in Crypto/Web3, AI, or Robotics.
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
