import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileText, Mail, Phone, MapPin, Github, Linkedin, GraduationCap, Briefcase, Wrench, Award } from "lucide-react";
import { useMemo } from "react";

/* ─── Section headings we try to detect ─── */
const SECTION_PATTERNS: [RegExp, string, React.ElementType][] = [
  [/\b(PROFESSIONAL\s+SKILLS?\s+(AND\s+INTERESTS?)?|SKILLS?|TECHNICAL\s+SKILLS?|CORE\s+COMPETENCIES)\b/i, "Skills", Wrench],
  [/\b(EDUCATION|ACADEMIC|QUALIFICATION)\b/i, "Education", GraduationCap],
  [/\b(EXPERIENCE|WORK\s+EXPERIENCE|EMPLOYMENT|PROFESSIONAL\s+EXPERIENCE|WORK\s+HISTORY)\b/i, "Experience", Briefcase],
  [/\b(CERTIFICATION|CERTIFICATIONS|AWARDS?|ACHIEVEMENTS?)\b/i, "Certifications & Awards", Award],
  [/\b(PROFILE\s+SNAPSHOT|SUMMARY|OBJECTIVE|ABOUT|PROFILE)\b/i, "Profile Summary", FileText],
  [/\b(PROFESSIONAL\s+SKILLS\s+DEMONSTRATED|PROJECTS?|KEY\s+PROJECTS?)\b/i, "Key Projects", Briefcase],
  [/\b(CONTACT)\b/i, "Contact", Phone],
];

/* Try to extract structured contact info from raw text */
function extractContact(text: string) {
  const email = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? null;
  const phone = text.match(/(?:\+?\d{1,3}[\s-]?)?\(?\d{2,5}\)?[\s.-]?\d{3,5}[\s.-]?\d{3,5}/)?.[0] ?? null;
  const linkedin = text.match(/linkedin\.com\/in\/[\w-]+/)?.[0] ?? null;
  const github = text.match(/github\.com\/[\w-]+/)?.[0] ?? null;
  const location = text.match(/Address\s+([\w\s,]+?)(?:\s{2,}|\n|LinkedIn|Email|Phone|Github)/i)?.[1]?.trim() ?? null;
  return { email, phone, linkedin, github, location };
}

/* Split raw text into labelled sections */
function parseSections(raw: string): { heading: string; icon: React.ElementType; body: string }[] {
  if (!raw) return [];

  // Try to split by common section heading patterns (ALL CAPS words often denote section breaks)
  const sectionSplitRegex = /\s{2,}(?=[A-Z][A-Z\s&]+(?:\s{2,}|$))/g;
  const roughBlocks = raw.split(sectionSplitRegex).filter((b) => b.trim().length > 0);

  const sections: { heading: string; icon: React.ElementType; body: string }[] = [];
  let currentHeading = "Overview";
  let currentIcon: React.ElementType = FileText;
  let currentBody: string[] = [];

  const flush = () => {
    const body = currentBody.join("  ").trim();
    if (body) sections.push({ heading: currentHeading, icon: currentIcon, body });
    currentBody = [];
  };

  for (const block of roughBlocks) {
    let matched = false;
    for (const [pattern, label, icon] of SECTION_PATTERNS) {
      if (pattern.test(block.slice(0, 80))) {
        flush();
        currentHeading = label;
        currentIcon = icon;
        // Remove the matched heading text from the body
        currentBody.push(block.replace(pattern, "").trim());
        matched = true;
        break;
      }
    }
    if (!matched) {
      currentBody.push(block);
    }
  }
  flush();

  return sections;
}

/* Extract name from the beginning of the text */
function extractName(text: string): string | null {
  // Look for a pattern like "VIGNESH V" or similar at the beginning or after PROFILE SNAPSHOT
  const nameMatch = text.match(/(?:SUPPLY\s+CHAIN\s+ANALYST\s+)?([A-Z][A-Z\s.]+?)(?:\s{2,}|PROFILE|Phone|Email|\n)/);
  return nameMatch?.[1]?.trim() ?? null;
}

export function ResumeViewModal({ resumeApp, trigger }: { resumeApp: any; trigger?: React.ReactNode }) {
  if (!resumeApp) return null;

  const rawText: string = resumeApp.extracted_text || "";
  const contact = useMemo(() => extractContact(rawText), [rawText]);
  const sections = useMemo(() => parseSections(rawText), [rawText]);
  const displayName = useMemo(() => extractName(rawText), [rawText]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            View Resume
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-br from-primary/5 via-transparent to-accent/5">
          <DialogTitle className="flex items-center gap-3 text-lg">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="font-semibold truncate">
                {displayName || resumeApp.file_name || "Applicant Resume"}
              </div>
              <div className="text-xs text-muted-foreground font-normal mt-0.5">
                {resumeApp.file_name || "Resume document"}
                {resumeApp.created_at && (
                  <> · Submitted {new Date(resumeApp.created_at).toLocaleDateString()}</>
                )}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="px-6 py-5 space-y-5">
            {/* Contact info bar */}
            {(contact.email || contact.phone || contact.linkedin || contact.github || contact.location) && (
              <div className="flex flex-wrap gap-2">
                {contact.email && (
                  <a href={`mailto:${contact.email}`} className="inline-flex items-center gap-1.5 text-xs bg-muted/60 hover:bg-muted border border-border rounded-full px-3 py-1.5 transition-colors">
                    <Mail className="h-3 w-3 text-primary" />
                    <span className="text-foreground/80">{contact.email}</span>
                  </a>
                )}
                {contact.phone && (
                  <span className="inline-flex items-center gap-1.5 text-xs bg-muted/60 border border-border rounded-full px-3 py-1.5">
                    <Phone className="h-3 w-3 text-primary" />
                    <span className="text-foreground/80">{contact.phone}</span>
                  </span>
                )}
                {contact.location && (
                  <span className="inline-flex items-center gap-1.5 text-xs bg-muted/60 border border-border rounded-full px-3 py-1.5">
                    <MapPin className="h-3 w-3 text-primary" />
                    <span className="text-foreground/80">{contact.location}</span>
                  </span>
                )}
                {contact.linkedin && (
                  <a href={`https://${contact.linkedin}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs bg-muted/60 hover:bg-muted border border-border rounded-full px-3 py-1.5 transition-colors">
                    <Linkedin className="h-3 w-3 text-blue-600" />
                    <span className="text-foreground/80">LinkedIn</span>
                  </a>
                )}
                {contact.github && (
                  <a href={`https://${contact.github}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 text-xs bg-muted/60 hover:bg-muted border border-border rounded-full px-3 py-1.5 transition-colors">
                    <Github className="h-3 w-3" />
                    <span className="text-foreground/80">GitHub</span>
                  </a>
                )}
              </div>
            )}

            {/* Parsed sections */}
            {sections.length > 0 ? (
              sections.map((sec, i) => {
                const Icon = sec.icon;
                return (
                  <div key={i} className="space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Icon className="h-4 w-4 text-primary/70" />
                      {sec.heading}
                    </div>
                    <div className="pl-6 text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap break-words">
                      {formatBody(sec.body, sec.heading)}
                    </div>
                    {i < sections.length - 1 && <div className="border-b border-border/50 mt-3" />}
                  </div>
                );
              })
            ) : (
              /* Fallback: render the raw text nicely */
              <div className="text-sm leading-relaxed text-foreground/80 whitespace-pre-wrap break-words">
                {rawText || "No text could be extracted from this resume."}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Format body text depending on section type ─── */
function formatBody(body: string, heading: string) {
  if (heading === "Skills") {
    // Try to parse comma / semicolon separated skill items
    const skills = body
      .split(/[,;·•]|\d+%/)
      .map((s) => s.replace(/\s+/g, " ").trim())
      .filter((s) => s.length > 1 && s.length < 80);
    if (skills.length > 2) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {skills.map((s, i) => (
            <Badge key={i} variant="outline" className="text-xs font-normal px-2.5 py-1">
              {s}
            </Badge>
          ))}
        </div>
      );
    }
  }

  if (heading === "Education") {
    // Split into entries by double-space or "Graduated"
    const entries = body.split(/(?=Graduated|Bachelor|Master|Diploma)/i).filter(Boolean);
    if (entries.length > 1) {
      return (
        <div className="space-y-3">
          {entries.map((entry, i) => (
            <div key={i} className="rounded-md border border-border/50 bg-muted/20 px-3 py-2.5 text-sm">
              {entry.trim()}
            </div>
          ))}
        </div>
      );
    }
  }

  if (heading === "Experience" || heading === "Key Projects") {
    // Try to split by company/role patterns
    const entries = body
      .split(/(?=(?:[A-Z][\w\s&]+(?:Pvt|Ltd|Inc|LLC|Corp))|(?:Sep|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Oct|Nov|Dec)\s+\d{4})/i)
      .filter((e) => e.trim().length > 10);
    if (entries.length > 1) {
      return (
        <div className="space-y-3">
          {entries.map((entry, i) => (
            <div key={i} className="rounded-md border-l-2 border-primary/30 pl-3 py-1 text-sm">
              {entry.trim()}
            </div>
          ))}
        </div>
      );
    }
  }

  // Default: render as-is with better wrapping
  return body;
}
