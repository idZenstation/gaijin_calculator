document.addEventListener('DOMContentLoaded', () => {
  const calculateBtn = document.getElementById('calculate');
  const resultDiv = document.getElementById('result');
  let isProcessing = false;

  calculateBtn.addEventListener('click', async () => {
    if (isProcessing) return;
    isProcessing = true;
    calculateBtn.disabled = true;
    resultDiv.innerHTML = '<p class="loading">Загрузка данных...</p>';

    try {
      // Шаг 1: Получаем HTML через background.js
      const { html, error: fetchError } = await chrome.runtime.sendMessage({
        action: 'fetchPurchases'
      });

      if (fetchError) throw new Error(fetchError);

      // Шаг 2: Получаем активную вкладку
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

      if (!tab) throw new Error('Не найдена активная вкладка');

      // Шаг 3: Отправляем HTML в content.js для парсинга
      const injectionResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      const { success, data, error: parseError } = await chrome.tabs.sendMessage(
        tab.id,
        {
          action: 'parseHTML',
          html
        }
      );

      if (!success) throw new Error(parseError);

      // Шаг 4: Отображаем результаты
      resultDiv.innerHTML = `
        <h3>Статистика покупок</h3>
        <p><strong>Всего покупок:</strong> ${data.count}</p>
        <p><strong>Общая сумма:</strong> ${data.total.toFixed(2)}</p>
        ${data.currencies.map(c => `
          <div class="currency-item">${c}</div>
        `).join('')}
        <p><small>Последнее обновление: ${new Date().toLocaleTimeString()}</small></p>
      `;
    } catch (error) {
      console.error('Ошибка:', error);
      resultDiv.innerHTML = `
        <p class="error">Ошибка: ${error.message}</p>
        <p>Попробуйте:</p>
        <ol>
          <li>Открыть <a href="https://store.gaijin.net/user.php?view=purchases" target="_blank">страницу покупок</a></li>
          <li>Войти в аккаунт</li>
          <li>Обновить страницу (F5)</li>
          <li>Попробовать снова</li>
        </ol>
      `;
    } finally {
      isProcessing = false;
      calculateBtn.disabled = false;
    }
  });
});