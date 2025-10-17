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

    function setLoadingState(isLoading) {
        if (isLoading) {
            refreshBtn.innerHTML = '⏳ Загрузка...';
            refreshBtn.disabled = true;
        } else {
            refreshBtn.innerHTML = '🔄 Обновить статистику';
            refreshBtn.disabled = false;
        }
    }

    function getPurchaseData() {
        setLoadingState(true);

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs[0] || !tabs[0].url.includes('store.gaijin.net/user.php?view=purchases')) {
                setLoadingState(false);
                return;
            }

            chrome.tabs.sendMessage(
                tabs[0].id,
                {action: "calculatePurchases"},
                function(response) {
                    setLoadingState(false);

                    if (chrome.runtime.lastError) {
                        console.error('Error:', chrome.runtime.lastError);
                        return;
                    }

                    if (response && response.success && response.results) {
                        updateUI(response.results);
                    }
                }
            );
        });
    }

    refreshBtn.addEventListener('click', getPurchaseData);

    // Только получаем данные, не показываем попап на странице
    getPurchaseData();
});