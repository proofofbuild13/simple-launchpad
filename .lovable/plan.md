## Landing page analysis

Current sections (top → bottom): `Nav → Hero → HowItWorks → ProjectShowcase → Pillars → CTA → Footer`.

What's missing:
- No dedicated **metrics / impact** band (only 3 tiny inline stats in the Hero).
- No **for-founders vs for-builders** split — visitors can't quickly see what's in it for them.
- No **trust signals** (categories, payout volume, time-to-hire, security/compliance).
- No **FAQ** to answer pricing/escrow/IP questions before signup.
- Footer is thin (no real link columns, no contact).

## Plan

Add two new sections and upgrade the footer — no business-logic changes, presentation-only.

### 1. New `MetricsBand.tsx` (inserted after `HowItWorks`)
A bold, dark, full-bleed band with 4–6 headline metrics in a large display font, plus a one-line caption per metric. Numbers animate up on scroll (CountUp via simple `requestAnimationFrame`, no new deps).

Metrics:
- `2,400+` active builders
- `$1.2M` paid through escrow
- `96%` on-time delivery
- `7 days` median time-to-first-prototype
- `48 hrs` median founder response
- `38` countries represented

Below the metric grid: a 3-column **"By the numbers, in practice"** strip explaining what each metric means for founders (e.g. "Faster than a recruiter cycle", "Backed by milestone escrow", "Vetted by shipped work, not résumés").

### 2. New `AudienceSplit.tsx` (inserted after `Pillars`)
Two side-by-side cards — **For founders** / **For builders** — each with: a tagline, 4 bullet outcomes, and a CTA button (`/register/startup`, `/register/builder`). Uses the existing `bg-card`, `signal`, and `ink` tokens already in `index.css`.

### 3. New `FAQ.tsx` (inserted before `CTA`)
Uses the existing `@/components/ui/accordion` shadcn component. 6 questions covering:
- How does escrow work?
- Who owns the IP of submitted prototypes?
- What does it cost?
- What if no submission is good enough?
- How are builders vetted?
- Can I convert a builder to a full-time hire?

### 4. Upgrade `Footer.tsx`
Expand to a 4-column footer: brand blurb · Product (Browse, Post, Pricing, Leaderboard) · Company (About, Blog, Contact) · Legal (Privacy, Terms, Admin). Keep current bottom bar with copyright + social.

### 5. `Index.tsx` wiring
Update `<main>` to:
```
<Hero /> <HowItWorks /> <MetricsBand /> <ProjectShowcase /> <Pillars /> <AudienceSplit /> <FAQ /> <CTA />
```
Also tighten `<title>` / `<meta description>` (keep < 60 / < 160 chars) and add `<meta name="keywords">` + JSON-LD `Organization` schema for SEO.

### Technical notes
- All new components use existing semantic tokens (`bg-card`, `text-signal`, `bg-ink`, `font-display`, `font-mono`) — no hardcoded colors, no new fonts.
- Count-up animation is a tiny inline hook (no `react-countup` install).
- Accordion is already in `src/components/ui/accordion.tsx` — no new deps.
- No DB, RLS, or route changes.

### Files
- create `src/components/site/MetricsBand.tsx`
- create `src/components/site/AudienceSplit.tsx`
- create `src/components/site/FAQ.tsx`
- edit `src/components/site/Footer.tsx`
- edit `src/pages/Index.tsx`
