chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchPurchases') {
    const fetchUrl = `https://store.gaijin.net/user.php?view=purch_type&type=yuplay&project=wt&rand=${Math.random()}`;

    fetch(fetchUrl, {
      credentials: 'include',
      headers: { 'Cache-Control': 'no-cache' }
    })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    })
    .then(html => {
      if (!html.includes('popup__content')) {
        throw new Error('Invalid response: missing popup content');
      }
      sendResponse({ status: 'success', html }); // Четкая структура ответа
    })
    .catch(error => {
      sendResponse({ status: 'error', error: error.message });
    });

    return true; // Оставляем канал открытым для асинхронного ответа
  }
});