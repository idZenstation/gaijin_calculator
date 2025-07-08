async function fetchPurchases() {
  try {
    const response = await fetch('https://store.gaijin.net/user.php?project=wt&view=purchases', {
      credentials: 'include' // Для передачи куков авторизации
    });
    
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    const html = await response.text();
    return html;
  } catch (error) {
    console.error('Fetch error:', error);
    return null;
  }
}

function parseHTML(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const table = doc.querySelector('#purchases-history');
  
  if (!table) {
    throw new Error('Таблица покупок не найдена в ответе');
  }

  let total = 0;
  let count = 0;
  const rows = table.querySelectorAll('tbody tr');

  rows.forEach(row => {
    const priceCell = row.querySelector('td:nth-child(4)');
    if (!priceCell) return;

    const priceText = priceCell.textContent.trim();
    const match = priceText.match(/([₽$€£])\s*([\d,.]+)/);
    if (!match) return;

    const amount = parseFloat(match[2].replace(',', ''));
    total += amount;
    count++;
  });

  return { total, count };
}

// Обработчик сообщений от popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getPurchases') {
    fetchPurchases()
      .then(html => {
        if (!html) throw new Error('Не удалось загрузить данные');
        return parseHTML(html);
      })
      .then(data => sendResponse(data))
      .catch(error => sendResponse({ error: error.message }));
    
    return true; // Для асинхронного ответа
  }
});