import { Bot, Blocks, Cpu } from "lucide-react";

const profiles = [
  {
    icon: Blocks,
    domain: "Crypto & Web3",
    title: "Protocol engineer",
    skills: ["Solidity", "Rust", "Smart contracts"],
    proof: "Repository · testnet demo · walkthrough",
  },
  {
    icon: Cpu,
    domain: "Artificial intelligence",
    title: "Applied AI engineer",
    skills: ["LLM applications", "Evaluation", "Data pipelines"],
    proof: "Prototype · evaluation notes · repository",
  },
  {
    icon: Bot,
    domain: "Robotics",
    title: "Robotics software engineer",
    skills: ["ROS 2", "Computer vision", "Embedded systems"],
    proof: "Demo video · system notes · code sample",
  },
];

export const BuildersSection = () => (
  <section id="builders" className="container py-24 md:py-32 border-t border-border">
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
      <div>
        <div className="font-mono text-xs text-signal uppercase tracking-widest mb-3">The talent</div>
        <h2 className="font-display text-5xl md:text-6xl max-w-2xl text-balance">
          Different skills. The same focus on <em className="text-signal not-italic italic font-light">evidence.</em>
        </h2>
      </div>
      <p className="text-muted-foreground max-w-sm">
        Illustrative profile examples show how builders can present relevant skills and work across Crypto/Web3, AI, and Robotics.
      </p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      {profiles.map(({ icon: Icon, domain, title, skills, proof }) => (
        <article key={domain} className="flex flex-col bg-card border border-border rounded-2xl p-6">
          <div className="flex items-center justify-between gap-4">
            <Icon className="h-6 w-6 text-signal" strokeWidth={1.5} aria-hidden="true" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground text-right">Example profile</span>
          </div>
          <p className="mt-7 font-mono text-[11px] uppercase tracking-widest text-signal">{domain}</p>
          <h3 className="mt-2 font-display text-2xl">{title}</h3>
          <div className="mt-5 flex flex-wrap gap-2">
            {skills.map((skill) => (
              <span key={skill} className="rounded-md bg-secondary px-2.5 py-1 font-mono text-[11px] text-muted-foreground">{skill}</span>
            ))}
          </div>
          <p className="mt-auto border-t border-border pt-5 mt-8 text-sm text-muted-foreground">{proof}</p>
        </article>
      ))}
    </div>
  </section>
);