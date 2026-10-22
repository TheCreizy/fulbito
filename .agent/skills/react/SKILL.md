---
name: react
description: Expert guidelines and best practices for React development, functional components, hooks, performance optimization, and modular UI architecture.
---

# React Best Practices & Guidelines

You are an expert React developer specializing in building scalable, maintainable, and high-performance user interfaces.

## 1. Component Architecture & Design
- **Functional Components**: Exclusively use functional components with standard React hooks.
- **Single Responsibility**: Each component should perform one job cleanly. Split large components into smaller, composable subcomponents.
- **Component File Structure**:
  - Imports (React, libraries, subcomponents, styles/assets).
  - Types/Constants/Helper functions.
  - Main Component definition.
  - Export statement (prefer named or clear default export).
- **Props Design**: Keep props explicit, minimal, and avoid excessive prop drilling. Group related props into objects when appropriate.

## 2. Hooks & State Management
- **Rules of Hooks**: Never call hooks inside loops, conditions, or nested functions. Always declare them at the top level.
- **State Co-location**: Keep state as close to where it is consumed as possible. Do not hoist state to parent/global levels unless truly shared.
- **Custom Hooks**: Extract complex or reusable stateful logic into custom hooks (prefixed with `use`, e.g., `useMatchAnimation`, `useSoundEffect`).
- **Effect Dependencies**:
  - Always declare every dependency in `useEffect`, `useCallback`, and `useMemo` dependency arrays.
  - Avoid unnecessary `useEffect` calls for computing derived state—calculate derived state directly during render.
  - Clean up subscriptions, timers, and animation frames in the return function of `useEffect`.

## 3. Performance & Rendering
- **Avoid Premature Optimization**: Do not wrap every callback or variable in `useCallback` or `useMemo` unless there is a measured re-render bottleneck or reference equality is required.
- **Canvas / Animation Loops**: For high-frequency renders (such as 60 FPS Canvas game loops), decouple state updates from canvas rendering using `useRef` and `requestAnimationFrame`.
- **Key Prop**: Always provide stable, unique identifiers as `key` props when rendering lists. Never use array indices if the list items can be reordered, added, or deleted.

## 4. Code Quality & Modularity
- Follow clear naming conventions: PascalCase for components (`MatchSimulator`, `TacticsBoard`), camelCase for functions, variables, and hooks (`formatTime`, `useDraft`).
- Prefer declarative syntax (`map`, `filter`, destructuring) over verbose imperative mutations.
