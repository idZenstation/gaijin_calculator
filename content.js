// Глобальная переменная для отслеживания состояния
let isPopupManuallyClosed = false;
let currentLanguage = 'ru';

// Состояние раскрытых элементов попапа
let popupState = {
    extendedStatsOpen: false
};

// Локализация для content.js
const contentTranslations = {
    ru: {
        purchaseStats: "Сумма покупок",
        totalAmount: "Общая сумма",
        totalItems: "Всего",
        freeItems: "Бесплатные",
        paidItems: "Платные",
        refreshButton: "Обновить статистику",
        allItemsIncluded: "Учтены все товары на странице",
        loading: "Загрузка...",
        gaijinStore: "Gaijin Store",
        pixstormStore: "PixStorm Store",
        extendedStats: "Расширенная статистика",
        categoriesHeader: "Категории расходов:",
        goldenEaglesCat: "Золотые орлы:",
        premiumDaysCat: "Премиум-аккаунт:",
        packsVehiclesCat: "Пакеты и техника:",
        mostExpensive: "Самые дорогие товары:",
        giftsToOthers: "Подарки другим:",
        eaglesUnit: "орлов",
        daysUnit: "дней",
        pcsUnit: "шт."
    },
    en: {
        purchaseStats: "Purchase Summary",
        totalAmount: "Total Amount",
        totalItems: "Total",
        freeItems: "Free",
        paidItems: "Paid",
        refreshButton: "Refresh Statistics",
        allItemsIncluded: "All items on page included",
        loading: "Loading...",
        gaijinStore: "Gaijin Store",
        pixstormStore: "PixStorm Store",
        extendedStats: "Extended Statistics",
        categoriesHeader: "Spending Categories:",
        goldenEaglesCat: "Golden Eagles:",
        premiumDaysCat: "Premium Account:",
        packsVehiclesCat: "Packs & Vehicles:",
        mostExpensive: "Most expensive items:",
        giftsToOthers: "Gifts to others:",
        eaglesUnit: "eagles",
        daysUnit: "days",
        pcsUnit: "pcs."
    }
};

function getTranslation(key) {
    return contentTranslations[currentLanguage][key] || key;
}

function setContentLanguage(lang) {
    currentLanguage = lang;
    const existingPopup = document.getElementById('gaijin-purchase-summary');
    if (existingPopup && !isPopupManuallyClosed) {
        const results = calculateTotalPurchases();
        displayResults(results);
    }
}

function notifyPopupAboutVisibility() {
    chrome.runtime.sendMessage({
        action: "popupVisibilityChanged",
        isVisible: !isPopupManuallyClosed
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
    if (popup) {
        const extendedStats = popup.querySelector('details');
        if (extendedStats) {
            popupState.extendedStatsOpen = extendedStats.open;
        }
    }
}

function getStoreType() {
    const url = window.location.hostname;
    if (url.includes('pixstorm.ru')) return 'pixstorm';
    if (url.includes('gaijin.net')) return 'gaijin';
    return 'unknown';
}

function getSelectors() {
    return {
        item: '.showcase-item',
        price: '.showcase-item-price',
        quantity: '.showcase-item-description__title-comment',
        title: '.showcase-item-description__title'
    };
}

function parsePrice(priceText) {
    if (!priceText) return 0;
    const match = priceText.match(/(\d[\d\s,]*)\.?\d*/);
    if (match) {
        let priceStr = match[1].replace(/\s/g, '').replace(',', '.');
        return parseFloat(priceStr) || 0;
    }
    return 0;
}

function getCleanItemName(item) {
    const selectors = getSelectors();
    const titleElement = item.querySelector(selectors.title);
    const quantityElement = item.querySelector(selectors.quantity);

    if (!titleElement) return 'Unknown Item';

    let name = titleElement.textContent.trim();
    if (quantityElement) {
        const quantityText = quantityElement.textContent.trim();
        name = name.replace(quantityText, '').trim();
    }
    return name;
}

function getItemQuantity(item) {
    const selectors = getSelectors();
    const quantityElement = item.querySelector(selectors.quantity);

    if (quantityElement) {
        const quantityText = quantityElement.textContent.trim();
        const match = quantityText.match(/(\d+)\s*x/);
        if (match) {
            return parseInt(match[1], 10) || 1;
        }
    }
    return 1;
}

function isGoldenEagles(itemName) {
    if (!itemName) return false;
    const eaglesPatterns = [/золотых орлов/i, /golden eagles/i, /орлов/i, /eagles/i];
    return eaglesPatterns.some(pattern => pattern.test(itemName));
}

function isPurePremiumAccount(itemName) {
    if (!itemName) return false;
    const premiumPatterns = [
        /премиум-аккаунт/i,
        /премиум аккаунт/i,
        /premium account/i,
        /premium-account/i
    ];
    return premiumPatterns.some(pattern => pattern.test(itemName));
}

function extractPremiumDays(itemName) {
    const match = itemName.match(/(\d+)\s*(?:дней|дня|день|days|day)/i);
    return match ? (parseInt(match[1], 10) || 0) : 0;
}

function extractEaglesCount(itemName) {
    const match = itemName.match(/(\d+[\s\d]*)\s*(?:Золотых орлов|Golden eagles|орлов|eagles)/i);
    if (match) {
        return parseInt(match[1].replace(/\s/g, ''), 10) || 0;
    }
    return 0;
}

function calculateTotalPurchases() {
    const selectors = getSelectors();
    const purchaseItems = document.querySelectorAll(selectors.item);

    const donatorBlock = document.getElementById('PURCH_donator_link') ||
                         document.querySelector('[id*="donator"], [class*="donator"]');

    let total = 0;
    let totalItems = 0;
    let freeItems = 0;
    let paidItems = 0;
    let giftTotal = 0;

    let eaglesSpent = 0;
    let totalEagles = 0;

    let premiumSpent = 0;
    let totalPremiumDays = 0;

    let packsSpent = 0;
    let totalPacksCount = 0;

    const regularItems = [];
    let detectedCurrency = null;

    purchaseItems.forEach((item) => {
        const itemName = getCleanItemName(item);
        const quantity = getItemQuantity(item);
        const priceElement = item.querySelector(selectors.price);

        let price = 0;
        if (priceElement) {
            const priceText = priceElement.textContent.trim();
            price = parsePrice(priceText);

            if (!detectedCurrency) {
                const currMatch = priceText.match(/[^\d\s.,]+/);
                if (currMatch) detectedCurrency = currMatch[0];
            }
        }

        const isGift = donatorBlock ? donatorBlock.contains(item) : false;
        const isEagles = isGoldenEagles(itemName);
        const isPremium = isPurePremiumAccount(itemName);

        const itemTotal = price * quantity;
        total += itemTotal;
        totalItems += quantity;

        if (price > 0) {
            paidItems += quantity;

            if (isGift) {
                giftTotal += itemTotal;
            }

            if (isEagles) {
                const eaglesCount = extractEaglesCount(itemName);
                totalEagles += eaglesCount * quantity;
                eaglesSpent += itemTotal;
            } else if (isPremium) {
                const days = extractPremiumDays(itemName);
                totalPremiumDays += days * quantity;
                premiumSpent += itemTotal;
            } else {
                totalPacksCount += quantity;
                packsSpent += itemTotal;

                if (!isGift) {
                    regularItems.push({
                        name: itemName,
                        price: price,
                        quantity: quantity,
                        total: itemTotal
                    });
                }
            }
        } else {
            freeItems += quantity;
        }
    });

    regularItems.sort((a, b) => b.price - a.price);
    const mostExpensiveItems = regularItems.slice(0, 5);

    const currencySymbol = detectedCurrency ? ` ${detectedCurrency}` : (currentLanguage === 'ru' ? ' ₽' : ' RUB');

    return {
        total: Math.round(total * 100) / 100,
        currencySymbol,
        totalItems,
        freeItems,
        paidItems,
        processedElements: purchaseItems.length,
        storeType: getStoreType(),
        mostExpensiveItems,
        giftTotal: Math.round(giftTotal * 100) / 100,
        eagles: {
            count: totalEagles,
            total: Math.round(eaglesSpent * 100) / 100
        },
        premium: {
            days: totalPremiumDays,
            total: Math.round(premiumSpent * 100) / 100
        },
        packs: {
            count: totalPacksCount,
            total: Math.round(packsSpent * 100) / 100
        }
    };
}

function displayResults(results) {
    if (isPopupManuallyClosed) return;

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
        width: 390px;
        max-height: 85vh;
        overflow-y: auto;
        color: #bac2c8;
        box-sizing: border-box;
    `;

    const storeName = results.storeType === 'pixstorm' ? getTranslation('pixstormStore') : getTranslation('gaijinStore');
    const currency = results.currencySymbol;
    const shouldOpenExtendedStats = popupState.extendedStatsOpen;

    resultsContainer.innerHTML = `
        <div style="font-weight: bold; color: #e1ce9b; margin-bottom: 14px; font-size: 18px; text-align: center;">
            🎯 ${getTranslation('purchaseStats')}
        </div>

        <div style="font-size: 12px; color: #8a949e; text-align: center; margin-bottom: 10px;">
            ${storeName}
        </div>

        <!-- Общая сумма -->
        <div style="margin-bottom: 10px; padding: 12px 10px; background: #27323f; border-radius: 6px; border: 1px solid #344150;">
            <div style="font-size: 12px; color: #8a949e; margin-bottom: 4px; text-align: center; text-transform: uppercase;">
                ${getTranslation('totalAmount')}
            </div>
            <div style="font-size: 24px; font-weight: bold; color: #19bcb7; text-align: center;">
                ${results.total.toLocaleString(currentLanguage === 'ru' ? 'ru-RU' : 'en-US')}${currency}
            </div>
        </div>

        <!-- Компактные плитки счетчиков -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; margin-bottom: 12px;">
            <div style="background: #27323f; border-radius: 6px; padding: 8px 4px; text-align: center; border: 1px solid #344150;">
                <div style="font-size: 10px; color: #8a949e; margin-bottom: 2px; text-transform: uppercase;">${getTranslation('totalItems')}</div>
                <div style="font-size: 16px; font-weight: bold; color: #bac2c8;">${results.totalItems}</div>
            </div>
            <div style="background: #27323f; border-radius: 6px; padding: 8px 4px; text-align: center; border: 1px solid #344150;">
                <div style="font-size: 10px; color: #8a949e; margin-bottom: 2px; text-transform: uppercase;">${getTranslation('paidItems')}</div>
                <div style="font-size: 16px; font-weight: bold; color: #e1ce9b;">${results.paidItems}</div>
            </div>
            <div style="background: #27323f; border-radius: 6px; padding: 8px 4px; text-align: center; border: 1px solid #344150;">
                <div style="font-size: 10px; color: #8a949e; margin-bottom: 2px; text-transform: uppercase;">${getTranslation('freeItems')}</div>
                <div style="font-size: 16px; font-weight: bold; color: #8a949e;">${results.freeItems}</div>
            </div>
        </div>

        <!-- Разделы статистики по категориям -->
        <div style="background: #27323f; border-radius: 6px; padding: 12px 10px; margin-bottom: 12px; border: 1px solid #344150;">
            <div style="font-size: 11px; font-weight: bold; color: #e1ce9b; margin-bottom: 10px; text-transform: uppercase;">
                ${getTranslation('categoriesHeader')}
            </div>
            <div style="display: flex; flex-direction: column; gap: 8px; font-size: 13px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #bac2c8;">🦅 ${getTranslation('goldenEaglesCat')}</span>
                    <span style="text-align: right;">
                        <b style="color: #e1ce9b;">${results.eagles.count.toLocaleString()}</b> ${getTranslation('eaglesUnit')}
                        <span style="color: #19bcb7; font-weight: bold;">(${results.eagles.total.toLocaleString()}${currency})</span>
                    </span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #bac2c8;">⭐ ${getTranslation('premiumDaysCat')}</span>
                    <span style="text-align: right;">
                        <b style="color: #e1ce9b;">${results.premium.days.toLocaleString()}</b> ${getTranslation('daysUnit')}
                        <span style="color: #19bcb7; font-weight: bold;">(${results.premium.total.toLocaleString()}${currency})</span>
                    </span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <span style="color: #bac2c8;">📦 ${getTranslation('packsVehiclesCat')}</span>
                    <span style="text-align: right;">
                        <b style="color: #e1ce9b;">${results.packs.count.toLocaleString()}</b> ${getTranslation('pcsUnit')}
                        <span style="color: #19bcb7; font-weight: bold;">(${results.packs.total.toLocaleString()}${currency})</span>
                    </span>
                </div>
            </div>
        </div>

        <!-- Дополнительные детали -->
        <details ${shouldOpenExtendedStats ? 'open' : ''} style="margin-bottom: 12px; background: #27323f; border-radius: 6px; padding: 10px; border: 1px solid #344150;">
            <summary style="cursor: pointer; color: #19bcb7; font-weight: bold; font-size: 13px;">
                📊 ${getTranslation('extendedStats')}
            </summary>

            <div style="margin-top: 10px; border-top: 1px solid #344150; padding-top: 10px;">
                <div style="margin-bottom: 10px;">
                    <div style="color: #bac2c8; font-size: 12px; margin-bottom: 6px;">${getTranslation('mostExpensive')}</div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        ${results.mostExpensiveItems.length > 0 ?
                            results.mostExpensiveItems.map(item => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 2px 0;">
                                    <span title="${item.name}" style="color: #bac2c8; font-size: 12px; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 8px;">
                                        ${item.quantity > 1 ? item.quantity + '× ' : ''}${item.name}
                                    </span>
                                    <span style="color: #19bcb7; font-weight: bold; font-size: 12px; white-space: nowrap;">
                                        ${item.price.toLocaleString()}${currency}
                                    </span>
                                </div>
                            `).join('') :
                            '<div style="color: #8a949e; text-align: center; font-size: 12px;">-</div>'
                        }
                    </div>
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #344150; padding-top: 8px; font-size: 12px;">
                    <span style="color: #bac2c8;">🎁 ${getTranslation('giftsToOthers')}</span>
                    <span style="color: #19bcb7; font-weight: bold;">
                        ${results.giftTotal > 0 ? results.giftTotal.toLocaleString() + currency : '-'}
                    </span>
                </div>
            </div>
        </details>

        <button id="refreshPopupBtn" style="width: 100%; padding: 10px; background: #19bcb7; color: #2d3a48; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; transition: all 0.2s ease;">
            🔄 ${getTranslation('refreshButton')}
        </button>

        <div style="font-size: 11px; color: #8a949e; margin-top: 12px; text-align: center; border-top: 1px solid #27323f; padding-top: 8px;">
            ${getTranslation('allItemsIncluded')}
        </div>
    `;

    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
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
        resultsContainer.remove();
        savePopupVisibilityState(false);
        notifyPopupAboutVisibility();
    };

    const refreshBtn = resultsContainer.querySelector('#refreshPopupBtn');
    refreshBtn.onclick = () => {
        refreshBtn.innerHTML = `⏳ ${getTranslation('loading')}`;
        refreshBtn.disabled = true;
        savePopupState();

        setTimeout(() => {
            const newResults = calculateTotalPurchases();
            displayResults(newResults);
        }, 300);
    };

    const extendedStats = resultsContainer.querySelector('details');
    if (extendedStats) {
        extendedStats.addEventListener('toggle', () => {
            popupState.extendedStatsOpen = extendedStats.open;
        });
    }

    resultsContainer.appendChild(closeButton);
    document.body.appendChild(resultsContainer);

    savePopupVisibilityState(true);
    notifyPopupAboutVisibility();
}

function showPopup() {
    isPopupManuallyClosed = false;
    const results = calculateTotalPurchases();
    if (results.processedElements > 0 || results.totalItems > 0) {
        displayResults(results);
    }
}

function hidePopup() {
    isPopupManuallyClosed = true;
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

function initExtension() {
    chrome.storage.local.get(['popupVisible', 'popupManuallyClosed', 'language'], function(result) {
        if (result && result.language) currentLanguage = result.language;
        if (result && result.popupManuallyClosed !== undefined) {
            isPopupManuallyClosed = result.popupManuallyClosed;
        }

        setTimeout(() => {
            if (!isPopupManuallyClosed) {
                const results = calculateTotalPurchases();
                if (results.processedElements > 0 || results.totalItems > 0) {
                    displayResults(results);
                }
            }
        }, 1000);
    });
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExtension);
} else {
    initExtension();
}

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "calculatePurchases") {
        sendResponse({ success: true, results: calculateTotalPurchases() });
    }
    if (request.action === "togglePopup") {
        togglePopup(request.isVisible);
        sendResponse({ success: true });
    }
    if (request.action === "getPopupState") {
        sendResponse({ success: true, isVisible: getPopupState().isVisible });
    }
    if (request.action === "setLanguage") {
        setContentLanguage(request.language);
        sendResponse({ success: true });
    }
    return true;
});