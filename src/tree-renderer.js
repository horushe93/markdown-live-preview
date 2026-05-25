import Sortable from 'sortablejs';
import { createElement } from 'lucide';
import { File, Folder, FolderOpen } from 'lucide';

const expandedDirs = new Set();

function createIcon(icon) {
    const svg = createElement(icon);
    svg.classList.add('sidebar-tree__icon');
    return svg;
}

function createRow(node) {
    const row = document.createElement('div');
    row.classList.add('sidebar-tree__row');

    const iconWrap = document.createElement('span');
    iconWrap.classList.add('sidebar-tree__icon-wrap');

    if (node.type === 'directory') {
        const isExpanded = expandedDirs.has(node.id);
        iconWrap.appendChild(createIcon(isExpanded ? FolderOpen : Folder));
    } else {
        iconWrap.appendChild(createIcon(File));
    }

    const nameSpan = document.createElement('span');
    nameSpan.classList.add('sidebar-tree__name');
    nameSpan.textContent = node.name;

    row.appendChild(iconWrap);
    row.appendChild(nameSpan);
    return row;
}

function renderNode(node, state, callbacks) {
    const li = document.createElement('li');
    li.classList.add('sidebar-tree__item');
    li.dataset.id = node.id;

    if (node.type === 'directory') {
        li.classList.add('sidebar-tree__item--dir');
    } else {
        li.classList.add('sidebar-tree__item--file');
    }

    const isActive = node.type === 'file'
        ? node.id === state.activeFileId
        : node.id === state.contextDirId;
    if (isActive) {
        li.classList.add('sidebar-tree__item--active');
    }

    const row = createRow(node);
    li.appendChild(row);

    if (node.type === 'directory') {
        const isExpanded = expandedDirs.has(node.id);

        const childUl = document.createElement('ul');
        childUl.classList.add('sidebar-tree__list');
        childUl.dataset.parentId = node.id;
        childUl.style.display = isExpanded ? '' : 'none';

        node.children.forEach(id => {
            const child = state.nodes[id];
            if (child) childUl.appendChild(renderNode(child, state, callbacks));
        });

        if (node.children.length === 0) {
            childUl.classList.add('sidebar-tree__list--empty');
        }

        li.appendChild(childUl);
    }

    return li;
}

function collectSortables(container, state, callbacks) {
    const lists = container.querySelectorAll('.sidebar-tree__list');
    const sortables = [];

    lists.forEach(ul => {
        const sortable = new Sortable(ul, {
            group: {
                name: 'sidebar-tree',
                pull: true,
                put: function (to) {
                    const targetParentId = to.el.dataset.parentId || null;
                    return targetParentId !== '' || true;
                }
            },
            animation: 150,
            fallbackOnBody: true,
            swapThreshold: 0.65,
            onEnd: function () {
                setTimeout(() => {
                    syncStateFromDOM(container, state, callbacks);
                }, 0);
            }
        });
        sortables.push(sortable);
    });

    return sortables;
}

function syncStateFromDOM(container, state, callbacks) {
    const rootUl = container.querySelector('.sidebar-tree__list[data-parent-id=""]');
    if (!rootUl) return;

    const collected = collectFromDOM(rootUl, null);
    state.rootChildren = collected.children;

    Object.keys(state.nodes).forEach(id => {
        if (!collected.found.has(id)) {
            delete state.nodes[id];
        }
    });

    collected.found.forEach(id => {
        const node = state.nodes[id];
        if (!node) return;
        const domInfo = collected.nodeInfo[id];
        if (!domInfo) return;
        node.parentId = domInfo.parentId;
        node.children = domInfo.children;
    });

    if (callbacks.onTreeMutated) {
        callbacks.onTreeMutated(state);
    }
}

function collectFromDOM(ul, parentId) {
    const children = [];
    const found = new Set();
    const nodeInfo = {};

    Array.from(ul.children).forEach(li => {
        const id = li.dataset.id;
        if (!id) return;
        children.push(id);
        found.add(id);

        const childUl = li.querySelector(':scope > .sidebar-tree__list');
        if (childUl) {
            const result = collectFromDOM(childUl, id);
            result.found.forEach(fid => found.add(fid));
            Object.assign(nodeInfo, result.nodeInfo);
            nodeInfo[id] = {
                parentId: parentId,
                children: result.children
            };
        } else {
            nodeInfo[id] = {
                parentId: parentId,
                children: []
            };
        }
    });

    return { children, found, nodeInfo };
}

export function renderTree(container, state, callbacks) {
    const oldSortables = container._sortables || [];
    oldSortables.forEach(s => s.destroy());

    if (container._clickHandler) {
        container.removeEventListener('click', container._clickHandler);
    }
    if (container._dblClickHandler) {
        container.removeEventListener('dblclick', container._dblClickHandler);
    }
    if (container._contextMenuHandler) {
        container.removeEventListener('contextmenu', container._contextMenuHandler);
    }

    container.innerHTML = '';

    const rootUl = document.createElement('ul');
    rootUl.classList.add('sidebar-tree__list');
    rootUl.dataset.parentId = '';

    state.rootChildren.forEach(id => {
        const child = state.nodes[id];
        if (child) rootUl.appendChild(renderNode(child, state, callbacks));
    });

    if (state.rootChildren.length === 0) {
        rootUl.classList.add('sidebar-tree__list--empty');
    }

    container.appendChild(rootUl);

    container._sortables = collectSortables(container, state, callbacks);

    const clickHandler = (e) => {
        const row = e.target.closest('.sidebar-tree__row');
        if (!row) return;
        const li = row.closest('.sidebar-tree__item');
        if (!li) return;
        const nodeId = li.dataset.id;
        const node = state.nodes[nodeId];
        if (!node) return;

        if (node.type === 'directory') {
            if (expandedDirs.has(nodeId)) {
                expandedDirs.delete(nodeId);
            } else {
                expandedDirs.add(nodeId);
            }
            if (callbacks.onDirSelect) callbacks.onDirSelect(nodeId);
            if (callbacks.onToggle) callbacks.onToggle(nodeId);
        }

        if (node.type === 'file' && callbacks.onSelect) {
            callbacks.onSelect(nodeId);
        }
    };

    const dblClickHandler = (e) => {
        const row = e.target.closest('.sidebar-tree__row');
        if (!row) return;
        const li = row.closest('.sidebar-tree__item');
        if (!li) return;
        const nodeId = li.dataset.id;
        if (callbacks.onRename) callbacks.onRename(nodeId);
    };

    const contextMenuHandler = (e) => {
        const row = e.target.closest('.sidebar-tree__row');
        if (!row) return;
        const li = row.closest('.sidebar-tree__item');
        if (!li) return;
        e.preventDefault();
        const nodeId = li.dataset.id;
        if (callbacks.onContextMenu) {
            callbacks.onContextMenu(nodeId, e.clientX, e.clientY);
        }
    };

    container.addEventListener('click', clickHandler);
    container.addEventListener('dblclick', dblClickHandler);
    container.addEventListener('contextmenu', contextMenuHandler);

    container._clickHandler = clickHandler;
    container._dblClickHandler = dblClickHandler;
    container._contextMenuHandler = contextMenuHandler;
}

export function isDirExpanded(id) {
    return expandedDirs.has(id);
}

export function expandAll(state) {
    Object.values(state.nodes).forEach(node => {
        if (node.type === 'directory') {
            expandedDirs.add(node.id);
        }
    });
}

export function collapseAll(state) {
    expandedDirs.clear();
}

export function allExpanded(state) {
    const dirs = Object.values(state.nodes).filter(n => n.type === 'directory');
    return dirs.every(d => expandedDirs.has(d.id));
}

export function expandDirRecursive(dirId, state) {
    const dir = state.nodes[dirId];
    if (!dir || dir.type !== 'directory') return;
    expandedDirs.add(dirId);
    dir.children.forEach(childId => {
        expandDirRecursive(childId, state);
    });
}

export function collapseDirRecursive(dirId, state) {
    const dir = state.nodes[dirId];
    if (!dir || dir.type !== 'directory') return;
    expandedDirs.delete(dirId);
    dir.children.forEach(childId => {
        collapseDirRecursive(childId, state);
    });
}
