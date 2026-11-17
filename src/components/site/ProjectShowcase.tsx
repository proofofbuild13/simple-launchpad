import { Bot, Blocks, Cpu } from "lucide-react";

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

const examples = [
  { domain: "Crypto & Web3", title: "Prototype a smart-wallet onboarding flow", details: "Wallet connection · transaction UX · testnet demo" },
  { domain: "AI", title: "Build a document-search assistant", details: "Retrieval workflow · sample data · evaluation plan" },
  { domain: "Robotics", title: "Create a robot telemetry dashboard", details: "Sensor data · status views · operator workflow" },
];

export const ProjectShowcase = () => (
  <>
    <section id="projects" className="container py-24 md:py-32 border-t border-border">
      <div className="max-w-3xl mb-12">
        <div className="font-mono text-xs text-signal uppercase tracking-widest mb-3">Example challenges</div>
        <h2 className="font-display text-5xl md:text-6xl text-balance">What could your team build?</h2>
        <p className="mt-5 max-w-2xl text-muted-foreground leading-relaxed">Illustrative project briefs—not live listings.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {examples.map((example) => (
          <article key={example.domain} className="flex flex-col bg-card border border-border rounded-2xl p-6">
            <span className="font-mono text-[11px] text-signal uppercase tracking-widest">{example.domain}</span>
            <h3 className="font-display text-2xl leading-tight mt-6 mb-4">{example.title}</h3>
            <p className="mt-auto border-t border-border pt-4 text-sm text-muted-foreground">{example.details}</p>
          </article>
        ))}
      </div>
    </section>

    <section className="container pb-24 md:pb-32 border-t border-border pt-20">
      <div className="max-w-3xl mb-12">
        <div className="font-mono text-xs text-signal uppercase tracking-widest mb-3">Build domains</div>
        <h2 className="font-display text-5xl md:text-6xl text-balance">Crypto/Web3. AI. Robotics.</h2>
        <p className="mt-5 max-w-2xl text-muted-foreground leading-relaxed">
          Frame challenges across decentralized technology, intelligent software, and robotics.
        </p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border bg-border">
        {domains.map(({ number, icon: Icon, title, description, examples: domainExamples, tools }) => (
          <article key={title} className="flex flex-col bg-card p-7 md:p-8">
            <div className="flex items-center justify-between mb-10">
              <Icon className="h-7 w-7 text-signal" strokeWidth={1.5} aria-hidden="true" />
              <span className="font-mono text-xs text-muted-foreground">{number}</span>
            </div>
            <h3 className="font-display text-3xl mb-3">{title}</h3>
            <p className="min-h-12 text-sm text-muted-foreground leading-relaxed">{description}</p>
            <ul className="mt-7 space-y-3 border-t border-border pt-6 text-sm">
              {domainExamples.map((example) => <li key={example}>{example}</li>)}
            </ul>
            <div className="mt-auto flex flex-wrap gap-2 pt-8">
              {tools.map((tool) => (
                <span key={tool} className="rounded-md bg-secondary px-2.5 py-1 font-mono text-[11px] text-muted-foreground">{tool}</span>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Example project areas and tools</p>
          </article>
        ))}
      </div>
    </section>
  </>
);