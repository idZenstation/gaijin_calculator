(function (root) {
    const layouts = {};

    function escapeHtml(value) {
        return String(value).replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[ch]));
    }

    function layout(prefix) {
        return layouts[prefix] || { width: 560, position: null };
    }

    function remember(prefix, patch) {
        layouts[prefix] = Object.assign({ width: 560, position: null }, layouts[prefix], patch);
    }

    function load(prefix, done) {
        const positionKey = prefix + 'Position';
        const widthKey = prefix + 'Width';
        chrome.storage.local.get([positionKey, widthKey], (result) => {
            const width = Number(result && result[widthKey]);
            remember(prefix, {
                position: result && result[positionKey] ? result[positionKey] : null,
                width: width >= 480 ? width : 560
            });
            if (done) done(layout(prefix));
        });
    }

    function shellStyle(width) {
        return 'position:fixed;top:100px;right:20px;background:#2d3a48;padding:20px;border:2px solid #27323f;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.3);z-index:10000;font-family:Arial,sans-serif;width:' + width + 'px;max-height:85vh;overflow:hidden;display:flex;flex-direction:column;color:#bac2c8;box-sizing:border-box;font-size:15px;';
    }

    function css(id) {
        const rootId = '#' + id;
        return `
            ${rootId} .panel-head { display:flex; align-items:center; justify-content:center; gap:10px; margin:0 0 14px; padding-right:78px; cursor:grab; user-select:none; position:relative; }
            ${rootId} .panel-head:active { cursor:grabbing; }
            ${rootId} .panel-title { font-weight:bold; color:#e1ce9b; font-size:20px; line-height:1.2; text-align:center; }
            ${rootId} .lang-switch { position:absolute; right:28px; top:0; display:flex; gap:4px; }
            ${rootId} .lang-btn { background:none; border:1px solid #344150; color:#8a949e; padding:2px 6px; border-radius:3px; cursor:pointer; font-size:11px; font-weight:bold; line-height:1.4; }
            ${rootId} .lang-btn:hover { border-color:#19bcb7; color:#19bcb7; }
            ${rootId} .lang-btn.active { background:#19bcb7; border-color:#19bcb7; color:#2d3a48; }
            ${rootId} .panel-body { overflow:auto; min-height:0; scrollbar-gutter:stable; scrollbar-width:thin; scrollbar-color:#19bcb7 #202a35; }
            ${rootId} .panel-body::-webkit-scrollbar { width:8px; }
            ${rootId} .panel-body::-webkit-scrollbar-track { background:#202a35; border-radius:8px; }
            ${rootId} .panel-body::-webkit-scrollbar-thumb { background:#19bcb7; border-radius:8px; border:2px solid #202a35; }
            ${rootId} .panel-body::-webkit-scrollbar-thumb:hover { background:#e1ce9b; }
            ${rootId} .resize-handle { position:absolute; top:0; bottom:0; width:10px; z-index:2; cursor:ew-resize; }
            ${rootId} .line-chart-scroll { overflow-x:auto; margin:8px 0 4px; scrollbar-width:thin; scrollbar-color:#19bcb7 #202a35; }
            ${rootId} .line-chart { display:block; height:auto; }
            ${rootId} .line-chart text { font-family:Arial,sans-serif; }
            ${rootId} .bars { display:flex; flex-direction:column; gap:6px; margin:8px 0 4px; }
            ${rootId} .bar-row { display:grid; grid-template-columns:minmax(88px, 34%) 1fr auto; gap:8px; align-items:center; min-width:0; }
            ${rootId} .bar-label, ${rootId} .bar-value { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:12px; color:#bac2c8; }
            ${rootId} .bar-value { color:#19bcb7; font-weight:bold; text-align:right; }
            ${rootId} .bar-track { height:8px; background:#202a35; border-radius:8px; overflow:hidden; }
            ${rootId} .bar-fill { display:block; height:100%; background:#19bcb7; border-radius:8px; }
            ${rootId} .panel-nav { display:flex; justify-content:center; flex-wrap:wrap; gap:6px; margin-top:14px; }
            ${rootId} .panel-nav a { font-size:11px; line-height:1.2; padding:4px 8px; border-radius:4px; border:1px solid #344150; background:#27323f; color:#8a949e; text-decoration:none; white-space:nowrap; }
            ${rootId} .panel-nav a:hover { border-color:#19bcb7; color:#19bcb7; }
            ${rootId} .panel-nav a.active { border-color:#19bcb7; color:#19bcb7; }
            ${rootId} summary { list-style:none; }
            ${rootId} summary::-webkit-details-marker { display:none; }
            ${rootId} summary .disclosure { display:inline-block; width:0.9em; color:#8a949e; transition:transform 0.15s ease; }
            ${rootId} details[open] > summary .disclosure { transform:rotate(90deg); }
        `;
    }

    function head(title, language) {
        const lang = language === 'en' ? 'en' : 'ru';
        return `
            <div class="panel-head">
                <span class="panel-title">${escapeHtml(title)}</span>
                <span class="lang-switch">
                    <button type="button" class="lang-btn ${lang === 'ru' ? 'active' : ''}" data-lang="ru">RU</button>
                    <button type="button" class="lang-btn ${lang === 'en' ? 'active' : ''}" data-lang="en">EN</button>
                </span>
            </div>
        `;
    }

    function nav(current, labels) {
        const items = [
            { id: 'gaijin', href: 'https://store.gaijin.net/user.php?view=purchases', icon: '🎮', label: labels.gaijin },
            { id: 'pixstorm', href: 'https://store.pixstorm.ru/user.php?view=purchases', icon: '🌟', label: labels.pixstorm },
            { id: 'market', href: 'https://store.gaijin.net/balance_history.php', icon: '📈', label: labels.market }
        ];
        return `<nav class="panel-nav">${items.map((item) => `
            <a class="${item.id === current ? 'active' : ''}" href="${item.href}">${item.icon} ${escapeHtml(item.label || '')}</a>
        `).join('')}</nav>`;
    }

    function lineChart(rows) {
        const list = (rows || []).filter((row) => row && row.label);
        if (!list.length) return '';
        const slot = 58;
        const height = 168;
        const padLeft = 28;
        const padRight = 28;
        const padTop = 28;
        const padBottom = 28;
        const width = Math.max(320, padLeft + padRight + Math.max(0, list.length - 1) * slot);
        const values = list.map((row) => Math.abs(Number(row.value) || 0));
        const max = Math.max.apply(null, values.concat(1));
        const innerWidth = width - padLeft - padRight;
        const innerHeight = height - padTop - padBottom;
        const points = values.map((value, index) => {
            const x = list.length === 1
                ? padLeft + innerWidth / 2
                : padLeft + (innerWidth * index) / (list.length - 1);
            const y = padTop + innerHeight - (value / max) * innerHeight;
            return { x: x, y: y, row: list[index], value: value };
        });
        const line = points.map((point) => point.x.toFixed(1) + ',' + point.y.toFixed(1)).join(' ');
        const base = padTop + innerHeight;
        const area = points[0].x.toFixed(1) + ',' + base + ' ' + line + ' ' + points[points.length - 1].x.toFixed(1) + ',' + base;
        const dots = points.map((point) => {
            const amount = point.row.text || '';
            const valueY = Math.max(12, point.y - 8);
            return `
            <g>
                <title>${escapeHtml(point.row.title || (point.row.label + (amount ? ': ' + amount : '')))}</title>
                <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="3.5" fill="#19bcb7"></circle>
                ${amount ? `<text x="${point.x.toFixed(1)}" y="${valueY.toFixed(1)}" text-anchor="middle" font-size="10" fill="#e1ce9b">${escapeHtml(amount)}</text>` : ''}
                <text x="${point.x.toFixed(1)}" y="${(base + 16).toFixed(1)}" text-anchor="middle" font-size="10" fill="#bac2c8">${escapeHtml(point.row.label)}</text>
            </g>`;
        }).join('');
        return `
            <div class="line-chart-scroll">
                <svg class="line-chart" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img">
                    <line x1="${padLeft}" y1="${base}" x2="${width - padRight}" y2="${base}" stroke="#344150" stroke-width="1"></line>
                    <polygon points="${area}" fill="#19bcb7" opacity="0.18"></polygon>
                    <polyline points="${line}" fill="none" stroke="#19bcb7" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"></polyline>
                    ${dots}
                </svg>
            </div>
        `;
    }

    function bars(rows) {
        const list = rows || [];
        const max = list.reduce((peak, row) => Math.max(peak, Math.abs(Number(row.value) || 0)), 0) || 1;
        return `<div class="bars">${list.map((row) => {
            const value = Math.abs(Number(row.value) || 0);
            const width = value > 0 ? Math.max(4, Math.round(value / max * 100)) : 0;
            return `
                <div class="bar-row">
                    <span class="bar-label">${escapeHtml(row.label || '')}</span>
                    <span class="bar-track"><span class="bar-fill" style="width:${width}%"></span></span>
                    <span class="bar-value">${escapeHtml(row.text || '')}</span>
                </div>
            `;
        }).join('')}</div>`;
    }

    function applyPlacement(panel, prefix) {
        const current = layout(prefix);
        panel.style.width = current.width + 'px';
        if (!current.position) return;
        const left = Number(current.position.left);
        const top = Number(current.position.top);
        if (!Number.isFinite(left) || !Number.isFinite(top)) return;
        panel.style.left = Math.max(8, left) + 'px';
        panel.style.top = Math.max(8, top) + 'px';
        panel.style.right = 'auto';
    }

    function attach(panel, options) {
        const prefix = options.prefix;
        applyPlacement(panel, prefix);
        const motion = { drag: null, resize: null };

        panel.querySelectorAll('.lang-btn').forEach((button) => {
            button.addEventListener('mousedown', (event) => event.stopPropagation());
            button.addEventListener('click', () => {
                const lang = button.dataset.lang === 'en' ? 'en' : 'ru';
                if (options.onLanguage) options.onLanguage(lang);
            });
        });

        const headNode = panel.querySelector('.panel-head');
        if (headNode) {
            headNode.addEventListener('mousedown', (event) => {
                if (event.button !== 0 || event.target.closest('.lang-switch')) return;
                const rect = panel.getBoundingClientRect();
                motion.drag = { dx: event.clientX - rect.left, dy: event.clientY - rect.top };
                event.preventDefault();
            });
        }

        ['left', 'right'].forEach((edge) => {
            const handle = document.createElement('div');
            handle.className = 'resize-handle';
            handle.style[edge] = '0';
            handle.addEventListener('mousedown', (event) => {
                if (event.button !== 0) return;
                const rect = panel.getBoundingClientRect();
                motion.resize = { edge: edge, startX: event.clientX, startWidth: rect.width, startLeft: rect.left };
                event.preventDefault();
                event.stopPropagation();
            });
            panel.appendChild(handle);
        });

        attach.motion = motion;
        attach.panel = panel;
        attach.prefix = prefix;
        if (attach.listening) return;
        attach.listening = true;

        window.addEventListener('mousemove', (event) => {
            const current = attach.motion;
            const node = attach.panel;
            if (!node || !document.body.contains(node)) return;
            if (current.resize) {
                const dx = event.clientX - current.resize.startX;
                const maxWidth = Math.max(480, window.innerWidth - 16);
                let width = current.resize.edge === 'right' ? current.resize.startWidth + dx : current.resize.startWidth - dx;
                width = Math.min(Math.max(480, width), maxWidth);
                node.style.width = width + 'px';
                if (current.resize.edge === 'left') {
                    node.style.left = (current.resize.startLeft + current.resize.startWidth - width) + 'px';
                    node.style.right = 'auto';
                }
                return;
            }
            if (!current.drag) return;
            const maxLeft = Math.max(8, window.innerWidth - node.offsetWidth);
            const maxTop = Math.max(8, window.innerHeight - 48);
            node.style.left = Math.min(Math.max(8, event.clientX - current.drag.dx), maxLeft) + 'px';
            node.style.top = Math.min(Math.max(8, event.clientY - current.drag.dy), maxTop) + 'px';
            node.style.right = 'auto';
        });
        window.addEventListener('mouseup', () => {
            const current = attach.motion;
            const node = attach.panel;
            if (!current.drag && !current.resize) return;
            current.drag = null;
            current.resize = null;
            if (!node) return;
            const rect = node.getBoundingClientRect();
            remember(attach.prefix, {
                width: Math.round(rect.width),
                position: { left: rect.left, top: rect.top }
            });
            const saved = layout(attach.prefix);
            const patch = {};
            patch[attach.prefix + 'Width'] = saved.width;
            patch[attach.prefix + 'Position'] = saved.position;
            chrome.storage.local.set(patch);
        });
    }

    root.GaijinPanel = {
        load: load,
        layout: layout,
        shellStyle: shellStyle,
        css: css,
        head: head,
        bars: bars,
        lineChart: lineChart,
        nav: nav,
        attach: attach
    };
})(typeof globalThis !== 'undefined' ? globalThis : this);
