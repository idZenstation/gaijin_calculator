(function (root) {
    const WEB_URL = 'https://market-proxy.gaijin.net/web';
    const ASSET_URL = 'https://market-proxy.gaijin.net/assetAPI';
    const FALLBACK_APP = '1067';

    function readTokenPair(raw) {
        if (!raw || typeof raw !== 'string') return '';
        try {
            const parsed = JSON.parse(raw);
            if (typeof parsed === 'string') return parsed;
            if (parsed && typeof parsed.token === 'string') return parsed.token;
        } catch (error) {
            if (raw.split('.').length === 3) return raw;
        }
        return '';
    }

    function humanizeHash(hash) {
        const body = String(hash || '').replace(/^id\d+_/, '').replace(/_/g, ' ').trim();
        if (!body) return '';
        return body.replace(/\b([a-z])/g, (letter) => letter.toUpperCase());
    }

    function tradeIdFromTrans(transId) {
        const matched = /^(?:o|i)(\d+)/.exec(String(transId || ''));
        return matched ? matched[1] : '';
    }

    function classifyReason(reason, transId, cents) {
        const text = String(reason || '').trim().toLowerCase();
        if (text === 'продажа' || text === 'sale') return 'sale';
        if (text === 'покупка' || text === 'purchase' || text === 'buy') return 'purchase';
        if (text === 'прочее' || text === 'other' || text === 'пополнение' || text === 'topup' || text === 'top-up') return 'topup';
        const id = String(transId || '');
        if (id.startsWith('o')) return 'sale';
        if (id.startsWith('i')) return 'purchase';
        return cents < 0 ? 'purchase' : 'topup';
    }

    let bridgeReady = null;
    let fetchSeq = 0;

    function canUseBridge() {
        if (typeof window === 'undefined' || !window.postMessage) return Promise.resolve(false);
        if (bridgeReady !== null) return Promise.resolve(bridgeReady);
        bridgeReady = new Promise((resolve) => {
            const stop = setTimeout(finish, 1000);
            const retry = setInterval(() => {
                window.postMessage({ source: 'gaijin-summary', action: 'market-bridge-ping' }, '*');
            }, 50);
            function finish(ready) {
                clearTimeout(stop);
                clearInterval(retry);
                window.removeEventListener('message', onMessage);
                resolve(!!ready);
            }
            function onMessage(event) {
                if (event.source !== window) return;
                const data = event.data;
                if (!data || data.source !== 'gaijin-summary' || data.action !== 'market-bridge-pong') return;
                finish(true);
            }
            window.addEventListener('message', onMessage);
            window.postMessage({ source: 'gaijin-summary', action: 'market-bridge-ping' }, '*');
        });
        return bridgeReady;
    }

    function postFormViaPage(url, fields) {
        return new Promise((resolve, reject) => {
            const id = ++fetchSeq;
            const timer = setTimeout(() => {
                window.removeEventListener('message', onMessage);
                reject(new Error('market'));
            }, 20000);
            function onMessage(event) {
                if (event.source !== window) return;
                const data = event.data;
                if (!data || data.source !== 'gaijin-summary' || data.action !== 'market-fetch-result' || data.id !== id) return;
                clearTimeout(timer);
                window.removeEventListener('message', onMessage);
                if (!data.ok) reject(new Error('market'));
                else resolve(data.json);
            }
            window.addEventListener('message', onMessage);
            window.postMessage({ source: 'gaijin-summary', action: 'market-fetch', id: id, url: url, fields: fields }, '*');
        });
    }

    async function postForm(url, fields) {
        if (await canUseBridge()) return postFormViaPage(url, fields);
        const body = new URLSearchParams();
        Object.keys(fields).forEach((key) => {
            const value = fields[key];
            if (value !== undefined && value !== null && value !== '') body.append(key, String(value));
        });
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                accept: 'application/json, text/plain, */*',
                'content-type': 'application/x-www-form-urlencoded'
            },
            body: body.toString()
        });
        if (!response.ok) throw new Error('market');
        return response.json();
    }

    function readHistoryEvents(payload) {
        const sources = [payload, payload && payload.response, payload && payload.result];
        for (let index = 0; index < sources.length; index++) {
            const source = sources[index];
            if (source && Array.isArray(source.events)) return source.events;
        }
        throw new Error('market');
    }

    function unwrap(payload) {
        if (!payload || typeof payload !== 'object') throw new Error('market');
        if (payload.success === false || payload.error) throw new Error('market');
        if (payload.response !== undefined) return payload.response;
        return payload;
    }

    function languageCode(language) {
        return language === 'en' ? 'en_US' : 'ru';
    }

    const nameCache = new Map();

    function displayFallback(hash) {
        const text = String(hash || '');
        if (/^id\d+_/.test(text) || /^ugcitem_\d+/.test(text) || /^items_/.test(text)) {
            return humanizeHash(text.replace(/^items_/, ''));
        }
        return text;
    }

    async function resolveMarketName(token, appId, hash, language) {
        const cacheKey = appId + '\0' + hash + '\0' + language;
        if (nameCache.has(cacheKey)) return nameCache.get(cacheKey);
        const idMatch = /^id(\d+)_/.exec(hash);
        let classes = idMatch ? [{ name: '__itemdefid', value: idMatch[1] }] : null;
        if (!classes) {
            try {
                const info = unwrap(await postForm(WEB_URL, {
                    action: 'cln_market_get_asset_class',
                    token: token,
                    appid: appId,
                    name: hash
                }));
                if (info && Array.isArray(info.asset_class) && info.asset_class.length) classes = info.asset_class;
            } catch (error) {
                void error;
            }
        }
        let name = '';
        let itemType = '';
        let itemTypeSort = 999;
        let itemTypeColor = '';
        if (classes) {
            try {
                const fields = {
                    action: 'GetAssetClassInfo',
                    token: token,
                    appid: appId,
                    language: languageCode(language),
                    class_count: classes.length
                };
                classes.forEach((item, index) => {
                    fields['class_name' + index] = item.name;
                    fields['class_value' + index] = item.value;
                });
                const payload = await postForm(ASSET_URL, fields);
                const asset = payload && payload.result && payload.result.asset;
                name = asset && (asset.market_name || asset.name) || '';
                const typeTag = typeFromAsset(asset);
                itemType = typeTag.itemType;
                itemTypeSort = typeTag.itemTypeSort;
                itemTypeColor = typeTag.itemTypeColor;
            } catch (error) {
                void error;
            }
        }
        if (!name) name = displayFallback(hash);
        const resolved = {
            name: name,
            itemType: itemType,
            itemTypeSort: itemTypeSort,
            itemTypeColor: itemTypeColor
        };
        nameCache.set(cacheKey, resolved);
        return resolved;
    }

    function typeFromAsset(asset) {
        const tags = asset && Array.isArray(asset.tags) ? asset.tags : [];
        const type = tags.find((tag) => tag && tag.category === 'type' && tag.name);
        if (!type) return { itemType: '', itemTypeSort: 999, itemTypeColor: '' };
        const raw = String(type.color || '').replace(/^#/, '');
        return {
            itemType: String(type.name),
            itemTypeSort: Number(type.sort_index) || 0,
            itemTypeColor: /^[0-9a-fA-F]{6}$/.test(raw) ? '#' + raw : ''
        };
    }

    async function attachNames(token, trades, language) {
        const groups = new Map();
        trades.forEach((trade) => {
            trade.name = displayFallback(trade.market);
            const key = trade.appId + '\0' + trade.market;
            if (!trade.market) return;
            if (!groups.has(key)) groups.set(key, { appId: trade.appId, hash: trade.market, trades: [] });
            groups.get(key).trades.push(trade);
        });

        const jobs = [...groups.values()];
        async function worker() {
            while (jobs.length) {
                const job = jobs.shift();
                const resolved = await resolveMarketName(token, job.appId, job.hash, language);
                job.trades.forEach((trade) => {
                    if (resolved && resolved.name) trade.name = resolved.name;
                    trade.itemType = resolved && resolved.itemType || '';
                    trade.itemTypeSort = resolved && resolved.itemTypeSort;
                    trade.itemTypeColor = resolved && resolved.itemTypeColor || '';
                });
            }
        }

        await Promise.all([worker(), worker(), worker(), worker()]);
    }

    async function loadTrades(token, language) {
        if (!token) return [];
        const trades = [];
        const seen = new Set();
        let skip = 0;

        for (let page = 0; page < 50; page++) {
            const payload = unwrap(await postForm(WEB_URL, {
                action: 'cln_get_user_history',
                token: token,
                count: 100,
                skip: skip
            }));
            const events = readHistoryEvents(payload);
            events.forEach((row) => {
                if (!row || row.event !== 'deal') return;
                const id = String(row.orderId || '');
                if (!id || seen.has(id)) return;
                seen.add(id);
                const amount = Number(row.count);
                trades.push({
                    id: id,
                    type: String(row.type || '').toUpperCase(),
                    market: String(row.hashname || ''),
                    appId: String(row.appid || FALLBACK_APP),
                    normalPrice: Number(row.price) || 0,
                    quantity: Number.isFinite(amount) && amount > 0 ? amount : 1
                });
            });
            if (events.length < 100) break;
            skip += 100;
        }

        await attachNames(token, trades, language);
        return trades;
    }

    root.GaijinMarket = {
        readTokenPair: readTokenPair,
        humanizeHash: humanizeHash,
        tradeIdFromTrans: tradeIdFromTrans,
        classifyReason: classifyReason,
        loadTrades: loadTrades
    };
})(typeof globalThis !== 'undefined' ? globalThis : this);
