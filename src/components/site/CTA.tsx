import { Button } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

export const CTA = () => (
  <section className="container py-24 md:py-32">
    <div className="relative overflow-hidden rounded-3xl border border-border bg-card p-12 md:p-20 shadow-card">
      <div className="absolute -right-20 -top-20 h-80 w-80 rounded-full bg-gradient-signal blur-3xl opacity-20" />
      <div className="relative max-w-3xl">
        <h2 className="font-display text-5xl md:text-7xl leading-[0.95] text-balance">
          Stop interviewing. <br/>
          <em className="text-signal not-italic italic font-light">Start shipping onchain.</em>
        </h2>
        <p className="mt-6 text-lg text-muted-foreground max-w-xl">
          Post your first onchain challenge in under 5 minutes. Free until you hire.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/register/startup">
            <Button size="lg" className="bg-ink text-ink-foreground hover:bg-ink/90 h-12 px-6 text-base">
              Post an onchain challenge <ArrowUpRight className="ml-1 h-4 w-4" />
            </Button>
          </Link>
          <Link to="/register/builder">
            <Button size="lg" variant="outline" className="h-12 px-6 text-base">
              Apply as a Web3 builder
            </Button>
          </Link>
        </div>
      </div>
    </div>
  </section>
);
