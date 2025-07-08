function parsePopupContent(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const popup = doc.querySelector('.popup__content');

  if (!popup) {
    console.error('Полученный HTML:', html); // Для отладки
    throw new Error('Popup с данными не найден в ответе');
  }

  const items = popup.querySelectorAll('.showcase-item-comment');
  const results = {
    total: 0,
    count: 0,
    purchases: []
  };

  items.forEach(item => {
    const title = item.querySelector('.showcase-item-comment__title')?.textContent.trim();
    const counter = parseInt(item.querySelector('.showcase-item-comment__counter')?.textContent) || 1;
    const dateInfo = item.querySelector('.showcase-item-comment__item div')?.textContent.trim().split(' - ');

    // Парсим цену (формат: "Название ₽100.00")
    const priceMatch = title?.match(/[₽$€£](\d+[\.,]\d{2})/);
    if (!priceMatch) return;

    const price = parseFloat(priceMatch[1].replace(',', '.'));

    results.total += price * counter;
    results.count += counter;
    results.purchases.push({
      title: title.replace(priceMatch[0], '').trim(),
      price: price,
      currency: priceMatch[0][0],
      count: counter,
      date: dateInfo?.[0],
      recipient: dateInfo?.[1]
    });
  });

  return results;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'parsePurchases') {
    try {
      const data = parsePopupContent(request.html);
      sendResponse({ success: true, data });
    } catch (error) {
      sendResponse({ success: false, error: error.message });
    }
  }
  return true;
});