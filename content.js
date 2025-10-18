// Глобальная переменная для отслеживания состояния
let isPopupManuallyClosed = false;
let currentLanguage = 'ru';

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
        pixstormStore: "PixStorm Store"
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
        pixstormStore: "PixStorm Store"
    }
};

// Функция для получения перевода
function getTranslation(key) {
    return contentTranslations[currentLanguage][key] || key;
}

// Функция для установки языка
function setContentLanguage(lang) {
    currentLanguage = lang;
    // Если попап открыт - перерисовываем его
    const existingPopup = document.getElementById('gaijin-purchase-summary');
    if (existingPopup && !isPopupManuallyClosed) {
        const results = calculateTotalPurchases();
        displayResults(results);
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

    if (storeType === 'pixstorm') {
        return {
            item: '.showcase-item',
            price: '.showcase-item-price',
            quantity: '.showcase-item-description__title-comment'
        };
    } else {
        // Gaijin store
        return {
            item: '.showcase-item',
            price: '.showcase-item-price',
            quantity: '.showcase-item-description__title-comment'
        };
    }
}

// Функция для расчета суммы покупок
function calculateTotalPurchases() {
    console.log('Calculating purchases for store:', getStoreType());
    const selectors = getSelectors();
    const purchaseItems = document.querySelectorAll(selectors.item);
    let total = 0;
    let totalItems = 0;
    let freeItems = 0;
    let paidItems = 0;
    let processedElements = 0;

    purchaseItems.forEach(item => {
        const quantityElement = item.querySelector(selectors.quantity);
        let quantity = 1;
        if (quantityElement) {
            const quantityText = quantityElement.textContent.trim();
            const quantityMatch = quantityText.match(/(\d+)\s*x/);
            if (quantityMatch) {
                quantity = parseInt(quantityMatch[1]);
            }
        }

        const priceElement = item.querySelector(selectors.price);
        if (priceElement && priceElement.textContent.trim()) {
            const priceText = priceElement.textContent.trim();

            // Универсальный парсинг цены для разных форматов
            const priceMatch = priceText.match(/([\d\s,.]+)/);

            if (priceMatch) {
                // Очищаем цену от пробелов и заменяем запятые на точки
                let priceStr = priceMatch[1].replace(/\s/g, '').replace(',', '.');
                let price = parseFloat(priceStr);

                // Проверяем, является ли цена числом
                if (!isNaN(price)) {
                    total += price * quantity;

                    if (price > 0) {
                        paidItems += quantity;
                        console.log(`Found paid item: ${price} ₽ x ${quantity}`);
                    } else {
                        freeItems += quantity;
                        console.log(`Found free item: ${price} ₽ x ${quantity}`);
                    }

                    totalItems += quantity;
                    processedElements++;
                } else {
                    // Если цена не распознана - считаем бесплатным
                    freeItems += quantity;
                    totalItems += quantity;
                }
            } else {
                freeItems += quantity;
                totalItems += quantity;
            }
        } else {
            // Если нет цены - считаем бесплатным
            freeItems += quantity;
            totalItems += quantity;
        }
    });

    console.log(`Calculation complete: ${total} ₽, Total: ${totalItems}, Paid: ${paidItems}, Free: ${freeItems} for ${getStoreType()}`);

    return {
        total: Math.round(total * 100) / 100,
        totalItems,
        freeItems,
        paidItems,
        processedElements,
        storeType: getStoreType()
    };
}

// Функция для отображения результатов на странице
function displayResults(results) {
    // Проверяем, не был ли попап закрыт пользователем
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
        min-width: 280px;
        color: #bac2c8;
    `;

    const storeName = results.storeType === 'pixstorm' ? getTranslation('pixstormStore') : getTranslation('gaijinStore');
    const currencySymbol = currentLanguage === 'ru' ? ' ₽' : ' RUB';

    resultsContainer.innerHTML = `
        <div style="font-weight: bold; color: #e1ce9b; margin-bottom: 16px; font-size: 18px; text-align: center;">
            🎯 ${getTranslation('purchaseStats')}
        </div>

        <div style="font-size: 12px; color: #8a949e; text-align: center; margin-bottom: 10px;">
            ${storeName}
        </div>

        <div style="margin-bottom: 12px; padding: 10px; background: #27323f; border-radius: 6px;">
            <div style="font-size: 14px; color: #bac2c8; margin-bottom: 4px;">${getTranslation('totalAmount')}</div>
            <div style="font-size: 20px; font-weight: bold; color: #19bcb7;">${results.total.toLocaleString(currentLanguage === 'ru' ? 'ru-RU' : 'en-US')}${currencySymbol}</div>
        </div>

        <div style="margin-bottom: 8px;">
            <span style="color: #bac2c8;">${getTranslation('totalItems')}</span>
            <span style="float: right; color: #bac2c8; font-weight: bold;">${results.totalItems}</span>
        </div>

        <div style="margin-bottom: 8px;">
            <span style="color: #bac2c8;">${getTranslation('freeItems')}</span>
            <span style="float: right; color: #bac2c8; font-weight: bold;">${results.freeItems}</span>
        </div>

        <div style="margin-bottom: 16px;">
            <span style="color: #bac2c8;">${getTranslation('paidItems')}</span>
            <span style="float: right; color: #19bcb7; font-weight: bold;">${results.paidItems}</span>
        </div>

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
    `;
    closeButton.onmouseover = () => closeButton.style.backgroundColor = '#27323f';
    closeButton.onmouseout = () => closeButton.style.backgroundColor = 'transparent';
    closeButton.onclick = () => {
        isPopupManuallyClosed = true;
        resultsContainer.remove();
    };

    // Кнопка обновления статистики
    const refreshBtn = resultsContainer.querySelector('#refreshPopupBtn');
    refreshBtn.onmouseover = () => refreshBtn.style.backgroundColor = '#17a8a3';
    refreshBtn.onmouseout = () => refreshBtn.style.backgroundColor = '#19bcb7';
    refreshBtn.onclick = () => {
        refreshBtn.innerHTML = `⏳ ${getTranslation('loading')}`;
        refreshBtn.disabled = true;

        setTimeout(() => {
            const newResults = calculateTotalPurchases();
            updatePopupResults(resultsContainer, newResults);

            refreshBtn.innerHTML = `🔄 ${getTranslation('refreshButton')}`;
            refreshBtn.disabled = false;
        }, 500);
    };

    resultsContainer.appendChild(closeButton);
    document.body.appendChild(resultsContainer);
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

// Функция для обновления результатов в попапе
function updatePopupResults(container, results) {
    const storeNameElement = container.querySelector('div:nth-child(2)');
    const totalElement = container.querySelector('div:nth-child(3) div:nth-child(2)');
    const totalItemsElement = container.querySelector('div:nth-child(4) span:nth-child(2)');
    const freeItemsElement = container.querySelector('div:nth-child(5) span:nth-child(2)');
    const paidItemsElement = container.querySelector('div:nth-child(6) span:nth-child(2)');
    const refreshBtn = container.querySelector('#refreshPopupBtn');

    const storeName = results.storeType === 'pixstorm' ? getTranslation('pixstormStore') : getTranslation('gaijinStore');
    const currencySymbol = currentLanguage === 'ru' ? ' ₽' : ' RUB';

    if (storeNameElement) storeNameElement.textContent = storeName;
    if (totalElement) totalElement.textContent = `${results.total.toLocaleString(currentLanguage === 'ru' ? 'ru-RU' : 'en-US')}${currencySymbol}`;
    if (totalItemsElement) totalItemsElement.textContent = results.totalItems;
    if (freeItemsElement) freeItemsElement.textContent = results.freeItems;
    if (paidItemsElement) paidItemsElement.textContent = results.paidItems;
    if (refreshBtn) refreshBtn.innerHTML = `🔄 ${getTranslation('refreshButton')}`;
}

// Основная функция инициализации
function initExtension() {
    console.log('Purchase Summary extension loaded for:', getStoreType());

    // Сбрасываем флаг при каждой загрузке/обновлении страницы
    isPopupManuallyClosed = false;

    // Загружаем сохраненный язык
    chrome.storage.local.get(['language'], function(result) {
        if (result.language) {
            currentLanguage = result.language;
        }

        // Ждем немного для загрузки контента
        setTimeout(() => {
            const results = calculateTotalPurchases();
            if (results.processedElements > 0 || results.totalItems > 0) {
                displayResults(results);
            } else {
                console.log('No purchase items found or page not fully loaded');
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

    // Новое действие для смены языка
    if (request.action === "setLanguage") {
        setContentLanguage(request.language);
        sendResponse({
            success: true
        });
    }

    return true;
});