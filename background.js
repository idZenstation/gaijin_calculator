chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchPurchases') {
    fetch('https://store.gaijin.net/user.php?project=wt&view=purchases', {
      credentials: 'include',
      headers: {
        'Cache-Control': 'no-cache'
      }
    })
      .then(response => {
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return response.text();
      })
      .then(html => sendResponse({ html }))
      .catch(error => sendResponse({ error: error.message }));

    return true;
  }
});