import { Badge } from "@/components/ui/badge";
import { Clock, Users, Trophy } from "lucide-react";

const projects = [
  { cat: "AI", title: "Voice agent for clinic intake", budget: "$8,000", days: 14, subs: 23, tags: ["Realtime", "Whisper", "Next.js"] },
  { cat: "SaaS", title: "Lightweight CRM for solo founders", budget: "$12,000", days: 21, subs: 47, tags: ["Postgres", "React", "Stripe"] },
  { cat: "No-code", title: "Lead-gen automation for agencies", budget: "$3,500", days: 7, subs: 31, tags: ["Make", "Airtable"] },
  { cat: "Mobile", title: "Habit tracker w/ social streaks", budget: "$15,000", days: 30, subs: 18, tags: ["Expo", "Supabase"] },
  { cat: "Web", title: "Marketing site + CMS for fund", budget: "$6,000", days: 10, subs: 12, tags: ["Astro", "Sanity"] },
  { cat: "Marketing", title: "Cold-outbound playbook + assets", budget: "$4,200", days: 14, subs: 9, tags: ["Copy", "Apollo"] },
];

export const ProjectShowcase = () => (
  <section id="projects" className="container py-24 md:py-32 border-t border-border">
    <div className="flex items-end justify-between mb-12">
      <div>
        <div className="font-mono text-xs text-signal uppercase tracking-widest mb-3">Live challenges</div>
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
