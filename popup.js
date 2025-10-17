document.addEventListener('DOMContentLoaded', function() {
    const refreshBtn = document.getElementById('refresh');
    const togglePopupBtn = document.getElementById('togglePopupBtn');
    const totalAmount = document.getElementById('totalAmount');
    const totalItems = document.getElementById('totalItems');
    const freeItems = document.getElementById('freeItems');
    const paidItems = document.getElementById('paidItems');

    let isPopupVisible = true; // Предполагаем, что попап видим при загрузке

    function updateUI(results) {
        totalAmount.textContent = results.total.toLocaleString('ru-RU') + ' ₽';
        totalItems.textContent = results.totalItems;
        freeItems.textContent = results.freeItems;
        paidItems.textContent = results.paidItems;
    }

    function updateToggleButton() {
        if (isPopupVisible) {
            togglePopupBtn.textContent = '📊';
            togglePopupBtn.classList.remove('off');
            togglePopupBtn.title = 'Скрыть попап на странице';
        } else {
            togglePopupBtn.textContent = '📊';
            togglePopupBtn.classList.add('off');
            togglePopupBtn.title = 'Показать попап на странице';
        }
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

    // Функция для переключения видимости попапа на странице
    function togglePopupOnPage() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs[0] || !tabs[0].url.includes('store.gaijin.net/user.php?view=purchases')) {
                return;
            }

            chrome.tabs.sendMessage(
                tabs[0].id,
                {action: "togglePopup", isVisible: !isPopupVisible},
                function(response) {
                    if (response && response.success) {
                        isPopupVisible = !isPopupVisible;
                        updateToggleButton();
                    }
                }
            );
        });
    }

    // Функция для проверки текущего состояния попапа
    function checkPopupState() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs[0] || !tabs[0].url.includes('store.gaijin.net/user.php?view=purchases')) {
                return;
            }

            chrome.tabs.sendMessage(
                tabs[0].id,
                {action: "getPopupState"},
                function(response) {
                    if (response && response.success) {
                        isPopupVisible = response.isVisible;
                        updateToggleButton();
                    }
                }
            );
        });
    }

    refreshBtn.addEventListener('click', getPurchaseData);
    togglePopupBtn.addEventListener('click', togglePopupOnPage);

    // Автоматически запрашиваем данные при открытии popup
    getPurchaseData();
    checkPopupState(); // Проверяем состояние попапа при открытии
});