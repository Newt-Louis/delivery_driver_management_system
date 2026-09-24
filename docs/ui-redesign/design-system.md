# Design-System Contract (Pending Approval)

This is the single source for the future UI system. It intentionally does not select a palette or component API before the audit and human design-direction review.

## Decisions to approve

| Area | Required decision |
| --- | --- |
| Visual direction | Product character, density, and examples that are appropriate for public drivers, operations staff, TV, and administration. |
| Color tokens | Neutral surface/text/border scale; one primary brand scale; optional supporting accent; semantic state scales; focus and disabled colors. |
| Typography | Font family, Vietnamese legibility, type scale, line heights, and numeric/table treatment. |
| Layout | Content widths, shell/sidebar/navigation behavior, responsive breakpoints, page density, and mobile-first public flows. |
| Foundations | Button, field, select, checkbox/switch, status badge, dialog, toast, table, tabs, empty state, loading state, error state, and icon policy. |
| Accessibility | Minimum contrast, `:focus-visible`, target sizes, screen-reader labels, reduced motion, and error messaging. |

## Implementation contract after approval

- Define color, spacing, radius, elevation, typography, and motion as named tokens in the frontend theme/base stylesheet.
- Build only the base primitives required by approved page groups; composition belongs in feature/page code.
- Keep component states explicit and documented. Loading is not only a disabled button; it needs clear feedback without misleading status color.
- Use icons to clarify a labeled action, not as unexplained decoration. Adopt a single icon source only after approval.
- Keep public driver flows touch-first and operational screens information-dense without visual noise.

## Prohibited by default

- Gradients, decorative glass effects, ambient blobs, or exaggerated shadows.
- Arbitrary hex/RGB/HSL values, one-off spacing, and page-local color decisions.
- Replacing configured unit colors or using semantic colors as general decoration.
- A screenshot baseline created before a human has reviewed the target state.
