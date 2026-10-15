// Локализация для всплывающего окна расширения
const translations = {
    ru: {
        purchaseStats: "Статистика покупок",
        totalAmount: "Общая сумма (+ подарки)",
        totalItems: "Всего",
        freeItems: "Бесплатные",
        paidItems: "Платные",
        refreshButton: "Обновить статистику",
        openingLists: "Открываем списки покупок…",
        listsIncluded: "Свои покупки. Подарки вам в сумму не входят",
        scriptMissing: "Обновите вкладку с историей покупок и откройте расширение снова",
        welcomeTitle: "Добро пожаловать!",
        welcomeText: "Откройте страницу истории покупок в одном из поддерживаемых магазинов:",
        welcomeHint: "После перехода на страницу покупок откройте это расширение снова",
        showPopup: "Показать попап на странице",
        hidePopup: "Скрыть попап на странице",
        loading: "Загрузка..."
    },
    en: {
        purchaseStats: "Purchase Statistics",
        totalAmount: "Total (+ gifts)",
        totalItems: "Total",
        freeItems: "Free",
        paidItems: "Paid",
        refreshButton: "Refresh Statistics",
        openingLists: "Opening purchase lists…",
        listsIncluded: "Your purchases only. Gifts to you are not included",
        scriptMissing: "Reload the purchase history tab, then open the extension again",
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
    const statusLine = document.getElementById('statusLine');
    const headerText = document.getElementById('headerText');

    const statsState = document.getElementById('statsState');
    const welcomeState = document.getElementById('welcomeState');
    const langButtons = document.querySelectorAll('.lang-btn');

    let currentStoreType = null;
    let currentLanguage = 'ru';
    let isLoading = false;
    let currentPopupVisible = true;
    let lastResults = null;

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
        if (lastResults) setStatus(lastResults);
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

        headerText.textContent = storeName ? texts.purchaseStats + ' (' + storeName + ')' : texts.purchaseStats;
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
        let parsed;
        try {
            parsed = new URL(url);
        } catch (error) {
            return null;
        }

        let store = null;
        if (parsed.hostname === 'store.gaijin.net') store = 'gaijin';
        else if (parsed.hostname === 'store.pixstorm.ru') store = 'pixstorm';
        if (!store || !parsed.pathname.endsWith('/user.php')) return null;
        if (parsed.searchParams.get('view') !== 'purchases') return null;
        return store;
    }

    function setStatus(results, errorText) {
        const texts = translations[currentLanguage];
        if (!statusLine) return;
        if (errorText) {
            statusLine.textContent = errorText;
            return;
        }
        if (!results) {
            statusLine.textContent = '';
            return;
        }
        if (results.sectionsLoading) {
            statusLine.textContent = texts.openingLists;
            return;
        }
        statusLine.textContent = texts.listsIncluded;
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
        lastResults = results;
        totalAmount.textContent = results.totalLabel || '0';
        totalItems.textContent = results.totalItems;
        freeItems.textContent = results.freeItems;
        paidItems.textContent = results.paidItems;
        setStatus(results);
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
                setStatus(null);
                return;
            }

            setStatus({ sectionsLoading: true });

            chrome.tabs.sendMessage(
                tabs[0].id,
                {action: "calculatePurchases"},
                function(response) {
                    setLoadingState(false);
                    if (chrome.runtime.lastError) {
                        setStatus(null, translations[currentLanguage].scriptMissing);
                        return;
                    }
                    if (response && response.success && response.results) {
                        updateUI(response.results);
                    } else {
                        setStatus(null, translations[currentLanguage].scriptMissing);
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
        if (request.action === "purchaseResults" && request.results && currentStoreType) {
            updateUI(request.results);
        }
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