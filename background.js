chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchPurchases') {
    // Запрашиваем именно страницу истории покупок
    fetch('https://store.gaijin.net/user.php?view=purchases&project=wt', {
      credentials: 'include',
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'Accept': 'text/html'
      }
    })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.text();
    })
    .then(html => {
      // Проверяем, что это действительно страница покупок
      if (!html.includes('purchases-history') && !html.includes('showcase-item-comment')) {
        throw new Error('Received incorrect page content');
      }
      sendResponse({ status: 'success', html });
    })
    .catch(error => {
      sendResponse({
        status: 'error',
        error: error.message,
        details: 'Failed to fetch purchase history'
      });
    });

    return true;
  }
});