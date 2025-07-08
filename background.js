chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchPurchases') {
    fetch(`https://store.gaijin.net/user.php?view=purch_type&type=yuplay&project=wt&rand=${Math.random()}`)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.text();
      })
      .then(html => {
        // Проверяем, содержит ли ответ нужные данные
        if (!html.includes('popup__content')) {
          throw new Error('Ответ не содержит данных о покупках');
        }
        sendResponse({ success: true, html });
      })
      .catch(error => sendResponse({
        success: false,
        error: error.message
      }));

    return true; // Для асинхронного ответа
  }
});