// Функция для расчета суммы покупок
function calculateTotalPurchases() {
    console.log('Calculating purchases...');
    const purchaseItems = document.querySelectorAll('.showcase-item');
    let total = 0;
    let totalItems = 0;          // Всего товаров (с учетом quantity)
    let freeItems = 0;           // Бесплатные товары
    let paidItems = 0;           // Платные товары
    let processedElements = 0;   // Обработанных элементов

    purchaseItems.forEach(item => {
        // Получаем количество товаров в позиции
        const quantityElement = item.querySelector('.showcase-item-description__title-comment');
        let quantity = 1;
        if (quantityElement) {
            const quantityText = quantityElement.textContent.trim();
            const quantityMatch = quantityText.match(/(\d+)\s*x/);
            if (quantityMatch) {
                quantity = parseInt(quantityMatch[1]);
            }
        }

        // Проверяем цену
        const priceElement = item.querySelector('.showcase-item-price');
        if (priceElement && priceElement.textContent.trim()) {
            const priceText = priceElement.textContent.trim();
            const priceMatch = priceText.match(/([\d,.]+)/);

            if (priceMatch) {
                let price = parseFloat(priceMatch[1].replace(',', '.'));
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
                // Если цена есть, но не распознана - считаем бесплатным
                freeItems += quantity;
                totalItems += quantity;
            }
        } else {
            // Если нет цены - считаем бесплатным
            freeItems += quantity;
            totalItems += quantity;
        }
    });

    console.log(`Calculation complete: ${total} ₽, Total: ${totalItems}, Paid: ${paidItems}, Free: ${freeItems}`);

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

        <div style="margin-bottom: 8px;">
            <span style="color: #bac2c8;">Платные товары:</span>
            <span style="float: right; color: #19bcb7; font-weight: bold;">${results.paidItems}</span>
        </div>

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
    closeButton.onclick = () => resultsContainer.remove();

    resultsContainer.appendChild(closeButton);
    document.body.appendChild(resultsContainer);
}

// Основная функция инициализации
function initExtension() {
    console.log('Gaijin Purchase Summary extension loaded');

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

        // Также обновляем отображение на странице
        if (results.processedElements > 0 || results.totalItems > 0) {
            displayResults(results);
        }
    }

    return true; // Ответ будет асинхронным
});