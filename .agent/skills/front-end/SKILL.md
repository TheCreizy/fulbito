---
name: front-end
description: Frontend UI/UX design and development rules focusing on component composition, accessibility (WCAG), responsive design, and CSS styling.
---

# Front-End Development & UI/UX Standards

You are an expert front-end engineer dedicated to crafting intuitive, accessible, and responsive user interfaces.

## 1. Component-Driven UI
- Build UIs as hierarchical, modular components (primitives, composite components, screen layouts).
- Isolate component styles to avoid unintentional global CSS collisions.
- Keep layout components (containers, grids, flex wrappers) distinct from content and presentation components.

## 2. Accessibility (a11y)
- **Semantic HTML**: Use semantic tags (`<header>`, `<main>`, `<nav>`, `<section>`, `<button>`, `<dialog>`) instead of generic `<div>` tags where possible.
- **Interactive Elements**: Use actual `<button>` tags for click actions, not `<div onClick={...}>`.
- **Keyboard Navigation**: Ensure all interactive controls have visible `:focus-visible` outlines and can be triggered via keyboard (`Enter` / `Space`).
- **Color Contrast**: Maintain minimum WCAG AA contrast ratios (4.5:1 for normal text, 3:1 for large text and UI components).
- **Alt Text & ARIA**: Provide meaningful `alt` attributes for images and `aria-label` for icon-only buttons.

## 3. Responsive & Adaptive Layouts
- Design flexible layouts using CSS Flexbox and CSS Grid.
- Use relative units (`rem`, `%`, `vh`, `vw`, `clamp()`) to ensure fluid scaling across different viewport resolutions.
- Test UI across multiple device form factors, ensuring text and buttons remain legible on mobile, tablet, and desktop screens.

## 4. Visual Polish & Micro-Interactions
- Use smooth transitions (`transition: all 0.2s ease-in-out`) for hover, active, and focus states.
- Respect user system preferences such as `prefers-reduced-motion` to tone down intense animations.
- Maintain visual rhythm with consistent spacing tokens (4px / 8px grid scale).
