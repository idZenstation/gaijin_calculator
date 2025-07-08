document.getElementById('calculate').addEventListener('click', async () => {
  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = '<div class="loading">Загрузка данных...</div>';

  try {
    // 1. Получаем HTML через background.js
    const { html, error: fetchError } = await chrome.runtime.sendMessage({
      action: 'fetchPurchases'
    });
    if (fetchError) throw new Error(fetchError);

    // 2. Парсим данные через content.js
    const { data, error: parseError } = await chrome.runtime.sendMessage({
      action: 'parsePurchases',
      html
    });
    if (parseError) throw new Error(parseError);

    // 3. Отображаем результаты
    resultDiv.innerHTML = `
      <h3>Статистика покупок</h3>
      <p>Всего: ${data.count} покупок</p>
      <p>Общая сумма: ${data.total.toFixed(2)} ${data.purchases[0]?.currency || ''}</p>
      <div class="purchases">
        ${data.purchases.slice(0, 5).map(p => `
          <div class="purchase">
            <span class="date">${p.date}</span>
            <span class="title">${p.title}</span>
            <span class="price">${p.price.toFixed(2)} × ${p.count}</span>
          </div>
        `).join('')}
      </div>
    `;
  } catch (error) {
    resultDiv.innerHTML = `
      <div class="error">
        <p>Ошибка: ${error.message}</p>
        <p>Попробуйте:</p>
        <ol>
          <li>Открыть <a href="https://store.gaijin.net/user.php?view=purchases" target="_blank">страницу покупок</a></li>
          <li>Проверить авторизацию</li>
          <li>Обновить страницу (F5)</li>
        </ol>
      </div>
    `;
  }
});