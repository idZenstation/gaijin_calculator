document.addEventListener('DOMContentLoaded', () => {
  const calculateBtn = document.getElementById('calculate');
  const resultDiv = document.getElementById('result');

  calculateBtn.addEventListener('click', async () => {
    resultDiv.innerHTML = '<p>Загрузка данных...</p>';

    chrome.runtime.sendMessage(
      { action: 'getPurchases' },
      (response) => {
        if (response.error) {
          resultDiv.innerHTML = `<p style="color: red;">Ошибка: ${response.error}</p>`;
        } else {
          resultDiv.innerHTML = `
            <h3>Статистика покупок</h3>
            <p>Всего покупок: ${response.count}</p>
            <p>Общая сумма: ${response.total.toFixed(2)} USD</p>
          `;
        }
      }
    );
  });
});