let isPopupManuallyClosed = false;
let currentLanguage = 'ru';
let lastSignature = '';
let renderToken = 0;
let lastRows = [];

const openState = {
    topups: false,
    purchases: false,
    sales: false,
    years: false
};

const texts = {
    ru: {
        title: 'Биржа GJN',
        net: 'Итог по журналу',
        topups: 'Пополнения',
        purchases: 'Покупки',
        sales: 'Продажи',
        byYear: 'По годам',
        undated: 'Без даты',
        refresh: 'Обновить статистику',
        loading: 'Загрузка...',
        topupRow: 'Пополнение',
        unnamedBuy: 'Покупка без лота',
        storeKey: 'Ключ',
        unnamedSell: 'Продажа без лота',
        uncategorized: 'Без категории',
        ledgerOnly: 'Суммы из журнала баланса',
        namesReady: 'Названия лотов подставлены из истории биржи',
        namesPartial: 'Названы не все сделки. Откройте биржу в этом браузере и обновите панель',
        namesMissing: 'Суммы из журнала баланса. Чтобы увидеть лоты, откройте биржу и обновите панель',
        authError: 'Войдите в магазин и откройте историю баланса',
        loadError: 'Не удалось прочитать журнал баланса',
        openMarket: 'Открыть биржу',
        gaijinStore: 'Gaijin Store',
        pixstormStore: 'PixStorm',
        marketPage: 'Биржа',
        spent: 'Потрачено',
        months: ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь']
    },
    en: {
        title: 'GJN Market',
        net: 'Ledger total',
        topups: 'Top-ups',
        purchases: 'Purchases',
        sales: 'Sales',
        byYear: 'By year',
        undated: 'No date',
        refresh: 'Refresh statistics',
        loading: 'Loading...',
        topupRow: 'Top-up',
        unnamedBuy: 'Purchase without a lot',
        storeKey: 'Key',
        unnamedSell: 'Sale without a lot',
        uncategorized: 'Uncategorized',
        ledgerOnly: 'Sums from the balance ledger',
        namesReady: 'Lot names come from the market history',
        namesPartial: 'Some deals have no lot name. Open the market in this browser and refresh',
        namesMissing: 'Sums come from the balance ledger. Open the market and refresh to see lots',
        authError: 'Sign in to the store and open the balance history',
        loadError: 'Could not read the balance ledger',
        openMarket: 'Open market',
        gaijinStore: 'Gaijin Store',
        pixstormStore: 'PixStorm',
        marketPage: 'Market',
        spent: 'Spent',
        months: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
    }
};

const monthIcons = ['❄️', '🌨', '🌱', '🌸', '🌷', '☀️', '🏖', '🌾', '🍂', '🎃', '🍁', '🎄'];

function t(key) {
    return (texts[currentLanguage] || texts.ru)[key] || key;
}

function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, (ch) => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

function isBalancePage() {
    return /\/balance_history\.php$/i.test(window.location.pathname);
}

function toCents(sum) {
    const value = Number(sum);
    if (!Number.isFinite(value)) return 0;
    return Math.round(value * 100);
}

function formatGjn(cents, withSign) {
    const sign = cents < 0 ? '−' : (withSign && cents > 0 ? '+' : '');
    const text = (Math.abs(cents) / 100).toLocaleString(currentLanguage === 'ru' ? 'ru-RU' : 'en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return sign + text + ' GJN';
}

function tradeIdFromTrans(transId) {
    const matched = /^(?:o|i)(\d+)/.exec(String(transId || ''));
    return matched ? matched[1] : '';
}

function classifyReason(reason, transId, cents) {
    const text = String(reason || '').trim().toLowerCase();
    if (text === 'продажа' || text === 'sale') return 'sale';
    if (text === 'покупка' || text === 'purchase' || text === 'buy') return 'purchase';
    if (text === 'прочее' || text === 'other' || text === 'пополнение' || text === 'topup' || text === 'top-up') return 'topup';
    const id = String(transId || '');
    if (id.startsWith('o')) return 'sale';
    if (id.startsWith('i')) return 'purchase';
    return cents < 0 ? 'purchase' : 'topup';
}

function parseStamp(time) {
    const matched = /^(\d{2})\.(\d{2})\.(\d{4})(?:\s+(\d{2}):(\d{2}))?/.exec(String(time || ''));
    if (!matched) return null;
    return {
        year: Number(matched[3]),
        month: Number(matched[2]),
        label: matched[4] ? matched[1] + '.' + matched[2] + '.' + matched[3] + ' ' + matched[4] + ':' + matched[5] : matched[1] + '.' + matched[2] + '.' + matched[3],
        order: Date.UTC(Number(matched[3]), Number(matched[2]) - 1, Number(matched[1]), Number(matched[4] || 0), Number(matched[5] || 0))
    };
}

async function fetchLedger() {
    const rows = [];
    const seen = new Set();
    let page = 1;
    let total = Infinity;

    while (rows.length < total && page <= 40) {
        const url = new URL(window.location.pathname, window.location.origin);
        url.searchParams.set('page', String(page));
        url.searchParams.set('size', '100');
        url.searchParams.set('from', '');
        url.searchParams.set('till', '');
        url.searchParams.set('tag', 'any');
        const response = await fetch(url.toString(), {
            credentials: 'include',
            headers: {
                accept: 'application/json, text/plain, */*',
                'x-requested-with': 'XMLHttpRequest'
            }
        });
        const body = await response.text();
        let data;
        try {
            data = JSON.parse(body);
        } catch (error) {
            const auth = new Error('auth');
            auth.code = 'auth';
            throw auth;
        }
        if (!data || !Array.isArray(data.rows)) {
            const auth = new Error('auth');
            auth.code = 'auth';
            throw auth;
        }
        total = Number(data.total_rows);
        if (!Number.isFinite(total)) total = rows.length + data.rows.length;
        data.rows.forEach((row) => {
            const id = String(row && row.id || '');
            if (id && seen.has(id)) return;
            if (id) seen.add(id);
            rows.push(row);
        });
        if (!data.rows.length) break;
        page += 1;
    }

    return rows;
}

function tradeMapFrom(trades) {
    const map = new Map();
    (trades || []).forEach((trade) => {
        if (!trade) return;
        if (trade.id) map.set(String(trade.id), trade);
        if (trade.orderId) map.set(String(trade.orderId), trade);
    });
    return map;
}

function loadTradeMap(force) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: 'loadMarketTrades', language: currentLanguage, force: !!force }, (response) => {
            if (chrome.runtime.lastError || !response || !Array.isArray(response.trades)) {
                resolve(new Map());
                return;
            }
            resolve(tradeMapFrom(response.trades));
        });
    });
}

function buildStats(rows, tradeMap) {
    const buckets = {
        topup: [],
        purchase: [],
        sale: []
    };
    const sums = { topup: 0, purchase: 0, sale: 0, net: 0 };
    const years = new Map();
    let marketDeals = 0;
    let namedDeals = 0;

    rows.forEach((row) => {
        const cents = toCents(row.sum);
        const kind = classifyReason(row.reason, row.trans_id, cents);
        const stamp = parseStamp(row.time);
        const tradeId = tradeIdFromTrans(row.trans_id);
        const trade = tradeId ? tradeMap.get(tradeId) : null;
        const storeKey = kind === 'purchase' && !(trade && trade.name) && Math.abs(cents) === 249;
        if (tradeId && (kind === 'purchase' || kind === 'sale') && !storeKey) {
            marketDeals += 1;
            if (trade && trade.name) namedDeals += 1;
        }
        let name = t('topupRow');
        if (kind === 'purchase') name = (trade && trade.name) || (storeKey ? t('storeKey') : t('unnamedBuy'));
        if (kind === 'sale') name = (trade && trade.name) || t('unnamedSell');
        if (trade && trade.quantity > 1) name = trade.quantity + '× ' + name;

        const entry = {
            kind: kind,
            cents: cents,
            name: name,
            when: stamp ? stamp.label : String(row.time || ''),
            order: stamp ? stamp.order : 0,
            hash: trade && trade.market || '',
            itemType: storeKey ? t('storeKey') : (trade && trade.itemType || ''),
            itemTypeSort: storeKey ? 8 : (trade && Number.isFinite(Number(trade.itemTypeSort)) ? Number(trade.itemTypeSort) : 999),
            itemTypeColor: storeKey ? '#c8c8c8' : safeColor(trade && trade.itemTypeColor)
        };
        buckets[kind].push(entry);
        sums[kind] += cents;
        sums.net += cents;

        const yearKey = stamp ? stamp.year : 0;
        const monthKey = stamp ? stamp.month : 0;
        if (!years.has(yearKey)) years.set(yearKey, new Map());
        const months = years.get(yearKey);
        if (!months.has(monthKey)) months.set(monthKey, { topup: 0, purchase: 0, sale: 0, net: 0 });
        const month = months.get(monthKey);
        month[kind] += cents;
        month.net += cents;
    });

    Object.keys(buckets).forEach((kind) => {
        buckets[kind].sort((a, b) => b.order - a.order);
    });

    return {
        mode: 'market',
        count: rows.length,
        sums: sums,
        buckets: buckets,
        years: years,
        marketDeals: marketDeals,
        namedDeals: namedDeals,
        netLabel: formatGjn(sums.net, true),
        topupLabel: formatGjn(sums.topup, true),
        purchaseLabel: formatGjn(sums.purchase, true),
        saleLabel: formatGjn(sums.sale, true)
    };
}

function rememberOpenState() {
    const root = document.getElementById('gaijin-market-summary');
    if (!root) return;
    ['topups', 'purchases', 'sales', 'years'].forEach((id) => {
        const node = root.querySelector('#' + id);
        if (node) openState[id] = node.open;
    });
}

function rowHtml(entry) {
    const title = entry.hash ? entry.name + ' · ' + entry.hash : entry.name;
    return `
        <div class="line lot-line">
            <span class="lot-when">${escapeHtml(entry.when)}</span>
            <span class="lot-title" title="${escapeHtml(title)}">${escapeHtml(entry.name)}</span>
            <span class="line-money line-sum">${escapeHtml(formatGjn(entry.cents, true))}</span>
        </div>
    `;
}

function safeColor(value) {
    return /^#[0-9a-fA-F]{6}$/.test(String(value || '')) ? String(value) : '';
}

function categoryHtml(entries) {
    const groups = new Map();
    entries.forEach((entry) => {
        const key = entry.itemType || '';
        if (!groups.has(key)) {
            groups.set(key, {
                name: key || t('uncategorized'),
                sort: key ? entry.itemTypeSort : 1000,
                color: entry.itemTypeColor || '#bac2c8',
                cents: 0,
                entries: []
            });
        }
        const group = groups.get(key);
        group.cents += entry.cents;
        group.entries.push(entry);
    });
    return [...groups.values()]
        .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, currentLanguage === 'ru' ? 'ru' : 'en'))
        .map((group) => `
            <details class="type-group">
                <summary class="line summary-line">
                    <span class="line-name"><span class="disclosure">▸</span> <span class="type-name" style="color:${group.color}">${escapeHtml(group.name)}</span></span>
                    <span class="line-money line-sum">${escapeHtml(formatGjn(group.cents, true))}</span>
                </summary>
                <div class="stack nested">${group.entries.map(rowHtml).join('')}</div>
            </details>
        `).join('');
}

function sectionHtml(id, icon, title, cents, entries, grouped) {
    const rows = entries.length
        ? (grouped ? categoryHtml(entries) : entries.map(rowHtml).join(''))
        : '<div class="empty">-</div>';
    return `
        <details id="${id}" ${openState[id] ? 'open' : ''}>
            <summary class="line summary-line">
                <span class="line-name"><span class="disclosure">▸</span> ${icon} ${escapeHtml(title)}</span>
                <span class="line-money line-sum">${escapeHtml(formatGjn(cents, true))}</span>
            </summary>
            <div class="stack">${rows}</div>
        </details>
    `;
}

function monthLines(bucket) {
    const lines = [
        ['💳', t('topups'), bucket.topup],
        ['🛒', t('purchases'), bucket.purchase],
        ['🏷', t('sales'), bucket.sale]
    ];
    return lines.filter((line) => line[2] !== 0).map((line) => `
        <div class="line">
            <span class="line-name">${line[0]} ${escapeHtml(line[1])}</span>
            <span class="line-money line-sum">${escapeHtml(formatGjn(line[2], true))}</span>
        </div>
    `).join('');
}

function spentCents(bucket) {
    return Math.abs(Math.min(0, bucket.purchase || 0));
}

function chartAmount(cents) {
    const abs = Math.abs(cents) / 100;
    const digits = abs >= 100 ? 0 : 2;
    const text = abs.toLocaleString(currentLanguage === 'ru' ? 'ru-RU' : 'en-US', {
        minimumFractionDigits: digits,
        maximumFractionDigits: digits
    });
    return (cents < 0 ? '−' : '') + text;
}

function monthStampRows(entries, amountOf, textOf) {
    if (!entries.length) return [];
    const first = entries[0];
    const last = entries[entries.length - 1];
    const byKey = new Map(entries.map((entry) => [entry.year + '-' + entry.month, entry]));
    const rows = [];
    let year = first.year;
    let month = first.month;
    while (year < last.year || (year === last.year && month <= last.month)) {
        const entry = byKey.get(year + '-' + month);
        const amount = entry ? amountOf(entry) : 0;
        const name = (t('months')[month - 1] || String(month)).slice(0, 3);
        rows.push({
            label: name + ' ' + String(year).slice(2),
            value: Math.abs(amount),
            text: amount ? textOf(amount) : '',
            title: name + ' ' + year + (amount ? ': ' + textOf(amount) : '')
        });
        month += 1;
        if (month > 12) {
            month = 1;
            year += 1;
        }
    }
    return rows;
}

function yearHtml(stats) {
    const years = [...stats.years.entries()].sort((a, b) => b[0] - a[0]);
    const monthEntries = [];
    years.filter(([year]) => year).slice().reverse().forEach(([year, months]) => {
        [...months.entries()].filter(([month]) => month).sort((a, b) => a[0] - b[0]).forEach(([month, bucket]) => {
            monthEntries.push({ year: year, month: month, bucket: bucket });
        });
    });
    const yearChart = GaijinPanel.lineChart(monthStampRows(
        monthEntries,
        (entry) => -spentCents(entry.bucket),
        (amount) => chartAmount(amount)
    ));
    const blocks = years.map(([year, months]) => {
        let net = 0;
        months.forEach((bucket) => { net += bucket.net; });
        const label = year ? String(year) : t('undated');
        const icon = year ? '📅' : '❓';
        const monthEntries = [...months.entries()].filter((entry) => entry[0] !== 0).sort((a, b) => a[0] - b[0]);
        const monthChart = GaijinPanel.lineChart(monthEntries.map(([month, bucket]) => ({
            label: (t('months')[month - 1] || String(month)).slice(0, 3),
            value: spentCents(bucket),
            text: spentCents(bucket) ? chartAmount(-spentCents(bucket)) : '',
            title: (t('months')[month - 1] || '') + ': ' + formatGjn(-spentCents(bucket), true)
        })));
        const monthBlocks = monthEntries
            .map(([month, bucket]) => `
                <details>
                    <summary class="line summary-line">
                        <span class="line-name"><span class="disclosure">▸</span> ${monthIcons[month - 1] || '📅'} ${escapeHtml(t('months')[month - 1] || String(month))}</span>
                        <span class="line-money line-sum">${escapeHtml(formatGjn(bucket.net, true))}</span>
                    </summary>
                    <div class="stack nested">${monthLines(bucket)}</div>
                </details>
            `).join('');
        const undated = year ? months.get(0) : null;
        const undatedHtml = undated ? `<div class="line"><span class="line-name">❓ ${escapeHtml(t('undated'))}</span><span class="line-money line-sum">${escapeHtml(formatGjn(undated.net, true))}</span></div>` : '';
        return `
            <details>
                <summary class="line summary-line">
                    <span class="line-name"><span class="disclosure">▸</span> ${icon} ${escapeHtml(label)}</span>
                    <span class="line-money line-sum">${escapeHtml(formatGjn(net, true))}</span>
                </summary>
                <div class="stack nested">${monthChart}${monthBlocks}${undatedHtml}</div>
            </details>
        `;
    }).join('');

    return `
        <details id="years" ${openState.years ? 'open' : ''}>
            <summary class="line summary-line">
                <span class="line-name"><span class="disclosure">▸</span> 📅 ${escapeHtml(t('byYear'))}</span>
                <span class="line-money line-sum">${escapeHtml(formatGjn(stats.sums.net, true))}</span>
            </summary>
            <div class="stack">
                <div style="font-size:12px;color:#8a949e;">${escapeHtml(t('spent'))}</div>
                ${yearChart}
                ${blocks || '<div class="empty">-</div>'}
            </div>
        </details>
    `;
}

function footnote(stats) {
    if (!stats.marketDeals) return t('ledgerOnly');
    if (stats.namedDeals >= stats.marketDeals) return t('namesReady');
    if (stats.namedDeals > 0) return t('namesPartial');
    return t('namesMissing');
}

function overlayCss() {
    return `
        #gaijin-market-summary { scrollbar-width: thin; scrollbar-color: #19bcb7 #202a35; }
        #gaijin-market-summary::-webkit-scrollbar { width: 8px; }
        #gaijin-market-summary::-webkit-scrollbar-track { background: #202a35; border-radius: 8px; }
        #gaijin-market-summary::-webkit-scrollbar-thumb { background: #19bcb7; border-radius: 8px; border: 2px solid #202a35; }
        #gaijin-market-summary::-webkit-scrollbar-thumb:hover { background: #e1ce9b; }
        #gaijin-market-summary summary { list-style: none; }
        #gaijin-market-summary summary::-webkit-details-marker { display: none; }
        #gaijin-market-summary summary .disclosure { display: inline-block; width: 0.9em; color: #8a949e; transition: transform 0.15s ease; }
        #gaijin-market-summary details[open] > summary .disclosure { transform: rotate(90deg); }
        #gaijin-market-summary .line { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-width: 0; }
        #gaijin-market-summary .line-name { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: #bac2c8; }
        #gaijin-market-summary .line-money { flex-shrink: 0; white-space: nowrap; text-align: right; }
        #gaijin-market-summary .line-sum { color: #19bcb7; font-weight: bold; }
        #gaijin-market-summary .lot-when { flex: 0 0 auto; font-size: 13px; line-height: 1.2; color: #8a949e; }
        #gaijin-market-summary .lot-title { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 16px; color: #bac2c8; }
        #gaijin-market-summary .type-name { font-weight: bold; }
        #gaijin-market-summary .summary-line { cursor: pointer; font-size: 16px; }
        #gaijin-market-summary .stack { display: flex; flex-direction: column; gap: 6px; margin-top: 8px; }
        #gaijin-market-summary .nested { padding-left: 12px; }
        #gaijin-market-summary details { background: #27323f; border: 1px solid #344150; border-radius: 6px; padding: 10px; }
        #gaijin-market-summary .tiles { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px; }
        #gaijin-market-summary .tile { background: #27323f; border: 1px solid #344150; border-radius: 6px; padding: 8px 4px; text-align: center; min-width: 0; }
        #gaijin-market-summary .tile span { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        #gaijin-market-summary .tile-label { font-size: 12px; color: #8a949e; text-transform: uppercase; margin-bottom: 2px; }
        #gaijin-market-summary .tile-value { font-size: 16px; font-weight: bold; color: #19bcb7; }
        ${GaijinPanel.css('gaijin-market-summary')}
        #gaijin-market-summary .empty { color: #8a949e; text-align: center; font-size: 12px; }
        #gaijin-market-summary .actions { display: flex; flex-direction: column; gap: 8px; }
        #gaijin-market-summary .actions button {
            width: 100%; box-sizing: border-box; border-radius: 6px; font-weight: bold; font-size: 14px;
            text-align: center; white-space: nowrap; padding: 10px; background: #19bcb7; color: #2d3a48; border: none; cursor: pointer;
        }
        #gaijin-market-summary .market-link { display: block; margin-top: 8px; font-size: 11px; color: #8a949e; text-align: center; text-decoration: none; }
        #gaijin-market-summary .market-link:hover { color: #19bcb7; }
        #gaijin-market-summary .footnote { font-size: 11px; color: #8a949e; margin-top: 12px; text-align: center; text-wrap: balance; }
    `;
}

function render(stats, errorText) {
    if (isPopupManuallyClosed) return;
    const signature = errorText || (stats ? [stats.netLabel, stats.topupLabel, stats.purchaseLabel, stats.saleLabel, stats.namedDeals, stats.count, currentLanguage].join('|') : 'loading');
    if (signature === lastSignature && document.getElementById('gaijin-market-summary')) return;
    lastSignature = signature;
    rememberOpenState();

    const old = document.getElementById('gaijin-market-summary');
    if (old) old.remove();

    const root = document.createElement('div');
    root.id = 'gaijin-market-summary';
    root.style.cssText = GaijinPanel.shellStyle(GaijinPanel.layout('marketPanel').width);

    const body = errorText
        ? `<div class="footnote">${escapeHtml(errorText)}</div>`
        : stats
            ? `
                <div style="margin-bottom:10px;padding:12px 10px;background:#27323f;border-radius:6px;border:1px solid #344150;">
                    <div style="font-size:12px;color:#8a949e;margin-bottom:4px;text-align:center;text-transform:uppercase;">${escapeHtml(t('net'))}</div>
                    <div style="font-size:28px;font-weight:bold;color:#19bcb7;text-align:center;white-space:nowrap;">${escapeHtml(stats.netLabel)}</div>
                </div>
                <div class="tiles">
                    <div class="tile"><span class="tile-label">${escapeHtml(t('topups'))}</span><span class="tile-value">${escapeHtml(stats.topupLabel)}</span></div>
                    <div class="tile"><span class="tile-label">${escapeHtml(t('purchases'))}</span><span class="tile-value">${escapeHtml(stats.purchaseLabel)}</span></div>
                    <div class="tile"><span class="tile-label">${escapeHtml(t('sales'))}</span><span class="tile-value">${escapeHtml(stats.saleLabel)}</span></div>
                </div>
                <div class="stack" style="margin-bottom:12px;">
                    ${sectionHtml('topups', '💳', t('topups'), stats.sums.topup, stats.buckets.topup, false)}
                    ${sectionHtml('purchases', '🛒', t('purchases'), stats.sums.purchase, stats.buckets.purchase, true)}
                    ${sectionHtml('sales', '🏷', t('sales'), stats.sums.sale, stats.buckets.sale, true)}
                    ${yearHtml(stats)}
                </div>
                <div class="footnote">${escapeHtml(footnote(stats))}</div>
            `
            : `<div class="footnote">${escapeHtml(t('loading'))}</div>`;

    const marketLink = stats && stats.namedDeals < stats.marketDeals
        ? `<a class="market-link" href="https://trade.gaijin.net/">📈 ${escapeHtml(t('openMarket'))}</a>`
        : '';

    root.innerHTML = `
        <style>${overlayCss()}</style>
        ${GaijinPanel.head('📈 ' + t('title'), currentLanguage)}
        <div class="panel-body">
            ${body}
            <div class="actions" style="margin-top:12px;">
                <button type="button" id="refreshMarketBtn">🔄 ${escapeHtml(errorText || stats ? t('refresh') : t('loading'))}</button>
                ${marketLink}
            </div>
            ${GaijinPanel.nav('market', {
                gaijin: t('gaijinStore'),
                pixstorm: t('pixstormStore'),
                market: t('marketPage')
            })}
        </div>
    `;

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.textContent = '×';
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.style.cssText = 'position:absolute;top:8px;right:10px;background:none;border:none;font-size:20px;cursor:pointer;color:#8a949e;width:24px;height:24px;padding:0;';
    closeButton.onclick = () => {
        isPopupManuallyClosed = true;
        lastSignature = '';
        root.remove();
        chrome.storage.local.set({ marketPopupVisible: false, marketPopupManuallyClosed: true });
        notifyVisibility();
    };

    const refreshBtn = root.querySelector('#refreshMarketBtn');
    refreshBtn.onclick = () => {
        refreshBtn.disabled = true;
        refreshBtn.textContent = '⏳ ' + t('loading');
        rememberOpenState();
        lastSignature = '';
        refreshStats(true);
    };
    ['topups', 'purchases', 'sales', 'years'].forEach((id) => {
        const node = root.querySelector('#' + id);
        if (!node) return;
        node.addEventListener('toggle', () => { openState[id] = node.open; });
    });

    root.appendChild(closeButton);
    document.body.appendChild(root);
    GaijinPanel.attach(root, {
        prefix: 'marketPanel',
        onLanguage: (lang) => {
            currentLanguage = lang === 'en' ? 'en' : 'ru';
            chrome.storage.local.set({ language: currentLanguage });
            lastSignature = '';
            refreshStats(true);
        }
    });
    chrome.storage.local.set({ marketPopupVisible: true, marketPopupManuallyClosed: false });
    notifyVisibility();
    if (stats) {
        chrome.runtime.sendMessage({ action: 'marketResults', results: publicResults(stats) }, () => {
            void chrome.runtime.lastError;
        });
    }
}

function publicResults(stats) {
    return {
        mode: 'market',
        netLabel: stats.netLabel,
        topupLabel: stats.topupLabel,
        purchaseLabel: stats.purchaseLabel,
        saleLabel: stats.saleLabel,
        count: stats.count,
        namedDeals: stats.namedDeals,
        marketDeals: stats.marketDeals,
        footnote: footnote(stats)
    };
}

function notifyVisibility() {
    chrome.runtime.sendMessage({
        action: 'popupVisibilityChanged',
        isVisible: !isPopupManuallyClosed
    }, () => { void chrome.runtime.lastError; });
}

async function refreshStats(force) {
    const token = ++renderToken;
    if (!isPopupManuallyClosed) render(null, '');
    try {
        const rows = await fetchLedger();
        if (token !== renderToken) return null;
        lastRows = rows;
        const tradeMap = await loadTradeMap(force);
        if (token !== renderToken) return null;
        const stats = buildStats(rows, tradeMap);
        if (!isPopupManuallyClosed) render(stats, '');
        return stats;
    } catch (error) {
        if (token !== renderToken) return null;
        if (!isPopupManuallyClosed) render(null, error && error.code === 'auth' ? t('authError') : t('loadError'));
        return null;
    }
}

function hidePopup() {
    isPopupManuallyClosed = true;
    lastSignature = '';
    const old = document.getElementById('gaijin-market-summary');
    if (old) old.remove();
    chrome.storage.local.set({ marketPopupVisible: false, marketPopupManuallyClosed: true });
    notifyVisibility();
}

function showPopup() {
    isPopupManuallyClosed = false;
    lastSignature = '';
    refreshStats();
}

function init() {
    if (!isBalancePage()) return;
    GaijinPanel.load('marketPanel', () => {
    chrome.storage.local.get(['marketPopupManuallyClosed', 'language'], (result) => {
        if (result && result.language) currentLanguage = result.language === 'en' ? 'en' : 'ru';
        if (result && result.marketPopupManuallyClosed) isPopupManuallyClosed = true;
        if (!isPopupManuallyClosed) refreshStats(true);
    });
    });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes.marketTrades || isPopupManuallyClosed || !lastRows.length) return;
        const trades = changes.marketTrades.newValue && changes.marketTrades.newValue.trades;
        if (!Array.isArray(trades)) return;
        lastSignature = '';
        render(buildStats(lastRows, tradeMapFrom(trades)), '');
    });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || !request.action || !isBalancePage()) return;
    if (request.action === 'calculateMarket') {
        refreshStats(true).then((stats) => {
            sendResponse(stats ? { success: true, results: publicResults(stats) } : { success: false });
        });
        return true;
    }
    if (request.action === 'togglePopup') {
        if (request.isVisible) showPopup();
        else hidePopup();
        sendResponse({ success: true });
        return;
    }
    if (request.action === 'getPopupState') {
        sendResponse({ success: true, isVisible: !!document.getElementById('gaijin-market-summary') && !isPopupManuallyClosed });
        return;
    }
    if (request.action === 'setLanguage') {
        currentLanguage = request.language === 'en' ? 'en' : 'ru';
        lastSignature = '';
        if (!isPopupManuallyClosed) refreshStats(true);
        sendResponse({ success: true });
    }
});
