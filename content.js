function parsePurchasesData() {
  try {
    const popupContent = document.querySelector('.popup__content');
    if (!popupContent) {
      throw new Error('Блок с информацией о покупках не найден');
    }

    const items = Array.from(popupContent.querySelectorAll('.showcase-item-comment'));
    if (items.length === 0) {
      throw new Error('Список покупок пуст');
    }

    let totalSpent = 0;
    let purchaseCount = 0;
    const purchases = [];

    items.forEach(item => {
      const titleElement = item.querySelector('.showcase-item-comment__title');
      const counterElement = item.querySelector('.showcase-item-comment__counter');
      const dateElement = item.querySelector('.showcase-item-comment__item div');

      if (!titleElement || !dateElement) return;

      const title = titleElement.textContent.trim();
      const counter = counterElement ? parseInt(counterElement.textContent) || 1 : 1;
      const dateText = dateElement.textContent.trim();
      const priceMatch = title.match(/[₽$€£]\s*([\d,.]+)/);

      if (priceMatch) {
        const price = parseFloat(priceMatch[1].replace(',', ''));
        totalSpent += price * counter;
        purchaseCount += counter;

        purchases.push({
          title: title.replace(priceMatch[0], '').trim(),
          price: price,
          currency: priceMatch[0].trim(),
          count: counter,
          date: dateText.split(' - ')[0].trim(),
          recipient: dateText.split(' - ')[1]?.trim()
        });
      }
    });

    return {
      success: true,
      data: {
        total: totalSpent,
        count: purchaseCount,
        purchases: purchases,
        currencies: Array.from(new Set(purchases.map(p => p.currency)))
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Отправляем данные при запросе
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPurchases') {
    const result = parsePurchasesData();
    sendResponse(result);
  }
  return true;
});