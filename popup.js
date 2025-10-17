document.addEventListener('DOMContentLoaded', function() {
    const refreshBtn = document.getElementById('refresh');
    const totalAmount = document.getElementById('totalAmount');
    const totalItems = document.getElementById('totalItems');
    const freeItems = document.getElementById('freeItems');
    const paidItems = document.getElementById('paidItems');

    function updateUI(results) {
        totalAmount.textContent = results.total.toLocaleString('ru-RU') + ' ₽';
        totalItems.textContent = results.totalItems;
        freeItems.textContent = results.freeItems;
        paidItems.textContent = results.paidItems;
    }

    function showError(message) {
        totalAmount.textContent = '0 ₽';
        totalItems.textContent = '0';
        freeItems.textContent = '0';
        paidItems.textContent = '0';

        // Можно добавить уведомление об ошибке
        console.error(message);
    }

    function getPurchaseData() {
        refreshBtn.textContent = '🔄 Загрузка...';
        refreshBtn.disabled = true;

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs[0] || !tabs[0].url.includes('store.gaijin.net/user.php?view=purchases')) {
                showError('Not on purchases page');
                refreshBtn.textContent = '🔄 Обновить статистику';
                refreshBtn.disabled = false;
                return;
            }

            chrome.tabs.sendMessage(
                tabs[0].id,
                {action: "calculatePurchases"},
                function(response) {
                    refreshBtn.textContent = '🔄 Обновить статистику';
                    refreshBtn.disabled = false;

                    if (chrome.runtime.lastError) {
                        showError(chrome.runtime.lastError.message);
                        return;
                    }

                    if (response && response.success && response.results) {
                        const res = response.results;
                        updateUI(res);
                    } else {
                        showError('No data received');
                    }
                }
            );
        });
    }

    refreshBtn.addEventListener('click', getPurchaseData);

    // Автоматически запрашиваем данные при открытии popup
    getPurchaseData();
});