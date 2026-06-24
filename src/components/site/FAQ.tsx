import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const faqs = [
  {
    q: "How does escrow work?",
    a: "When you start a contract, funds for each milestone are held by the platform. Money is released to the builder only after you sign off on the milestone — and disputes are mediated by our admin team using the artifacts attached to the contract.",
  },
  {
    q: "Who owns the IP of submitted prototypes?",
    a: "Builders retain rights to their submissions until you hire them. On hire, a signed IP-assignment and contractor agreement transfers full ownership of the work product to your company — automated as part of contract signing.",
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
    q: "How are builders vetted?",
    a: "Every builder profile is judged on shipped work — repos, live URLs, walkthroughs and on-platform reviews from past founders. There are no résumé-only profiles.",
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
          Everything founders and builders typically ask before posting their first challenge.
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
