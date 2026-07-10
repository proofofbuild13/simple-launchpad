import { Star, Quote } from "lucide-react";
import { Badge } from "@/components/ui/badge";

type Builder = {
  name: string;
  handle: string;
  role: string;
  location: string;
  rating: number;
  reviews: number;
  rate: string;
  shipped: number;
  skills: string[];
  initials: string;
  testimonial: string;
  reviewer: string;
};

const builders: Builder[] = [
  {
    name: "Ananya Rao",
    handle: "@ananya.eth",
    role: "Solidity · DeFi",
    location: "Bengaluru, IN",
    rating: 4.9,
    reviews: 27,
    rate: "$95/hr",
    shipped: 18,
    skills: ["Solidity", "Foundry", "Viem"],
    initials: "AR",
    testimonial: "Shipped our perp DEX contracts in 9 days — audited-clean, gas-tight, zero rework.",
    reviewer: "Maya · Founder, ClinicLoop",
  },
  {
    name: "Jordan Mehta",
    handle: "@jordan.sol",
    role: "Rust · Solana",
    location: "Lisbon, PT",
    rating: 5.0,
    reviews: 14,
    rate: "$110/hr",
    shipped: 11,
    skills: ["Rust", "Anchor", "Solana"],
    initials: "JM",
    testimonial: "Beat 22 other submissions with a deployed Solana program in 4 days. Easy hire.",
    reviewer: "Devin · CEO, StreakLab",
  },
  {
    name: "Priya Shah",
    handle: "@priya.eth",
    role: "Web3 Design Eng",
    location: "Remote",
    rating: 4.8,
    reviews: 33,
    rate: "$85/hr",
    shipped: 24,
    skills: ["React", "Wagmi", "RainbowKit"],
    initials: "PS",
    testimonial: "Rebuilt our staking UI end-to-end — pixel-perfect, wallet-aware, gas-transparent.",
    reviewer: "Tomás · Founder, Northfund",
  },
  {
    name: "Diego Alvarez",
    handle: "@diego.graph",
    role: "Indexer · Infra",
    location: "Mexico City, MX",
    rating: 4.9,
    reviews: 19,
    rate: "$90/hr",
    shipped: 15,
    skills: ["The Graph", "Go", "Postgres"],
    initials: "DA",
    testimonial: "Cut our subgraph sync time by 6x. Hired full-time to run our data layer.",
    reviewer: "Sara · CTO, FlowKite",
  },
  {
    name: "Yuki Tanaka",
    handle: "@yuki.dao",
    role: "DAO Tooling",
    location: "Tokyo, JP",
    rating: 5.0,
    reviews: 22,
    rate: "$75/hr",
    shipped: 31,
    skills: ["Safe", "Snapshot", "Tally"],
    initials: "YT",
    testimonial: "Replaced 3 governance tools with one clean Safe + Snapshot flow. Unreal.",
    reviewer: "Henry · Ops, Bramble",
  },
  {
    name: "Léa Dubois",
    handle: "@lea.base",
    role: "Frontend · Web3",
    location: "Paris, FR",
    rating: 4.7,
    reviews: 12,
    rate: "$95/hr",
    shipped: 9,
    skills: ["Wagmi", "Viem", "Base"],
    initials: "LD",
    testimonial: "Shipped our Farcaster mini-app in one sprint with real onchain UX edge-cases.",
    reviewer: "Rohan · Founder, OrbitDAO",
  },
];

const Stars = ({ rating }: { rating: number }) => (
  <div className="flex items-center gap-0.5">
    {Array.from({ length: 5 }).map((_, i) => (
      <Star
        key={i}
        className={`h-3 w-3 ${i < Math.round(rating) ? "fill-signal text-signal" : "text-muted-foreground/30"}`}
        strokeWidth={1.5}
      />
    ))}
    <span className="ml-1.5 font-mono text-xs text-foreground">{rating.toFixed(1)}</span>
  </div>
);

const Card = ({ b }: { b: Builder }) => (
  <article className="group bg-card border border-border rounded-2xl p-6 hover:shadow-card hover:-translate-y-0.5 transition-all duration-300 flex flex-col">
    <div className="flex items-start gap-4 mb-5">
      <div className="h-12 w-12 rounded-full bg-ink text-ink-foreground flex items-center justify-center font-display text-base shrink-0">
        {b.initials}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="font-display text-lg leading-tight truncate">{b.name}</h3>
          <span className="font-mono text-xs text-signal shrink-0">{b.rate}</span>
        </div>
        <div className="font-mono text-[11px] text-muted-foreground truncate">{b.handle} · {b.location}</div>
      </div>
    </div>

    <div className="flex items-center justify-between mb-4">
      <Badge variant="outline" className="font-mono text-[10px] tracking-wider border-foreground/15">
        {b.role.toUpperCase()}
      </Badge>
      <Stars rating={b.rating} />
    </div>

    <div className="flex flex-wrap gap-1.5 mb-5">
      {b.skills.map((s) => (
        <span key={s} className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-secondary text-muted-foreground">
          {s}
        </span>
      ))}
    </div>

    <div className="mt-auto pt-5 border-t border-border">
      <Quote className="h-3.5 w-3.5 text-signal mb-2" strokeWidth={2} />
      <p className="text-sm text-foreground/80 leading-relaxed mb-3">"{b.testimonial}"</p>
      <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
        <span>{b.reviewer}</span>
        <span>{b.shipped} shipped · {b.reviews} reviews</span>
      </div>
    </div>
  </article>
);

export const BuildersSection = () => (
  <section id="builders" className="container py-24 md:py-32 border-t border-border">
    <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
      <div>
        <div className="font-mono text-xs text-signal uppercase tracking-widest mb-3">The talent</div>
        <h2 className="font-display text-5xl md:text-6xl max-w-2xl text-balance">
          Onchain builders founders <em className="text-signal not-italic italic font-light">re-hire</em>.
        </h2>
      </div>
      <p className="text-muted-foreground max-w-sm">
        Every profile here has shipped Web3 code on the platform — deployed contracts, live dApps, verified
        subgraphs. Ratings come from founders who signed off real milestones.
      </p>
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {builders.map((b) => <Card key={b.handle} b={b} />)}
    </div>
  </section>
);
