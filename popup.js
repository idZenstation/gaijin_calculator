document.getElementById('calculate').addEventListener('click', async () => {
  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = '<p>Loading purchases data...</p>';

  try {
    const [tab] = await chrome.tabs.query({active: true, currentWindow: true});

    if (!tab.url.includes('store.gaijin.net/user.php')) {
      throw new Error('Please open Gaijin Store purchase history page first');
    }

    const results = await chrome.scripting.executeScript({
      target: {tabId: tab.id},
      func: () => {
        try {
          const popup = document.querySelector('.popup__content-wrapper');
          if (!popup) {
            throw new Error('Purchase popup not found. Please open your purchase history first.');
          }

          const purchases = [];
          let total = 0;
          const items = popup.querySelectorAll('.showcase-item-comment');

          items.forEach(item => {
            const title = item.querySelector('.showcase-item-comment__title')?.textContent.trim();
            const priceText = item.querySelector('.showcase-item-comment__price')?.textContent.trim();
            const dateItem = item.querySelector('.showcase-item-comment__list .showcase-item-comment__item');

            if (!title || !priceText || !dateItem) return;

            const priceMatch = priceText.match(/([₽$€])\s*([\d,]+)/);
            if (!priceMatch) return;

            const price = parseFloat(priceMatch[2].replace(',', ''));
            const currency = priceMatch[1];
            const date = dateItem.textContent.trim();

            purchases.push({
              title,
              price,
              currency,
              date
            });

            total += price;
          });

          if (purchases.length === 0) {
            throw new Error('No purchases found in the popup');
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
            htmlSnippet: document.documentElement.outerHTML.substring(0, 500)
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
      <div>Number of items: ${purchases.length}</div>
      <div class="purchases-list">
        ${purchases.slice(0, 5).map(p => `
          <div class="purchase">
            <div><strong>${p.title}</strong></div>
            <div>${p.price} ${p.currency} • ${p.date}</div>
          </div>
        `).join('')}
      </div>
      ${purchases.length > 5 ? `<p>...and ${purchases.length - 5} more</p>` : ''}
    `;

  } catch (error) {
    resultDiv.innerHTML = `
      <div class="error">
        <p><strong>Error:</strong> ${error.message}</p>
        <p>Please make sure:</p>
        <ol>
          <li>You're on <a href="https://store.gaijin.net/user.php?view=purchases" target="_blank">purchase history</a></li>
          <li>Purchase popup is visible</li>
          <li>You're logged in</li>
        </ol>
      </div>
    `;
  }
});