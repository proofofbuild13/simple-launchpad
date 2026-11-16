# Broaden the landing page beyond Web3

## Goal
Reposition the full landing page around ProofBuild connecting proven builders across Crypto/Web3, AI, and Robotics—not only onchain work.

## Changes
- Rewrite the hero headline, supporting copy, proof points, and both calls to action so the first screen names all three domains.
- Align the process, domain showcase, builder section, founder/builder panels, benefits, pricing intro, trust section, FAQ, and final call to action around proof-of-work hiring across those domains.
- Update title, description, keywords, and structured organization copy for the broader positioning.
- Keep accurate Web3-specific product details (such as onchain examples and chain support) where relevant; preserve existing pricing and platform terms.
- Avoid inventing AI/robotics customers, completed work, testimonials, or performance metrics. Clearly frame new examples as project types, not platform activity.

## Technical details
- Limit changes to landing-page presentation and metadata components.
- Review all sections rendered by `src/pages/Index.tsx`, then update the relevant `src/components/site/*` copy and `Index.tsx` metadata.
- Verify the complete rendered page at desktop and mobile widths, inspect preview/build logs, and commit only the landing-page changes.
