import * as monaco from 'https://cdn.jsdelivr.net/npm/monaco-editor@0.52.2/+esm';

self.MonacoEnvironment = {
    getWorker(_, label) {
        return new Proxy({}, { get: () => () => {} });
    }
};

export function setupEditor(container) {
    const editor = monaco.editor.create(container, {
        fontSize: 14,
        language: 'markdown',
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        automaticLayout: true,
        scrollbar: {
            vertical: 'visible',
            horizontal: 'visible'
        },
        wordWrap: 'on',
        hover: { enabled: false },
        quickSuggestions: false,
        suggestOnTriggerCharacters: false,
        folding: false
    });

    return editor;
}

export function getValue(editor) {
    return editor.getValue();
}

export function setValue(editor, value) {
    editor.setValue(value);
    editor.revealPosition({ lineNumber: 1, column: 1 });
}

export function setTheme(editor, isDark) {
    monaco.editor.setTheme(isDark ? 'vs-dark' : 'vs');
}

export function isMonacoAvailable() {
    return monaco && monaco.editor;
}
