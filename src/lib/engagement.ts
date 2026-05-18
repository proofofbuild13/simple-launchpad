// Helpers for the two engagement models on a project.
// engagement_type: 'project_hire' (contract + milestone) | 'hire_to_build' (full-time role)

export type EngagementType = "project_hire" | "hire_to_build";

export const isHireToBuild = (p: any): boolean =>
  p?.engagement_type === "hire_to_build";

export const engagementLabel = (t?: string) =>
  t === "hire_to_build" ? "Full-time Role" : "Project Hire";

export const engagementBadgeClass = (t?: string) =>
  t === "hire_to_build"
    ? "bg-emerald-500/15 text-emerald-700 border-emerald-500/30"
    : "bg-blue-500/15 text-blue-700 border-blue-500/30";

export const submissionCta = (t?: string) =>
  t === "hire_to_build" ? "Apply for Role" : "Submit Solution";

export const offerCta = (t?: string) =>
  t === "hire_to_build" ? "Send job offer" : "Send offer";

export const formatCtcRange = (p: any): string => {
  if (!p) return "—";
  if (p.ctc_confidential) return "Competitive Salary";
  const min = p.ctc_min ? `$${Number(p.ctc_min).toLocaleString()}` : null;
  const max = p.ctc_max ? `$${Number(p.ctc_max).toLocaleString()}` : null;
  if (min && max) return `${min} – ${max}`;
  return min || max || "—";
};
