document.addEventListener('DOMContentLoaded', function() {
    const refreshBtn = document.getElementById('refresh');
    const resultsDiv = document.getElementById('results');

    function getPurchaseData() {
        resultsDiv.innerHTML = '<div class="result">🔄 Запрос данных...</div>';

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs[0] || !tabs[0].url.includes('store.gaijin.net/user.php?view=purchases')) {
                resultsDiv.innerHTML = `
                    <div class="result">❌ Откройте страницу истории покупок Gaijin Store</div>
                    <div class="result">URL должен содержать: store.gaijin.net/user.php?view=purchases</div>
                `;
                return;
            }

            chrome.tabs.sendMessage(
                tabs[0].id,
                {action: "calculatePurchases"},
                function(response) {
                    if (chrome.runtime.lastError) {
                        console.error('Error:', chrome.runtime.lastError);
                        resultsDiv.innerHTML = `
                            <div class="result">❌ Ошибка: ${chrome.runtime.lastError.message}</div>
                            <div class="result">Перезагрузите страницу покупок</div>
                        `;
                        return;
                    }

                    if (response && response.success && response.results) {
                        const res = response.results;

                        if (res.processedItems > 0 || res.giftProcessedItems > 0) {
                            resultsDiv.innerHTML = `
                                <div class="result" style="background: #f8f9fa;">
                                    <div style="font-weight: bold; color: #28a745; margin-bottom: 5px;">📦 Мои покупки</div>
                                    <div>Сумма: ${res.total.toLocaleString('ru-RU')} ₽</div>
                                    <div>Товаров: ${res.paidItemCount}</div>
                                </div>

                                <div class="result" style="background: #e8f4fd;">
                                    <div style="font-weight: bold; color: #17a2b8; margin-bottom: 5px;">🎁 Подарки другим</div>
                                    <div>Сумма: ${res.giftTotal.toLocaleString('ru-RU')} ₽</div>
                                    <div>Товаров: ${res.giftPaidItemCount}</div>
                                </div>

                                <div class="result" style="background: #fff3cd;">
                                    <div style="font-weight: bold; color: #856404; margin-bottom: 5px;">💰 Общая сумма</div>
                                    <div>${res.overallTotal.toLocaleString('ru-RU')} ₽</div>
                                    <div>Всего товаров: ${res.overallPaidItemCount}</div>
                                </div>
                            `;
                        } else {
                            resultsDiv.innerHTML = '<div class="result">ℹ️ Платные покупки не найдены</div>';
                        }
                    } else {
                        resultsDiv.innerHTML = `
                            <div class="result">❌ Данные не получены</div>
                            <div class="result">Перезагрузите страницу и попробуйте снова</div>
                        `;
                    }
                }
            );
        });
    }

    refreshBtn.addEventListener('click', getPurchaseData);

    // Автоматически запрашиваем данные при открытии popup
    getPurchaseData();
});