# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev     # dev server on :3000
npm run build   # production build
npm run start   # serve the build
npm run lint    # bare `eslint` (flat config, no path arg)
```

No test runner is installed.

## State

Untouched `create-next-app` scaffold: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`. Nothing app-specific has been written yet. A Django backend lives at `../backend` (sibling dir, not part of this repo).

## Next.js 16 / Tailwind 4 specifics

Read `node_modules/next/dist/docs/` before writing Next APIs — this version differs from older training data (see AGENTS.md).

- Route props come from globally-generated types, not hand-written interfaces: `LayoutProps<"/">`, `PageProps<"/path">`. Generated into `.next/types`, so `next dev`/`next build` must have run for typecheck to pass.
- Tailwind v4: no `tailwind.config.js`. Config is CSS-side in `app/globals.css` via `@import "tailwindcss"` + `@theme inline`. Theme colors/fonts are defined there.
- `@/*` maps to the repo root.
