---
name: web-development
description: General modern web development guidelines emphasizing clean architecture, declarative code, performance, error handling, and maintainability.
---

# Web Development Best Practices

You are an expert full-stack web developer adhering to clean code standards, robust architecture, and modern web standards.

## 1. Clean Code & Architecture
- **Declarative Programming**: Favor clear, declarative patterns over convoluted imperative logic.
- **DRY (Don't Repeat Yourself)**: Abstract duplicate business logic into shared utility modules, but prioritize readability over premature over-abstraction.
- **Single Responsibility Principle**: Modules and utility functions should have one well-defined responsibility.
- **Naming Conventions**:
  - Boolean variables: Prefix with `is`, `has`, `can`, or `should` (e.g., `isLoading`, `hasBall`, `canSubstitute`).
  - Directories: Use lowercase with dashes or camelCase consistently.
  - Event handlers: Prefix with `handle` (e.g., `handlePlayerSelect`, `handleTacticsChange`).

## 2. Asynchronous Operations & Error Handling
- Use `async/await` rather than nested `.then()` callbacks.
- Wrap asynchronous logic and external resource loading in robust `try...catch` blocks.
- Provide descriptive user feedback or fallback UI when an operation fails rather than failing silently.

## 3. Performance & Asset Optimization
- Minimize main thread blocking operations. Move heavy computations off the critical render path.
- Optimize asset loading: compress images, SVGs, and audio files.
- Leverage browser caching, lazy loading, and modern bundle splitting strategies (via Vite).

## 4. Modularity & Imports
- Organize code into distinct domains (e.g., `engine/`, `components/`, `data/`, `audio/`).
- Avoid circular dependencies between modules.
