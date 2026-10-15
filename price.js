(function (root, factory) {
    const api = factory();
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    }
    root.GaijinPrice = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    const CURRENCY_RE = /₽|€|\$|£|¥|₸|₴|₺|руб\.?|RUB|USD|EUR|GBP|KZT|UAH/i;
    const EAGLE_PHRASE = /золот\p{L}*\s+орл\p{L}*|golden eagles?/giu;
    const EAGLE_LOOSE = /(?:^|[^\p{L}])(?:орлов|eagles)(?=[^\p{L}]|$)/giu;
    const LION_PHRASE = /серебрян\p{L}*\s+льв\p{L}*|silver lions?/giu;
    const PREMIUM_PHRASE = /премиум[-\s]?аккаунт\p{L}*|premium accounts?|premium-accounts?|premiumkonto|cuenta premium|compte premium/giu;
    const DURATION_WORD = /дней|дня|день|days?|месяц\p{L}*|months?|года?|лет|years?|tage?|jours?/giu;
    const FILLER_WORD = /^(на|for|of|the|a|an|и)$/i;

    function emptyMoney() {
        return { amounts: {} };
    }

    function addMoney(bucket, currency, amount) {
        const key = currency || '';
        bucket.amounts[key] = (bucket.amounts[key] || 0) + amount;
        return bucket;
    }

    function roundMoney(value) {
        return Math.round(value * 100) / 100;
    }

    function primaryTotal(bucket) {
        const values = Object.values(bucket.amounts);
        if (values.length !== 1) return 0;
        return roundMoney(values[0]);
    }

    function formatNumber(value, lang) {
        const rounded = roundMoney(value);
        const integer = Math.abs(rounded - Math.trunc(rounded)) < 0.001;
        return rounded.toLocaleString(lang === 'ru' ? 'ru-RU' : 'en-US', {
            minimumFractionDigits: integer ? 0 : 2,
            maximumFractionDigits: 2
        });
    }

    function formatAmount(amount, currency, lang) {
        const number = formatNumber(amount, lang);
        return currency ? number + ' ' + currency : number;
    }

    function formatMoney(bucket, lang, fallbackCurrency) {
        const entries = Object.entries(bucket.amounts).filter(([, value]) => Math.abs(value) > 0.0001);
        if (!entries.length) {
            return formatAmount(0, fallbackCurrency || '', lang);
        }
        return entries
            .map(([currency, value]) => formatAmount(value, currency, lang))
            .join(' + ');
    }

    function looksLikeThousands(value, separator) {
        const parts = value.split(separator);
        if (parts.length < 2) return false;
        if (!/^\d{1,3}$/.test(parts[0])) return false;
        return parts.slice(1).every((part) => /^\d{3}$/.test(part));
    }

    function normalizeNumber(raw) {
        const compact = String(raw).replace(/\s/g, '');
        if (!compact) return null;
        const hasDot = compact.includes('.');
        const hasComma = compact.includes(',');
        let normalized = compact;

        if (hasDot && hasComma) {
            if (compact.lastIndexOf(',') > compact.lastIndexOf('.')) {
                normalized = compact.replace(/\./g, '').replace(',', '.');
            } else {
                normalized = compact.replace(/,/g, '');
            }
        } else if (hasComma) {
            normalized = looksLikeThousands(compact, ',')
                ? compact.replace(/,/g, '')
                : compact.replace(',', '.');
        } else if (hasDot && looksLikeThousands(compact, '.')) {
            normalized = compact.replace(/\./g, '');
        }

        const value = Number.parseFloat(normalized);
        return Number.isFinite(value) ? value : null;
    }

    function detectCurrency(priceText) {
        const match = String(priceText || '').match(CURRENCY_RE);
        if (!match) return '';
        const token = match[0];
        if (/^руб\.?$/i.test(token)) return '₽';
        if (/^RUB$/i.test(token)) return '₽';
        if (/^USD$/i.test(token)) return '$';
        if (/^EUR$/i.test(token)) return '€';
        if (/^GBP$/i.test(token)) return '£';
        if (/^KZT$/i.test(token)) return '₸';
        if (/^UAH$/i.test(token)) return '₴';
        return token;
    }

    function parsePrice(priceText) {
        if (!priceText) return null;
        const withoutPercent = String(priceText)
            .replace(/\u00a0/g, ' ')
            .replace(/[−–]/g, '-')
            .replace(/-?\d+(?:[.,]\d+)?\s*%/g, ' ');
        const matches = [...withoutPercent.matchAll(/(\d[\d\s.,]*)/g)];
        const amounts = [];
        matches.forEach((match) => {
            const value = normalizeNumber(match[1]);
            if (value != null) amounts.push(value);
        });
        if (!amounts.length) return null;
        return amounts[amounts.length - 1];
    }

    function interpretPrice(priceText) {
        const text = String(priceText || '').replace(/\u00a0/g, ' ').trim();
        if (!text) return { kind: 'missing', amount: 0, currency: '' };
        if (/бесплатно|free/i.test(text) && !/\d/.test(text)) {
            return { kind: 'free', amount: 0, currency: detectCurrency(text) };
        }
        const amount = parsePrice(text);
        if (amount == null) return { kind: 'missing', amount: 0, currency: '' };
        if (amount === 0) return { kind: 'free', amount: 0, currency: detectCurrency(text) };
        return { kind: 'paid', amount: amount, currency: detectCurrency(text) };
    }

    function parseQuantityText(text) {
        const value = String(text || '').replace(/\s+/g, ' ').trim();
        if (!value || value.length > 16) return 1;
        const patterns = [
            /^(\d+)\s*[xх×]$/i,
            /^[xх×]\s*(\d+)$/i,
            /^(\d+)\s*шт\.?$/i,
            /^(\d+)\s*pcs\.?$/i
        ];
        for (let i = 0; i < patterns.length; i++) {
            const match = value.match(patterns[i]);
            if (!match) continue;
            const qty = Number.parseInt(match[1], 10);
            return qty > 0 ? qty : 1;
        }
        return 1;
    }

    function reset(pattern) {
        pattern.lastIndex = 0;
        return pattern;
    }

    function leftover(name, phrase) {
        const cleaned = name
            .replace(reset(phrase), ' ')
            .replace(reset(DURATION_WORD), ' ')
            .replace(/\d[\d\s.,]*/g, ' ')
            .replace(/[xх×]/g, ' ')
            .replace(/шт\.?|pcs\.?|pieces?/gi, ' ')
            .replace(/[^\p{L}]+/gu, ' ')
            .trim();
        return cleaned
            .split(/\s+/)
            .filter((word) => word && !FILLER_WORD.test(word))
            .join(' ');
    }

    function isPure(name, phrase) {
        reset(phrase);
        return phrase.test(name) && leftover(name, phrase).length === 0;
    }

    function extractGroupedCount(name, phrase) {
        const match = name.match(new RegExp('(\\d[\\d\\s.]*)\\s*(?:' + phrase.source + ')', 'iu'));
        if (!match) return 0;
        const digits = match[1].replace(/[^\d]/g, '');
        return Number.parseInt(digits, 10) || 0;
    }

    function extractPremiumDays(name) {
        let days = 0;
        const dayMatch = name.match(/(\d+)\s*(?:дней|дня|день|days?|tage?|jours?)/iu);
        const monthMatch = name.match(/(\d+)\s*(?:месяц\p{L}*|months?)/iu);
        const yearMatch = name.match(/(\d+)\s*(?:год|года|лет|years?)/iu);
        if (dayMatch) days += Number.parseInt(dayMatch[1], 10) || 0;
        if (monthMatch) days += (Number.parseInt(monthMatch[1], 10) || 0) * 30;
        if (yearMatch) days += (Number.parseInt(yearMatch[1], 10) || 0) * 365;
        return days;
    }

    function classifyPurchaseName(name) {
        const title = String(name || '').trim();
        const empty = { kind: 'pack', eagles: 0, lions: 0, days: 0 };
        if (!title) return empty;

        const eaglePhrase = new RegExp(EAGLE_PHRASE.source, EAGLE_PHRASE.flags);
        const lionPhrase = new RegExp(LION_PHRASE.source, LION_PHRASE.flags);
        const premiumPhrase = new RegExp(PREMIUM_PHRASE.source, PREMIUM_PHRASE.flags);
        const hasEagles = eaglePhrase.test(title);
        const hasLions = lionPhrase.test(title);
        const hasPremium = premiumPhrase.test(title);

        const pureEagles = isPure(title, new RegExp(EAGLE_PHRASE.source, 'giu'))
            || isPure(title, new RegExp(EAGLE_LOOSE.source, 'giu'));
        if ((hasEagles || pureEagles) && !hasLions && !hasPremium && pureEagles) {
            return {
                kind: 'eagles',
                eagles: extractGroupedCount(title, EAGLE_PHRASE) || extractGroupedCount(title, /орлов|eagles/iu),
                lions: 0,
                days: 0
            };
        }
        if (hasLions && !hasEagles && !hasPremium && isPure(title, new RegExp(LION_PHRASE.source, 'giu'))) {
            return {
                kind: 'lions',
                eagles: 0,
                lions: extractGroupedCount(title, LION_PHRASE),
                days: 0
            };
        }
        if (hasPremium && !hasEagles && !hasLions && isPure(title, new RegExp(PREMIUM_PHRASE.source, 'giu'))) {
            return {
                kind: 'premium',
                eagles: 0,
                lions: 0,
                days: extractPremiumDays(title)
            };
        }
        return empty;
    }

    return {
        emptyMoney: emptyMoney,
        addMoney: addMoney,
        primaryTotal: primaryTotal,
        formatNumber: formatNumber,
        formatAmount: formatAmount,
        formatMoney: formatMoney,
        parsePrice: parsePrice,
        detectCurrency: detectCurrency,
        interpretPrice: interpretPrice,
        parseQuantityText: parseQuantityText,
        classifyPurchaseName: classifyPurchaseName
    };
});
