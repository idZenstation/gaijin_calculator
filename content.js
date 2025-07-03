// content.js
class GaijinPurchaseStats {
  constructor() {
    this.statsContainerId = 'gaijin-purchase-stats';
    this.initialized = false;
    this.init();
  }

  async init() {
    if (this.initialized) return;

    try {
      this.injectStyles();
      await this.waitForElement('.profile__title.profile__title_small-margin');
      this.createContainer();
      await this.calculateStats();
      this.initialized = true;
    } catch (error) {
      console.error('Gaijin Stats Error:', error);
      this.showError();
    }
  }

  injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      #${this.statsContainerId} {
        margin: 15px 0;
        padding: 15px;
        background: #f5f5f5;
        border-radius: 5px;
        font-family: Arial, sans-serif;
      }
      .gaijin-stats-header {
        display: flex;
        justify-content: space-between;
        margin-bottom: 10px;
      }
      .gaijin-stats-title {
        font-weight: bold;
        color: #333;
      }
      .gaijin-stats-content {
        display: grid;
        gap: 10px;
      }
      .gaijin-stats-section {
        background: white;
        padding: 10px;
        border-radius: 4px;
      }
      .gaijin-stats-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 5px;
      }
      .gaijin-stats-refresh {
        color: #0066cc;
        cursor: pointer;
        border: none;
        background: none;
      }
      .gaijin-stats-error {
        color: #d32f2f;
      }
    `;
    document.head.appendChild(style);
  }

  waitForElement(selector, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) return resolve();

      const observer = new MutationObserver((_, obs) => {
        if (document.querySelector(selector)) {
          obs.disconnect();
          resolve();
        }
      });

      observer.observe(document.body, { childList: true, subtree: true });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found`));
      }, timeout);
    });
  }

  createContainer() {
    let container = document.getElementById(this.statsContainerId);
    if (container) container.remove();

    container = document.createElement('div');
    container.id = this.statsContainerId;
    container.innerHTML = `
      <div class="gaijin-stats-header">
        <div class="gaijin-stats-title">Статистика покупок</div>
        <button class="gaijin-stats-refresh" title="Обновить">↻</button>
      </div>
      <div class="gaijin-stats-content">
        <div>Загрузка данных...</div>
      </div>
    `;

    container.querySelector('.gaijin-stats-refresh').addEventListener('click', () => {
      this.calculateStats();
    });

    const target = document.querySelector('.profile__title.profile__title_small-margin');
    target?.insertAdjacentElement('afterend', container);
  }

  async calculateStats() {
    const container = document.getElementById(this.statsContainerId);
    if (!container) return;

    const content = container.querySelector('.gaijin-stats-content');
    content.innerHTML = '<div>Обработка данных...</div>';

    await new Promise(resolve => setTimeout(resolve, 50));

    try {
      const items = this.getValidItems();
      if (!items.length) {
        content.innerHTML = '<div>Нет данных для анализа</div>';
        return;
      }

      const stats = this.processItems(items);
      this.updateStats(stats, content);
    } catch (error) {
      console.error('Stats calculation error:', error);
      this.showError();
    }
  }

  getValidItems() {
    return Array.from(document.querySelectorAll('.showcase-item')).filter(item => {
      const priceText = item.querySelector('.showcase-item__price')?.textContent?.trim();
      return priceText?.match(/[\d,]+\.?\d*/);
    });
  }

  processItems(items) {
    const stats = {
      total: 0,
      totalItems: 0,
      monthlyStats: {},
      productStats: {},
      firstPurchase: null,
      lastPurchase: null
    };

    items.forEach(item => {
      const priceText = item.querySelector('.showcase-item__price').textContent.trim();
      const price = parseFloat(priceText.replace(/[^\d,]/g, '').replace(',', '.'));
      const productName = this.getProductName(item);
      const purchaseHistory = this.getPurchaseHistory(item);

      purchaseHistory.forEach(({date, quantity}) => {
        const itemTotal = price * quantity;
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthName = `${date.toLocaleString('ru-RU', { month: 'long' })} ${date.getFullYear()}`;

        // Обновляем общую статистику
        stats.total += itemTotal;
        stats.totalItems += quantity;

        // Обновляем даты первой/последней покупки
        if (!stats.firstPurchase || date < stats.firstPurchase) {
          stats.firstPurchase = date;
        }
        if (!stats.lastPurchase || date > stats.lastPurchase) {
          stats.lastPurchase = date;
        }

        // Статистика по месяцам
        if (!stats.monthlyStats[monthKey]) {
          stats.monthlyStats[monthKey] = { name: monthName, total: 0, count: 0 };
        }
        stats.monthlyStats[monthKey].total += itemTotal;
        stats.monthlyStats[monthKey].count += quantity;

        // Статистика по товарам
        if (!stats.productStats[productName]) {
          stats.productStats[productName] = { total: 0, count: 0, price };
        }
        stats.productStats[productName].total += itemTotal;
        stats.productStats[productName].count += quantity;
      });
    });

    return {
      ...stats,
      monthlyStats: Object.entries(stats.monthlyStats)
        .sort(([a], [b]) => b.localeCompare(a)),
      productStats: Object.entries(stats.productStats)
        .sort(([,a], [,b]) => b.total - a.total)
        .slice(0, 10)
    };
  }

  getPurchaseHistory(item) {
    const popupId = item.querySelector('.js-popup__trigger')?.dataset.popupId;
    if (!popupId) {
      const dateText = item.querySelector('.showcase-item__timestamp')?.textContent.trim();
      const date = this.parseDate(dateText);
      return date ? [{ date, quantity: 1 }] : [];
    }

    const popup = document.getElementById(popupId);
    if (!popup) return [];

    return Array.from(popup.querySelectorAll('.showcase-item-comment__item'))
      .map(comment => {
        const commentText = comment.textContent.trim();
        const dateMatch = commentText.match(/(\d{2}\.\d{2}\.\d{4})/);
        const quantityMatch = commentText.match(/(\d+)\s*x\s*/);
        
        const date = dateMatch ? this.parseDate(dateMatch[1]) : null;
        const quantity = quantityMatch ? parseInt(quantityMatch[1]) : 1;
        
        return date ? { date, quantity } : null;
      })
      .filter(Boolean);
  }

  parseDate(dateString) {
    if (!dateString) return null;
    
    const [day, month, year] = dateString.split('.').map(Number);
    if (!day || !month || !year) return null;
    
    return new Date(year, month - 1, day);
  }

  getProductName(item) {
    const titleEl = item.querySelector('.showcase-item-description__title');
    return titleEl ? titleEl.textContent.replace(/\d+\s*x\s*/, '').trim() : 'Неизвестный товар';
  }

  updateStats({total, totalItems, monthlyStats, productStats, firstPurchase, lastPurchase}, content) {
    const formatDate = (date) => date?.toLocaleDateString('ru-RU') || 'Н/Д';
    const monthsDiff = firstPurchase && lastPurchase 
      ? (lastPurchase.getFullYear() - firstPurchase.getFullYear()) * 12 + 
        (lastPurchase.getMonth() - firstPurchase.getMonth()) + 1
      : 0;

    content.innerHTML = `
      <div class="gaijin-stats-section">
        ${this.createStatsRow('Всего потрачено:', `${total.toFixed(2)} ₽`, true)}
        ${this.createStatsRow('Всего покупок:', totalItems, true)}
        ${totalItems ? this.createStatsRow('Средний чек:', `${(total / totalItems).toFixed(2)} ₽`, true) : ''}
        ${firstPurchase ? this.createStatsRow('Первая покупка:', formatDate(firstPurchase)) : ''}
        ${lastPurchase ? this.createStatsRow('Последняя покупка:', formatDate(lastPurchase)) : ''}
        ${monthsDiff > 1 ? this.createStatsRow('Период:', `${monthsDiff} мес.`) : ''}
      </div>
      <div class="gaijin-stats-section">
        <div style="margin-bottom: 8px;">По месяцам:</div>
        ${monthlyStats.slice(0, 12).map(([, stat]) => 
          this.createStatsRow(
            stat.name, 
            `${stat.total.toFixed(2)} ₽ (${stat.count} покупок)`
          )
        ).join('')}
      </div>
      <div class="gaijin-stats-section">
        <div style="margin-bottom: 8px;">Топ товаров:</div>
        ${productStats.map(([name, stat]) => 
          this.createStatsRow(
            `${this.truncate(name, 25)}`, 
            `${stat.total.toFixed(2)} ₽ (${stat.count} × ${stat.price.toFixed(2)} ₽)`,
            false,
            name
          )
        ).join('')}
      </div>
    `;
  }

  createStatsRow(label, value, isBold = false, title = '') {
    return `
      <div class="gaijin-stats-row" ${title ? `title="${title}"` : ''}>
        <span>${label}</span>
        <span${isBold ? ' style="font-weight: bold;"' : ''}>${value}</span>
      </div>
    `;
  }

  truncate(str, maxLength) {
    return str.length > maxLength ? `${str.substring(0, maxLength - 3)}...` : str;
  }

  showError() {
    const content = document.getElementById(this.statsContainerId)?.querySelector('.gaijin-stats-content');
    if (content) {
      content.innerHTML = '<div class="gaijin-stats-error">Ошибка загрузки статистики</div>';
    }
  }
}

// Инициализация
if (document.readyState === 'complete') {
  new GaijinPurchaseStats();
} else {
  window.addEventListener('load', () => new GaijinPurchaseStats());
}