# Design System: Naver SA Autopilot

## 1. Visual Theme And Atmosphere
Naver SA Autopilot is a dense operator console, not a marketing site. The product should feel like a calm command desk for ad setup work: precise, quiet, Korean-first, and fast to scan. Density is high enough for agency operators, while spacing stays generous enough for advertisers to understand the next action without training.

## 2. Color Palette And Roles
- Canvas Bone (#F7F6F3) - Main application background.
- Paper Surface (#FFFFFF) - Primary panels, forms, and worklist rows.
- Soft Surface (#FBFBFA) - Secondary metric cells and nested summaries.
- Charcoal Ink (#171717) - Primary text and primary action buttons.
- Muted Clay (#66615B) - Secondary copy, labels, and descriptions.
- Whisper Border (#E7E3DC) - Structural borders and dividers.
- Verified Green (#177D4E) - Approved, safe, and ready states.
- Review Amber (#9E5700) - Pending approval, missing channel, or human review.
- Blocked Red (#D93025) - Validation blockers and unsafe states.
- Operator Blue (#2F6F9F) - Focus, system accents, and active navigation.

## 3. Typography Rules
- Interface font: Pretendard Variable for Korean UI readability.
- Fallbacks: Helvetica Neue, Apple SD Gothic Neo, Malgun Gothic, sans-serif.
- Numeric data: tabular numbers across the UI so budgets, bids, and counts align.
- Headings: compact, weight-driven hierarchy; no oversized hero text inside the dashboard.
- Body: concise Korean copy, line height around 1.45 to 1.65.

## 4. Component Styling
- App shell: fixed operator sidebar on desktop, horizontal sticky rail on tablet.
- Cards and panels: 8px radius, 1px optical border via soft ring, almost no shadow.
- Buttons: flat, tactile, keyboard focus visible, minimum 36px height on desktop and full width on mobile where needed.
- Status tiles: left accent rule communicates state; numbers are bold but not oversized.
- Approval rows: compact two-column worklist, with decision actions always visible.
- Inputs: label above field, no floating labels, visible focus ring, stable vertical rhythm.
- Empty and blocked states: inline panels with the next concrete action, never vague "no data" language.

## 5. Layout Principles
- Primary flow: input, approval queue, execution readiness, forecast, keyword table, operations, report.
- No nested card stacks without purpose. Inner boxes are allowed only for repeated data cells or alerts.
- Desktop target: 1280px operator viewport, three-column command area.
- Tablet target: collapse inspector and input panels below approval worklist.
- Mobile target: single column, full-width buttons, no horizontal overflow except data tables.

## 6. Motion And Interaction
- Motion is restrained and functional: hover lift, tactile active press, and smooth focus transitions.
- Animate only transform, opacity, color, and shadow.
- Honor reduced motion preferences.
- Avoid decorative motion that slows scanning during repetitive setup work.

## 7. Anti-Patterns
- No generic SaaS landing hero inside the app.
- No neon gradients, glow effects, or large purple-blue decorative backgrounds.
- No pure black (#000000).
- No fake startup names, fake avatars, or filler screenshots.
- No excessive pills or decorative system labels.
- No live ad activation affordance until production policy explicitly allows it.
