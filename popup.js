// Локализация
const translations = {
    ru: {
        // Заголовки
        purchaseStats: "Статистика покупок",
        purchaseStatsGaijin: "Статистика (Gaijin Store)",
        purchaseStatsPixstorm: "Статистика (PixStorm Store)",

        // Статистика
        totalAmount: "Общая сумма",
        totalItems: "Всего товаров:",
        freeItems: "Бесплатные:",
        paidItems: "Платные:",
        refreshButton: "Обновить статистику",

        // Welcome
        welcomeTitle: "Добро пожаловать!",
        welcomeText: "Откройте страницу истории покупок в одном из поддерживаемых магазинов:",
        welcomeHint: "После перехода на страницу покупок откройте это расширение снова",

        // Tooltips
        showPopup: "Показать попап на странице",
        hidePopup: "Скрыть попап на странице",

        // Loading states
        loading: "Загрузка..."
    },
    en: {
        // Headers
        purchaseStats: "Purchase Statistics",
        purchaseStatsGaijin: "Statistics (Gaijin Store)",
        purchaseStatsPixstorm: "Statistics (PixStorm Store)",

        // Statistics
        totalAmount: "Total Amount",
        totalItems: "Total Items:",
        freeItems: "Free:",
        paidItems: "Paid:",
        refreshButton: "Refresh Statistics",

        // Welcome
        welcomeTitle: "Welcome!",
        welcomeText: "Open the purchase history page in one of the supported stores:",
        welcomeHint: "After navigating to the purchase page, open this extension again",

        // Tooltips
        showPopup: "Show popup on page",
        hidePopup: "Hide popup on page",

        // Loading states
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

    // Функция для установки языка
    function setLanguage(lang) {
        currentLanguage = lang;

        // Обновляем активную кнопку языка
        langButtons.forEach(btn => {
            if (btn.dataset.lang === lang) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });

        // Обновляем все тексты
        updateAllTexts();

        // Обновляем состояние кнопки обновления
        updateRefreshButtonText();

        // Отправляем язык в content.js
        sendLanguageToContentScript(lang);

        // Сохраняем выбор языка
        chrome.storage.local.set({ language: lang });
    }

    // Функция для отправки языка в content script
    function sendLanguageToContentScript(lang) {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs[0]) return;

            const storeType = isSupportedPage(tabs[0].url);
            if (!storeType) return;

            chrome.tabs.sendMessage(
                tabs[0].id,
                {
                    action: "setLanguage",
                    language: lang
                },
                function(response) {
                    if (chrome.runtime.lastError) {
                        console.error('Error sending language:', chrome.runtime.lastError);
                    }
                }
            );
        });
    }

    // Функция для обновления всех текстов
    function updateAllTexts() {
        const texts = translations[currentLanguage];

        // Обновляем элементы с data-i18n
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (texts[key]) {
                element.textContent = texts[key];
            }
        });

        // Обновляем атрибуты title
        document.querySelectorAll('[data-i18n-title]').forEach(element => {
            const key = element.getAttribute('data-i18n-title');
            if (texts[key]) {
                element.title = texts[key];
            }
        });

        // Обновляем заголовок в зависимости от магазина
        updateHeaderText();

        // Обновляем подсказки кнопок
        updateToggleButton();
    }

    // Функция для обновления текста кнопки обновления
    function updateRefreshButtonText() {
        const texts = translations[currentLanguage];
        if (isLoading) {
            refreshBtn.innerHTML = '<span>⏳</span><span>' + texts.loading + '</span>';
        } else {
            refreshBtn.innerHTML = '<span>🔄</span><span>' + texts.refreshButton + '</span>';
        }
    }

    // Функция для обновления заголовка
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

    // Функция для обновления кнопки переключения попапа
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

    // Функция для проверки поддерживаемой страницы
    function isSupportedPage(url) {
        if (url.includes('store.gaijin.net/user.php?view=purchases')) {
            return 'gaijin';
        } else if (url.includes('store.pixstorm.ru/user.php?view=purchases')) {
            return 'pixstorm';
        }
        return null;
    }

    // Функция для переключения состояний интерфейса
    function setUIState(storeType) {
        currentStoreType = storeType;

        if (storeType) {
            statsState.classList.remove('hidden');
            welcomeState.classList.add('hidden');
            togglePopupBtn.classList.remove('hidden');
            updateHeaderText();

            // При переключении на поддерживаемую страницу сразу проверяем состояние попапа
            checkPopupState();
        } else {
            statsState.classList.add('hidden');
            welcomeState.classList.remove('hidden');
            togglePopupBtn.classList.add('hidden');
            updateHeaderText();
        }
    }

    function updateUI(results) {
        const currencySymbol = currentLanguage === 'ru' ? ' ₽' : ' RUB';
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
            if (!tabs[0]) {
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
            if (!tabs[0] || !currentStoreType) {
                return;
            }

            const newVisibilityState = !currentPopupVisible;

            chrome.tabs.sendMessage(
                tabs[0].id,
                {action: "togglePopup", isVisible: newVisibilityState},
                function(response) {
                    if (response && response.success) {
                        currentPopupVisible = newVisibilityState;
                        updateToggleButton();

                        // Сохраняем состояние
                        chrome.storage.local.set({
                            popupVisible: newVisibilityState,
                            popupManuallyClosed: !newVisibilityState
                        });
                    }
                }
            );
        });
    }

    // Функция для проверки текущего состояния попапа
    function checkPopupState() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs[0] || !currentStoreType) {
                return;
            }

            chrome.tabs.sendMessage(
                tabs[0].id,
                {action: "getPopupState"},
                function(response) {
                    if (response && response.success) {
                        currentPopupVisible = response.isVisible;
                        updateToggleButton();

                        // Синхронизируем состояние в хранилище
                        chrome.storage.local.set({
                            popupVisible: response.isVisible,
                            popupManuallyClosed: !response.isVisible
                        });
                    } else if (chrome.runtime.lastError) {
                        // Если content script не отвечает, используем сохраненное состояние
                        console.log('Content script not available, using stored state');
                    }
                }
            );
        });
    }

    // Обработчики событий
    refreshBtn.addEventListener('click', getPurchaseData);
    togglePopupBtn.addEventListener('click', togglePopupOnPage);

    // Обработчики переключения языка
    langButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            setLanguage(btn.dataset.lang);
        });
    });

    // Обработчик сообщений от content script
    chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
        if (request.action === "popupVisibilityChanged") {
            // Обновляем состояние переключателя на основе уведомления от content script
            currentPopupVisible = request.isVisible;
            updateToggleButton();

            // Синхронизируем состояние в хранилище
            chrome.storage.local.set({
                popupVisible: request.isVisible,
                popupManuallyClosed: !request.isVisible
            });
        }
    });

    // Функция для принудительной синхронизации состояния при открытии popup
    function forceSyncPopupState() {
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (!tabs[0]) return;

            const storeType = isSupportedPage(tabs[0].url);
            if (!storeType) return;

            // Всегда запрашиваем актуальное состояние при открытии popup
            checkPopupState();
        });
    }

    // Загружаем сохраненный язык и состояние
    chrome.storage.local.get(['language', 'popupVisible'], function(result) {
        if (result.language) {
            setLanguage(result.language);
        } else {
            setLanguage('ru');
        }

        // Восстанавливаем состояние видимости попапа из хранилища
        if (result.popupVisible !== undefined) {
            currentPopupVisible = result.popupVisible;
            updateToggleButton();
        }

        // Загружаем данные
        getPurchaseData();

        // Принудительно синхронизируем состояние попапа
        setTimeout(forceSyncPopupState, 100);
    });

    // Слушаем события активации вкладки для обновления состояния
    chrome.tabs.onActivated.addListener(function(activeInfo) {
        setTimeout(forceSyncPopupState, 100);
    });

    // Слушаем события обновления вкладок
    chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
        if (changeInfo.status === 'complete') {
            setTimeout(forceSyncPopupState, 100);
        }
    });
});