document.addEventListener('DOMContentLoaded', async () => {
  const statsDiv = document.getElementById('stats');
  const calculateBtn = document.getElementById('calculate');
  const refreshBtn = document.getElementById('refresh');
  const loader = document.getElementById('loader');

  // Функция для отображения статуса
  function showStatus(message, isError = false) {
    statsDiv.innerHTML = `
      <p style="color: ${isError ? 'red' : 'inherit'};">
        ${message}
      </p>
    `;
  }

  // Основная функция расчета
  async function calculateStats() {
    try {
      // Показываем индикатор загрузки
      loader.style.display = 'block';
      calculateBtn.disabled = true;
      showStatus('Connecting to Gaijin Store...');

      // Получаем активную вкладку
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true
      });

      // Проверяем URL
      if (!tab?.url?.includes('store.gaijin.net/user.php')) {
        throw new Error('Please open Gaijin Store purchase history page first!');
      }

      // 1. Внедряем content script
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });

      // 2. Выполняем расчет
      const injectionResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          try {
            return window.getPurchaseData();
          } catch (e) {
            return {
              status: 'error',
              error: e.message,
              stack: e.stack
            };
          }
        }
      });

      const result = injectionResults[0]?.result;
      console.debug('Calculation result:', result);

      if (!result) {
        throw new Error('No response from content script');
      }

      if (result.status === 'error') {
        throw new Error(`Content script error: ${result.error}`);
      }

      if (result.status === 'no_data') {
        throw new Error('No purchase data found in table');
      }

      // Сохраняем и показываем результат
      await chrome.storage.local.set({ gaijinStats: result });
      showStats(result);

    } catch (error) {
      console.error('Calculation failed:', error);
      showStatus(`Error: ${error.message}`, true);

      // Дополнительная диагностика
      if (error.message.includes('Cannot access contents')) {
        showStatus(
          'Extension needs permission. Refresh the page and try again.',
          true
        );
      }
    } finally {
      loader.style.display = 'none';
      calculateBtn.disabled = false;
    }
  }

  // Функция отображения статистики
  function showStats(data) {
    statsDiv.innerHTML = `
      <div class="stat-item">
        <span>Total purchases:</span>
        <strong>${data.count}</strong>
      </div>
      <div class="stat-item">
        <span>Total spent:</span>
        <strong>${data.currency} ${data.total}</strong>
      </div>
      <div class="stat-item">
        <span>Average:</span>
        <strong>${data.currency} ${(data.total / data.count).toFixed(2)}</strong>
      </div>
      ${data.failedParses > 0 ? `
        <div class="warning">
          (${data.failedParses} entries skipped)
        </div>
      ` : ''}
    `;
  }

  // Обработчики кнопок
  calculateBtn.addEventListener('click', calculateStats);

  refreshBtn.addEventListener('click', async () => {
    try {
      const { gaijinStats } = await chrome.storage.local.get('gaijinStats');
      if (gaijinStats) {
        showStats(gaijinStats);
      } else {
        showStatus('No data available. Click Calculate first.');
      }
    } catch (error) {
      console.error('Refresh failed:', error);
      showStatus('Error loading saved data', true);
    }
  });

  // Загружаем сохраненные данные при открытии
  refreshBtn.click();
});