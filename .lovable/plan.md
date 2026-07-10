# Web3 audience pivot — copy only

Reposition the marketing site so Web3 founders and builders instantly recognize it as built for them. No visual redesign, no functionality changes, no escrow changes (stays fiat). Verticals emphasized: DeFi & trading, Infra & tooling, Consumer & social, DAO & governance.

## Scope

Rewrite user-facing copy on the landing page and a few adjacent surfaces. Everything else — colors, fonts, layout, routes, auth, RLS, escrow, contracts — stays as-is.

## Files to edit

- `src/components/site/Hero.tsx` — headline, subhead, trust stats, badge pill
- `src/components/site/HowItWorks.tsx` — reframe steps around onchain challenges
- `src/components/site/AudienceSplit.tsx` — Web3 founder + Web3 builder cards
- `src/components/site/Pillars.tsx` — pillars framed for onchain execution
- `src/components/site/ProjectShowcase.tsx` — example challenges: DEX widget, indexer, wallet onboarding flow, DAO voting UI
- `src/components/site/BuildersSection.tsx` — builder archetypes (Solidity, Rust/Solana, fullstack onchain, frontend web3)
- `src/components/site/MetricsBand.tsx` — reword labels toward onchain framing
- `src/components/site/FAQ.tsx` — add/replace 2–3 Q&As (chains supported, do builders need to be doxxed, IP/repo ownership)
- `src/components/site/CTA.tsx` — final CTA reworded
- `src/components/site/TrustSection.tsx` — trust points reframed (onchain-native builders, verified GitHub, etc.)
- `src/components/site/Pricing.tsx` — light copy tweaks only
- `src/pages/Index.tsx` — `<title>`, meta description, OG tags, JSON-LD description
- `src/pages/auth/RegisterStartup.tsx` — heading + subhead + industry placeholder ("e.g. DeFi, Infra, DAO tooling")
- `src/pages/auth/RegisterBuilder.tsx` — heading + subhead + skills placeholder ("Solidity, Rust, Move, Viem, Foundry…")
- `index.html` — `<title>` and `<meta name="description">`
- `public/llms.txt` — one-paragraph rewrite to describe the Web3 focus

## Copy direction

- **Headline**: "Hire the Web3 builder whose onchain prototype already works."
- **Subhead**: Real onchain challenges. Builders ship working dApps, contracts, indexers, and interfaces. AI-assisted review, milestone escrow, hire the winner.
- **Audience tags**: "For Web3 founders" / "For onchain builders"
- **Vertical chips** across showcase and register forms: DeFi · Infra · Consumer · DAO
- **Builder skill tags**: Solidity, Rust, Move, Viem/Wagmi, Foundry, Anchor, The Graph, Subgraphs, ZK
- **Trust reframes**: "vetted onchain builders", "shipped mainnet code", "milestones signed onchain-style, funded in escrow"
- **FAQ additions**: chains covered (EVM, Solana, Move-based, L2s); whether pseudonymous builders are allowed; who owns the repo/contracts after handoff

## Out of scope

- No palette, typography, layout, or component structure changes
- No changes to escrow (stays fiat), payments, or smart-contract integrations
- No new routes, DB tables, or backend logic
- No changes to `remotion/` marketing video
- No new imagery generation

## Verification

- Read each edited file after changes to confirm copy renders
- Playwright screenshot of `/` at 1280×1800 to confirm layout is intact and new copy is visible
- `tsgo` clean
