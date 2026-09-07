# Collective — community layer for ProofBuild

A new `/collective` page inside the app (signed-in area, same sidebar and visual style), social-first rather than deal-first, aimed at web3 founders and builders.

## What you get

**Tabs:** Feed · Rooms · Weekly · Deal Flow

1. **Builder identity header**
   Your avatar, name, headline, ProofBuild score (existing rating), GitHub link and wallet address, plus a "Verified builder" badge when you have at least one completed submission. Founders see their startup identity instead.

2. **Proof feed (center)**
   Newest completed builds first: builder name, challenge title, one-line result, link to the submission. Filter chips: All / DeFi / DAO / NFT / Infra / L2, using the category already stored on projects.

3. **Founder rooms**
   Five topic rooms (DeFi, L2s, DAOs, NFT Infra, RWA Tokenization) with simple threaded posts. On your own post, a "Convert to challenge" button opens the existing project posting flow pre-filled with the post text.

4. **Weekly community challenge (right)**
   The current week's reputation-only challenge with submission count and a "Submit your build" button. No money or escrow involved.

5. **Deal flow board**
   In this pass the board is visual only: layout, filters and the "I'm interested" button in place, with a clear "coming soon" state. Backend follows in a second pass.

Mobile: feed first, side panels stack underneath.

## Technical notes

New tables (migrations, each with grants + RLS):
- `room_posts` — room_id (enum/text), author_id, content, parent_id for replies, created_at. Read: any signed-in user. Write/update/delete: author only.
- `community_challenges` — title, description, start_date, end_date, is_active. Read: signed-in users. Write: admins.
- `community_submissions` — challenge_id, builder_id, title, url, created_at (needed for the submission count and CTA to work).
- `deal_flow_posts` and `deal_flow_interest` — created in this pass as schema only so the follow-up pass is a UI wire-up.

Column additions:
- `builder_profiles.wallet_address` and `builder_profiles.reputation_nft_id` (nullable placeholders).

Proof feed access: `submissions` RLS today limits reads to the submitting builder and the owning founder, so a cross-platform feed cannot query the table directly. Add a `get_proof_feed(_category text, _limit int)` SECURITY DEFINER function returning only non-sensitive fields (builder name/avatar, project title + category, submission title, one-line summary, id) for submissions with status `completed`, and grant execute to authenticated.

New files: `src/pages/collective/Collective.tsx`, plus components `BuilderIdentityHeader.tsx`, `ProofFeed.tsx`, `FounderRooms.tsx`, `WeeklyChallengeCard.tsx`, `DealFlowBoard.tsx` under `src/components/collective/`, and `src/lib/collective.ts` for queries. Route added in `src/App.tsx` under the protected dashboard layout, plus a "Collective" sidebar item for both roles.

Notification on "I'm interested" reuses the existing `send_notification` RPC when the deal flow backend lands.
