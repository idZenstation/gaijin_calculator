// Глобальная переменная для отслеживания состояния
let isPopupManuallyClosed = false;

// Функция для расчета суммы покупок
function calculateTotalPurchases() {
    console.log('Calculating purchases...');
    const purchaseItems = document.querySelectorAll('.showcase-item');
    let total = 0;
    let totalItems = 0;
    let freeItems = 0;
    let paidItems = 0;
    let processedElements = 0;

    purchaseItems.forEach(item => {
        const quantityElement = item.querySelector('.showcase-item-description__title-comment');
        let quantity = 1;
        if (quantityElement) {
            const quantityText = quantityElement.textContent.trim();
            const quantityMatch = quantityText.match(/(\d+)\s*x/);
            if (quantityMatch) {
                quantity = parseInt(quantityMatch[1]);
            }
        }

        const priceElement = item.querySelector('.showcase-item-price');
        if (priceElement && priceElement.textContent.trim()) {
            const priceText = priceElement.textContent.trim();
            const priceMatch = priceText.match(/([\d,.]+)/);

            if (priceMatch) {
                let price = parseFloat(priceMatch[1].replace(',', '.'));
                total += price * quantity;

                if (price > 0) {
                    paidItems += quantity;
                } else {
                    freeItems += quantity;
                }

                totalItems += quantity;
                processedElements++;
            } else {
                freeItems += quantity;
                totalItems += quantity;
            }
        } else {
            freeItems += quantity;
            totalItems += quantity;
        }
    });

    return {
        total: Math.round(total * 100) / 100,
        totalItems,
        freeItems,
        paidItems,
        processedElements
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

    resultsContainer.innerHTML = `
        <div style="font-weight: bold; color: #e1ce9b; margin-bottom: 16px; font-size: 18px; text-align: center;">
            🎯 Сумма покупок
        </div>

        <div style="margin-bottom: 12px; padding: 10px; background: #27323f; border-radius: 6px;">
            <div style="font-size: 14px; color: #bac2c8; margin-bottom: 4px;">Общая сумма</div>
            <div style="font-size: 20px; font-weight: bold; color: #19bcb7;">${results.total.toLocaleString('ru-RU')} ₽</div>
        </div>

        <div style="margin-bottom: 8px;">
            <span style="color: #bac2c8;">Всего товаров:</span>
            <span style="float: right; color: #bac2c8; font-weight: bold;">${results.totalItems}</span>
        </div>

        <div style="margin-bottom: 8px;">
            <span style="color: #bac2c8;">Бесплатные товары:</span>
            <span style="float: right; color: #bac2c8; font-weight: bold;">${results.freeItems}</span>
        </div>

        <div style="margin-bottom: 16px;">
            <span style="color: #bac2c8;">Платные товары:</span>
            <span style="float: right; color: #19bcb7; font-weight: bold;">${results.paidItems}</span>
        </div>

        <button id="refreshPopupBtn" style="width: 100%; padding: 10px; background: #19bcb7; color: #2d3a48; border: none; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; transition: all 0.2s ease;">
            🔄 Обновить статистику
        </button>

        <div style="font-size: 11px; color: #8a949e; margin-top: 12px; text-align: center; border-top: 1px solid #27323f; padding-top: 8px;">
            Учтены все товары на странице
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
        refreshBtn.innerHTML = '⏳ Загрузка...';
        refreshBtn.disabled = true;

        setTimeout(() => {
            const newResults = calculateTotalPurchases();
            updatePopupResults(resultsContainer, newResults);

            refreshBtn.innerHTML = '🔄 Обновить статистику';
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
    const totalElement = container.querySelector('div:nth-child(2) div:nth-child(2)');
    const totalItemsElement = container.querySelector('div:nth-child(3) span:nth-child(2)');
    const freeItemsElement = container.querySelector('div:nth-child(4) span:nth-child(2)');
    const paidItemsElement = container.querySelector('div:nth-child(5) span:nth-child(2)');

    if (totalElement) totalElement.textContent = `${results.total.toLocaleString('ru-RU')} ₽`;
    if (totalItemsElement) totalItemsElement.textContent = results.totalItems;
    if (freeItemsElement) freeItemsElement.textContent = results.freeItems;
    if (paidItemsElement) paidItemsElement.textContent = results.paidItems;
}

// Основная функция инициализации
function initExtension() {
    console.log('Gaijin Purchase Summary extension loaded');

    // Сбрасываем флаг при каждой загрузке/обновлении страницы
    isPopupManuallyClosed = false;

    // Ждем немного для загрузки контента
    setTimeout(() => {
        const results = calculateTotalPurchases();
        if (results.processedElements > 0 || results.totalItems > 0) {
            displayResults(results);
        } else {
            console.log('No purchase items found or page not fully loaded');
        }
    }, 1000);
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

    return true;
});