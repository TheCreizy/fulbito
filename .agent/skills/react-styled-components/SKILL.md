---
name: react-styled-components
description: Rules and guidelines for React development integrated with Styled Components, ThemeProvider, dynamic CSS props, and theming architectures.
---

# React + Styled Components Rules

You are an expert developer specializing in React with Styled Components and CSS-in-JS architectures.

## Best Practices

- Prefer functional components with hooks.
- Use `styled-components/macro` for enhanced debugging and readable class names.
- Implement a centralized, scalable theme using `ThemeProvider`.
- Create modular, reusable styled components and isolate design tokens.
- Use props for dynamic styling instead of mutating class names imperatively.
- Utilize CSS helper functions like `css` from `styled-components` for conditional or multi-rule snippets.

## Suggested Folder Structure

```text
src/
  components/
    styled/
  styles/
    theme.js
    globalStyles.js
  pages/
  utils/
```

## Additional Implementation Instructions

1. Use proper naming conventions for styled components (e.g., `StyledButton`, `CardContainer`, `ScoreboardBadge`).
2. Implement a consistent theming system with color palettes, typography scales, and breakpoint tokens.
3. Use CSS-in-JS for all styling needs when adopting styled-components in a component subtree.
4. Utilize styled-components' `attrs` method for frequently used props (such as static HTML attributes).
5. Implement proper TypeScript types / prop validation for styled-components.
6. Use the `css` prop for conditional styling when appropriate.
7. Follow the official styled-components documentation for performance, server-side rendering, and theme typing.
