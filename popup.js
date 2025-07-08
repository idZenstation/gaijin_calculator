document.addEventListener('DOMContentLoaded', async () => {
    const statsDiv = document.getElementById('stats');
    const calculateBtn = document.getElementById('calculate');
    const loader = document.getElementById('loader');

    async function fetchPurchaseData() {
        try {
            loader.style.display = 'block';
            statsDiv.textContent = 'Fetching purchase data...';

            const [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
                url: 'https://store.gaijin.net/user.php*'
            });

            if (!tab) {
                throw new Error('Please open Gaijin Store purchase history first!');
            }

            // Получаем HTML страницы
            const result = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: () => {
                    return {
                        html: document.documentElement.outerHTML,
                        url: window.location.href
                    };
                }
            });

            const pageData = result[0]?.result;
            if (!pageData) {
                throw new Error('Failed to get page data');
            }

            // Парсим данные
            const parsedData = parsePurchaseData(pageData.html);

            if (parsedData.status !== 'success') {
                throw new Error(parsedData.error || 'No valid purchase data found');
            }

            // Сохраняем и отображаем
            await chrome.storage.local.set({ gaijinStats: parsedData });
            displayStats(parsedData);

        } catch (error) {
            console.error('Error:', error);
            statsDiv.innerHTML = `<p style="color: red;">Error: ${error.message}</p>`;
        } finally {
            loader.style.display = 'none';
        }
    }

    function displayStats(data) {
        const currencySymbol = {
            'RUB': '₽',
            'USD': '$',
            'EUR': '€'
        }[data.currency] || data.currency;

        statsDiv.innerHTML = `
            <h4>Purchase Statistics</h4>
            <p>Total purchases: <strong>${data.count}</strong></p>
            <p>Total spent: <strong>${currencySymbol} ${data.total}</strong></p>
            <p>Average: <strong>${currencySymbol} ${(data.total / data.count).toFixed(2)}</strong></p>
            <details>
                <summary>Show details</summary>
                <ul style="max-height: 150px; overflow-y: auto;">
                    ${data.purchases.map(p => `
                        <li>
                            ${p.date} - ${p.title}: ${currencySymbol} ${p.price.toFixed(2)}
                        </li>
                    `).join('')}
                </ul>
            </details>
        `;
    }

    calculateBtn.addEventListener('click', fetchPurchaseData);

    // Загружаем сохраненные данные при открытии
    const { gaijinStats } = await chrome.storage.local.get('gaijinStats');
    if (gaijinStats) {
        displayStats(gaijinStats);
    }
});