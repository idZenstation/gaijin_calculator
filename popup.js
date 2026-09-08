// Локализация для всплывающего окна расширения
const translations = {
    ru: {
        purchaseStats: "Статистика покупок",
        totalAmount: "Общая сумма",
        totalItems: "Всего",
        freeItems: "Бесплатные",
        paidItems: "Платные",
        refreshButton: "Обновить статистику",
        welcomeTitle: "Добро пожаловать!",
        welcomeText: "Откройте страницу истории покупок в одном из поддерживаемых магазинов:",
        welcomeHint: "После перехода на страницу покупок откройте это расширение снова",
        showPopup: "Показать попап на странице",
        hidePopup: "Скрыть попап на странице",
        loading: "Загрузка..."
    },
    en: {
        purchaseStats: "Purchase Statistics",
        totalAmount: "Total Amount",
        totalItems: "Total",
        freeItems: "Free",
        paidItems: "Paid",
        refreshButton: "Refresh Statistics",
        welcomeTitle: "Welcome!",
        welcomeText: "Open the purchase history page in one of the supported stores:",
        welcomeHint: "After navigating to the purchase page, open this extension again",
        showPopup: "Show popup on page",
        hidePopup: "Hide popup on page",
        loading: "Loading..."
    }
};

document.addEventListener('DOMContentLoaded', function() {
    const refreshBtn = document.getElementById('refresh');
    const togglePopupBtn = document.getElementById('togglePopupBtn');
    const totalAmount = document.getElementById('totalAmount');
    const totalItems = document.getElementById('totalItems');
    const freeItems = document.getElementById('freeItems');
    const paidItems = document.getElementById('paidItems');
    const headerText = document.getElementById('headerText');

    const statsState = document.getElementById('statsState');
    const welcomeState = document.getElementById('welcomeState');
    const langButtons = document.querySelectorAll('.lang-btn');

    let currentStoreType = null;
    let currentLanguage = 'ru';
    let isLoading = false;
    let currentPopupVisible = true;

    function setLanguage(lang) {
        currentLanguage = lang;

        langButtons.forEach(btn => {
            if (btn.dataset.lang === lang) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        updateAllTexts();
        updateRefreshButtonText();
        sendLanguageToContentScript(lang);
        chrome.storage.local.set({ language: lang });
    }

    function sendLanguageToContentScript(lang) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs || !tabs[0] || !tabs[0].url) return;

            const storeType = isSupportedPage(tabs[0].url);
            if (!storeType) return;

            chrome.tabs.sendMessage(
                tabs[0].id,
                { action: "setLanguage", language: lang },
                function() {
                    if (chrome.runtime.lastError) {
                        // Игнорируем, если скрипт еще не активен
                    }
                }
            );
        });
    }

    function updateAllTexts() {
        const texts = translations[currentLanguage];

        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (texts[key]) {
                element.textContent = texts[key];
            }
        });

        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            if (texts[key]) {
                element.title = texts[key];
            }
        });

        updateHeaderText();
        updateToggleButton();
    }

    function updateRefreshButtonText() {
        const texts = translations[currentLanguage];
        if (isLoading) {
            refreshBtn.innerHTML = '<span>⏳</span><span>' + texts.loading + '</span>';
        } else {
            refreshBtn.innerHTML = '<span>🔄</span><span>' + texts.refreshButton + '</span>';
        }
    }

    function updateHeaderText() {
        const texts = translations[currentLanguage];
        let storeName = '';

        if (currentStoreType === 'gaijin') {
            storeName = 'Gaijin Store';
        } else if (currentStoreType === 'pixstorm') {
            storeName = 'PixStorm Store';
        }

        headerText.textContent = storeName ? `${texts.purchaseStats} (${storeName})` : texts.purchaseStats;
    }

    function updateToggleButton() {
        const texts = translations[currentLanguage];
        if (currentPopupVisible) {
            togglePopupBtn.classList.remove('off');
            togglePopupBtn.title = texts.hidePopup;
            togglePopupBtn.innerHTML = '📊';
        } else {
            togglePopupBtn.classList.add('off');
            togglePopupBtn.title = texts.showPopup;
            togglePopupBtn.innerHTML = '📈';
        }
    }

    function isSupportedPage(url) {
        if (!url || typeof url !== 'string') return null;
        if (url.includes('store.gaijin.net/user.php?view=purchases')) return 'gaijin';
        if (url.includes('store.pixstorm.ru/user.php?view=purchases')) return 'pixstorm';
        return null;
    }

    function setUIState(storeType) {
        currentStoreType = storeType;

        if (storeType) {
            statsState.classList.remove('hidden');
            welcomeState.classList.add('hidden');
            togglePopupBtn.classList.remove('hidden');
            updateHeaderText();
            checkPopupState();
        } else {
            statsState.classList.add('hidden');
            welcomeState.classList.remove('hidden');
            togglePopupBtn.classList.add('hidden');
            updateHeaderText();
        }
    }

    function updateUI(results) {
        const currencySymbol = results.currencySymbol || (currentLanguage === 'ru' ? ' ₽' : ' RUB');
        totalAmount.textContent = results.total.toLocaleString(currentLanguage === 'ru' ? 'ru-RU' : 'en-US') + currencySymbol;
        totalItems.textContent = results.totalItems;
        freeItems.textContent = results.freeItems;
        paidItems.textContent = results.paidItems;
    }

    function setLoadingState(loading) {
        isLoading = loading;
        const texts = translations[currentLanguage];
        if (loading) {
            refreshBtn.innerHTML = '<span>⏳</span><span>' + texts.loading + '</span>';
            refreshBtn.disabled = true;
        } else {
            refreshBtn.innerHTML = '<span>🔄</span><span>' + texts.refreshButton + '</span>';
            refreshBtn.disabled = false;
        }
    }

    function getPurchaseData() {
        setLoadingState(true);

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs || !tabs[0] || !tabs[0].url) {
                setLoadingState(false);
                setUIState(null);
                return;
            }

            const storeType = isSupportedPage(tabs[0].url);
            setUIState(storeType);

            if (!storeType) {
                setLoadingState(false);
                return;
            }

            chrome.tabs.sendMessage(
                tabs[0].id,
                {action: "calculatePurchases"},
                function(response) {
                    setLoadingState(false);
                    if (chrome.runtime.lastError) {
                        return;
                    }
                    if (response && response.success && response.results) {
                        updateUI(response.results);
                    }
                }
            );
        });
    }

    function togglePopupOnPage() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs || !tabs[0] || !currentStoreType) return;

            const newVisibilityState = !currentPopupVisible;

            chrome.tabs.sendMessage(
                tabs[0].id,
                {action: "togglePopup", isVisible: newVisibilityState},
                function(response) {
                    if (response && response.success) {
                        currentPopupVisible = newVisibilityState;
                        updateToggleButton();
                        chrome.storage.local.set({
                            popupVisible: newVisibilityState,
                            popupManuallyClosed: !newVisibilityState
                        });
                    }
                }
            );
        });
    }

    function checkPopupState() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs || !tabs[0] || !currentStoreType) return;

            chrome.tabs.sendMessage(
                tabs[0].id,
                {action: "getPopupState"},
                function(response) {
                    if (response && response.success) {
                        currentPopupVisible = response.isVisible;
                        updateToggleButton();
                        chrome.storage.local.set({
                            popupVisible: response.isVisible,
                            popupManuallyClosed: !response.isVisible
                        });
                    }
                }
            );
        });
    }

    refreshBtn.addEventListener('click', getPurchaseData);
    togglePopupBtn.addEventListener('click', togglePopupOnPage);

    langButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            setLanguage(btn.dataset.lang);
        });
    });

    chrome.runtime.onMessage.addListener(function(request) {
        if (request.action === "popupVisibilityChanged") {
            currentPopupVisible = request.isVisible;
            updateToggleButton();
            chrome.storage.local.set({
                popupVisible: request.isVisible,
                popupManuallyClosed: !request.isVisible
            });
        }
    });

    function forceSyncPopupState() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs || !tabs[0] || !tabs[0].url) return;
            const storeType = isSupportedPage(tabs[0].url);
            if (!storeType) return;
            checkPopupState();
        });
    }

    chrome.storage.local.get(['language', 'popupVisible'], function(result) {
        if (result && result.language) {
            setLanguage(result.language);
        } else {
            setLanguage('ru');
        }

        if (result && result.popupVisible !== undefined) {
            currentPopupVisible = result.popupVisible;
            updateToggleButton();
        }

        getPurchaseData();
        setTimeout(forceSyncPopupState, 100);
    });

    chrome.tabs.onActivated.addListener(function() {
        setTimeout(forceSyncPopupState, 100);
    });

    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo) {
        if (changeInfo.status === 'complete') {
            setTimeout(forceSyncPopupState, 100);
        }
    });
});