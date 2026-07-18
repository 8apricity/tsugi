# UI Design Guidance

Use this guidance whenever designing, prototyping, or changing application UI in this repository.

Tsugi should feel like a focused, modern tool made for students. Keep the interface quiet, direct, and easy to understand. Every visible element must earn its place.

## Core Direction

- Keep the design minimal and simple.
- Build clear visual hierarchy with spacing, typography, alignment, and contrast.
- Use icons actively to make actions and information easier to scan.
- Prefer familiar, modern interaction patterns over novelty.
- Make each screen feel purpose-built for its task, not assembled from a generic template.
- Optimize for mobile use first while keeping desktop layouts efficient.

## Avoid AI-Generated Aesthetics

Do not produce the stereotypical visual language of AI-generated applications or landing pages.

- No decorative gradients, glowing effects, glassmorphism, blurred color blobs, or oversized hero treatments.
- No excessive rounded cards, floating panels, pills, badges, or shadows.
- Do not place every piece of content inside a card.
- Do not use large headings and empty space to disguise weak information hierarchy.
- Do not add decorative charts, illustrations, icons, or copy that do not help the student complete a task.
- Avoid generic dashboard layouts when the feature calls for a timetable, list, editor, form, or focused detail view.
- Avoid repetitive UI patterns that make unrelated information look equally important.

The result should look intentionally designed for Tsugi, not generated from a prompt or copied from a component-library demo.

## Layout and Hierarchy

- Give each screen one clear purpose and one obvious primary action.
- Put the most important student information first. Secondary controls should remain easy to find without competing for attention.
- Use a small, consistent spacing scale. Prefer alignment and whitespace over extra borders or containers.
- Keep content width appropriate to the task: readable for text, wider for timetables and dense operational views.
- Use cards only when a distinct group needs a visible boundary. Prefer sections, rows, dividers, and whitespace otherwise.
- Keep navigation compact. Do not let navigation dominate the content.
- On mobile, preserve the task hierarchy instead of merely stacking every desktop element.
- On desktop, use available space to improve comparison, scanning, and editing rather than enlarging decoration.

## Icons

- Use the project's existing icon library. Do not mix icon families or substitute emoji.
- Add icons to common actions, navigation, status, content types, and compact metadata where they improve recognition.
- Use familiar symbols. Do not invent meaning for an ambiguous icon.
- Pair an icon with a text label when the action may be unclear, destructive, uncommon, or important.
- Icon-only controls are appropriate for universally understood, repeated actions when they have an accessible name and tooltip.
- Keep icon size, stroke weight, alignment, and optical spacing consistent.
- Icons support hierarchy; they do not replace clear wording.

## Visual System

- Use a restrained neutral palette with one primary accent color.
- Reserve additional colors for states with real meaning, such as success, warning, error, selection, and timetable categories.
- Never rely on color alone to communicate state.
- Prefer flat surfaces, subtle borders, and minimal shadow. Use elevation only when layers genuinely overlap.
- Keep corner radii modest and consistent. Choose shape from function, not decoration.
- Use a clean system sans-serif or the project's established typeface.
- Use few type sizes and weights. Strong hierarchy matters more than large typography.
- Maintain comfortable density: compact enough to scan quickly, spacious enough for touch use.

## Components and Interaction

- Prefer native, familiar controls and established project components.
- Reduce the number of decisions shown at once. Reveal advanced or infrequent options when needed.
- Keep primary actions visually distinct. Secondary and destructive actions must not compete with them.
- Make entire logical rows or targets clickable when that matches user expectation; avoid tiny hit areas.
- Provide immediate, local feedback for loading, saving, success, validation, and failure.
- Use empty states to explain what is missing and what the student can do next. Keep them concise.
- Use dialogs only for short, focused decisions. Use a page, sheet, or dedicated flow for complex work.
- Use motion sparingly for continuity and feedback. Keep it fast, subtle, and safe for reduced-motion settings.

## Timetables and Dense Information

- Keep the daily plan, multi-day plan, timetable, or other primary information visually central.
- Optimize tables and lists for scanning. Align repeated values and keep headers visible when useful.
- Show changes, conflicts, selection, pending work, and unsaved state with more than color alone.
- Keep repeated controls compact and predictable.
- Prefer direct manipulation or in-context editing when it is faster and remains understandable on touch devices.
- Preserve context when opening details or editing an item; students should not lose their place unnecessarily.

## Language

- Write student-facing copy in concise, natural Japanese.
- Use `CONTEXT.md` for conceptual meaning, not as a literal UI translation dictionary.
- Choose wording that matches a student's mental model while preserving the domain meaning.
- Keep labels concrete and action-oriented. Avoid technical language, generic slogans, and unnecessary explanation.
- Use consistent Japanese wording for the same concept in similar contexts.

## Accessibility and Responsiveness

- Meet WCAG AA contrast for text and meaningful controls.
- Support keyboard navigation, visible focus, screen-reader names, and logical reading order.
- Use touch targets large enough for comfortable mobile operation.
- Design for narrow phones, wide desktops, zoomed text, long Japanese labels, loading states, empty states, and error states.
- Do not hide essential functionality behind hover.

## Review Checklist

Before accepting a UI change, confirm:

- Can a student identify the screen's purpose and primary action immediately?
- Can anything be removed without losing meaning or capability?
- Does the layout fit the task instead of resembling a generic dashboard?
- Do icons improve scanning and remain understandable and accessible?
- Are hierarchy and state clear without decorative effects or color alone?
- Does the UI work naturally on a phone and efficiently on a desktop?
- Does the result feel modern, restrained, and specific to Tsugi?
