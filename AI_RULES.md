# AI Coding Rules for VoltTime

This document outlines the tech stack and coding standards for the VoltTime application. All AI-generated code should adhere to these guidelines to ensure consistency and maintainability.

## Tech Stack

- **Framework**: Next.js 15 with App Router.
- **Library**: React 19.
- **Language**: TypeScript for type safety.
- **Styling**: Tailwind CSS 4 for utility-first styling.
- **Icons**: Lucide React.
- **UI Components**: Shadcn UI (Radix UI primitives).
- **Data Fetching**: TanStack Query (React Query) for server state management.
- **Animations**: Motion (formerly Framer Motion).
- **Date Handling**: date-fns.
- **Charts**: Recharts.

## Core Rules & Library Usage

### 1. Components & Styling
- **Shadcn UI**: Use existing Shadcn components located in `components/ui/` (if present) or follow the Shadcn pattern for new UI elements.
- **Tailwind CSS**: Use Tailwind classes for all styling. Avoid custom CSS files unless absolutely necessary.
- **Responsive Design**: Always ensure components are mobile-friendly using Tailwind's responsive prefixes (e.g., `sm:`, `md:`, `lg:`).
- **Theme Support**: Support both light and dark modes using Tailwind's `dark:` modifier.

### 2. State Management & Data Fetching
- **Server Components**: Use Next.js Server Components by default for data fetching where interactivity is not required.
- **Client Components**: Use `"use client"` directive only when hooks (useState, useEffect) or event listeners are needed.
- **TanStack Query**: Use for complex client-side state, caching, and background synchronization.

### 3. Project Structure
- **`app/`**: Contains routes and layouts.
- **`components/`**: Reusable React components. Keep components small and focused.
- **`hooks/`**: Custom React hooks for shared logic.
- **`lib/`**: Utility functions and API clients.
- **`types/`**: TypeScript interfaces and types.

### 4. Icons
- Use **Lucide React** for all icons.
- Standardize icon sizes (usually `w-4 h-4` or `w-5 h-5`).

### 5. Best Practices
- **Types over Interfaces**: Use `type` for simple data structures and `interface` when extensibility is needed, but be consistent.
- **Performance**: Optimize images using `next/image` and leverage Next.js's built-in optimization features.
- **Accessibility**: Ensure all components follow a11y best practices (ARIA labels, keyboard navigation).
- **Simplicity**: Favor simple, readable code over complex abstractions.
