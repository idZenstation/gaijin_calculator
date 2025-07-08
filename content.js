function parsePurchaseData(html) {
    try {
        // Создаем временный DOM-элемент для парсинга
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        // Находим все элементы с покупками
        const items = doc.querySelectorAll('.showcase__item');
        if (!items.length) {
            return { status: 'no_data', error: 'No purchase items found' };
        }

        let total = 0;
        let count = 0;
        const purchases = [];

        items.forEach(item => {
            try {
                const priceElement = item.querySelector('.showcase-item-price');
                if (!priceElement) return;

                const priceText = priceElement.textContent.trim();
                const price = parsePrice(priceText);
                if (isNaN(price) return;

                const title = item.querySelector('.showcase-item-description__title')?.textContent.trim() || 'Unknown';
                const date = item.querySelector('.showcase-item__timestamp')?.textContent.trim() || '';
                const game = item.querySelector('.inline-icon-label')?.className.match(/inline-icon-label_(\d+)/)?.[1] || '';

                total += price;
                count++;

                purchases.push({
                    title,
                    price,
                    currency: 'RUB', // По умолчанию, уточним ниже
                    date,
                    game
                });
            } catch (e) {
                console.error('Error parsing item:', e);
            }
        });

        // Определяем валюту (рубли по умолчанию)
        const currency = determineCurrency(purchases);

        return {
            status: count > 0 ? 'success' : 'no_valid_data',
            total: total.toFixed(2),
            count,
            currency,
            purchases,
            rawItems: items.length
        };
    } catch (error) {
        return {
            status: 'error',
            error: error.message,
            stack: error.stack
        };
    }
}

function parsePrice(text) {
    // Удаляем все символы кроме цифр и десятичных разделителей
    const clean = text.replace(/[^\d.,]/g, '')
                      .replace(',', '.');
    return parseFloat(clean) || 0;
}

function determineCurrency(purchases) {
    // Анализируем покупки для определения валюты
    if (purchases.some(p => p.priceText?.includes('€'))) return 'EUR';
    if (purchases.some(p => p.priceText?.includes('$'))) return 'USD';
    if (purchases.some(p => p.priceText?.includes('₽'))) return 'RUB';
    return 'RUB'; // По умолчанию
}

// Основная функция для вызова
function getPurchaseStatistics() {
    return parsePurchaseData(document.documentElement.outerHTML);
}

window.getPurchaseStatistics = getPurchaseStatistics;