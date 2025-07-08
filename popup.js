document.addEventListener('DOMContentLoaded', () => {
  const calculateBtn = document.getElementById('calculate');
  const resultDiv = document.getElementById('result');

  calculateBtn.addEventListener('click', async () => {
    calculateBtn.disabled = true;
    resultDiv.innerHTML = '<div class="loading">Получаем данные...</div>';

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab) throw new Error('Не найдена активная вкладка');

      const result = await chrome.tabs.sendMessage(tab.id, { action: 'getPurchases' });

      if (!result) throw new Error('Нет ответа от контент-скрипта');
      if (!result.success) throw new Error(result.error);

      displayResults(result.data);
    } catch (error) {
      showError(error.message);
    } finally {
      calculateBtn.disabled = false;
    }
  });

  function displayResults(data) {
    resultDiv.innerHTML = `
      <h3>Статистика покупок</h3>
      <div class="summary">
        <p>Всего покупок: <strong>${data.count}</strong></p>
        <p>Общая сумма: <strong>${data.total.toFixed(2)} ${data.currencies.join('/')}</strong></p>
      </div>
      <div class="purchases-list">
        <h4>Последние покупки:</h4>
        <ul>
          ${data.purchases.slice(0, 5).map(purchase => `
            <li>
              <span class="date">${purchase.date}</span>
              <span class="title">${purchase.title}</span>
              <span class="price">${purchase.price} ${purchase.currency} × ${purchase.count}</span>
            </li>
          `).join('')}
        </ul>
      </div>
      <button id="show-all">Показать все</button>
    `;

    document.getElementById('show-all').addEventListener('click', () => {
      resultDiv.querySelector('.purchases-list ul').innerHTML = data.purchases.map(purchase => `
        <li>
          <span class="date">${purchase.date}</span>
          <span class="title">${purchase.title}</span>
          <span class="price">${purchase.price} ${purchase.currency} × ${purchase.count}</span>
          ${purchase.recipient ? `<span class="recipient">${purchase.recipient}</span>` : ''}
        </li>
      `).join('');
    });
  }

  function showError(message) {
    resultDiv.innerHTML = `
      <div class="error">
        <p>${message}</p>
        <p>Попробуйте:</p>
        <ol>
          <li>Открыть <a href="https://store.gaijin.net/user.php?view=purchases" target="_blank">страницу покупок</a></li>
          <li>Прокрутить страницу вниз для загрузки всех данных</li>
          <li>Нажать кнопку "Рассчитать" снова</li>
        </ol>
      </div>
    `;
  }
});