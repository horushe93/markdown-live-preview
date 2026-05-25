import { createIcons, FilePlus, FolderPlus, FolderSync, FileText, Pencil, Trash2, ChevronsDownUp, ChevronsUpDown } from 'lucide';
import { showContextMenu } from './context-menu';
import { createFile, createDirectory, deleteNode, renameNode, setActiveFile, getUniqueName, saveFileSystem } from './storage';
import { renderTree, expandAll, collapseAll, allExpanded, isDirExpanded, expandDirRecursive, collapseDirRecursive } from './tree-renderer';
import { SELECTORS } from './constants';

let currentState = null;
let onFileSelectCallback = null;
let onTreeChangeCallback = null;

function initButtons() {
    createIcons({
        icons: { FilePlus, FolderPlus, FolderSync },
        root: document.querySelector(SELECTORS.sidebar)
    });
}

function refreshTree() {
    const container = document.querySelector(SELECTORS.sidebarTree);
    if (!container) return;

    renderTree(container, currentState, {
        onSelect(id) {
            if (currentState.activeFileId === id) return;
            if (onFileSelectCallback) {
                onFileSelectCallback(id, currentState);
            }
            setActiveFile(currentState, id);
            currentState.contextDirId = currentState.nodes[id]?.parentId || null;
            refreshTree();
        },
        onDirSelect(dirId) {
            currentState.contextDirId = dirId;
            refreshTree();
        },
        onToggle() {
            refreshTree();
        },
        onTreeMutated(state) {
            currentState = state;
            saveFileSystem(currentState);
            refreshTree();
            if (onTreeChangeCallback) onTreeChangeCallback(currentState);
        },
        onRename(id) {
            startRename(id);
        },
        onContextMenu(nodeId, x, y) {
            handleContextMenu(nodeId, x, y);
        }
    });
}

function handleNewFile() {
    const parentId = getTargetParentId();
    const name = getUniqueName(currentState, parentId, 'Untitled.md');
    const node = createFile(currentState, parentId, name);
    saveFileSystem(currentState);

    if (onFileSelectCallback) {
        onFileSelectCallback(node.id, currentState);
    }
    setActiveFile(currentState, node.id);
    currentState.contextDirId = parentId;
    refreshTree();
    if (onTreeChangeCallback) onTreeChangeCallback(currentState);
}

function handleNewFolder() {
    const parentId = getTargetParentId();
    const name = getUniqueName(currentState, parentId, 'New Folder');
    createDirectory(currentState, parentId, name);
    saveFileSystem(currentState);
    refreshTree();
    if (onTreeChangeCallback) onTreeChangeCallback(currentState);
}

function handleToggleAll() {
    if (allExpanded(currentState)) {
        collapseAll(currentState);
    } else {
        expandAll(currentState);
    }
    refreshTree();
}

function getTargetParentId() {
    if (currentState.contextDirId) {
        const dir = currentState.nodes[currentState.contextDirId];
        if (dir && dir.type === 'directory') return currentState.contextDirId;
    }
    const activeFile = currentState.activeFileId
        ? currentState.nodes[currentState.activeFileId]
        : null;
    if (activeFile && activeFile.parentId) return activeFile.parentId;
    return null;
}

function startRename(id) {
    const container = document.querySelector(SELECTORS.sidebarTree);
    const li = container.querySelector(`[data-id="${id}"]`);
    if (!li) return;
    const nameSpan = li.querySelector('.sidebar-tree__name');
    if (!nameSpan) return;
    const node = currentState.nodes[id];
    if (!node) return;

    const input = document.createElement('input');
    input.type = 'text';
    input.classList.add('sidebar-tree__rename-input');
    input.value = node.name;

    if (node.type === 'file') {
        const dotIdx = node.name.lastIndexOf('.');
        if (dotIdx > 0) {
            input.setSelectionRange(0, dotIdx);
        } else {
            input.select();
        }
    } else {
        input.select();
    }

    nameSpan.replaceWith(input);
    input.focus();

    const finish = () => {
        const newName = input.value.trim();
        input.replaceWith(nameSpan);
        if (newName && newName !== node.name) {
            const parentId = node.parentId;
            const uniqueName = getUniqueName(currentState, parentId, newName);
            renameNode(currentState, id, uniqueName);
            saveFileSystem(currentState);
            refreshTree();
            if (onTreeChangeCallback) onTreeChangeCallback(currentState);
        } else {
            nameSpan.textContent = node.name;
        }
    };

    input.addEventListener('blur', finish);
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        } else if (e.key === 'Escape') {
            nameSpan.textContent = node.name;
            input.replaceWith(nameSpan);
        }
    });
}

// ----- Context menu -----

function getTheme() {
    return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

async function handleContextMenu(nodeId, x, y) {
    const node = currentState.nodes[nodeId];
    if (!node) return;

    const items = node.type === 'directory'
        ? buildDirMenuItems(node)
        : buildFileMenuItems(node);

    const key = await showContextMenu(x, y, items, getTheme());
    if (!key) return;

    switch (key) {
        case 'open':
            if (onFileSelectCallback) onFileSelectCallback(nodeId, currentState);
            setActiveFile(currentState, nodeId);
            currentState.contextDirId = node.parentId;
            saveFileSystem(currentState);
            refreshTree();
            break;
        case 'rename':
            startRename(nodeId);
            break;
        case 'new-file': {
            const parentId = node.type === 'directory' ? nodeId : node.parentId;
            const name = getUniqueName(currentState, parentId, 'Untitled.md');
            const newNode = createFile(currentState, parentId, name);
            saveFileSystem(currentState);
            if (onFileSelectCallback) onFileSelectCallback(newNode.id, currentState);
            setActiveFile(currentState, newNode.id);
            currentState.contextDirId = parentId;
            refreshTree();
            if (onTreeChangeCallback) onTreeChangeCallback(currentState);
            break;
        }
        case 'new-folder': {
            const parentId = node.type === 'directory' ? nodeId : node.parentId;
            const name = getUniqueName(currentState, parentId, 'New Folder');
            createDirectory(currentState, parentId, name);
            saveFileSystem(currentState);
            refreshTree();
            if (onTreeChangeCallback) onTreeChangeCallback(currentState);
            break;
        }
        case 'expand-all':
            expandDirRecursive(nodeId, currentState);
            refreshTree();
            break;
        case 'collapse-all':
            collapseDirRecursive(nodeId, currentState);
            refreshTree();
            break;
        case 'delete': {
            const isOpenFile = node.type === 'file' && currentState.activeFileId === nodeId;
            let nextFile = null;
            if (isOpenFile) {
                const allFiles = Object.values(currentState.nodes).filter(
                    n => n.type === 'file' && n.id !== nodeId
                );
                if (allFiles.length > 0) nextFile = allFiles[0].id;
            }
            deleteNode(currentState, nodeId);
            if (isOpenFile) {
                currentState.contextDirId = nextFile
                    ? currentState.nodes[nextFile]?.parentId || null
                    : null;
            }
            saveFileSystem(currentState);
            if (isOpenFile && onFileSelectCallback && nextFile) {
                onFileSelectCallback(nextFile, currentState);
            }
            refreshTree();
            if (onTreeChangeCallback) onTreeChangeCallback(currentState);
            break;
        }
    }
}

function buildFileMenuItems(node) {
    const items = [];
    const isActive = node.id === currentState.activeFileId;

    if (!isActive) {
        items.push({ key: 'open', label: 'Open', icon: FileText });
    }
    items.push({ key: 'rename', label: 'Rename', icon: Pencil });
    items.push({ key: 'new-file', label: 'New File', icon: FilePlus });
    items.push({ key: 'new-folder', label: 'New Folder', icon: FolderPlus });
    items.push({ key: 'delete', label: 'Delete', icon: Trash2, danger: true });

    return items;
}

function buildDirMenuItems(node) {
    const items = [];

    items.push({ key: 'new-file', label: 'New File', icon: FilePlus });
    items.push({ key: 'new-folder', label: 'New Folder', icon: FolderPlus });
    items.push({ key: 'rename', label: 'Rename', icon: Pencil });

    if (node.children.length > 0) {
        const allExp = allChildrenExpanded(node);
        const anyExp = node.children.some(id => {
            const child = currentState.nodes[id];
            return child && child.type === 'directory' && isDirExpanded(id);
        });
        if (!allExp) {
            items.push({ key: 'expand-all', label: 'Expand All', icon: ChevronsDownUp });
        }
        if (anyExp) {
            items.push({ key: 'collapse-all', label: 'Collapse All', icon: ChevronsUpDown });
        }
    }

    items.push({ key: 'delete', label: 'Delete', icon: Trash2, danger: true });

    return items;
}

function allChildrenExpanded(node) {
    return node.children.every(id => {
        const child = currentState.nodes[id];
        if (!child) return true;
        if (child.type === 'file') return true;
        return isDirExpanded(id) && allChildrenExpanded(child);
    });
}

// ----- Keyboard -----

function handleKeydown(e) {
    const activeId = currentState.activeFileId;
    if (!activeId) return;

    const node = currentState.nodes[activeId];
    if (!node) return;

    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (document.activeElement && document.activeElement.closest('.sidebar-tree__rename-input')) return;
        if (document.activeElement && document.activeElement.closest('.monaco-editor')) return;

        const siblings = node.parentId === null
            ? currentState.rootChildren
            : currentState.nodes[node.parentId]?.children || [];

        if (siblings.length <= 1 && node.parentId === null) {
            return;
        }

        let nextFile = null;
        const allFiles = Object.values(currentState.nodes).filter(n => n.type === 'file' && n.id !== node.id);
        if (allFiles.length > 0) {
            nextFile = allFiles[0].id;
        }

        deleteNode(currentState, activeId);
        currentState.contextDirId = nextFile
            ? currentState.nodes[nextFile]?.parentId || null
            : null;
        saveFileSystem(currentState);
        if (onFileSelectCallback && nextFile) onFileSelectCallback(nextFile, currentState);
        refreshTree();
        if (onTreeChangeCallback) onTreeChangeCallback(currentState);
    }
}

// ----- Init -----

export function initSidebar(state, callbacks) {
    currentState = state;
    onFileSelectCallback = callbacks.onFileSelect || null;
    onTreeChangeCallback = callbacks.onTreeChange || null;

    if (currentState.contextDirId === undefined) {
        currentState.contextDirId = null;
    }

    initButtons();

    document.querySelector(SELECTORS.btnNewFile).addEventListener('click', handleNewFile);
    document.querySelector(SELECTORS.btnNewFolder).addEventListener('click', handleNewFolder);
    document.querySelector(SELECTORS.btnToggleAll).addEventListener('click', handleToggleAll);

    document.addEventListener('keydown', handleKeydown);

    collapseAll(state);
    refreshTree();
}

export function updateState(state) {
    currentState = state;
}

export function refreshSidebar(state) {
    currentState = state;
    refreshTree();
}
