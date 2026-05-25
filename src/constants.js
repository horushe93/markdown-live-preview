export const DEFAULT_MARKDOWN = `# Markdown syntax guide

## Headers

# This is a Heading h1
## This is a Heading h2
###### This is a Heading h6

## Emphasis

*This text will be italic*
_This will also be italic_

**This text will be bold**
__This will also be bold__

_You **can** combine them_

## Lists

### Unordered

* Item 1
* Item 2
* Item 2a
* Item 2b
    * Item 3a
    * Item 3b

### Ordered

1. Item 1
2. Item 2
3. Item 3
    1. Item 3a
    2. Item 3b

## Images

![This is an alt text.](/image/Markdown-mark.svg "This is a sample image.")

## Links

You may be using [Markdown Live Preview](https://markdownlivepreview.com/).

## Blockquotes

> Markdown is a lightweight markup language with plain-text-formatting syntax, created in 2004 by John Gruber with Aaron Swartz.
>
>> Markdown is often used to format readme files, for writing messages in online discussion forums, and to create rich text using a plain text editor.

## Tables

| Left columns  | Right columns |
| ------------- |:-------------:|
| left foo      | right foo     |
| left bar      | right bar     |
| left baz      | right baz     |

## Blocks of code

\`\`\`
let message = 'Hello world';
alert(message);
\`\`\`

## Mermaid diagrams
\`\`\`mermaid
graph TD
  A[Start] --> B{Decision}
  B -->|Yes| C[Finish]
  B -->|No| D[Alternate]
\`\`\`

## Inline code

This web site is using \`markedjs/marked\`.
`;

export const WELCOME_FILE_ID = 'welcome';

export function createDefaultState() {
    return {
        nodes: {
            [WELCOME_FILE_ID]: {
                id: WELCOME_FILE_ID,
                name: 'Welcome.md',
                type: 'file',
                parentId: null,
                children: [],
                content: DEFAULT_MARKDOWN,
                createdAt: Date.now(),
                updatedAt: Date.now()
            }
        },
        rootChildren: [WELCOME_FILE_ID],
        activeFileId: WELCOME_FILE_ID,
        contextDirId: null
    };
}

export const STORAGE_KEY = 'filesystem:state';

export const SELECTORS = {
    sidebar: '#sidebar',
    sidebarTree: '#sidebar-tree',
    btnNewFile: '#btn-new-file',
    btnNewFolder: '#btn-new-folder',
    btnToggleAll: '#btn-toggle-all'
};

export const CSS_CLASSES = {
    treeItem: 'sidebar-tree__item',
    treeItemFile: 'sidebar-tree__item--file',
    treeItemDir: 'sidebar-tree__item--dir',
    treeItemActive: 'sidebar-tree__item--active',
    treeItemDragOver: 'sidebar-tree__item--drag-over',
    sortableGhost: 'sidebar-tree__ghost'
};
