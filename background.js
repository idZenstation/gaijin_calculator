importScripts('market-api.js');

let openingTradeTab = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || request.action !== 'loadMarketTrades') return;
    loadMarketTrades(request.language, request.force).then(sendResponse);
    return true;
});

async function loadMarketTrades(language, force) {
    const lang = language === 'en' ? 'en' : 'ru';
    const stored = await chrome.storage.local.get(['marketAuth', 'marketTrades']);
    const cached = stored.marketTrades && Array.isArray(stored.marketTrades.trades) ? stored.marketTrades.trades : [];

    const fromPage = await captureFromTradePage(lang);
    if (hasTypes(fromPage && fromPage.trades)) {
        await rememberTrades(fromPage.trades);
        return { success: true, trades: fromPage.trades, named: true };
    }

    const token = stored.marketAuth && stored.marketAuth.token;
    if (token) {
        try {
            const trades = await GaijinMarket.loadTrades(token, lang);
            if (hasTypes(trades)) {
                await rememberTrades(trades);
                return { success: true, trades: trades, named: true };
            }
        } catch (error) {
            void error;
        }
    }

    if (hasTypes(cached)) {
        return { success: true, trades: cached, named: true, stale: true };
    }

    const opened = await openTradeTab(lang);
    if (opened && hasTypes(opened.trades)) {
        await rememberTrades(opened.trades);
        return { success: true, trades: opened.trades, named: true };
    }

    if (hasNames(fromPage && fromPage.trades)) {
        return { success: true, trades: fromPage.trades, named: true };
    }
    if (hasNames(cached)) {
        return { success: true, trades: cached, named: true, stale: true };
    }
    return { success: true, trades: [], named: false };
}

function rememberTrades(trades) {
    return chrome.storage.local.set({
        marketTrades: { trades: trades, savedAt: Date.now(), history: true }
    });
}

async function captureFromTradePage(language) {
    const tabs = await chrome.tabs.query({ url: 'https://trade.gaijin.net/*' });
    let sawSignedOut = false;
    let named = null;
    for (const tab of tabs) {
        const response = await askTradeTab(tab.id, language);
        if (hasTypes(response && response.trades)) return response;
        if (hasNames(response && response.trades)) named = response;
        if (response && response.reason === 'no-token') sawSignedOut = true;
    }
    if (named) return named;
    return sawSignedOut ? { reason: 'no-token', trades: [] } : null;
}

async function openTradeTab(language) {
    if (openingTradeTab) return openingTradeTab;
    openingTradeTab = openTradeTabNow(language).finally(() => {
        openingTradeTab = null;
    });
    return openingTradeTab;
}

async function openTradeTabNow(language) {
    const tab = await chrome.tabs.create({ url: 'https://trade.gaijin.net/', active: false });
    await waitForComplete(tab.id);
    for (let attempt = 0; attempt < 20; attempt++) {
        const response = await askTradeTab(tab.id, language);
        if (hasTypes(response && response.trades) || hasNames(response && response.trades)) return response;
        await delay(500);
    }
    return null;
}

function hasTypes(trades) {
    return Array.isArray(trades) && trades.some((trade) => trade && trade.itemType);
}

function hasNames(trades) {
    return Array.isArray(trades) && trades.some((trade) => trade && (trade.name || trade.market));
}

function askTradeTab(tabId, language) {
    return chrome.tabs.sendMessage(tabId, { action: 'captureMarketTrades', language: language }).catch(() => null);
}

function waitForComplete(tabId) {
    return new Promise((resolve) => {
        const timer = setTimeout(finish, 15000);
        function finish() {
            clearTimeout(timer);
            chrome.tabs.onUpdated.removeListener(onUpdated);
            resolve();
        }
        function onUpdated(id, info) {
            if (id === tabId && info.status === 'complete') finish();
        }
        chrome.tabs.onUpdated.addListener(onUpdated);
        chrome.tabs.get(tabId).then((tab) => {
            if (tab && tab.status === 'complete') finish();
        }).catch(() => {});
    });
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
