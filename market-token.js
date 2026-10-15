const TOKEN_STORAGE_KEY = 'MarketApp,auth,tokenPair';

let lastToken = '';
let lastTrades = [];
let captureTask = null;

function pageLanguage() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['language'], (result) => {
            resolve(result && result.language === 'en' ? 'en' : 'ru');
        });
    });
}

function captureMarketTrades(force, language) {
    if (captureTask) return captureTask;
    captureTask = runCapture(force, language).finally(() => {
        captureTask = null;
    });
    return captureTask;
}

async function runCapture(force, language) {
    let raw = '';
    try {
        raw = localStorage.getItem(TOKEN_STORAGE_KEY) || '';
    } catch (error) {
        return { ok: false };
    }
    const token = GaijinMarket.readTokenPair(raw);
    if (!token) return { ok: false, reason: 'no-token' };
    if (!force && token === lastToken && lastTrades.length) {
        return { ok: true, trades: lastTrades, history: true };
    }

    const lang = language === 'en' || language === 'ru' ? language : await pageLanguage();
    try {
        const trades = await GaijinMarket.loadTrades(token, lang);
        lastToken = token;
        lastTrades = trades;
        await chrome.storage.local.set({
            marketAuth: { token: token, savedAt: Date.now() },
            marketTrades: { trades: trades, savedAt: Date.now(), history: true }
        });
        return { ok: true, trades: trades, history: true };
    } catch (error) {
        await chrome.storage.local.set({
            marketAuth: { token: token, savedAt: Date.now() }
        });
        return { ok: false };
    }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || request.action !== 'captureMarketTrades') return;
    captureMarketTrades(true, request.language).then(sendResponse);
    return true;
});

captureMarketTrades(false);
window.setInterval(() => captureMarketTrades(false), 15000);
window.addEventListener('focus', () => captureMarketTrades(false));
