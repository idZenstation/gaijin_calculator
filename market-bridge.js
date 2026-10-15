const ALLOWED_ACTIONS = {
    'https://market-proxy.gaijin.net/web': ['cln_get_user_history', 'cln_market_get_asset_class', 'cln_market_info'],
    'https://market-proxy.gaijin.net/assetAPI': ['GetAssetClassInfo']
};

function allowedRequest(url, fields) {
    let parsed;
    try {
        parsed = new URL(url);
    } catch (error) {
        return false;
    }
    const key = parsed.origin + parsed.pathname;
    const actions = ALLOWED_ACTIONS[key];
    const action = fields && fields.action;
    return !!(actions && action && actions.indexOf(action) !== -1);
}

window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== 'gaijin-summary') return;
    if (data.action === 'market-bridge-ping') {
        window.postMessage({ source: 'gaijin-summary', action: 'market-bridge-pong' }, '*');
        return;
    }
    if (data.action !== 'market-fetch' || !data.id || !allowedRequest(data.url, data.fields)) return;
    const body = new URLSearchParams();
    const fields = data.fields || {};
    Object.keys(fields).forEach((key) => {
        const value = fields[key];
        if (value !== undefined && value !== null && value !== '') body.append(key, String(value));
    });
    fetch(data.url, {
        method: 'POST',
        headers: {
            accept: 'application/json, text/plain, */*',
            'content-type': 'application/x-www-form-urlencoded'
        },
        body: body.toString()
    }).then((response) => response.json()).then((json) => {
        window.postMessage({ source: 'gaijin-summary', action: 'market-fetch-result', id: data.id, ok: true, json: json }, '*');
    }).catch(() => {
        window.postMessage({ source: 'gaijin-summary', action: 'market-fetch-result', id: data.id, ok: false }, '*');
    });
});
