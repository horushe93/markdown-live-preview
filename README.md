# Markdown Live Preview

A fast, browser-based Markdown editor with live preview, multi-file management, and Mermaid diagram support. Available at [markdownlivepreview.com](https://markdownlivepreview.com/).

## Features

- **Live preview** -- Renders Markdown to HTML in real time as you type, styled with GitHub Flavored Markdown CSS.
- **Multi-file workspace** -- Create, rename, delete, and organize Markdown files and folders in a sidebar file tree. All content persists locally via IndexedDB.
- **Drag-and-drop file management** -- Reorder files and folders, or drag items between directories to reorganize your workspace.
- **Mermaid diagram rendering** -- Write Mermaid syntax in fenced code blocks to render flowcharts, sequence diagrams, Gantt charts, and more.
- **Dark mode** -- Toggle between light and dark themes with a single click. Preference is remembered across sessions.
- **PDF export** -- Export the rendered preview to a print-ready A4 PDF.
- **Synchronized scrolling** -- Optionally lock the editor and preview scroll positions for side-by-side reading.
- **Right-click context menu** -- Quick access to file and folder actions directly from the sidebar tree.
- **Keyboard shortcuts** -- Press `Delete` to remove the active file, `Enter` to confirm rename, `Escape` to cancel.
- **No sign-up, no server** -- Everything runs in your browser. Your files stay on your device.

## Quick Start

```bash
# Install dependencies
make setup

# Start the development server
make dev
```

Open `http://localhost:5173` in your browser.

## Commands

| Command | Description |
|---|---|
| `make setup` | Install npm dependencies |
| `make dev` | Start Vite dev server with hot reload |
| `make build` | Build for production to `dist/` |
| `make preview` | Preview the production build locally |
| `make serve-dist` | Serve `dist/` on port 5001 |
| `make build-serve` | Build then serve the production output |
| `make deploy` | Deploy to Firebase Hosting |

Equivalent npm scripts are also available: `npm run dev`, `npm run build`, `npm run preview`, `npm run serve-dist`, `npm run build-and-serve`.

## How It Works

The editor pane (left) uses Monaco Editor with Markdown syntax support. On each keystroke, the text is parsed by [marked](https://github.com/markedjs/marked), sanitized with [DOMPurify](https://github.com/cure53/DOMPurify), and rendered into the preview pane (right). The two panes are separated by a draggable divider.

The sidebar (far left) provides a file tree backed by [localforage](https://github.com/localForage/localForage), which stores data in IndexedDB. Files and folders are represented as a flat map of nodes with ordered child arrays, enabling efficient lookups and easy reordering. Drag-and-drop is powered by [SortableJS](https://github.com/SortableJS/Sortable).

Icons throughout the interface come from [Lucide](https://lucide.dev/).

## Tech Stack

| Layer | Library |
|---|---|
| Editor | Monaco Editor (CDN, not bundled) |
| Markdown parsing | marked |
| HTML sanitization | DOMPurify |
| Diagrams | Mermaid |
| Markdown styling | github-markdown-css |
| Drag and drop | SortableJS |
| Local storage | localforage (IndexedDB) |
| PDF export | html2pdf.js (CDN) |
| Icons | Lucide |
| Build tool | Vite |
| Deployment | Firebase Hosting |

## Project Structure

```
src/
  main.js             Application entry point
  editor.js           Monaco Editor setup and theme control
  storage.js          File system CRUD via localforage
  tree-renderer.js    Sidebar tree DOM rendering and SortableJS integration
  sidebar.js          Sidebar controller (buttons, events, context menu)
  context-menu.js     Right-click context menu UI
  constants.js        Default content, CSS selectors, default file system state
index.html            HTML shell (header, sidebar, editor, preview)
public/css/style.css  Application styles (layout, sidebar, tree, dark theme)
```

## License

See the [LICENSE](https://github.com/tanabe/markdown-live-preview/blob/master/LICENSE) file in this repository.
