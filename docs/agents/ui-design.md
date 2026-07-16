# UI Design Guidance

Description: Use this guidance when designing, prototyping, or changing application UI in this repository. The intended product feel is a clean, minimalist, Bootstrap-inspired enterprise web application for school timetable operations: functional, readable, calm, and polished without decorative visual effects.

## UI Language and Domain Vocabulary

- Write student-facing UI copy in natural Japanese.
- Do not expose the canonical English terms from `CONTEXT.md` directly as labels, headings, actions, help text, validation messages, or other UI copy.
- Treat `CONTEXT.md` as the source of conceptual meaning for engineering work, not as approved UI copy or a translation dictionary.
- Translate or rephrase domain concepts for the student's context and mental model. Prefer clear, concise Japanese over a literal or mechanically consistent translation of the English term.
- Keep the meaning of the underlying domain concept intact, and use consistent Japanese wording when the same concept appears in similar UI contexts.
- Terms listed under `_Avoid_` in `CONTEXT.md` constrain engineering and domain discussion. They do not prohibit natural Japanese UI wording, provided the wording does not introduce a different or misleading concept.
- Canonical English domain terms remain appropriate in code, tests, technical specifications, and internal engineering discussion.

## Style Direction

- Use a Bootstrap-inspired interface.
- Prefer flat design.
- Use a light gray page background, approximately `#f5f5f5`.
- Use white content panels.
- Use thin borders.
- Use very subtle shadows only where they improve hierarchy.
- Use large spacing and padding.
- Aim for a professional enterprise software appearance.
- Use a neutral color palette.
- Make the UI functional rather than decorative.
- Use typography similar to Open Sans or Inter.
- Prioritize usability and readability.
- Keep the timetable or primary operational table as the visual center of the screen.
- Prefer spreadsheet-like editing patterns where they improve speed: cell selection, direct editing, compact controls, and clear active states.
- Make operational state visible at a glance, especially unscheduled items, conflicts, fixed placements, provisional placements, and unsaved changes.
- Aim for a calm school-operations feel: warmer and more approachable than generic enterprise SaaS, but more serious than a playful education app.

## Color Direction

- Use a neutral base with a restrained two-tone identity.
- Prefer calm navy for structural UI such as navigation, headers, and strong anchors.
- Prefer muted teal for selection, active navigation, focused controls, and small accent surfaces.
- Keep page and table backgrounds neutral so timetable content remains primary.
- Separate brand/accent colors from functional colors and subject colors.
- Use functional colors only for meaning: success, warning, danger, info, conflict, and disabled states.
- Use subject colors sparingly and at low saturation, usually as subtle cell backgrounds or side markers rather than dominant blocks.
- Avoid using teal for every button or every highlighted element.

Recommended palette:

- Page background: `#F5F6F7`
- Panel background: `#FFFFFF`
- Border: `#D9DEE3`
- Primary navy: `#23324D`
- Primary accent teal: `#2A9FA7`
- Light accent teal: `#E8F5F6`
- Text: `#1F2933`
- Muted text: `#6B7280`

## Avoid

- Glassmorphism.
- Neumorphism.
- Heavy gradients.
- Vibrant colors.
- Excessive shadows.
- Modern startup landing page aesthetics.
- Letting navigation, decoration, or cards compete visually with the timetable.
- Large areas of cyan, blue-green, or colorful subject blocks.
- Relying on color alone to communicate important state.

## Quality Bar

Create wireframe-quality but polished enterprise web application UI. The result should feel like usable internal or admin software, not a marketing page.
