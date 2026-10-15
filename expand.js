(function () {
    const FLAG = 'gaijinSummaryOpened';
    const SECTION_LABELS = [
        /списки активац/i,
        /activation lists/i,
        /вы подарили/i,
        /подарили другим/i,
        /gifted to other/i,
        /gifts to other/i,
        /прочие покупки/i,
        /other purchases/i
    ];

    function onPurchasesPage() {
        try {
            return new URLSearchParams(window.location.search).get('view') === 'purchases';
        } catch (error) {
            return false;
        }
    }

    function mark(node) {
        if (node) node.dataset[FLAG] = '1';
    }

    function marked(node) {
        return !!(node && node.dataset[FLAG] === '1');
    }

    function textOf(node) {
        return (node.innerText || node.textContent || '').replace(/\s+/g, ' ').trim();
    }

    function findShowPurchControl(type) {
        const nodes = document.querySelectorAll('[onclick*="showPurch"], [href*="showPurch"]');
        for (let i = 0; i < nodes.length; i++) {
            const code = (nodes[i].getAttribute('onclick') || '') + ' ' + (nodes[i].getAttribute('href') || '');
            if (code.includes("'" + type + "'") || code.includes('"' + type + '"')) {
                return nodes[i];
            }
        }
        return null;
    }

    function openCollapsedContainers() {
        if (typeof showPurch !== 'function' && !document.querySelector('[onclick*="showPurch"]')) {
            return;
        }

        const nodes = document.querySelectorAll('[id^="PURCH_"][id$="_c"]');
        nodes.forEach((node) => {
            if (marked(node)) return;
            const type = node.id.slice('PURCH_'.length, -'_c'.length);
            if (!type) return;

            const control = findShowPurchControl(type);
            if (control) {
                mark(node);
                mark(control);
                if (control.parentElement) mark(control.parentElement);
                control.click();
                return;
            }

            if (typeof showPurch !== 'function') return;
            mark(node);
            if (node.parentElement) mark(node.parentElement);
            const project = new URLSearchParams(window.location.search).get('project');
            if (project) showPurch(type, project);
            else showPurch(type);
        });
    }

    function sectionHasItems(node) {
        const details = node.closest('details');
        if (details && details.open && details.querySelector('.showcase-item, .product-widget')) {
            return true;
        }
        const sibling = node.nextElementSibling;
        if (sibling && sibling.querySelector('.showcase-item, .showcase__item, .product-widget')) {
            return true;
        }
        const parent = node.parentElement;
        if (!parent) return false;
        const link = parent.querySelector(':scope > [id^="PURCH_"][id$="_link"]');
        return !!(link && link.querySelector('.showcase-item, .product-widget'));
    }

    const openedLabels = new Set();

    function controlScore(node) {
        let score = 0;
        const code = (node.getAttribute('onclick') || '') + (node.getAttribute('href') || '');
        if (code.includes('showPurch')) score += 5;
        if (node.tagName === 'BUTTON' || node.tagName === 'SUMMARY' || /^H[2-4]$/.test(node.tagName)) score += 3;
        if (node.tagName === 'A') score += 2;
        return score;
    }

    function openNamedSections() {
        const candidates = [...document.querySelectorAll('a, button, summary, h2, h3, h4, [onclick], [role="button"], [class*="title"], [class*="header"]')];
        candidates.sort((a, b) => controlScore(b) - controlScore(a));

        candidates.forEach((node) => {
            if (marked(node) || node.closest('[data-gaijin-summary-opened="1"]')) return;
            if (node.closest('.showcase-item, .product-widget, #gaijin-purchase-summary')) return;

            const text = textOf(node);
            if (!text || text.length > 60) return;
            const label = SECTION_LABELS.find((pattern) => pattern.test(text));
            if (!label || openedLabels.has(label.source)) return;

            if (node.tagName === 'A') {
                const href = node.getAttribute('href') || '';
                const onclick = node.getAttribute('onclick') || '';
                const safe = href === '' || href === '#' || href.startsWith('javascript:') || /showPurch/.test(onclick + href);
                if (!safe) return;
            }

            const details = node.closest('details');
            if (details && details.open) {
                openedLabels.add(label.source);
                mark(node);
                return;
            }
            if (sectionHasItems(node)) {
                openedLabels.add(label.source);
                mark(node);
                return;
            }

            openedLabels.add(label.source);
            mark(node);
            if (node.parentElement) mark(node.parentElement);
            node.click();
        });
    }

    function expandPurchases() {
        if (!onPurchasesPage()) return;
        openCollapsedContainers();
        openNamedSections();
    }

    window.addEventListener('message', (event) => {
        if (event.source !== window) return;
        const data = event.data;
        if (!data || data.source !== 'gaijin-summary' || data.action !== 'expand-purchases') return;
        expandPurchases();
    });

    if (onPurchasesPage()) {
        let tries = 0;
        const timer = window.setInterval(() => {
            if (!onPurchasesPage()) {
                window.clearInterval(timer);
                return;
            }
            expandPurchases();
            tries += 1;
            if (tries >= 40) window.clearInterval(timer);
        }, 500);

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', expandPurchases);
        } else {
            expandPurchases();
        }
    }
})();
