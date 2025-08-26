document.addEventListener('DOMContentLoaded', function() {
    const refreshBtn = document.getElementById('refresh');
    const resultsDiv = document.getElementById('results');

    function getPurchaseData() {
        resultsDiv.innerHTML = '<div class="result">Запрос данных...</div>';

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs[0] || !tabs[0].url.includes('store.gaijin.net/user.php?view=purchases')) {
                resultsDiv.innerHTML = '<div class="result">Откройте страницу истории покупок Gaijin Store</div>';
                return;
            }

            // Отправляем сообщение content script
            chrome.tabs.sendMessage(
                tabs[0].id,
                {action: "calculatePurchases"},
                function(response) {
                    if (chrome.runtime.lastError) {
                        console.error('Error:', chrome.runtime.lastError);
                        resultsDiv.innerHTML = `
                            <div class="result">Ошибка: ${chrome.runtime.lastError.message}</div>
                            <div class="result">Перезагрузите страницу покупок</div>
                        `;
                        return;
                    }

                    if (response && response.success && response.results) {
                        if (response.results.processedItems > 0) {
                            resultsDiv.innerHTML = `
                                <div class="result">
                                    <strong>Общая сумма:</strong> ${response.results.total.toLocaleString('ru-RU')} ₽
                                </div>
                                <div class="result">
                                    <strong>Платных товаров:</strong> ${response.results.paidItemCount}
                                </div>
                                <div class="result">
                                    <strong>Всего товаров:</strong> ${response.results.itemCount}
                                </div>
                            `;
                        } else {
                            resultsDiv.innerHTML = '<div class="result">Платные покупки не найдены</div>';
                        }
                    } else {
                        resultsDiv.innerHTML = '<div class="result">Данные не получены. Перезагрузите страницу.</div>';
                    }
                }
            );
        });
    }

    refreshBtn.addEventListener('click', getPurchaseData);

    // Автоматически запрашиваем данные при открытии popup
    getPurchaseData();
});