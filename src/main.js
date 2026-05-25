import Storehouse from 'storehouse-js';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import mermaid from 'mermaid';
import { setupEditor, getValue, setValue, setTheme, isMonacoAvailable } from './editor';
import { loadFileSystem, saveFileSystem, updateFileContent, getActiveFile } from './storage';
import { initSidebar, updateState, refreshSidebar } from './sidebar';
import { WELCOME_FILE_ID, DEFAULT_MARKDOWN } from './constants';

const init = async () => {
    let hasEdited = false;
    let scrollBarSync = false;

    const localStorageNamespace = 'com.markdownlivepreview';
    const localStorageScrollBarKey = 'scroll_bar_settings';
    const localStorageThemeKey = 'theme_settings';
    const confirmationMessage = 'Are you sure you want to reset? Your changes will be lost.';
    let mermaidRenderTimer = null;
    let mermaidRenderVersion = 0;

    let escapeHtml = (value) => {
        return value
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    };

    let createMarkedRenderer = () => {
        const renderer = new marked.Renderer();
        const renderCode = renderer.code.bind(renderer);

        renderer.code = (token) => {
            const lang = (token.lang || '').match(/^\S*/)?.[0].toLowerCase();
            if (lang !== 'mermaid') {
                return renderCode(token);
            }
            return `<pre class="mermaid">${escapeHtml(token.text)}</pre>\n`;
        };

        return renderer;
    };

    let configureMermaid = (theme) => {
        mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme
        });
    };

    let showMermaidError = (element, error) => {
        const message = error && error.message ? error.message : 'Unable to render Mermaid chart.';
        element.classList.add('mermaid-error');
        element.textContent = `Mermaid render error: ${message}`;
    };

    let getMermaidTheme = () => {
        return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'default';
    };

    let renderMermaidDiagramsNow = async (theme = getMermaidTheme()) => {
        const outputElement = document.querySelector('#output');
        if (!outputElement) return;

        const version = ++mermaidRenderVersion;
        configureMermaid(theme);

        const elements = Array.from(outputElement.querySelectorAll('.mermaid'));
        for (const [index, element] of elements.entries()) {
            if (version !== mermaidRenderVersion) return;

            const source = element.dataset.mermaidSource || element.textContent;
            element.dataset.mermaidSource = source;
            element.classList.remove('mermaid-error');

            try {
                const renderId = `mermaid-${Date.now()}-${version}-${index}`;
                const { svg, bindFunctions } = await mermaid.render(renderId, source);
                if (version !== mermaidRenderVersion) return;
                element.innerHTML = svg;
                if (typeof bindFunctions === 'function') {
                    bindFunctions(element);
                }
            } catch (error) {
                showMermaidError(element, error);
            }
        }
    };

    let scheduleMermaidRender = () => {
        if (mermaidRenderTimer) clearTimeout(mermaidRenderTimer);
        mermaidRenderTimer = setTimeout(() => {
            mermaidRenderTimer = null;
            renderMermaidDiagramsNow();
        }, 150);
    };

    let renderMermaidDiagrams = (theme) => {
        if (mermaidRenderTimer) {
            clearTimeout(mermaidRenderTimer);
            mermaidRenderTimer = null;
        }
        return renderMermaidDiagramsNow(theme);
    };

    let renderer = createMarkedRenderer();

    let convert = (markdown) => {
        let options = {
            headerIds: false,
            mangle: false,
            renderer
        };
        let html = marked.parse(markdown, options);
        let sanitized = DOMPurify.sanitize(html);
        document.querySelector('#output').innerHTML = sanitized;
        scheduleMermaidRender();
    };

    // ----- File system state -----
    let fileState = await loadFileSystem();
    let saveTimer = null;

    let saveCurrentFile = () => {
        const activeFile = getActiveFile(fileState);
        if (!activeFile) return;
        const content = getValue(editor);
        updateFileContent(fileState, activeFile.id, content);
        scheduleSave();
    };

    let scheduleSave = () => {
        if (saveTimer) clearTimeout(saveTimer);
        saveTimer = setTimeout(() => {
            saveTimer = null;
            saveFileSystem(fileState);
        }, 300);
    };

    let loadFileContent = () => {
        const activeFile = getActiveFile(fileState);
        const content = activeFile ? activeFile.content : '';
        setValue(editor, content);
        convert(content);
        hasEdited = false;
    };

    // ----- Editor setup -----
    let editor = setupEditor(document.querySelector('#editor'));

    editor.onDidChangeModelContent(() => {
        hasEdited = true;
        let value = getValue(editor);
        convert(value);
        const activeFile = getActiveFile(fileState);
        if (activeFile) {
            updateFileContent(fileState, activeFile.id, value);
            scheduleSave();
        }
    });

    editor.onDidScrollChange((e) => {
        if (!scrollBarSync) return;

        const scrollTop = e.scrollTop;
        const scrollHeight = e.scrollHeight;
        const height = editor.getLayoutInfo().height;

        const maxScrollTop = scrollHeight - height;
        const scrollRatio = scrollTop / maxScrollTop;

        let previewElement = document.querySelector('#preview');
        let targetY = (previewElement.scrollHeight - previewElement.clientHeight) * scrollRatio;
        previewElement.scrollTo(0, targetY);
    });

    // ----- Sidebar init -----
    loadFileContent();

    initSidebar(fileState, {
        onFileSelect(fileId) {
            saveCurrentFile();
            const node = fileState.nodes[fileId];
            if (!node || node.type !== 'file') return;
            fileState.activeFileId = fileId;
            loadFileContent();
            updateState(fileState);
        },
        onTreeChange(state) {
            fileState = state;
        }
    });

    // flush any pending save before page unload
    window.addEventListener('beforeunload', () => {
        saveCurrentFile();
        if (saveTimer) {
            clearTimeout(saveTimer);
            saveFileSystem(fileState);
        }
    });

    // ----- Reset button -----
    let reset = () => {
        if (hasEdited) {
            var confirmed = window.confirm(confirmationMessage);
            if (!confirmed) return;
        }
        const activeFile = getActiveFile(fileState);
        if (activeFile) {
            const resetContent = activeFile.id === WELCOME_FILE_ID ? DEFAULT_MARKDOWN : '';
            updateFileContent(fileState, activeFile.id, resetContent);
            loadFileContent();
            saveFileSystem(fileState);
        }
        document.querySelectorAll('.column').forEach((element) => {
            element.scrollTo({ top: 0 });
        });
    };

    document.querySelector("#reset-button").addEventListener('click', (event) => {
        event.preventDefault();
        reset();
    });

    // ----- Copy button -----
    let copyToClipboard = (text, successHandler, errorHandler) => {
        navigator.clipboard.writeText(text).then(
            () => { successHandler(); },
            () => { errorHandler(); }
        );
    };

    let notifyCopied = () => {
        let labelElement = document.querySelector("#copy-button a");
        labelElement.innerHTML = "Copied!";
        setTimeout(() => {
            labelElement.innerHTML = "Copy";
        }, 1000);
    };

    document.querySelector("#copy-button").addEventListener('click', (event) => {
        event.preventDefault();
        let value = getValue(editor);
        copyToClipboard(value, () => {
            notifyCopied();
        }, () => {});
    });

    // ----- Export PDF -----
    const PREVIEW_CSS_LIGHT = 'css/github-markdown-light.css?v=1.11.0';
    const PREVIEW_CSS_DARK = 'css/github-markdown-dark_dimmed.css?v=1.11.0';

    let exportLightCssPromise = null;

    let getLightMarkdownCss = () => {
        if (exportLightCssPromise) return exportLightCssPromise;
        exportLightCssPromise = fetch(PREVIEW_CSS_LIGHT)
            .then((response) => {
                if (!response.ok) throw new Error(`Failed to load export CSS: ${response.status}`);
                return response.text();
            })
            .catch((error) => {
                console.error('Failed to load light markdown CSS', error);
                return '';
            });
        return exportLightCssPromise;
    };

    let exportPreviewToPdf = () => {
        const previewElement = document.querySelector('#preview-wrapper');
        if (!previewElement) return;

        if (typeof window.html2pdf !== 'function') {
            window.alert('PDF export is not available yet. Please try again in a moment.');
            return;
        }

        const restoreDarkMermaid = getMermaidTheme() === 'dark';

        renderMermaidDiagrams('default').then(() => getLightMarkdownCss()).then((lightCss) => {
            const options = {
                margin: 10,
                filename: 'markdown-preview.pdf',
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: {
                    scale: 2,
                    useCORS: true,
                    onclone: (clonedDoc) => {
                        clonedDoc.documentElement.setAttribute('data-theme', 'light');

                        const markdownLink = clonedDoc.getElementById('gh-markdown-link');
                        if (markdownLink) {
                            markdownLink.setAttribute('href', PREVIEW_CSS_LIGHT);
                        }

                        if (lightCss) {
                            const style = clonedDoc.createElement('style');
                            style.id = 'export-light-css';
                            style.textContent = `${lightCss}
#preview-wrapper, #output, body {
  background: #fff !important;
  color: #24292f !important;
}`;
                            clonedDoc.head.appendChild(style);
                        }

                        const clonedPreview = clonedDoc.getElementById('preview-wrapper');
                        if (clonedPreview) {
                            clonedPreview.style.background = '#fff';
                            clonedPreview.style.color = '#24292f';
                            clonedPreview.style.width = '190mm';
                            clonedPreview.style.maxWidth = '190mm';
                        }

                        const clonedOutput = clonedDoc.getElementById('output');
                        if (clonedOutput) {
                            clonedOutput.style.background = '#fff';
                            clonedOutput.style.color = '#24292f';
                            clonedOutput.style.width = '190mm';
                            clonedOutput.style.maxWidth = '190mm';
                        }
                    }
                },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            window.html2pdf()
                .set(options)
                .from(previewElement)
                .save()
                .catch((error) => {
                    console.error('Failed to export PDF', error);
                })
                .finally(() => {
                    if (restoreDarkMermaid) {
                        renderMermaidDiagrams();
                    }
                });
        });
    };

    document.querySelector('#export-button').addEventListener('click', (event) => {
        event.preventDefault();
        exportPreviewToPdf();
    });

    // ----- Scroll sync -----
    let initScrollBarSync = (settings) => {
        let checkbox = document.querySelector('#sync-scroll-checkbox');
        checkbox.checked = settings;
        scrollBarSync = settings;

        checkbox.addEventListener('change', (event) => {
            let checked = event.currentTarget.checked;
            scrollBarSync = checked;
            saveScrollBarSettings(checked);
        });
    };

    // ----- Preview CSS -----
    let setPreviewCss = (useDark) => {
        const link = document.getElementById('gh-markdown-link');
        if (!link) {
            const newLink = document.createElement('link');
            newLink.id = 'gh-markdown-link';
            newLink.rel = 'stylesheet';
            newLink.href = useDark ? PREVIEW_CSS_DARK : PREVIEW_CSS_LIGHT;
            document.head.appendChild(newLink);
            return;
        }
        const desired = useDark ? PREVIEW_CSS_DARK : PREVIEW_CSS_LIGHT;
        if (link.getAttribute('href') !== desired) {
            link.setAttribute('href', desired);
        }
    };

    // ----- Theme toggle -----
    let setPageTheme = (enabled) => {
        document.documentElement.setAttribute('data-theme', enabled ? 'dark' : 'light');
    };

    let initThemeToggle = (settings) => {
        let checkbox = document.querySelector('#theme-checkbox');
        if (!checkbox) return;
        checkbox.checked = settings;
        setPageTheme(settings);

        if (isMonacoAvailable()) {
            setTheme(editor, settings);
        }
        setPreviewCss(settings);

        checkbox.addEventListener('change', (event) => {
            let checked = event.currentTarget.checked;
            setPageTheme(checked);
            saveThemeSettings(checked);
            setPreviewCss(checked);
            if (isMonacoAvailable()) {
                setTheme(editor, checked);
            }
            renderMermaidDiagrams();
        });
    };

    // ----- Local state (theme & scroll sync) -----
    let loadScrollBarSettings = () => {
        return Storehouse.getItem(localStorageNamespace, localStorageScrollBarKey);
    };

    let loadThemeSettings = () => {
        let last = Storehouse.getItem(localStorageNamespace, localStorageThemeKey);
        if (last === null || last === undefined) {
            try {
                const raw = localStorage.getItem('theme');
                if (raw === 'dark') return true;
                if (raw === 'light') return false;
            } catch (e) { /* ignore */ }
        }
        return last;
    };

    let saveScrollBarSettings = (settings) => {
        let expiredAt = new Date(2099, 1, 1);
        Storehouse.setItem(localStorageNamespace, localStorageScrollBarKey, settings, expiredAt);
    };

    let saveThemeSettings = (settings) => {
        let expiredAt = new Date(2099, 1, 1);
        Storehouse.setItem(localStorageNamespace, localStorageThemeKey, settings, expiredAt);
        try {
            localStorage.setItem('theme', settings ? 'dark' : 'light');
        } catch (e) { /* ignore storage errors */ }
    };

    // ----- Split divider -----
    let setupDivider = () => {
        let lastLeftRatio = 0.5;
        const divider = document.getElementById('split-divider');
        const leftPane = document.getElementById('edit');
        const rightPane = document.getElementById('preview');
        const container = document.getElementById('container');

        let isDragging = false;

        divider.addEventListener('mouseenter', () => {
            divider.classList.add('hover');
        });

        divider.addEventListener('mouseleave', () => {
            if (!isDragging) divider.classList.remove('hover');
        });

        divider.addEventListener('mousedown', () => {
            isDragging = true;
            divider.classList.add('active');
            document.body.style.cursor = 'col-resize';
        });

        divider.addEventListener('dblclick', () => {
            const containerRect = container.getBoundingClientRect();
            const totalWidth = containerRect.width;
            const dividerWidth = divider.offsetWidth;
            const halfWidth = (totalWidth - dividerWidth) / 2;

            leftPane.style.width = halfWidth + 'px';
            rightPane.style.width = halfWidth + 'px';
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            document.body.style.userSelect = 'none';
            const containerRect = container.getBoundingClientRect();
            const totalWidth = containerRect.width;
            const offsetX = e.clientX - containerRect.left;
            const dividerWidth = divider.offsetWidth;

            const minWidth = 100;
            const maxWidth = totalWidth - minWidth - dividerWidth;
            const leftWidth = Math.max(minWidth, Math.min(offsetX, maxWidth));
            leftPane.style.width = leftWidth + 'px';
            rightPane.style.width = (totalWidth - leftWidth - dividerWidth) + 'px';
            lastLeftRatio = leftWidth / (totalWidth - dividerWidth);
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                divider.classList.remove('active');
                divider.classList.remove('hover');
                document.body.style.cursor = 'default';
                document.body.style.userSelect = '';
            }
        });

        window.addEventListener('resize', () => {
            const containerRect = container.getBoundingClientRect();
            const totalWidth = containerRect.width;
            const dividerWidth = divider.offsetWidth;
            const availableWidth = totalWidth - dividerWidth;

            const newLeft = availableWidth * lastLeftRatio;
            const newRight = availableWidth * (1 - lastLeftRatio);

            leftPane.style.width = newLeft + 'px';
            rightPane.style.width = newRight + 'px';
        });
    };

    let scrollBarSettings = loadScrollBarSettings() || false;
    initScrollBarSync(scrollBarSettings);

    let themeSettings = loadThemeSettings();
    if (themeSettings === 'true' || themeSettings === true) {
        themeSettings = true;
    } else {
        themeSettings = false;
    }
    initThemeToggle(themeSettings);

    setupDivider();
};

window.addEventListener("load", () => {
    init();
});
