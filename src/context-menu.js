import { createElement } from 'lucide';

let activeMenu = null;
let activeResolve = null;

function dismiss() {
    if (!activeMenu) return;
    activeMenu.remove();
    activeMenu = null;
    if (activeResolve) {
        activeResolve(null);
        activeResolve = null;
    }
}

export function showContextMenu(x, y, items, theme) {
    dismiss();

    const menu = document.createElement('div');
    menu.classList.add('ctx-menu');
    if (theme === 'dark') {
        menu.classList.add('ctx-menu--dark');
    }

    items.forEach(item => {
        const menuItem = document.createElement('div');
        menuItem.classList.add('ctx-menu__item');
        if (item.disabled) {
            menuItem.classList.add('ctx-menu__item--disabled');
        }
        if (item.danger) {
            menuItem.classList.add('ctx-menu__item--danger');
        }

        const icon = createElement(item.icon);
        icon.classList.add('ctx-menu__item-icon');

        const label = document.createElement('span');
        label.classList.add('ctx-menu__item-label');
        label.textContent = item.label;

        menuItem.appendChild(icon);
        menuItem.appendChild(label);

        if (!item.disabled) {
            menuItem.addEventListener('click', (e) => {
                e.stopPropagation();
                if (activeResolve) {
                    activeResolve(item.key);
                    activeResolve = null;
                }
                dismiss();
            });
        }

        menu.appendChild(menuItem);
    });

    document.body.appendChild(menu);
    activeMenu = menu;

    const menuRect = menu.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    let left = x;
    let top = y;

    if (left + menuRect.width > vw) {
        left = x - menuRect.width;
    }
    if (top + menuRect.height > vh) {
        top = y - menuRect.height;
    }

    menu.style.left = left + 'px';
    menu.style.top = top + 'px';

    const onOutside = (e) => {
        if (!menu.contains(e.target)) {
            dismiss();
            cleanup();
        }
    };

    const onEscape = (e) => {
        if (e.key === 'Escape') {
            dismiss();
            cleanup();
        }
    };

    const onScroll = () => {
        dismiss();
        cleanup();
    };

    const cleanup = () => {
        document.removeEventListener('click', onOutside, true);
        document.removeEventListener('keydown', onEscape);
        document.querySelector('#sidebar-tree')?.removeEventListener('scroll', onScroll);
        window.removeEventListener('resize', onScroll);
    };

    setTimeout(() => {
        document.addEventListener('click', onOutside, true);
    }, 0);

    document.addEventListener('keydown', onEscape);
    document.querySelector('#sidebar-tree')?.addEventListener('scroll', onScroll);
    window.addEventListener('resize', onScroll);

    return new Promise((resolve) => {
        activeResolve = resolve;
    });
}

export function closeContextMenu() {
    dismiss();
}
