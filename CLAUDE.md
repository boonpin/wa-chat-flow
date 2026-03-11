# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
pnpm dev        # Start dev server (http://localhost:3000)
pnpm build      # Production build
pnpm start      # Start production server
pnpm lint       # Run ESLint
```

Package manager: **pnpm** (pnpm-lock.yaml present).

## Stack

- **Next.js 16** with App Router (`app/` directory)
- **React 19**
- **TypeScript** (strict mode, path alias `@/*` maps to project root)
- **Tailwind CSS v4** (via `@tailwindcss/postcss`)
- **Geist** font family (sans + mono) loaded via `next/font/google`

## Architecture

This is a freshly bootstrapped Next.js App Router project. Entry points:

- [app/layout.tsx](app/layout.tsx) — Root layout with font setup and global metadata
- [app/page.tsx](app/page.tsx) — Home page (currently the default Create Next App starter)
- [app/globals.css](app/globals.css) — Global styles (Tailwind base)
- [next.config.ts](next.config.ts) — Next.js config
- [eslint.config.mjs](eslint.config.mjs) — ESLint flat config (extends `eslint-config-next`)
