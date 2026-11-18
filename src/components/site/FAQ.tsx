import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "What kinds of projects can I post?",
    a: "Challenges can cover Crypto/Web3, AI, or Robotics. For Web3 work, examples include EVM chains, Solana, and Move-based chains, with stacks such as Solidity, Rust, and Move. Describe the skills and deliverables your project needs in the brief.",
  },
  {
    q: "What should builders include in a submission?",
    a: "Share work that is relevant to the challenge, such as a repository, prototype, demo, or walkthrough. For Web3 projects, this may include deployed contracts or public repositories.",
  },
  {
    q: "Who owns the submitted work after hire?",
    a: "Ownership and confidentiality terms are set out in the agreement. Review those terms and confirm they cover the deliverables and materials involved before signing.",
  },
  {
    q: "How do milestone payments work?",
    a: "Milestone payment terms are set out in the contract. Review the funding, release, and dispute terms before you begin work.",
  },
  {
    q: "What does it cost?",
    a: "Posting and reviewing submissions are free. The platform fee is 15% on milestone releases. A separate one-time fee of 8.33% applies if a builder accepts a full-time offer. See the pricing section for details.",
  },
  {
    q: "What if no submission is good enough?",
    a: "You're never obligated to hire. If no submission meets the bar, you can close the challenge with no further commitment. Builders are told upfront that submission ≠ guaranteed payout.",
  },
  {
    q: "Can I continue working with a builder?",
    a: "You can discuss further work with a builder after reviewing their submission. The scope, duration, ownership, and payment terms should be agreed in the relevant contract.",
  },
];

export const FAQ = () => (
  <section id="faq" className="container py-24 md:py-32 border-t border-border">
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
      <div className="lg:col-span-4">
        <div className="font-mono text-xs text-signal uppercase tracking-widest mb-3">FAQ</div>
        <h2 className="font-display text-5xl md:text-6xl text-balance leading-[1.02]">
          Questions, <em className="text-signal not-italic italic font-light">answered</em>.
        </h2>
        <p className="mt-6 text-muted-foreground max-w-sm">Answers for founders and builders working across Crypto/Web3, AI, and Robotics.</p>
      </div>
      <div className="lg:col-span-8">
        <Accordion type="single" collapsible className="w-full">
          {faqs.map((f, i) => (
            <AccordionItem key={f.q} value={`item-${i}`} className="border-border">
              <AccordionTrigger className="text-left font-display text-xl md:text-2xl py-6 hover:no-underline hover:text-signal">
                {f.q}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground text-[15px] leading-relaxed pb-6 max-w-2xl">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </div>
  </section>
);
