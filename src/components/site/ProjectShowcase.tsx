import { Badge } from "@/components/ui/badge";
import { Clock, Users, Trophy } from "lucide-react";

const projects = [
  { cat: "DeFi", title: "Perp DEX limit-order widget", budget: "$12,000", days: 14, subs: 23, tags: ["Solidity", "Viem", "Foundry"] },
  { cat: "Infra", title: "Subgraph + indexer for L2 rollup", budget: "$9,000", days: 21, subs: 18, tags: ["The Graph", "TypeScript", "Postgres"] },
  { cat: "Consumer", title: "Smart-wallet onboarding flow", budget: "$8,500", days: 10, subs: 31, tags: ["Wagmi", "Privy", "Next.js"] },
  { cat: "DAO", title: "Onchain voting + treasury UI", budget: "$15,000", days: 30, subs: 14, tags: ["Snapshot", "Safe", "React"] },
  { cat: "DeFi", title: "Liquid-staking rewards dashboard", budget: "$6,500", days: 12, subs: 22, tags: ["Solidity", "Wagmi", "Recharts"] },
  { cat: "Consumer", title: "NFT-gated Farcaster mini-app", budget: "$4,200", days: 7, subs: 19, tags: ["Farcaster", "Viem", "Base"] },
];

export const ProjectShowcase = () => (
  <section id="projects" className="container py-24 md:py-32 border-t border-border">
    <div className="flex items-end justify-between mb-12">
      <div>
        <div className="font-mono text-xs text-signal uppercase tracking-widest mb-3">Live Web3 challenges</div>
        <h2 className="font-display text-5xl md:text-6xl text-balance">Open right now.</h2>
      </div>
      <a href="#" className="hidden md:inline-flex font-mono text-xs text-muted-foreground hover:text-foreground">view all →</a>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {projects.map((p, i) => (
        <article key={i} className="group relative bg-card border border-border rounded-2xl p-6 hover:shadow-card hover:-translate-y-0.5 transition-all duration-300">
          <div className="flex items-center justify-between mb-8">
            <Badge variant="outline" className="font-mono text-[10px] tracking-wider border-foreground/20">{p.cat.toUpperCase()}</Badge>
            <span className="font-display text-2xl">{p.budget}</span>
          </div>
          <h3 className="font-display text-2xl leading-tight mb-6 group-hover:text-signal transition-colors">{p.title}</h3>
          <div className="flex flex-wrap gap-1.5 mb-6">
            {p.tags.map(t => <span key={t} className="text-xs font-mono px-2 py-0.5 rounded-md bg-secondary text-muted-foreground">{t}</span>)}
          </div>
          <div className="flex items-center gap-4 text-xs font-mono text-muted-foreground pt-4 border-t border-border">
            <span className="flex items-center gap-1.5"><Clock className="h-3 w-3" />{p.days}d left</span>
            <span className="flex items-center gap-1.5"><Users className="h-3 w-3" />{p.subs} subs</span>
            <span className="flex items-center gap-1.5 ml-auto text-signal"><Trophy className="h-3 w-3" />open</span>
          </div>
        </article>
      ))}
    </div>
  </section>
);
