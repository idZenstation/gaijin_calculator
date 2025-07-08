/*function parsePurchases() {
  try {
    const popupWrapper = document.querySelector('.popup__content-wrapper');
    if (!popupWrapper) {
      throw new Error('Не найден контейнер с покупками (.popup__content-wrapper)');
    }

    const items = popupWrapper.querySelectorAll('.showcase-item-comment');
    if (items.length === 0) {
      throw new Error('Не найдены товары (.showcase-item-comment)');
    }

    const result = {
      total: 0,
      count: 0,
      purchases: []
    };

    items.forEach(item => {
      try {
        // Название товара
        const titleEl = item.querySelector('.showcase-item-comment__title');
        if (!titleEl) return;
        const title = titleEl.textContent.trim();

        // Цена товара
        const priceEl = item.querySelector('.showcase-item-comment__price');
        if (!priceEl) return;
        const priceText = priceEl.textContent.trim();

        // Парсим цену (форматы: "₽1,200", "$50.00")
        const priceMatch = priceText.match(/([₽$€])\s*([\d,.]+)/);
        if (!priceMatch) return;
        const price = parseFloat(priceMatch[2].replace(',', ''));
        const currency = priceMatch[1];

        // Количество и дата
        const listEl = item.querySelector('.showcase-item-comment__list');
        if (!listEl) return;

        let quantity = 1;
        let purchaseDate = 'Неизвестная дата';

        listEl.querySelectorAll('.showcase-item-comment__item').forEach(li => {
          const text = li.textContent.trim();
          if (text.includes('Количество:')) {
            const qtyMatch = text.match(/Количество:\s*(\d+)/);
            if (qtyMatch) quantity = parseInt(qtyMatch[1]);
          } else if (text.includes('Дата покупки:')) {
            purchaseDate = text.replace('Дата покупки:', '').trim();
          }
        });

        result.total += price * quantity;
        result.count += quantity;
        result.purchases.push({
          title,
          price,
          currency,
          quantity,
          date: purchaseDate
        });

      } catch (e) {
        console.error('Ошибка парсинга товара:', e);
      }
    });

    if (result.count === 0) {
      throw new Error('Не найдено ни одной покупки');
    }

    return { status: 'success', data: result };

  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      htmlSnippet: document.documentElement.outerHTML.substring(0, 1000)
    };
  }
}

// Обработчик сообщений для вызова из popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPurchases') {
    const result = parsePurchases();
    sendResponse(result);
  }
  return true;
});*/