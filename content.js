let isPopupManuallyClosed = false;
let currentLanguage = 'ru';
let lastSignature = '';

let popupState = {
    extendedStatsOpen: false,
    receivedGiftsOpen: false,
    sentGiftsOpen: false,
    yearsOpen: false
};

const contentTranslations = {
    ru: {
        purchaseStats: "Сумма покупок",
        totalAmount: "Общая сумма (+ подарки)",
        totalItems: "Всего",
        freeItems: "Бесплатные",
        paidItems: "Платные",
        refreshButton: "Обновить статистику",
        openingLists: "Открываем списки покупок…",
        listsIncluded: "Свои покупки. Подарки вам в сумму не входят",
        byYear: "По годам",
        undated: "Без даты",
        currentPrices: "по текущим ценам магазина",
        months: ["январь", "февраль", "март", "апрель", "май", "июнь", "июль", "август", "сентябрь", "октябрь", "ноябрь", "декабрь"],
        giftsToMe: "Подарки мне",
        giftsToMeNote: "входят только в общую сумму",
        unknownGiver: "Неизвестный игрок",
        loading: "Загрузка...",
        gaijinStore: "Gaijin Store",
        pixstormStore: "PixStorm Store",
        extendedStats: "Расширенная статистика",
        categoriesHeader: "Категории расходов:",
        goldenEaglesCat: "Золотые орлы:",
        premiumDaysCat: "Премиум-аккаунт:",
        packsVehiclesCat: "Пакеты и техника:",
        mostExpensive: "Самые дорогие покупки:",
        giftsToOthers: "Подарки другим",
        giftsIncluded: "уже входят в общую сумму",
        eaglesUnit: "орлов",
        daysUnit: "дней",
        pcsUnit: "шт.",
        unknownItem: "Без названия"
    },
    en: {
        purchaseStats: "Purchase Summary",
        totalAmount: "Total (+ gifts)",
        totalItems: "Total",
        freeItems: "Free",
        paidItems: "Paid",
        refreshButton: "Refresh Statistics",
        openingLists: "Opening purchase lists…",
        listsIncluded: "Your purchases only. Gifts to you are not included",
        byYear: "By year",
        undated: "No date",
        currentPrices: "at current store prices",
        months: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
        giftsToMe: "Gifts to me",
        giftsToMeNote: "included only in the total",
        unknownGiver: "Unknown player",
        loading: "Loading...",
        gaijinStore: "Gaijin Store",
        pixstormStore: "PixStorm Store",
        extendedStats: "Extended Statistics",
        categoriesHeader: "Spending Categories:",
        goldenEaglesCat: "Golden Eagles:",
        premiumDaysCat: "Premium Account:",
        packsVehiclesCat: "Packs & Vehicles:",
        mostExpensive: "Most expensive purchases:",
        giftsToOthers: "Gifts to others",
        giftsIncluded: "already included in the total",
        eaglesUnit: "eagles",
        daysUnit: "days",
        pcsUnit: "pcs.",
        unknownItem: "Untitled"
    }
};

const TITLE_SELECTOR = '.showcase-item-description__title, .product-widget-description__title, .product-widget__title, .product-widget-mobile__title';
const QUANTITY_SELECTOR = '.showcase-item-description__title-comment, .product-widget-description__title-comment';
const ITEM_SELECTOR = '.showcase-item, .showcase__item.product-widget, .product-widget';

function getTranslation(key) {
    return contentTranslations[currentLanguage][key] || key;
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

function isPurchasesPage() {
    try {
        return new URLSearchParams(window.location.search).get('view') === 'purchases';
    } catch (error) {
        return false;
    }
}

function setContentLanguage(lang) {
    currentLanguage = lang;
    lastSignature = '';
    if (!isPopupManuallyClosed && isPurchasesPage()) {
        displayResults(calculateTotalPurchases());
    }
}

function notifyPopupAboutVisibility() {
    chrome.runtime.sendMessage({
        action: "popupVisibilityChanged",
        isVisible: !isPopupManuallyClosed
    }, () => {
        void chrome.runtime.lastError;
    });
}

function publishResults(results) {
    chrome.runtime.sendMessage({
        action: "purchaseResults",
        results: results
    }, () => {
        void chrome.runtime.lastError;
    });
}

function savePopupVisibilityState(isVisible) {
    chrome.storage.local.set({
        popupVisible: isVisible,
        popupManuallyClosed: !isVisible
    });
}

function savePopupState() {
    const popup = document.getElementById('gaijin-purchase-summary');
    if (!popup) return;
    const extendedStats = popup.querySelector('#extendedStats');
    const receivedGifts = popup.querySelector('#receivedGifts');
    const sentGifts = popup.querySelector('#sentGifts');
    if (extendedStats) popupState.extendedStatsOpen = extendedStats.open;
    if (receivedGifts) popupState.receivedGiftsOpen = receivedGifts.open;
    if (sentGifts) popupState.sentGiftsOpen = sentGifts.open;
    const spendByYear = popup.querySelector('#spendByYear');
    if (spendByYear) popupState.yearsOpen = spendByYear.open;
}

function getStoreType() {
    const host = window.location.hostname;
    if (host.includes('pixstorm.ru')) return 'pixstorm';
    if (host.includes('gaijin.net')) return 'gaijin';
    return 'unknown';
}

function isPromoNode(node) {
    return !!node.closest('.splide, .showcase-item_slider, .showcase-main-offer, header, nav, footer, .carousel, #gaijin-purchase-summary');
}

function getPurchaseItems() {
    const found = [...document.querySelectorAll(ITEM_SELECTOR)].filter((node) => !isPromoNode(node));
    return found.filter((node) => !found.some((other) => other !== node && other.contains(node)));
}

function getPriceText(item) {
    const fresh = item.querySelector('.showcase-item-price__new, .product-widget-mobile__price_new');
    if (fresh) return fresh.textContent || '';

    const block = item.querySelector('.showcase-item-price, .product-widget__price, .product-widget-mobile__price');
    if (!block) return '';

    const nestedNew = block.querySelector('[class*="price__new"], [class*="price_new"]');
    if (nestedNew) return nestedNew.textContent || '';

    const clone = block.cloneNode(true);
    clone.querySelectorAll('[class*="price__old"], [class*="price_old"]').forEach((node) => node.remove());
    return clone.textContent || '';
}

function getCleanItemName(item) {
    const titleElement = item.querySelector(TITLE_SELECTOR);
    if (!titleElement) {
        const image = item.querySelector('img[alt]');
        if (image && image.alt.trim()) return image.alt.trim();
        return getTranslation('unknownItem');
    }

    const quantityElement = item.querySelector(QUANTITY_SELECTOR);
    let name = titleElement.textContent.replace(/\s+/g, ' ').trim();
    const quantityText = quantityElement
        ? quantityElement.textContent.replace(/\s+/g, ' ').trim()
        : '';
    if (quantityText && titleElement.contains(quantityElement)) {
        name = name.replace(quantityText, ' ').replace(/\s+/g, ' ').trim();
    }
    return name.replace(/^\d+\s*[xх×]\s+/i, '').trim() || getTranslation('unknownItem');
}

function getItemQuantity(item) {
    const quantityElement = item.querySelector(QUANTITY_SELECTOR);
    if (quantityElement) {
        const parsed = GaijinPrice.parseQuantityText(quantityElement.textContent || '');
        if (parsed > 1) return parsed;
    }
    const titleElement = item.querySelector(TITLE_SELECTOR);
    const title = titleElement ? titleElement.textContent.replace(/\s+/g, ' ').trim() : '';
    const leading = title.match(/^(\d+)\s*[xх×]\s+/i);
    return leading ? (Number.parseInt(leading[1], 10) || 1) : 1;
}

function isGiftItem(item) {
    const root = item.closest('[id^="PURCH_"][id$="_link"]');
    return !!(root && root.id === 'PURCH_donator_link');
}

function getItemPopup(item) {
    const trigger = item.querySelector('[data-popup-id]');
    if (!trigger) return null;
    const popupId = trigger.getAttribute('data-popup-id');
    return popupId ? document.getElementById(popupId) : null;
}

function parseAcquisitionEvents(popup) {
    if (!popup) return [];
    return [...popup.querySelectorAll('.showcase-item-comment__item')]
        .filter((row) => !row.classList.contains('showcase-item-comment__item_title'))
        .map((row) => {
            const text = row.textContent.replace(/\s+/g, ' ').trim();
            const dateMatch = text.match(/(\d{2}\.\d{2}\.\d{4})(?:\s+(\d{1,2}:\d{2}))?/);
            const quotedUser = text.match(/(?:игрок(?:у|а)?|player)\s+"([^"]+)"/i);
            const plainUser = text.match(/(?:игрок(?:у|а)?|player)\s+([^\s".]+)/i);
            const user = (quotedUser && quotedUser[1]) || (plainUser && plainUser[1]) || '';
            const isReceived = /вам подарил|подарил(?:а)? вам|gifted to you|was gifted to you/i.test(text);
            const isSent = !isReceived && /вы подарили|подарили игроку|в подарок|you gifted|gifted to player/i.test(text);
            return {
                date: dateMatch ? dateMatch[1] + (dateMatch[2] ? ' ' + dateMatch[2] : '') : '',
                fromUser: isReceived ? user : '',
                toUser: isSent ? user : '',
                isReceived: isReceived,
                isSent: isSent
            };
        })
        .filter((event) => event.date || event.fromUser || event.toUser || event.isReceived || event.isSent);
}

function classifyAcquisitionEvents(popup) {
    const events = parseAcquisitionEvents(popup);
    return {
        own: events.filter((event) => !event.isReceived && !event.isSent),
        received: events.filter((event) => event.isReceived),
        sent: events.filter((event) => event.isSent)
    };
}

function historyKey(popup) {
    if (!popup) return '';
    const lines = [...popup.querySelectorAll('.showcase-item-comment__item')]
        .filter((row) => !row.classList.contains('showcase-item-comment__item_title'))
        .map((row) => row.textContent.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
    return lines.length ? lines.join('\n') : (popup.id || '');
}

function parseSpendDate(text) {
    const match = String(text || '').match(/(\d{2})\.(\d{2})\.(\d{4})/);
    if (!match) return null;
    const month = Number.parseInt(match[2], 10);
    const year = Number.parseInt(match[3], 10);
    if (month < 1 || month > 12 || year < 2000) return null;
    return { year: year, month: month };
}

function cardSpendDate(item) {
    const node = item.querySelector('.showcase-item__timestamp');
    return parseSpendDate(node ? node.textContent : '');
}

function sectionsPending() {
    return !!document.querySelector('[id^="PURCH_"][id$="_c"], [id^="PURCH_"] .loader_active');
}

function requestExpand() {
    window.postMessage({ source: 'gaijin-summary', action: 'expand-purchases' }, '*');
}

function fallbackSymbol(bucket) {
    const keys = Object.keys(bucket.amounts).filter((key) => key);
    if (keys.length === 1) return keys[0];
    if (keys.length > 1) return '';
    return currentLanguage === 'ru' ? '₽' : '';
}

function calculateTotalPurchases() {
    const items = getPurchaseItems();
    const totalMoney = GaijinPrice.emptyMoney();
    const eagleMoney = GaijinPrice.emptyMoney();
    const premiumMoney = GaijinPrice.emptyMoney();
    const packMoney = GaijinPrice.emptyMoney();
    const giftMoney = GaijinPrice.emptyMoney();

    let totalItems = 0;
    let freeItems = 0;
    let paidItems = 0;
    let totalEagles = 0;
    let totalPremiumDays = 0;
    let totalPacksCount = 0;
    const expensive = [];
    const receivedGifts = [];
    const sentGifts = [];
    const countedHistories = new Set();
    const spendPoints = [];
    const undatedMoney = GaijinPrice.emptyMoney();

    function rememberSpend(dateText, fallbackDate, amount, currency) {
        if (!amount) return;
        const date = parseSpendDate(dateText) || fallbackDate || null;
        if (!date) {
            GaijinPrice.addMoney(undatedMoney, currency, amount);
            return;
        }
        spendPoints.push({
            year: date.year,
            month: date.month,
            amount: amount,
            currency: currency || ''
        });
    }

    function allocateSpend(quantity, unit, currency, dates, fallbackDate) {
        if (!unit || quantity <= 0) return;
        const list = (Array.isArray(dates) ? dates : [dates]).filter(Boolean);
        if (list.length === 1 || list.length === 0) {
            rememberSpend(list[0], fallbackDate, unit * quantity, currency);
            return;
        }
        const counted = Math.min(list.length, quantity);
        for (let i = 0; i < counted; i++) rememberSpend(list[i], fallbackDate, unit, currency);
        const rest = quantity - counted;
        if (rest > 0) rememberSpend(null, fallbackDate, unit * rest, currency);
    }

    function addPaidPurchase(itemName, parsed, quantity, classification, dates, fallbackDate) {
        if (quantity <= 0) return;
        totalItems += quantity;

        if (parsed.kind === 'missing' || parsed.kind === 'free') {
            freeItems += quantity;
            return;
        }

        const lineTotal = parsed.amount * quantity;
        paidItems += quantity;
        GaijinPrice.addMoney(totalMoney, parsed.currency, lineTotal);
        allocateSpend(quantity, parsed.amount, parsed.currency, dates, fallbackDate);

        if (classification.kind === 'eagles') {
            totalEagles += classification.eagles * quantity;
            GaijinPrice.addMoney(eagleMoney, parsed.currency, lineTotal);
        } else if (classification.kind === 'premium') {
            totalPremiumDays += classification.days * quantity;
            GaijinPrice.addMoney(premiumMoney, parsed.currency, lineTotal);
        } else {
            totalPacksCount += quantity;
            GaijinPrice.addMoney(packMoney, parsed.currency, lineTotal);
        }

        expensive.push({
            name: itemName,
            quantity: quantity,
            sortAmount: lineTotal,
            totalLabel: GaijinPrice.formatAmount(lineTotal, parsed.currency, currentLanguage)
        });
    }

    function pushReceived(itemName, parsed, event) {
        receivedGifts.push(giftEntry(itemName, event.fromUser, event.date, 1, parsed));
    }

    function pushSent(itemName, parsed, user, date, quantity) {
        const entry = giftEntry(itemName, user, date, quantity, parsed);
        sentGifts.push(entry);
        if (parsed.kind === 'paid') GaijinPrice.addMoney(giftMoney, parsed.currency, entry.amount);
    }

    function takeHistory(item, groups, giftCard) {
        const popup = getItemPopup(item);
        const key = historyKey(popup);
        if (key && countedHistories.has(key)) return false;
        if (key) countedHistories.add(key);

        const itemName = getCleanItemName(item);
        const parsed = GaijinPrice.interpretPrice(getPriceText(item));
        const classification = GaijinPrice.classifyPurchaseName(itemName);
        const cardQuantity = getItemQuantity(item);
        const spentOn = cardSpendDate(item);
        const ownQty = groups.own.length
            ? groups.own.length
            : (groups.received.length || groups.sent.length || giftCard ? 0 : cardQuantity);

        groups.received.forEach((event) => pushReceived(itemName, parsed, event));
        groups.sent.forEach((event) => {
            pushSent(itemName, parsed, event.toUser, event.date, 1);
            addPaidPurchase(itemName, parsed, 1, classification, [event.date], spentOn);
        });
        addPaidPurchase(
            itemName,
            parsed,
            ownQty,
            classification,
            groups.own.map((event) => event.date),
            spentOn
        );
        return true;
    }

    items.forEach((item) => {
        if (isGiftItem(item)) return;
        takeHistory(item, classifyAcquisitionEvents(getItemPopup(item)), false);
    });

    items.forEach((item) => {
        if (!isGiftItem(item)) return;
        const groups = classifyAcquisitionEvents(getItemPopup(item));
        takeHistory(item, groups, true);
        if (groups.sent.length) return;

        const itemName = getCleanItemName(item);
        const parsed = GaijinPrice.interpretPrice(getPriceText(item));
        const classification = GaijinPrice.classifyPurchaseName(itemName);
        const cardQuantity = Math.max(getItemQuantity(item), 1);
        const spentOn = cardSpendDate(item);
        pushSent(itemName, parsed, '', '', cardQuantity);
        addPaidPurchase(itemName, parsed, cardQuantity, classification, [spentOn], spentOn);
    });

    expensive.sort((a, b) => b.sortAmount - a.sortAmount);
    const symbol = fallbackSymbol(totalMoney);
    const receivedMoney = GaijinPrice.emptyMoney();
    receivedGifts.forEach((entry) => {
        if (entry.amount) GaijinPrice.addMoney(receivedMoney, entry.currency, entry.amount);
    });
    const receivedSymbol = fallbackSymbol(receivedMoney) || symbol;
    const combinedMoney = GaijinPrice.emptyMoney();
    [totalMoney, receivedMoney].forEach((bucket) => {
        Object.entries(bucket.amounts).forEach(([currency, amount]) => {
            GaijinPrice.addMoney(combinedMoney, currency, amount);
        });
    });
    const combinedSymbol = fallbackSymbol(combinedMoney) || symbol;
    const loading = sectionsPending();
    const years = buildYearBreakdown(spendPoints, symbol);
    const undatedLabel = Object.keys(undatedMoney.amounts).length
        ? GaijinPrice.formatMoney(undatedMoney, currentLanguage, symbol)
        : '';

    return {
        total: GaijinPrice.primaryTotal(totalMoney),
        totalLabel: GaijinPrice.formatMoney(combinedMoney, currentLanguage, combinedSymbol),
        purchaseLabel: GaijinPrice.formatMoney(totalMoney, currentLanguage, symbol),
        currencySymbol: symbol ? ' ' + symbol : '',
        totalItems: totalItems,
        freeItems: freeItems,
        paidItems: paidItems,
        sectionsLoading: loading,
        processedElements: items.length,
        storeType: getStoreType(),
        mostExpensiveItems: expensive.slice(0, 5).map((item) => ({
            name: item.name,
            quantity: item.quantity,
            totalLabel: item.totalLabel
        })),
        giftLabel: GaijinPrice.formatMoney(giftMoney, currentLanguage, symbol),
        giftEmpty: Object.keys(giftMoney.amounts).length === 0,
        receivedGiftLabel: GaijinPrice.formatMoney(receivedMoney, currentLanguage, receivedSymbol),
        receivedGiftEmpty: receivedGifts.length === 0,
        receivedGifts: receivedGifts.slice().sort((a, b) => b.amount - a.amount),
        sentGifts: sentGifts.slice().sort((a, b) => b.amount - a.amount),
        eagles: {
            count: totalEagles,
            totalLabel: GaijinPrice.formatMoney(eagleMoney, currentLanguage, symbol)
        },
        premium: {
            days: totalPremiumDays,
            totalLabel: GaijinPrice.formatMoney(premiumMoney, currentLanguage, symbol)
        },
        packs: {
            count: totalPacksCount,
            totalLabel: GaijinPrice.formatMoney(packMoney, currentLanguage, symbol)
        },
        years: years,
        undatedLabel: undatedLabel
    };
}

function resultsSignature(results) {
    return [
        currentLanguage,
        results.totalLabel,
        results.totalItems,
        results.paidItems,
        results.freeItems,
        results.sectionsLoading,
        results.giftLabel,
        results.receivedGiftLabel,
        (results.receivedGifts || []).map((entry) => entry.user + entry.name + entry.priceLabel).join('~'),
        (results.sentGifts || []).map((entry) => entry.user + entry.name + entry.priceLabel).join('~'),
        results.eagles.count,
        results.eagles.totalLabel,
        results.premium.days,
        results.premium.totalLabel,
        results.packs.count,
        results.packs.totalLabel,
        (results.years || []).map((year) => year.year + year.totalLabel + year.months.map((month) => month.name + month.totalLabel).join(',')).join('~'),
        results.undatedLabel,
        results.mostExpensiveItems.map((item) => item.quantity + item.name + item.totalLabel).join('~')
    ].join('|');
}

function giftEntry(name, user, date, quantity, parsed) {
    const lineAmount = parsed.kind === 'paid' ? parsed.amount * quantity : 0;
    return {
        name: name,
        user: user || getTranslation('unknownGiver'),
        date: date,
        quantity: quantity,
        amount: lineAmount,
        currency: parsed.currency || '',
        priceLabel: parsed.kind === 'paid'
            ? GaijinPrice.formatAmount(lineAmount, parsed.currency, currentLanguage)
            : GaijinPrice.formatAmount(0, parsed.currency, currentLanguage)
    };
}

function sentGiftEntries(item, itemName, parsed, ownQty) {
    const events = parseAcquisitionEvents(getItemPopup(item)).filter((event) => event.isSent || event.toUser);
    if (!events.length) return [giftEntry(itemName, '', '', ownQty, parsed)];
    if (events.length === 1) {
        const event = events[0];
        return [giftEntry(itemName, event.toUser || event.fromUser, event.date, ownQty, parsed)];
    }

    let used = 0;
    return events.map((event, index) => {
        const quantity = index === events.length - 1 ? Math.max(ownQty - used, 1) : 1;
        used += quantity;
        return giftEntry(itemName, event.toUser || event.fromUser, event.date, quantity, parsed);
    });
}

function giftPositionRows(entries) {
    if (!entries || !entries.length) {
        return '<div style="color: #8a949e; text-align: center; font-size: 12px;">-</div>';
    }
    return entries.map((entry) => {
        const copies = entry.quantity > 1 ? ' · ' + entry.quantity + '×' : '';
        const left = entry.user + ' · ' + entry.name + copies;
        return `
            <div class="line">
                <span class="line-name" title="${escapeHtml(left)}">${escapeHtml(left)}</span>
                <span class="line-money line-sum">${escapeHtml(entry.priceLabel)}</span>
            </div>
        `;
    }).join('');
}

function giftSection(id, icon, title, totalLabel, entries, note, open) {
    const hasEntries = entries && entries.length;
    return `
        <details id="${id}" ${open && hasEntries ? 'open' : ''} style="margin-top: 8px;">
            <summary class="line summary-line">
                <span class="line-name"><span class="disclosure">▸</span> ${icon} ${escapeHtml(title)}</span>
                <span class="line-money line-sum">${escapeHtml(hasEntries ? totalLabel : '-')}</span>
            </summary>
            <div style="margin-top: 6px; padding-left: 4px;">
                ${giftPositionRows(entries)}
                <div style="font-size: 11px; color: #8a949e; text-align: right; margin-top: 4px;">${escapeHtml(note)}</div>
            </div>
        </details>
    `;
}

function buildYearBreakdown(points, symbol) {
    const monthNames = getTranslation('months');
    const monthIcons = ['❄️', '🌨', '🌱', '🌸', '🌷', '☀️', '🏖', '🌾', '🍂', '🎃', '🍁', '🎄'];
    const years = new Map();

    points.forEach((point) => {
        if (!years.has(point.year)) {
            years.set(point.year, { money: GaijinPrice.emptyMoney(), months: new Map() });
        }
        const year = years.get(point.year);
        GaijinPrice.addMoney(year.money, point.currency, point.amount);
        if (!year.months.has(point.month)) year.months.set(point.month, GaijinPrice.emptyMoney());
        GaijinPrice.addMoney(year.months.get(point.month), point.currency, point.amount);
    });

    return [...years.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([year, data]) => ({
            year: year,
            totalLabel: GaijinPrice.formatMoney(data.money, currentLanguage, symbol),
            months: [...data.months.entries()]
                .sort((a, b) => a[0] - b[0])
                .map(([month, money]) => ({
                    icon: monthIcons[month - 1] || '📅',
                    name: Array.isArray(monthNames) ? monthNames[month - 1] : String(month),
                    totalLabel: GaijinPrice.formatMoney(money, currentLanguage, symbol)
                }))
        }));
}

function yearBreakdownBlock(results) {
    const years = results.years || [];
    if (!years.length && !results.undatedLabel) return '';
    const yearRows = years.map((year) => `
        <details style="margin-top: 6px;">
            <summary class="line summary-line">
                <span class="line-name"><span class="disclosure">▸</span> 📅 ${escapeHtml(String(year.year))}</span>
                <span class="line-money line-sum">${escapeHtml(year.totalLabel)}</span>
            </summary>
            <div class="nested">
                ${year.months.map((month) => `
                    <div class="line">
                        <span class="line-name">${month.icon} ${escapeHtml(month.name)}</span>
                        <span class="line-money line-sum">${escapeHtml(month.totalLabel)}</span>
                    </div>
                `).join('')}
            </div>
        </details>
    `).join('');
    const undated = results.undatedLabel
        ? `<div class="line undated"><span class="line-name">❓ ${escapeHtml(getTranslation('undated'))}</span><span class="line-money line-sum">${escapeHtml(results.undatedLabel)}</span></div>`
        : '';
    return `
        <details id="spendByYear" ${popupState.yearsOpen ? 'open' : ''} style="margin-top: 8px;">
            <summary class="line summary-line">
                <span class="line-name"><span class="disclosure">▸</span> 📅 ${escapeHtml(getTranslation('byYear'))}</span>
                <span class="line-money line-sum">${escapeHtml(results.purchaseLabel)}</span>
            </summary>
            <div style="margin-top: 6px; padding-left: 4px;">
                ${yearRows}
                ${undated}
            </div>
        </details>
    `;
}

function categoryRow(icon, label, count, unit, moneyLabel) {
    const countLabel = count.toLocaleString(currentLanguage === 'ru' ? 'ru-RU' : 'en-US') + ' ' + unit;
    return `
        <div class="line">
            <span class="line-name">${icon} ${escapeHtml(label)}</span>
            <span class="line-money"><b class="line-count">${escapeHtml(countLabel)}</b> <span class="line-sum">(${escapeHtml(moneyLabel)})</span></span>
        </div>
    `;
}

function displayResults(results) {
    if (isPopupManuallyClosed) return;

    const signature = resultsSignature(results);
    if (signature === lastSignature && document.getElementById('gaijin-purchase-summary')) return;
    lastSignature = signature;

    const oldResults = document.getElementById('gaijin-purchase-summary');
    if (oldResults) oldResults.remove();

    const resultsContainer = document.createElement('div');
    resultsContainer.id = 'gaijin-purchase-summary';
    resultsContainer.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: #2d3a48;
        padding: 20px;
        border: 2px solid #27323f;
        border-radius: 10px;
        box-shadow: 0 8px 24px rgba(0,0,0,0.3);
        z-index: 10000;
        font-family: Arial, sans-serif;
        width: 420px;
        max-height: 85vh;
        overflow-y: auto;
        overflow-x: hidden;
        scrollbar-gutter: stable;
        color: #bac2c8;
        box-sizing: border-box;
    `;

    const storeName = results.storeType === 'pixstorm' ? getTranslation('pixstormStore') : getTranslation('gaijinStore');
    const shouldOpenExtendedStats = popupState.extendedStatsOpen;
    const expensiveHtml = results.mostExpensiveItems.length
        ? results.mostExpensiveItems.map((item) => `
            <div class="line">
                <span class="line-name" title="${escapeHtml(item.name)}">${item.quantity > 1 ? escapeHtml(String(item.quantity)) + '× ' : ''}${escapeHtml(item.name)}</span>
                <span class="line-money line-sum">${escapeHtml(item.totalLabel)}</span>
            </div>
        `).join('')
        : '<div style="color: #8a949e; text-align: center; font-size: 12px;">-</div>';

    const footerText = results.sectionsLoading ? getTranslation('openingLists') : getTranslation('listsIncluded');

    resultsContainer.innerHTML = `
        <style>
            #gaijin-purchase-summary {
                scrollbar-width: thin;
                scrollbar-color: #19bcb7 #202a35;
            }
            #gaijin-purchase-summary::-webkit-scrollbar { width: 8px; }
            #gaijin-purchase-summary::-webkit-scrollbar-track {
                background: #202a35;
                border-radius: 8px;
            }
            #gaijin-purchase-summary::-webkit-scrollbar-thumb {
                background: #19bcb7;
                border-radius: 8px;
                border: 2px solid #202a35;
            }
            #gaijin-purchase-summary::-webkit-scrollbar-thumb:hover { background: #e1ce9b; }
            #gaijin-purchase-summary summary { list-style: none; }
            #gaijin-purchase-summary summary::-webkit-details-marker { display: none; }
            #gaijin-purchase-summary summary .disclosure {
                display: inline-block;
                width: 0.9em;
                color: #8a949e;
                transition: transform 0.15s ease;
            }
            #gaijin-purchase-summary details[open] > summary .disclosure { transform: rotate(90deg); }
            #gaijin-purchase-summary .line {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 10px;
                min-width: 0;
            }
            #gaijin-purchase-summary .line-name {
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                color: #bac2c8;
            }
            #gaijin-purchase-summary .line-money {
                flex-shrink: 0;
                white-space: nowrap;
                text-align: right;
            }
            #gaijin-purchase-summary .line-count { color: #e1ce9b; }
            #gaijin-purchase-summary .line-sum { color: #19bcb7; font-weight: bold; }
            #gaijin-purchase-summary .summary-line { cursor: pointer; font-size: 12px; }
            #gaijin-purchase-summary .nested { padding-left: 14px; }
            #gaijin-purchase-summary .total-caption,
            #gaijin-purchase-summary .footnote {
                text-wrap: balance;
                overflow-wrap: normal;
            }
        </style>
        <div style="font-weight: bold; color: #e1ce9b; margin-bottom: 14px; font-size: 18px; text-align: center;">
            🎯 ${escapeHtml(getTranslation('purchaseStats'))}
        </div>
        <div style="font-size: 12px; color: #8a949e; text-align: center; margin-bottom: 10px;">
            ${escapeHtml(storeName)}
        </div>
        <div style="margin-bottom: 10px; padding: 12px 10px; background: #27323f; border-radius: 6px; border: 1px solid #344150;">
            <div style="font-size: 12px; color: #8a949e; margin-bottom: 4px; text-align: center; text-transform: uppercase;">
                ${escapeHtml(getTranslation('totalAmount'))}
            </div>
            <div style="font-size: 24px; font-weight: bold; color: #19bcb7; text-align: center;">
                ${escapeHtml(results.totalLabel)}
            </div>
            <div class="total-caption" style="font-size: 11px; color: #8a949e; text-align: center; margin-top: 4px;">
                ${escapeHtml(getTranslation('currentPrices'))}
            </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px;">
            <div style="background: #27323f; border-radius: 6px; padding: 8px 4px; text-align: center; border: 1px solid #344150;">
                <div style="font-size: 10px; color: #8a949e; margin-bottom: 2px; text-transform: uppercase;">${escapeHtml(getTranslation('totalItems'))}</div>
                <div style="font-size: 16px; font-weight: bold; color: #bac2c8;">${results.totalItems}</div>
            </div>
            <div style="background: #27323f; border-radius: 6px; padding: 8px 4px; text-align: center; border: 1px solid #344150;">
                <div style="font-size: 10px; color: #8a949e; margin-bottom: 2px; text-transform: uppercase;">${escapeHtml(getTranslation('paidItems'))}</div>
                <div style="font-size: 16px; font-weight: bold; color: #e1ce9b;">${results.paidItems}</div>
            </div>
            <div style="background: #27323f; border-radius: 6px; padding: 8px 4px; text-align: center; border: 1px solid #344150;">
                <div style="font-size: 10px; color: #8a949e; margin-bottom: 2px; text-transform: uppercase;">${escapeHtml(getTranslation('freeItems'))}</div>
                <div style="font-size: 16px; font-weight: bold; color: #8a949e;">${results.freeItems}</div>
            </div>
        </div>
        <div style="background: #27323f; border-radius: 6px; padding: 12px 10px; margin-bottom: 12px; border: 1px solid #344150;">
            <div style="font-size: 11px; font-weight: bold; color: #e1ce9b; margin-bottom: 10px; text-transform: uppercase;">
                ${escapeHtml(getTranslation('categoriesHeader'))}
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
                ${categoryRow('🦅', getTranslation('goldenEaglesCat'), results.eagles.count, getTranslation('eaglesUnit'), results.eagles.totalLabel)}
                ${categoryRow('⭐', getTranslation('premiumDaysCat'), results.premium.days, getTranslation('daysUnit'), results.premium.totalLabel)}
                ${categoryRow('📦', getTranslation('packsVehiclesCat'), results.packs.count, getTranslation('pcsUnit'), results.packs.totalLabel)}
            </div>
        </div>
        <details id="extendedStats" ${shouldOpenExtendedStats ? 'open' : ''} style="margin-bottom: 12px; background: #27323f; border-radius: 6px; padding: 10px; border: 1px solid #344150;">
            <summary class="line summary-line" style="color: #19bcb7; font-weight: bold; font-size: 13px;">
                <span class="line-name"><span class="disclosure">▸</span> 📊 ${escapeHtml(getTranslation('extendedStats'))}</span>
            </summary>
            <div style="margin-top: 10px; border-top: 1px solid #344150; padding-top: 10px;">
                <div style="margin-bottom: 10px;">
                    <div style="color: #bac2c8; font-size: 12px; margin-bottom: 6px;">${escapeHtml(getTranslation('mostExpensive'))}</div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        ${expensiveHtml}
                    </div>
                </div>
                ${yearBreakdownBlock(results)}
                ${giftSection('receivedGifts', '🎁', getTranslation('giftsToMe'), results.receivedGiftLabel, results.receivedGifts, getTranslation('giftsToMeNote'), popupState.receivedGiftsOpen)}
                ${giftSection('sentGifts', '🎁', getTranslation('giftsToOthers'), results.giftLabel, results.sentGifts, getTranslation('giftsIncluded'), popupState.sentGiftsOpen)}
            </div>
        </details>
        <button id="refreshPopupBtn" style="width: 100%; padding: 10px; background: #19bcb7; color: #2d3a48; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">
            🔄 ${escapeHtml(getTranslation('refreshButton'))}
        </button>
        <div class="footnote" style="font-size: 11px; color: #8a949e; margin-top: 12px; text-align: center; border-top: 1px solid #27323f; padding-top: 8px;">
            ${escapeHtml(footerText)}
        </div>
    `;

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.textContent = '×';
    closeButton.setAttribute('aria-label', 'Close');
    closeButton.style.cssText = `
        position: absolute;
        top: 8px;
        right: 10px;
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #8a949e;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
    `;
    closeButton.onclick = () => {
        isPopupManuallyClosed = true;
        lastSignature = '';
        resultsContainer.remove();
        savePopupVisibilityState(false);
        notifyPopupAboutVisibility();
    };

    const refreshBtn = resultsContainer.querySelector('#refreshPopupBtn');
    refreshBtn.onclick = () => {
        refreshBtn.textContent = '⏳ ' + getTranslation('loading');
        refreshBtn.disabled = true;
        savePopupState();
        lastSignature = '';
        waitForSections(10000).then((nextResults) => {
            displayResults(nextResults);
        });
    };

    const extendedStats = resultsContainer.querySelector('#extendedStats');
    if (extendedStats) {
        extendedStats.addEventListener('toggle', () => {
            popupState.extendedStatsOpen = extendedStats.open;
        });
    }
    const receivedGifts = resultsContainer.querySelector('#receivedGifts');
    if (receivedGifts) {
        receivedGifts.addEventListener('toggle', () => {
            popupState.receivedGiftsOpen = receivedGifts.open;
        });
    }
    const sentGiftsPanel = resultsContainer.querySelector('#sentGifts');
    if (sentGiftsPanel) {
        sentGiftsPanel.addEventListener('toggle', () => {
            popupState.sentGiftsOpen = sentGiftsPanel.open;
        });
    }
    const spendByYear = resultsContainer.querySelector('#spendByYear');
    if (spendByYear) {
        spendByYear.addEventListener('toggle', () => {
            popupState.yearsOpen = spendByYear.open;
        });
    }

    resultsContainer.appendChild(closeButton);
    document.body.appendChild(resultsContainer);
    savePopupVisibilityState(true);
    notifyPopupAboutVisibility();
    publishResults(results);
}

function showPopup() {
    isPopupManuallyClosed = false;
    lastSignature = '';
    requestExpand();
    displayResults(calculateTotalPurchases());
    waitForSections(10000).then((results) => {
        if (!isPopupManuallyClosed) displayResults(results);
    });
}

function hidePopup() {
    isPopupManuallyClosed = true;
    lastSignature = '';
    const oldResults = document.getElementById('gaijin-purchase-summary');
    if (oldResults) oldResults.remove();
    savePopupVisibilityState(false);
    notifyPopupAboutVisibility();
}

function togglePopup(show) {
    if (show) showPopup();
    else hidePopup();
}

function getPopupState() {
    const popupExists = !!document.getElementById('gaijin-purchase-summary');
    return {
        isVisible: popupExists && !isPopupManuallyClosed,
        exists: popupExists
    };
}

function waitForSections(timeoutMs) {
    requestExpand();
    return new Promise((resolve) => {
        const start = Date.now();
        let stableTicks = 0;
        let lastCount = -1;

        const tick = () => {
            requestExpand();
            const count = getPurchaseItems().length;
            const pending = sectionsPending();
            if (!pending && count === lastCount) stableTicks += 1;
            else stableTicks = 0;
            lastCount = count;

            const elapsed = Date.now() - start;
            if ((elapsed > 500 && !pending && stableTicks >= 2) || elapsed > timeoutMs) {
                resolve(calculateTotalPurchases());
                return;
            }
            window.setTimeout(tick, 250);
        };

        window.setTimeout(tick, 50);
    });
}

function isOwnNode(node) {
    return !!(node && node.nodeType === 1 && (node.id === 'gaijin-purchase-summary' || node.closest('#gaijin-purchase-summary')));
}

function isRelevantMutation(mutations) {
    return mutations.some((mutation) => {
        const target = mutation.target.nodeType === 1 ? mutation.target : mutation.target.parentElement;
        if (target && isOwnNode(target)) return false;
        const touched = [...mutation.addedNodes, ...mutation.removedNodes].filter((node) => node.nodeType === 1);
        if (touched.length && touched.every((node) => isOwnNode(node))) return false;
        return true;
    });
}

let observerStarted = false;

function startObserver() {
    if (observerStarted || !document.body) return;
    observerStarted = true;
    let timer = 0;
    const observer = new MutationObserver((mutations) => {
        if (!isRelevantMutation(mutations)) return;
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
            requestExpand();
            if (isPopupManuallyClosed) return;
            displayResults(calculateTotalPurchases());
        }, 300);
    });
    observer.observe(document.body, { childList: true, subtree: true });
}

function initExtension() {
    if (!isPurchasesPage()) return;

    chrome.storage.local.get(['popupVisible', 'popupManuallyClosed', 'language'], (result) => {
        if (result && result.language) currentLanguage = result.language;
        if (result && result.popupManuallyClosed !== undefined) {
            isPopupManuallyClosed = result.popupManuallyClosed;
        }

        startObserver();
        requestExpand();

        if (!isPopupManuallyClosed) {
            displayResults(calculateTotalPurchases());
        }

        waitForSections(10000).then((results) => {
            publishResults(results);
            if (!isPopupManuallyClosed) displayResults(results);
        });
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExtension);
} else {
    initExtension();
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || !request.action || !isPurchasesPage()) return;

    if (request.action === 'calculatePurchases') {
        waitForSections(10000).then((results) => {
            sendResponse({ success: true, results: results });
        });
        return true;
    }
    if (request.action === 'togglePopup') {
        togglePopup(request.isVisible);
        sendResponse({ success: true });
        return;
    }
    if (request.action === 'getPopupState') {
        sendResponse({ success: true, isVisible: getPopupState().isVisible });
        return;
    }
    if (request.action === 'setLanguage') {
        setContentLanguage(request.language);
        sendResponse({ success: true });
    }
});
