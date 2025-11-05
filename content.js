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
        totalItems: "Всего товаров:",
        freeItems: "Бесплатные товары:",
        paidItems: "Платные товары:",
        refreshButton: "Обновить статистику",
        allItemsIncluded: "Учтены все товары на странице",
        loading: "Загрузка...",
        gaijinStore: "Gaijin Store",
        pixstormStore: "PixStorm Store",
        extendedStats: "Расширенная статистика",
        mostExpensive: "Самые дорогие товары:",
        giftsToOthers: "Подарки другим:",
        goldenEagles: "Куплено орлов:",
        eagles: "орлов"
    },
    en: {
        purchaseStats: "Purchase Summary",
        totalAmount: "Total Amount",
        totalItems: "Total Items:",
        freeItems: "Free Items:",
        paidItems: "Paid Items:",
        refreshButton: "Refresh Statistics",
        allItemsIncluded: "All items on page included",
        loading: "Loading...",
        gaijinStore: "Gaijin Store",
        pixstormStore: "PixStorm Store",
        extendedStats: "Extended Statistics",
        mostExpensive: "Most expensive items:",
        giftsToOthers: "Gifts to others:",
        goldenEagles: "Golden eagles bought:",
        eagles: "eagles"
    }
};

// Функция для получения перевода
function getTranslation(key) {
    return contentTranslations[currentLanguage][key] || key;
}

// Функция для установки языка
function setContentLanguage(lang) {
    currentLanguage = lang;
    const existingPopup = document.getElementById('gaijin-purchase-summary');
    if (existingPopup && !isPopupManuallyClosed) {
        const results = calculateTotalPurchases();
        displayResults(results);
    }
}

// Функция для сохранения состояния видимости попапа в хранилище
function savePopupVisibilityState(isVisible) {
    chrome.storage.local.set({
        popupVisible: isVisible,
        popupManuallyClosed: !isVisible
    }, function() {
        console.log('Popup visibility state saved:', isVisible);
    });
}

// Функция для уведомления popup о изменении состояния
function notifyPopupAboutStateChange() {
    chrome.runtime.sendMessage({
        action: "popupStateChanged",
        isVisible: !isPopupManuallyClosed && !!document.getElementById('gaijin-purchase-summary')
    });
}

// Функция для сохранения состояния попапа
function savePopupState() {
    const popup = document.getElementById('gaijin-purchase-summary');
    if (popup) {
        const extendedStats = popup.querySelector('details');
        if (extendedStats) {
            popupState.extendedStatsOpen = extendedStats.open;
        }
    }
}

// Функция для восстановления состояния попапа
function restorePopupState() {
    const popup = document.getElementById('gaijin-purchase-summary');
    if (popup) {
        const extendedStats = popup.querySelector('details');
        if (extendedStats && popupState.extendedStatsOpen) {
            extendedStats.open = true;
        }
    }
}

// Функция для определения типа магазина
function getStoreType() {
    const url = window.location.hostname;
    if (url.includes('pixstorm.ru')) {
        return 'pixstorm';
    } else if (url.includes('gaijin.net')) {
        return 'gaijin';
    }
    return 'unknown';
}

// Функция для получения селекторов в зависимости от магазина
function getSelectors() {
    const storeType = getStoreType();
    return {
        item: '.showcase-item',
        price: '.showcase-item-price',
        quantity: '.showcase-item-description__title-comment',
        title: '.showcase-item-description__title'
    };
}

// Функция для парсинга цены из текста
function parsePrice(priceText) {
    if (!priceText) return 0;

    // Ищем число в формате "1 000 ₽" или "1,000 ₽"
    const match = priceText.match(/(\d[\d\s,]*)\.?\d*/);
    if (match) {
        let priceStr = match[1].replace(/\s/g, '').replace(',', '.');
        return parseFloat(priceStr) || 0;
    }
    return 0;
}

// Функция для получения чистого названия товара
function getCleanItemName(item) {
    const selectors = getSelectors();
    const titleElement = item.querySelector(selectors.title);
    const quantityElement = item.querySelector(selectors.quantity);

    if (!titleElement) return 'Unknown Item';

    let name = titleElement.textContent.trim();

    // Удаляем текст количества из названия
    if (quantityElement) {
        const quantityText = quantityElement.textContent.trim();
        name = name.replace(quantityText, '').trim();
    }

    return name;
}

// Функция для получения количества товара
function getItemQuantity(item) {
    const selectors = getSelectors();
    const quantityElement = item.querySelector(selectors.quantity);

    if (quantityElement) {
        const quantityText = quantityElement.textContent.trim();
        const match = quantityText.match(/(\d+)\s*x/);
        if (match) {
            return parseInt(match[1]) || 1;
        }
    }
    return 1;
}

// Функция для проверки, является ли товар золотыми орлами
function isGoldenEagles(itemName) {
    if (!itemName) return false;

    const eaglesPatterns = [
        /золотых орлов/i,
        /golden eagles/i,
        /орлов/i,
        /eagles/i
    ];

    return eaglesPatterns.some(pattern => pattern.test(itemName));
}

// Функция для проверки, является ли товар премиум аккаунтом
function isPremiumAccount(itemName) {
    if (!itemName) return false;

    const premiumPatterns = [
        /premium account/i,
        /премиум аккаунт/i,
        /premium.*время/i,
        /премиум.*время/i,
        /premium.*дней/i,
        /премиум.*дней/i,
        /premium.*days/i,
        /премиум/i
    ];

    return premiumPatterns.some(pattern => pattern.test(itemName));
}

// Функция для проверки, находится ли товар в блоке подарков
function isGiftItem(item) {
    // Проверяем, находится ли товар внутри блока донатора
    const donatorBlock = document.getElementById('PURCH_donator_link');
    if (donatorBlock && donatorBlock.contains(item)) {
        return true;
    }

    return false;
}

// Функция для расчета золотых орлов
function calculateGoldenEagles() {
    let totalEagles = 0;
    let totalSpent = 0;
    const selectors = getSelectors();
    const allItems = document.querySelectorAll(selectors.item);

    allItems.forEach(item => {
        const itemName = getCleanItemName(item);

        if (isGoldenEagles(itemName)) {
            const quantity = getItemQuantity(item);
            const priceElement = item.querySelector(selectors.price);

            if (priceElement) {
                const priceText = priceElement.textContent.trim();
                const price = parsePrice(priceText);

                if (price > 0) {
                    // Парсим количество орлов из названия
                    const eaglesMatch = itemName.match(/(\d+[\s\d]*)\s*(?:Золотых орлов|Golden eagles|орлов|eagles)/i);
                    if (eaglesMatch) {
                        const eaglesCount = parseInt(eaglesMatch[1].replace(/\s/g, '')) || 0;
                        if (eaglesCount > 0) {
                            totalEagles += eaglesCount * quantity;
                            totalSpent += price * quantity;

                            console.log(`Golden Eagles: ${quantity} × ${eaglesCount} eagles = ${eaglesCount * quantity} eagles, ${quantity} × ${price} ₽ = ${price * quantity} ₽`);
                        }
                    }
                }
            }
        }
    });

    return { total: totalSpent, count: totalEagles };
}

// Функция для расчета суммы подарков
function calculateGiftTotal() {
    let giftTotal = 0;
    const selectors = getSelectors();

    // Ищем блок донатора разными способами
    let donatorBlock = document.getElementById('PURCH_donator_link');
    if (!donatorBlock) {
        // Альтернативный поиск блока подарков
        donatorBlock = document.querySelector('[id*="donator"], [class*="donator"]');
    }

    if (donatorBlock) {
        console.log('Found donator block:', donatorBlock);
        const giftItems = donatorBlock.querySelectorAll(selectors.item);

        giftItems.forEach(item => {
            const priceElement = item.querySelector(selectors.price);
            if (priceElement) {
                const priceText = priceElement.textContent.trim();
                const price = parsePrice(priceText);
                const quantity = getItemQuantity(item);

                if (price > 0) {
                    giftTotal += price * quantity;
                    const itemName = getCleanItemName(item);
                    console.log(`Gift: ${itemName} - ${price} ₽ × ${quantity} = ${price * quantity} ₽`);
                }
            }
        });
    } else {
        console.log('No donator block found');
    }

    return giftTotal;
}

// Основная функция расчета
function calculateTotalPurchases() {
    console.log('=== STARTING CALCULATION ===');
    const selectors = getSelectors();
    const purchaseItems = document.querySelectorAll(selectors.item);
    let total = 0;
    let totalItems = 0;
    let freeItems = 0;
    let paidItems = 0;

    const regularItems = [];
    const excludedItems = [];

    console.log(`Found ${purchaseItems.length} items total`);

    purchaseItems.forEach((item, index) => {
        const itemName = getCleanItemName(item);
        const quantity = getItemQuantity(item);
        const priceElement = item.querySelector(selectors.price);

        let price = 0;
        if (priceElement) {
            const priceText = priceElement.textContent.trim();
            price = parsePrice(priceText);
        }

        const isEagles = isGoldenEagles(itemName);
        const isPremium = isPremiumAccount(itemName);
        const isGift = isGiftItem(item);

        console.log(`Item ${index + 1}: "${itemName}" - Price: ${price} ₽, Quantity: ${quantity}, Eagles: ${isEagles}, Premium: ${isPremium}, Gift: ${isGift}`);

        const itemTotal = price * quantity;
        total += itemTotal;
        totalItems += quantity;

        if (price > 0) {
            paidItems += quantity;

            // В обычные товары добавляем только если это НЕ орлы, НЕ премиум и НЕ подарки
            if (!isEagles && !isPremium && !isGift) {
                regularItems.push({
                    name: itemName,
                    price: price,
                    quantity: quantity,
                    total: itemTotal
                });
                console.log(`✓ ADDED to regular items: ${itemName}`);
            } else {
                excludedItems.push({
                    name: itemName,
                    price: price,
                    quantity: quantity,
                    isEagles: isEagles,
                    isPremium: isPremium,
                    isGift: isGift
                });
                console.log(`✗ EXCLUDED from regular items: ${itemName} (eagles: ${isEagles}, premium: ${isPremium}, gift: ${isGift})`);
            }
        } else {
            freeItems += quantity;
        }
    });

    // Сортируем обычные товары по цене (по убыванию) и берем топ-5
    regularItems.sort((a, b) => b.price - a.price);
    const mostExpensiveItems = regularItems.slice(0, 5);

    // Логируем исключенные товары для отладки
    console.log('Excluded items:', excludedItems);

    // Расчет золотых орлов (отдельная логика)
    const eaglesData = calculateGoldenEagles();

    // Расчет подарков
    const giftTotal = calculateGiftTotal();

    console.log('=== CALCULATION RESULTS ===');
    console.log(`Total: ${total} ₽`);
    console.log(`Total items: ${totalItems}`);
    console.log(`Paid items: ${paidItems}`);
    console.log(`Free items: ${freeItems}`);
    console.log(`Regular items count: ${regularItems.length}`);
    console.log(`Excluded items count: ${excludedItems.length}`);
    console.log(`Most expensive items:`, mostExpensiveItems);
    console.log(`Golden eagles: ${eaglesData.count} eagles, spent: ${eaglesData.total} ₽`);
    console.log(`Gifts to others: ${giftTotal} ₽`);

    return {
        total: Math.round(total * 100) / 100,
        totalItems,
        freeItems,
        paidItems,
        processedElements: purchaseItems.length,
        storeType: getStoreType(),
        mostExpensiveItems,
        giftTotal: Math.round(giftTotal * 100) / 100,
        goldenEaglesTotal: Math.round(eaglesData.total * 100) / 100,
        goldenEaglesCount: eaglesData.count
    };
}

// Функция для отображения результатов на странице
function displayResults(results) {
    if (isPopupManuallyClosed) {
        console.log('Popup was manually closed, skipping display');
        return;
    }

    // Удаляем старые результаты
    const oldResults = document.getElementById('gaijin-purchase-summary');
    if (oldResults) {
        oldResults.remove();
    }

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
        width: 380px;
        color: #bac2c8;
        resize: none;
        overflow: hidden;
        box-sizing: border-box;
    `;

    const storeName = results.storeType === 'pixstorm' ? getTranslation('pixstormStore') : getTranslation('gaijinStore');
    const currencySymbol = currentLanguage === 'ru' ? ' ₽' : ' RUB';

    // Определяем, нужно ли открывать расширенную статистику
    const shouldOpenExtendedStats = popupState.extendedStatsOpen;

    resultsContainer.innerHTML = `
        <div style="font-weight: bold; color: #e1ce9b; margin-bottom: 16px; font-size: 18px; text-align: center;">
            🎯 ${getTranslation('purchaseStats')}
        </div>

        <div style="font-size: 12px; color: #8a949e; text-align: center; margin-bottom: 10px;">
            ${storeName}
        </div>

        <!-- Основная статистика -->
        <div style="margin-bottom: 12px; padding: 10px; background: #27323f; border-radius: 6px;">
            <div style="font-size: 14px; color: #bac2c8; margin-bottom: 4px;">${getTranslation('totalAmount')}</div>
            <div style="font-size: 20px; font-weight: bold; color: #19bcb7; text-align: center;">
                ${results.total.toLocaleString(currentLanguage === 'ru' ? 'ru-RU' : 'en-US')}${currencySymbol}
            </div>
        </div>

        <!-- Основные статистики с Flexbox -->
        <div style="display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #bac2c8;">${getTranslation('totalItems')}</span>
                <span style="color: #bac2c8; font-weight: bold;">${results.totalItems}</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #bac2c8;">${getTranslation('freeItems')}</span>
                <span style="color: #bac2c8; font-weight: bold;">${results.freeItems}</span>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="color: #bac2c8;">${getTranslation('paidItems')}</span>
                <span style="color: #19bcb7; font-weight: bold;">${results.paidItems}</span>
            </div>
        </div>

        <!-- Расширенная статистика -->
        <details ${shouldOpenExtendedStats ? 'open' : ''} style="margin-bottom: 12px; background: #27323f; border-radius: 6px; padding: 10px;">
            <summary style="cursor: pointer; color: #19bcb7; font-weight: bold; font-size: 14px; display: flex; align-items: center; gap: 8px;">
                <span>📊</span>
                <span>${getTranslation('extendedStats')}</span>
            </summary>

            <div style="margin-top: 10px; border-top: 1px solid #344150; padding-top: 10px;">
                <!-- Самые дорогие товары -->
                <div style="margin-bottom: 12px;">
                    <div style="color: #bac2c8; font-size: 13px; margin-bottom: 8px;">${getTranslation('mostExpensive')}</div>
                    <div style="display: flex; flex-direction: column; gap: 4px;">
                        ${results.mostExpensiveItems.length > 0 ?
                            results.mostExpensiveItems.map(item => `
                                <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0;">
                                    <span style="color: #bac2c8; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; margin-right: 12px;">
                                        ${item.quantity > 1 ? item.quantity + '× ' : ''}${item.name}
                                    </span>
                                    <span style="color: #19bcb7; font-weight: bold; min-width: 80px; text-align: right;">
                                        ${item.price.toLocaleString(currentLanguage === 'ru' ? 'ru-RU' : 'en-US')}${currencySymbol}
                                    </span>
                                </div>
                            `).join('') :
                            '<div style="color: #8a949e; text-align: center; font-size: 12px; padding: 8px;">-</div>'
                        }
                    </div>
                </div>

                <!-- Расширенные статистики с Flexbox -->
                <div style="display: flex; flex-direction: column; gap: 6px;">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #bac2c8; font-size: 13px;">${getTranslation('giftsToOthers')}</span>
                        <span style="color: #19bcb7; font-weight: bold; font-size: 13px;">
                            ${results.giftTotal > 0 ? results.giftTotal.toLocaleString(currentLanguage === 'ru' ? 'ru-RU' : 'en-US') + currencySymbol : '-'}
                        </span>
                    </div>

                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="color: #bac2c8; font-size: 13px;">${getTranslation('goldenEagles')}</span>
                        <span style="color: #19bcb7; font-weight: bold; font-size: 13px; text-align: right;">
                            ${results.goldenEaglesCount > 0 ?
                                results.goldenEaglesCount.toLocaleString(currentLanguage === 'ru' ? 'ru-RU' : 'en-US') +
                                ' ' + getTranslation('eagles') +
                                ' (' + results.goldenEaglesTotal.toLocaleString(currentLanguage === 'ru' ? 'ru-RU' : 'en-US') + currencySymbol + ')'
                                : '-'
                            }
                        </span>
                    </div>
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

    // Кнопка закрытия
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
        border-radius: 3px;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background-color 0.2s ease;
    `;
    closeButton.onmouseover = () => closeButton.style.backgroundColor = '#27323f';
    closeButton.onmouseout = () => closeButton.style.backgroundColor = 'transparent';
    closeButton.onclick = () => {
        isPopupManuallyClosed = true;
        resultsContainer.remove();

        // Сохраняем состояние и уведомляем popup
        savePopupVisibilityState(false);
        notifyPopupAboutStateChange();

        console.log('Popup closed by user, state saved');
    };

    // Кнопка обновления статистики
    const refreshBtn = resultsContainer.querySelector('#refreshPopupBtn');
    refreshBtn.onmouseover = () => refreshBtn.style.backgroundColor = '#17a8a3';
    refreshBtn.onmouseout = () => refreshBtn.style.backgroundColor = '#19bcb7';
    refreshBtn.onclick = () => {
        refreshBtn.innerHTML = `⏳ ${getTranslation('loading')}`;
        refreshBtn.disabled = true;

        // Сохраняем состояние перед обновлением
        savePopupState();

        setTimeout(() => {
            const newResults = calculateTotalPurchases();
            // Пересоздаем попап с сохраненным состоянием
            const existingPopup = document.getElementById('gaijin-purchase-summary');
            if (existingPopup) {
                existingPopup.remove();
            }
            displayResults(newResults);

            refreshBtn.innerHTML = `🔄 ${getTranslation('refreshButton')}`;
            refreshBtn.disabled = false;
        }, 500);
    };

    // Сохраняем состояние при взаимодействии с details
    const extendedStats = resultsContainer.querySelector('details');
    if (extendedStats) {
        extendedStats.addEventListener('toggle', () => {
            popupState.extendedStatsOpen = extendedStats.open;
        });
    }

    resultsContainer.appendChild(closeButton);
    document.body.appendChild(resultsContainer);

    // Сохраняем состояние видимости и уведомляем popup
    savePopupVisibilityState(true);
    notifyPopupAboutStateChange();
}

// Функция для обновления результатов в попапе
function updatePopupResults(container, results) {
    // Сохраняем состояние перед обновлением
    savePopupState();
    // Пересоздаем попап
    container.remove();
    displayResults(results);
}

// Функция для показа попапа
function showPopup() {
    isPopupManuallyClosed = false;
    const results = calculateTotalPurchases();
    if (results.processedElements > 0 || results.totalItems > 0) {
        displayResults(results);
    }
}

// Функция для скрытия попапа
function hidePopup() {
    isPopupManuallyClosed = true;
    const oldResults = document.getElementById('gaijin-purchase-summary');
    if (oldResults) {
        oldResults.remove();
    }

    // Сохраняем состояние и уведомляем popup
    savePopupVisibilityState(false);
    notifyPopupAboutStateChange();
}

// Функция для переключения видимости попапа
function togglePopup(show) {
    if (show) {
        showPopup();
    } else {
        hidePopup();
    }
}

// Функция для получения текущего состояния попапа
function getPopupState() {
    const popupExists = !!document.getElementById('gaijin-purchase-summary');
    return {
        isVisible: popupExists && !isPopupManuallyClosed,
        exists: popupExists
    };
}

// Основная функция инициализации
function initExtension() {
    console.log('Purchase Summary extension loaded for:', getStoreType());
    isPopupManuallyClosed = false;

    // Загружаем сохраненное состояние видимости попапа
    chrome.storage.local.get(['popupVisible', 'popupManuallyClosed', 'language'], function(result) {
        if (result.language) {
            currentLanguage = result.language;
        }

        // Восстанавливаем состояние закрытия попапа
        if (result.popupManuallyClosed !== undefined) {
            isPopupManuallyClosed = result.popupManuallyClosed;
        }

        setTimeout(() => {
            // Показываем попап только если он не был закрыт пользователем
            if (!isPopupManuallyClosed) {
                const results = calculateTotalPurchases();
                if (results.processedElements > 0 || results.totalItems > 0) {
                    displayResults(results);
                } else {
                    console.log('No purchase items found or page not fully loaded');
                }
            } else {
                console.log('Popup was manually closed, skipping display');
            }
        }, 1000);
    });
}

// Запускаем при загрузке страницы
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initExtension);
} else {
    initExtension();
}

// Обработчик сообщений от popup
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    console.log('Message received:', request);

    if (request.action === "calculatePurchases") {
        const results = calculateTotalPurchases();
        sendResponse({
            success: true,
            results: results
        });
    }

    if (request.action === "togglePopup") {
        togglePopup(request.isVisible);
        sendResponse({
            success: true
        });
    }

    if (request.action === "getPopupState") {
        const state = getPopupState();
        sendResponse({
            success: true,
            isVisible: state.isVisible
        });
    }

    if (request.action === "setLanguage") {
        setContentLanguage(request.language);
        sendResponse({
            success: true
        });
    }

    return true;
});