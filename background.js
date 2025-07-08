chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchPurchases') {
    fetch('https://store.gaijin.net/user.php?project=wt&view=purchases', {
      credentials: 'include',
      headers: { 'Cache-Control': 'no-cache' }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.text();
    })
    .then(html => {
      sendResponse({ success: true, html });
    })
    .catch(error => {
      sendResponse({
        success: false,
        error: error.message || 'Unknown fetch error'
      });
    });

    return true; // Необходимо для асинхронного ответа
  }
});