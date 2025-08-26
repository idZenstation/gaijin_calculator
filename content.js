// Функция для расчета суммы покупок
function calculateTotalPurchases() {
    console.log('Calculating purchases...');
    const purchaseItems = document.querySelectorAll('.showcase-item');
    let total = 0;
    let itemCount = 0;
    let paidItemCount = 0;
    let processedItems = 0;

    purchaseItems.forEach(item => {
        itemCount++;

        // Проверяем, есть ли цена у товара
        const priceElement = item.querySelector('.showcase-item-price');
        if (priceElement && priceElement.textContent.trim()) {
            // Извлекаем текст цены
            const priceText = priceElement.textContent.trim();
            const priceMatch = priceText.match(/([\d,.]+)/);

            if (priceMatch) {
                let price = parseFloat(priceMatch[1].replace(',', '.'));

                // Проверяем количество одинаковых товаров
                const quantityElement = item.querySelector('.showcase-item-description__title-comment');
                let quantity = 1;

                if (quantityElement) {
                    const quantityText = quantityElement.textContent.trim();
                    const quantityMatch = quantityText.match(/(\d+)\s*x/);
                    if (quantityMatch) {
                        quantity = parseInt(quantityMatch[1]);
                    }
                }

                total += price * quantity;
                paidItemCount += quantity;
                processedItems++;

                console.log(`Found paid item: ${price} ₽ x ${quantity}`);
            }
        }
    });

    console.log(`Calculation complete: ${total} ₽ from ${processedItems} paid items`);

    return {
        total: Math.round(total * 100) / 100,
        itemCount,
        paidItemCount,
        processedItems
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
        background: white;
        padding: 15px;
        border: 2px solid #ff8c00;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 10000;
        font-family: Arial, sans-serif;
        min-width: 250px;
    `;

    resultsContainer.innerHTML = `
        <div style="font-weight: bold; color: #ff8c00; margin-bottom: 10px; font-size: 16px;">
            🎯 Сумма покупок
        </div>
        <div style="margin-bottom: 8px;">
            <strong>Общая сумма:</strong> ${results.total.toLocaleString('ru-RU')} ₽
        </div>
        <div style="margin-bottom: 8px;">
            <strong>Платных товаров:</strong> ${results.paidItemCount}
        </div>
        <div style="margin-bottom: 8px;">
            <strong>Всего товаров:</strong> ${results.itemCount}
        </div>
        <div style="font-size: 12px; color: #666; margin-top: 10px;">
            Бесплатные товары не включены в сумму
        </div>
    `;

    // Кнопка закрытия
    const closeButton = document.createElement('button');
    closeButton.textContent = '×';
    closeButton.style.cssText = `
        position: absolute;
        top: 5px;
        right: 5px;
        background: none;
        border: none;
        font-size: 18px;
        cursor: pointer;
        color: #999;
    `;
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
        if (results.processedItems > 0) {
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
        if (results.processedItems > 0) {
            displayResults(results);
        }
    }

    return true; // Ответ будет асинхронным
});