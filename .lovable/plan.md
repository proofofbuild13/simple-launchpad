# Clean Collective workspace

## What will change
- Remove the introductory sentence and the large identity card from the top of Collective.
- Keep a compact `Collective` title and place a profile icon beside it; selecting it opens the existing profile page.
- Replace the wide tab strip with a clean left-side section menu on desktop and a compact horizontal menu on smaller screens.
- Give Feed, Rooms, Weekly, and Deal flow clear icons, active states, and short supporting labels.
- Keep all existing feed, room, challenge, and deal-flow behavior unchanged.

## Visual direction
- Crisp neutral surfaces with a restrained teal active accent.
- Space Grotesk-style headings and DM Sans-style body hierarchy, scoped to this page without changing the rest of the product.
- Flat, spacious composition with subtle borders, small corner radii, and no decorative header block.

## Technical details
- Update the Collective page composition using the existing tabs and button components.
- Use the existing `/profile` destination and Lucide icons.
- Preserve responsive behavior: sidebar navigation on desktop, scrollable section controls on mobile.
- Verify rendering and section switching where the signed-in preview allows it.
