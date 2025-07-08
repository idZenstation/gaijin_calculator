async function calculateTotal() {
    let total = 0;
    let count = 0;
    const currencySymbols = {
        '₽': 'RUB',
        '$': 'USD',
        '€': 'EUR',
        '£': 'GBP'
    };

    // Ждём загрузки таблицы (может быть динамической)
    const table = await waitForElement('#purchases-history');
    if (!table) return;

    const rows = table.querySelectorAll('tbody tr');
    if (rows.length === 0) return;

    for (const row of rows) {
        const priceCell = row.querySelector('td:nth-child(4)');
        if (!priceCell) continue;

        const priceText = priceCell.textContent.trim();
        if (!priceText) continue;

        // Извлекаем валюту и значение
        const match = priceText.match(/([₽$€£])\s*([\d,.]+)/);
        if (!match) continue;

        const currencySymbol = match[1];
        const amount = parseFloat(match[2].replace(',', ''));
        const currency = currencySymbols[currencySymbol] || 'UNKNOWN';

        total += amount;
        count++;
    }

    // Создаём элемент для отображения статистики
    let statsDiv = document.getElementById('gaijin-purchase-stats');
    if (!statsDiv) {
        statsDiv = document.createElement('div');
        statsDiv.id = 'gaijin-purchase-stats';
        statsDiv.style.padding = '10px';
        statsDiv.style.margin = '10px 0';
        statsDiv.style.backgroundColor = '#f5f5f5';
        statsDiv.style.borderRadius = '4px';
        table.parentNode.insertBefore(statsDiv, table);
    }

    statsDiv.innerHTML = `
        <h3>Статистика покупок</h3>
        <p>Всего покупок: ${count}</p>
        <p>Общая сумма: ${total.toFixed(2)}</p>
    `;
}

function waitForElement(selector, timeout = 5000) {
    return new Promise((resolve) => {
        if (document.querySelector(selector)) {
            return resolve(document.querySelector(selector));
        }

        const observer = new MutationObserver(() => {
            if (document.querySelector(selector)) {
                observer.disconnect();
                resolve(document.querySelector(selector));
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });

        setTimeout(() => {
            observer.disconnect();
            resolve(null);
        }, timeout);
    });
}

// Запускаем расчет при загрузке и при изменениях (для динамического контента)
document.addEventListener('DOMContentLoaded', calculateTotal);
new MutationObserver(calculateTotal).observe(document.body, {
    childList: true,
    subtree: true
});