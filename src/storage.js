import localforage from 'localforage';
import { createDefaultState, STORAGE_KEY } from './constants';

const store = localforage.createInstance({
    name: 'markdownLivePreview',
    storeName: 'filesystem'
});

export async function loadFileSystem() {
    const state = await store.getItem(STORAGE_KEY);
    if (state && state.nodes && state.rootChildren) {
        return state;
    }
    const defaultState = createDefaultState();
    await store.setItem(STORAGE_KEY, defaultState);
    return defaultState;
}

export async function saveFileSystem(state) {
    await store.setItem(STORAGE_KEY, state);
}

export function generateId() {
    return crypto.randomUUID();
}

export function createFile(state, parentId, name = 'Untitled.md') {
    const id = generateId();
    const node = {
        id,
        name,
        type: 'file',
        parentId,
        children: [],
        content: '',
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    state.nodes[id] = node;
    if (parentId === null) {
        state.rootChildren.push(id);
    } else {
        const parent = state.nodes[parentId];
        if (parent && parent.type === 'directory') {
            parent.children.push(id);
        }
    }
    return node;
}

export function createDirectory(state, parentId, name = 'New Folder') {
    const id = generateId();
    const node = {
        id,
        name,
        type: 'directory',
        parentId,
        children: [],
        content: '',
        createdAt: Date.now(),
        updatedAt: Date.now()
    };
    state.nodes[id] = node;
    if (parentId === null) {
        state.rootChildren.push(id);
    } else {
        const parent = state.nodes[parentId];
        if (parent && parent.type === 'directory') {
            parent.children.push(id);
        }
    }
    return node;
}

export function deleteNode(state, id) {
    const node = state.nodes[id];
    if (!node) return;

    if (node.type === 'directory') {
        [...node.children].forEach(childId => deleteNode(state, childId));
    }

    const siblingList = node.parentId === null
        ? state.rootChildren
        : state.nodes[node.parentId]?.children;

    if (siblingList) {
        const idx = siblingList.indexOf(id);
        if (idx !== -1) siblingList.splice(idx, 1);
    }

    delete state.nodes[id];
}

export function renameNode(state, id, newName) {
    const node = state.nodes[id];
    if (!node) return;
    node.name = newName;
    node.updatedAt = Date.now();
}

export function moveNode(state, id, newParentId, newIndex) {
    const node = state.nodes[id];
    if (!node) return;

    const oldSiblingList = node.parentId === null
        ? state.rootChildren
        : state.nodes[node.parentId]?.children;

    if (oldSiblingList) {
        const oldIdx = oldSiblingList.indexOf(id);
        if (oldIdx !== -1) oldSiblingList.splice(oldIdx, 1);
    }

    node.parentId = newParentId;
    node.updatedAt = Date.now();

    const newSiblingList = newParentId === null
        ? state.rootChildren
        : state.nodes[newParentId]?.children;

    if (newSiblingList) {
        newSiblingList.splice(newIndex, 0, id);
    }
}

export function setActiveFile(state, fileId) {
    if (fileId && state.nodes[fileId]?.type === 'file') {
        state.activeFileId = fileId;
    }
}

export function getActiveFile(state) {
    if (!state.activeFileId) return null;
    return state.nodes[state.activeFileId] || null;
}

export function updateFileContent(state, fileId, content) {
    const node = state.nodes[fileId];
    if (!node || node.type !== 'file') return;
    node.content = content;
    node.updatedAt = Date.now();
}

export function getUniqueName(state, parentId, baseName) {
    const siblingList = parentId === null
        ? state.rootChildren
        : state.nodes[parentId]?.children || [];

    const siblings = siblingList.map(id => state.nodes[id]).filter(Boolean);
    const names = new Set(siblings.map(n => n.name));

    if (!names.has(baseName)) return baseName;

    let counter = 1;
    const dotIdx = baseName.lastIndexOf('.');
    const baseWithoutExt = dotIdx > 0 ? baseName.slice(0, dotIdx) : baseName;
    const ext = dotIdx > 0 ? baseName.slice(dotIdx) : '';

    while (true) {
        const candidate = `${baseWithoutExt} (${counter})${ext}`;
        if (!names.has(candidate)) return candidate;
        counter++;
    }
}
