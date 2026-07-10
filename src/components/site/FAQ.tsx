import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "Which chains and stacks are supported?",
    a: "All EVM chains (Ethereum, Base, Arbitrum, Optimism, Polygon, and other L2s), Solana, and Move-based chains (Aptos, Sui). Builders list their primary stack — Solidity/Foundry, Rust/Anchor, Move, plus frontend tooling like Viem, Wagmi, RainbowKit, Privy, and indexer stacks like The Graph.",
  },
  {
    q: "Can pseudonymous builders participate?",
    a: "Yes. Web3 talent often ships under a handle. Pseudonymous builders can submit and get hired — every profile is still judged on verifiable onchain work (deployed contracts, verified addresses, public repos) and on-platform reviews from past founders.",
  },
  {
    q: "Who owns the contracts and repo after handoff?",
    a: "Builders retain rights to their submissions until you hire them. On hire, a signed IP-assignment and contractor agreement transfers full ownership of the code, contracts and deploy keys to your company — automated as part of contract signing.",
  },
  {
    q: "How does escrow work?",
    a: "When you start a contract, funds for each milestone are held by the platform in fiat escrow. Money is released to the builder only after you sign off on the milestone — and disputes are mediated by our admin team using the artifacts attached to the contract.",
  },
  {
    q: "What does it cost?",
    a: "Posting a challenge is free. The platform takes a flat commission on the contract value when you hire — clearly shown before you accept any offer. No subscriptions, no per-seat fees.",
  },
  {
    q: "What if no submission is good enough?",
    a: "You're never obligated to hire. If no submission meets the bar, you can close the challenge with no further commitment. Builders are told upfront that submission ≠ guaranteed payout.",
  },
  {
    q: "Can I convert a builder to a full-time hire?",
    a: "Yes. You can convert any winning builder into a 3, 6 or 12-month engagement directly from the contract — the IP, NDA and payment terms carry over automatically.",
  },
];

export const FAQ = () => (
  <section className="container py-24 md:py-32 border-t border-border">
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
      <div className="lg:col-span-4">
        <div className="font-mono text-xs text-signal uppercase tracking-widest mb-3">FAQ</div>
        <h2 className="font-display text-5xl md:text-6xl text-balance leading-[1.02]">
          Questions, <em className="text-signal not-italic italic font-light">answered</em>.
        </h2>
        <p className="mt-6 text-muted-foreground max-w-sm">
          Everything Web3 founders and builders typically ask before posting their first onchain challenge.
        </p>
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
