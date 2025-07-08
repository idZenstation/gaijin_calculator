document.getElementById('calculate').addEventListener('click', async () => {
  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = '<div class="loading">Loading...</div>';

  try {
    // 1. Получаем HTML
    const fetchResponse = await chrome.runtime.sendMessage({
      action: 'fetchPurchases'
    });

    if (!fetchResponse || fetchResponse.status !== 'success') {
      throw new Error(fetchResponse?.error || 'Failed to fetch data');
    }

    // 2. Парсим данные
    const parseResponse = await chrome.runtime.sendMessage({
      action: 'parsePurchases',
      html: fetchResponse.html
    });

    if (!parseResponse || parseResponse.status !== 'success') {
      throw new Error(parseResponse?.error || 'Failed to parse data');
    }

    // 3. Отображаем результат
    displayResults(parseResponse.data);
  } catch (error) {
    resultDiv.innerHTML = `
      <div class="error">
        <p>Error: ${error.message}</p>
        <button id="retry-btn">Try Again</button>
      </div>
    `;
    document.getElementById('retry-btn').addEventListener('click', () => {
      document.getElementById('calculate').click();
    });
  }
});

function displayResults(data) {
  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = `
    <h3>Purchase Stats</h3>
    <p>Total: ${data.count} items</p>
    <p>Amount: ${data.total.toFixed(2)} ${data.purchases[0]?.currency || ''}</p>
    <div class="purchase-list">
      ${data.purchases.slice(0, 5).map(p => `
        <div class="purchase-item">
          <span>${p.date}</span>
          <strong>${p.title}</strong>
          <span>${p.price.toFixed(2)} × ${p.count}</span>
        </div>
      `).join('')}
    </div>
  `;
}