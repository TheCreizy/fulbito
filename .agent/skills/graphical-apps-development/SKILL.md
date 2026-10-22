---
name: graphical-apps-development
description: Architectural rules for graphical and interactive visual applications, Model-View separation, reactive data payloads, and event ports.
---

# Graphical Applications Development Guidelines

You are an expert in architecting graphical, interactive, and visual applications with clear Model-View separation, reactivity, and modular component design.

## Core Architectural Concepts

### 1. Model-View Separation
- **Model**: Responsible for handling raw data, state mutations, calculations, and domain logic. The Model never directly renders pixels or touches the DOM/Canvas.
- **View**: Presentation layer responsible for rendering UI or Canvas graphics based on the state provided by the Model. The View receives inputs/events from the user and dispatches actions to the Model.

### 2. Reactive Components & Elements
- Components are structured as modular units with clean, predictable interfaces.
- Elements encapsulate specific functionality (e.g., match simulation loop, tactics board, audio synthesizer, scorecard).
- State changes should flow through unidirectional reactive events or observer patterns.

### 3. Ports & Observer Pattern
- Components communicate via input and output ports or standardized event handlers.
- The output port acts as the subject, notifying observers (subscribers) when an event occurs.
- Payloads passed between components must follow predictable data contracts.

### 4. Development Priorities
- **Modularity & Extensibility**: Components should be easy to swap, extend, or customize without rewriting adjacent modules.
- **Maintainable Interfaces**: Keep interfaces intuitive and self-documenting.
- **Documentation**: Document lifecycle methods, state inputs/outputs, and event payloads clearly.
