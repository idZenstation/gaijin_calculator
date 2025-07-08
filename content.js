function parsePurchases(html) {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const popup = doc.querySelector('.popup__content');

    if (!popup) throw new Error('Popup container not found in HTML');

    const items = popup.querySelectorAll('.showcase-item-comment');
    const result = {
      total: 0,
      count: 0,
      purchases: []
    };

    items.forEach(item => {
      const title = item.querySelector('.showcase-item-comment__title')?.textContent.trim() || '';
      const priceMatch = title.match(/[₽$€£](\d+[\.,]\d{2})/);
      if (!priceMatch) return;

      const price = parseFloat(priceMatch[1].replace(',', '.'));
      const count = parseInt(item.querySelector('.showcase-item-comment__counter')?.textContent || '1');
      const [date, recipient] = (item.querySelector('.showcase-item-comment__item div')?.textContent || ' - ')
        .split(' - ')
        .map(s => s.trim());

      result.total += price * count;
      result.count += count;
      result.purchases.push({
        title: title.replace(priceMatch[0], '').trim(),
        price,
        currency: priceMatch[0][0],
        count,
        date,
        recipient
      });
    });

    return { status: 'success', data: result };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'parsePurchases') {
    const result = parsePurchases(request.html);
    sendResponse(result);
  }
  return true;
});