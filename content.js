function parsePurchases(html) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    // Ищем основную таблицу покупок
    const table = doc.querySelector('#purchases-history, .purchase-history-table');
    if (!table) {
      throw new Error('Purchase history table not found');
    }

    // Альтернативные селекторы для элементов
    const items = table.querySelectorAll('tbody tr, .purchase-item');
    if (items.length === 0) {
      throw new Error('No purchase items found');
    }

    const result = {
      total: 0,
      count: 0,
      purchases: []
    };

    items.forEach(item => {
      try {
        // Ищем элементы с информацией
        const titleEl = item.querySelector('.showcase-item-comment__title, .item-title');
        const priceEl = item.querySelector('td:nth-child(4), .item-price');
        const dateEl = item.querySelector('.showcase-item-comment__item, .item-date');

        if (!titleEl || !priceEl || !dateEl) return;

        const title = titleEl.textContent.trim();
        const priceText = priceEl.textContent.trim();
        const dateInfo = dateEl.textContent.trim();

        // Парсим цену (поддерживаем ₽/$/€ и форматы типа "100.00 RUB")
        const priceMatch = priceText.match(/([₽$€]|RUB|USD|EUR)\s*([\d,.]+)/) ||
                         title.match(/([₽$€]|RUB|USD|EUR)\s*([\d,.]+)/);

        if (!priceMatch) return;

        const price = parseFloat(priceMatch[2].replace(',', '.'));
        const currency = priceMatch[1].length > 1 ?
                       {'RUB': '₽', 'USD': '$', 'EUR': '€'}[priceMatch[1]] :
                       priceMatch[1];

        // Парсим дату и получателя
        const [date, recipient = 'Yourself'] = dateInfo.split(' - ').map(s => s.trim());

        result.total += price;
        result.count++;
        result.purchases.push({
          title: title.replace(priceMatch[0], '').trim(),
          price,
          currency,
          date,
          recipient
        });
      } catch (e) {
        console.warn('Failed to parse item:', e);
      }
    });

    if (result.count === 0) {
      throw new Error('No valid purchases found after parsing');
    }

    return { status: 'success', data: result };

  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      htmlSnippet: html.substring(0, 500) + '...'
    };
  }
}