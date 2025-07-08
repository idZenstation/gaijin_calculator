document.getElementById('calculate').addEventListener('click', async () => {
  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = '<div class="loading">Loading purchases data...</div>';

  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});

    if (!tab.url.includes('store.gaijin.net/user.php')) {
      throw new Error('Please open Gaijin Store purchase history page first');
    }

    const results = await chrome.scripting.executeScript({
      target: {tabId: tab.id},
      func: async () => {
        try {
          // Проверка авторизации
          if (document.querySelector('.login-form, .user-login')) {
            throw new Error('Please login to your account first');
          }

          // Ждем загрузки попапа
          let popup = null;
          let attempts = 0;
          while (attempts < 5) {
            popup = document.querySelector('.popup__content-wrapper, .purchase-history-popup, [class*="purchase-popup"]');
            if (popup) break;
            await new Promise(resolve => setTimeout(resolve, 500));
            attempts++;
          }

          if (!popup) {
            throw new Error('Please open the purchase history popup from your account page');
          }

          // Дополнительное ожидание для AJAX-загрузки
          await new Promise(resolve => setTimeout(resolve, 800));

          const purchases = [];
          let total = 0;

          // Альтернативные селекторы для элементов
          const items = popup.querySelectorAll('.showcase-item-comment, [class*="purchase-item"], .history-item');

          if (items.length === 0) {
            console.error('Found popup but no items:', popup.outerHTML);
          }

          items.forEach(item => {
            try {
              const titleEl = item.querySelector('.showcase-item-comment__title, .item-title, [class*="title"]');
              const priceEl = item.querySelector('.showcase-item-comment__price, .item-price, [class*="price"]');
              const dateEl = item.querySelector('.showcase-item-comment__item, .item-date, [class*="date"]');

              if (!titleEl || !priceEl || !dateEl) {
                console.warn('Incomplete item:', item);
                return;
              }

              const title = titleEl.textContent.trim();
              const priceText = priceEl.textContent.trim();
              const dateText = dateEl.textContent.trim();

              // Поддержка разных форматов цен
              const priceMatch = priceText.match(/([₽$€]|RUB|USD|EUR)\s*([\d,.]+)/i);
              if (!priceMatch) {
                console.warn('Unsupported price format:', priceText);
                return;
              }

              const price = parseFloat(priceMatch[2].replace(',', '.'));
              const currency = priceMatch[1].length > 1 ?
                             {'RUB': '₽', 'USD': '$', 'EUR': '€'}[priceMatch[1].toUpperCase()] :
                             priceMatch[1];

              purchases.push({
                title,
                price,
                currency,
                date: dateText
              });

              total += price;
            } catch (e) {
              console.error('Error parsing item:', e, item);
            }
          });

          if (purchases.length === 0) {
            throw new Error(`No valid purchases found. Possible reasons:
              1. Popup not fully loaded
              2. No purchases in account
              3. Changed website structure`);
          }

          return {
            success: true,
            purchases,
            total,
            currency: purchases[0].currency
          };
        } catch (e) {
          return {
            success: false,
            error: e.message,
            htmlSnippet: document.documentElement.outerHTML.substring(0, 1000)
          };
        }
      }
    });

    const {success, purchases, total, currency, error} = results[0].result;

    if (!success) {
      throw new Error(error);
    }

    resultDiv.innerHTML = `
      <div class="total">Total: ${total.toFixed(2)} ${currency}</div>
      <div>Items found: ${purchases.length}</div>
      <div class="purchases-list">
        ${purchases.slice(0, 5).map(p => `
          <div class="purchase">
            <div><strong>${p.title}</strong></div>
            <div>${p.price} ${p.currency} • ${p.date}</div>
          </div>
        `).join('')}
      </div>
      ${purchases.length > 5 ? `<p>...and ${purchases.length - 5} more items</p>` : ''}
    `;

  } catch (error) {
    resultDiv.innerHTML = `
      <div class="error">
        <p><strong>Error:</strong> ${error.message}</p>
        <p>Please ensure:</p>
        <ol>
          <li>You're on <a href="https://store.gaijin.net/user.php?view=purchases" target="_blank">purchase history</a></li>
          <li>Purchase popup is open and visible</li>
          <li>You're logged in</li>
          <li>Page is fully loaded</li>
        </ol>
        <button id="retry-btn" style="margin-top:10px;padding:8px">Try Again</button>
      </div>
    `;
    document.getElementById('retry-btn').addEventListener('click', () => {
      document.getElementById('calculate').click();
    });
  }
});