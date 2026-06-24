import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";

const product = [
  { label: "Browse projects", to: "/browse" },
  { label: "Post a project", to: "/register/startup" },
  { label: "Marketplace", to: "/marketplace" },
  { label: "Leaderboard", to: "/leaderboard" },
];

const company = [
  { label: "About", to: "#" },
  { label: "Blog", to: "#" },
  { label: "Contact", to: "mailto:hello@proofbuild.in" },
  { label: "Careers", to: "#" },
];

const legal = [
  { label: "Privacy", to: "#" },
  { label: "Terms", to: "#" },
  { label: "Security", to: "#" },
];

const Col = ({ title, items }: { title: string; items: { label: string; to: string }[] }) => (
  <div>
    <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground mb-4">{title}</div>
    <ul className="space-y-2.5 text-sm">
      {items.map((i) =>
        i.to.startsWith("/") ? (
          <li key={i.label}>
            <Link to={i.to} className="text-foreground/80 hover:text-foreground">
              {i.label}
            </Link>
          </li>
        ) : (
          <li key={i.label}>
            <a href={i.to} className="text-foreground/80 hover:text-foreground">
              {i.label}
            </a>
          </li>
        )
      )}
    </ul>
  </div>
);

export const Footer = () => (
  <footer className="border-t border-border bg-card/30">
    <div className="container py-16 grid grid-cols-2 md:grid-cols-5 gap-10">
      <div className="col-span-2">
        <div className="flex items-center gap-2 mb-4">
          <img src="/logo.png" alt="proof_of_Build" className="h-7 w-7 object-contain" />
          <span className="font-display text-xl">proof_of_Build</span>
        </div>
        <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
          Execution-based hiring. Founders post real challenges, builders ship prototypes, escrow and contracts
          handled end-to-end.
        </p>
        <div className="mt-6 flex gap-3 text-xs font-mono text-muted-foreground">
          <a href="#" className="hover:text-foreground">Twitter</a>
          <span>·</span>
          <a href="#" className="hover:text-foreground">GitHub</a>
          <span>·</span>
          <a href="#" className="hover:text-foreground">LinkedIn</a>
        </div>
      </div>
      <Col title="Product" items={product} />
      <Col title="Company" items={company} />
      <Col title="Legal" items={legal} />
    </div>
    <div className="border-t border-border">
      <div className="container py-6 flex flex-col md:flex-row gap-3 items-start md:items-center justify-between text-xs font-mono text-muted-foreground">
        <span>© {new Date().getFullYear()} proof_of_Build. All rights reserved.</span>
        <Link to="/admin/login" className="hover:text-foreground inline-flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" />
          Admin
        </Link>
      </div>
    </div>
  </footer>
);
