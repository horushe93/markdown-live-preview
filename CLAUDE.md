# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Commands

- `npm run dev` — Start Vite dev server with HMR
- `npm run build` — Production build to `dist/`
- `npm run preview` — Preview production build locally
- `npm run serve-dist` — Serve `dist/` on port 5001 via http-server
- `npm run build-and-serve` — Build then serve
- `make deploy` — Deploy `dist/` to Firebase Hosting

## Architecture

This is a zero-framework vanilla JS application. There is a single source file:

- `src/main.js` — All application logic (~670 lines). No modules, no components. One `init()` function called on `window.load`.

### Application flow

1. Monaco Editor is created in `#editor` (left pane) with Markdown language mode
2. On each keystroke, `convert()` parses Markdown via **marked**, sanitizes via **DOMPurify**, and injects HTML into `#output` (right pane)
3. If the output contains `<pre class="mermaid">` blocks, `renderMermaidDiagrams()` renders them to SVG using **mermaid** after a 150ms debounce
4. A draggable `#split-divider` resizes the two panes; double-click resets to 50/50

### Key libraries

- **monaco-editor** — Loaded from jsdelivr CDN as ES module (not bundled). Worker is stubbed via `Proxy` to avoid extra network requests
- **marked** — Markdown → HTML. Custom renderer intercepts ` ```mermaid ` code blocks and outputs `<pre class="mermaid">` placeholders instead of highlighted code
- **mermaid** — Renders Mermaid diagram source to SVG. Theme matches page theme (light/dark). Version-based cancellation prevents stale async renders from overwriting newer ones
- **DOMPurify** — Sanitizes marked output before injection
- **github-markdown-css** — Provides GitHub-flavored Markdown styling. Light and dark CSS files are swapped at runtime via `<link id="gh-markdown-link">` href changes
- **storehouse-js** — localStorage wrapper with expiration. Persists editor content, scroll-sync preference, and theme preference
- **html2pdf.js** — PDF export (loaded via CDN). Forces light theme during export for print-friendly output

### State persistence

Three keys stored via Storehouse-js under namespace `com.markdownlivepreview`:
- `last_state` — Editor content
- `scroll_bar_settings` — Scroll sync checkbox state
- `theme_settings` — Dark mode checkbox state

A separate raw `localStorage` key `com.markdownlivepreview_theme` is used for the inline `<script>` in `<head>` that applies the theme before page paint (flash prevention).

### Theme system

- `data-theme` attribute on `<html>` drives CSS (light vs dark)
- Monaco theme (`vs` / `vs-dark`) and preview CSS (github-markdown-css variant) switch in sync
- Boot script in `<head>` reads `localStorage` directly to set `data-theme` before first paint

### Mermaid rendering

- Debounced at 150ms to avoid re-rendering on every keystroke
- Uses a monotonically increasing `mermaidRenderVersion` counter — if a new parse arrives while async renders are in flight, stale renders are silently discarded
- PDF export temporarily forces light Mermaid theme, then restores dark if needed

### PDF export flow

1. Force-render Mermaid diagrams with light theme
2. Fetch light github-markdown-css text content
3. Clone the preview DOM via html2canvas `onclone` callback, injecting light styles
4. Render to A4 PDF
5. Restore dark Mermaid diagrams if the page was in dark mode

### Static assets

- `public/css/style.css` — Application layout and dark theme overrides
- `public/css/github-markdown-*.css` — Three github-markdown-css variants (light, dark, dark_dimmed)
