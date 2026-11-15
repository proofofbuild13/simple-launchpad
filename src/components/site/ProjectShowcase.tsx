import { Badge } from "@/components/ui/badge";
import { Bot, Blocks, Clock, Cpu, Trophy, Users } from "lucide-react";

const projects = [
  { cat: "DeFi", title: "Perp DEX limit-order widget", budget: "$12,000", days: 14, subs: 23, tags: ["Solidity", "Viem", "Foundry"] },
  { cat: "Infra", title: "Subgraph + indexer for L2 rollup", budget: "$9,000", days: 21, subs: 18, tags: ["The Graph", "TypeScript", "Postgres"] },
  { cat: "Consumer", title: "Smart-wallet onboarding flow", budget: "$8,500", days: 10, subs: 31, tags: ["Wagmi", "Privy", "Next.js"] },
  { cat: "DAO", title: "Onchain voting + treasury UI", budget: "$15,000", days: 30, subs: 14, tags: ["Snapshot", "Safe", "React"] },
  { cat: "DeFi", title: "Liquid-staking rewards dashboard", budget: "$6,500", days: 12, subs: 22, tags: ["Solidity", "Wagmi", "Recharts"] },
  { cat: "Consumer", title: "NFT-gated Farcaster mini-app", budget: "$4,200", days: 7, subs: 19, tags: ["Farcaster", "Viem", "Base"] },
];

const domains = [
  {
    number: "01",
    icon: Blocks,
    title: "Crypto & Web3",
    description: "Build the protocols and products moving value onchain.",
    examples: ["Smart contracts & DeFi", "Wallets & payments", "Chain infrastructure"],
    tools: ["Solidity", "Rust", "EVM", "Solana"],
  },
  {
    number: "02",
    icon: Cpu,
    title: "Artificial intelligence",
    description: "Turn intelligent models into useful, reliable products.",
    examples: ["AI agents & automation", "Model evaluation", "Search & RAG systems"],
    tools: ["LLMs", "Agents", "RAG", "MLOps"],
  },
  {
    number: "03",
    icon: Bot,
    title: "Robotics",
    description: "Connect software, sensors and machines to the real world.",
    examples: ["Robot perception & control", "Autonomous systems", "Fleet software"],
    tools: ["ROS 2", "Computer vision", "Embedded", "Controls"],
  },
];

export const ProjectShowcase = () => (
  <>
    <section id="projects" className="container py-24 md:py-32 border-t border-border">
      <div className="flex items-end justify-between mb-12">
        <div>
          <div className="font-mono text-xs text-signal uppercase tracking-widest mb-3">Live Web3 challenges</div>
          <h2 className="font-display text-5xl md:text-6xl text-balance">Open right now.</h2>
        </div>
        <a href="#projects" className="hidden md:inline-flex font-mono text-xs text-muted-foreground hover:text-foreground">view all →</a>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {projects.map((p) => (
          <article key={p.title} className="group relative bg-card border border-border rounded-2xl p-6 hover:shadow-card hover:-translate-y-0.5 transition-all duration-300">
            <div className="flex items-center justify-between mb-8">
              <Badge variant="outline" className="font-mono text-[10px] tracking-wider border-foreground/20">{p.cat.toUpperCase()}</Badge>
              <span className="font-display text-2xl">{p.budget}</span>
            </div>
            <h3 className="font-display text-2xl leading-tight mb-6 group-hover:text-signal transition-colors">{p.title}</h3>
            <div className="flex flex-wrap gap-1.5 mb-6">
              {p.tags.map((tag) => <span key={tag} className="text-xs font-mono px-2 py-0.5 rounded-md bg-secondary text-muted-foreground">{tag}</span>)}
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

    <section className="container pb-24 md:pb-32 border-t border-border pt-20">
      <div className="max-w-3xl mb-12">
        <div className="font-mono text-xs text-signal uppercase tracking-widest mb-3">Build domains</div>
        <h2 className="font-display text-5xl md:text-6xl text-balance">Crypto. AI. Robotics.</h2>
        <p className="mt-5 max-w-2xl text-muted-foreground leading-relaxed">
          Find builders for ambitious work across decentralized technology, intelligent software and autonomous machines.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border bg-border">
        {domains.map(({ number, icon: Icon, title, description, examples, tools }) => (
          <article key={title} className="flex flex-col bg-card p-7 md:p-8">
            <div className="flex items-center justify-between mb-10">
              <Icon className="h-7 w-7 text-signal" strokeWidth={1.5} aria-hidden="true" />
              <span className="font-mono text-xs text-muted-foreground">{number}</span>
            </div>
            <h3 className="font-display text-3xl mb-3">{title}</h3>
            <p className="min-h-12 text-sm text-muted-foreground leading-relaxed">{description}</p>
            <ul className="mt-7 space-y-3 border-t border-border pt-6 text-sm">
              {examples.map((example) => <li key={example}>{example}</li>)}
            </ul>
            <div className="mt-auto flex flex-wrap gap-2 pt-8">
              {tools.map((tool) => (
                <span key={tool} className="rounded-md bg-secondary px-2.5 py-1 font-mono text-[11px] text-muted-foreground">{tool}</span>
              ))}
            </div>
          </article>
        ))}
      </div>
    </section>
  </>
);