/**
 * Gaijin Store Purchase Analyzer
 * Content Script - Main functionality
 *
 * Features:
 * - Parses purchase history from Gaijin Store
 * - Displays statistics and analytics
 * - Automatic retry on failures
 * - Comprehensive error handling
 */

// ===== CONSTANTS AND CONFIGURATION =====
const SELECTORS = {
  ITEM: '.showcase-item',
  PRICE: '.showcase-item__price',
  DATE: '.showcase-item__timestamp',
  PRODUCT: '.showcase-item-description__title',
  POPUP: '.js-popup__trigger'
};

const ERROR_MESSAGES = {
  NO_ITEMS: 'No purchase items found on this page',
  PARSE_ERROR: 'Failed to parse purchase data',
  LOAD_ERROR: 'Failed to load purchase history',
  ENVIRONMENT: 'Extension works only on store.gaijin.net in Chrome/Firefox',
  NETWORK: 'Network request failed',
  ELEMENT_NOT_FOUND: 'Required page elements not found'
};

const DEFAULT_CURRENCY = '₽';

// ===== MAIN CLASS =====
class PurchaseAnalyzer {
  constructor() {
    this.containerId = 'gaijin-purchase-stats';
    this.initialized = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.stats = {
      total: 0,
      count: 0,
      byMonth: {},
      byProduct: {},
      currency: DEFAULT_CURRENCY
    };

    this.init();
  }

  // ===== INITIALIZATION =====
  async init() {
    if (this.initialized) {
      console.debug('[Analyzer] Already initialized');
      return;
    }

    if (!this.checkEnvironment()) {
      console.warn('[Analyzer] Environment check failed');
      return;
    }

    try {
      await this.verifyPageRequirements();
      this.injectStyles();
      this.createContainer();
      await this.calculateStats();
      this.setupMessageHandler();
      this.initialized = true;
      this.retryCount = 0;
      console.info('[Analyzer] Initialized successfully');
    } catch (error) {
      this.handleError(error, 'Initialization');
    }
  }

  // ===== CORE FUNCTIONALITY =====
  async calculateStats() {
    try {
      const items = await this.getValidItems();
      if (items.length === 0) {
        throw new Error(ERROR_MESSAGES.NO_ITEMS);
      }

      this.resetStats();
      await this.processItems(items);
      this.updateUI();
    } catch (error) {
      throw new Error(`Failed to calculate stats: ${error.message}`);
    }
  }

  async processItems(items) {
    for (const item of items) {
      try {
        const price = this.parsePrice(item);
        const date = this.parseDate(item);
        const product = this.parseProduct(item);
        const quantity = this.parseQuantity(item);

        this.updateStats(price, date, product, quantity);
      } catch (error) {
        console.warn('[Analyzer] Skipping invalid item:', error.message);
      }
    }
  }

  // ===== DATA PARSING METHODS =====
  parsePrice(item) {
    const priceText = item.querySelector(SELECTORS.PRICE)?.textContent;
    if (!priceText) throw new Error('Missing price element');

    const priceValue = parseFloat(
      priceText.replace(/[^\d,.]/g, '')
        .replace(/\s+/g, '')
        .replace(',', '.')
    );

    if (isNaN(priceValue)) throw new Error('Invalid price format');
    return priceValue;
  }

  parseDate(item) {
    const dateText = item.querySelector(SELECTORS.DATE)?.textContent;
    if (!dateText) return new Date(); // Fallback to current date

    const [day, month, year] = dateText.split('.').map(Number);
    return new Date(year || new Date().getFullYear(), month - 1, day);
  }

  parseProduct(item) {
    return item.querySelector(SELECTORS.PRODUCT)?.textContent?.trim() || 'Unknown Product';
  }

  parseQuantity(item) {
    // Default to 1 if quantity cannot be determined
    return 1;
  }

  // ===== STATISTICS CALCULATION =====
  updateStats(price, date, product, quantity = 1) {
    const total = price * quantity;

    // Update total stats
    this.stats.total += total;
    this.stats.count += quantity;

    // Update monthly stats
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    this.stats.byMonth[monthKey] = (this.stats.byMonth[monthKey] || 0) + total;

    // Update product stats
    this.stats.byProduct[product] = (this.stats.byProduct[product] || 0) + total;
  }

  resetStats() {
    this.stats = {
      total: 0,
      count: 0,
      byMonth: {},
      byProduct: {},
      currency: DEFAULT_CURRENCY
    };
  }

  // ===== UI METHODS =====
  createContainer() {
    let container = document.getElementById(this.containerId);
    if (container) container.remove();

    container = document.createElement('div');
    container.id = this.containerId;
    container.innerHTML = `
      <div class="stats-header">
        <h3>Purchase Statistics</h3>
        <button class="refresh-btn" aria-label="Refresh statistics">↻</button>
      </div>
      <div class="stats-content">
        <div class="loading-message">Loading data...</div>
      </div>
    `;

    container.querySelector('.refresh-btn').addEventListener('click', () => {
      this.calculateStats();
    });

    const targetElement = document.querySelector('.profile__title') || document.body;
    targetElement.insertAdjacentElement('afterend', container);
  }

  updateUI() {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const content = container.querySelector('.stats-content');
    if (!content) return;

    // Format currency
    const formatter = new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'RUB',
      minimumFractionDigits: 2
    });

    content.innerHTML = `
      <div class="stats-summary">
        <div class="stat-row">
          <span>Total Spent:</span>
          <strong>${formatter.format(this.stats.total)}</strong>
        </div>
        <div class="stat-row">
          <span>Total Purchases:</span>
          <strong>${this.stats.count}</strong>
        </div>
      </div>
      ${this.renderMonthlyStats()}
      ${this.renderProductStats()}
    `;
  }

  renderMonthlyStats() {
    const months = Object.entries(this.stats.byMonth)
      .sort(([a], [b]) => b.localeCompare(a))
      .slice(0, 6); // Show last 6 months

    if (months.length === 0) return '';

    return `
      <div class="stats-section">
        <h4>Monthly Breakdown</h4>
        ${months.map(([month, total]) => `
          <div class="stat-row">
            <span>${this.formatMonth(month)}:</span>
            <span>${total.toFixed(2)} ${DEFAULT_CURRENCY}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  renderProductStats() {
    const products = Object.entries(this.stats.byProduct)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5); // Show top 5 products

    if (products.length === 0) return '';

    return `
      <div class="stats-section">
        <h4>Top Products</h4>
        ${products.map(([product, total]) => `
          <div class="stat-row" title="${product}">
            <span>${this.truncate(product, 20)}:</span>
            <span>${total.toFixed(2)} ${DEFAULT_CURRENCY}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ===== UTILITY METHODS =====
  checkEnvironment() {
    try {
      const isSupportedBrowser = /chrome|firefox/i.test(navigator.userAgent);
      const isCorrectDomain = window.location.hostname.includes('store.gaijin.net');
      return isSupportedBrowser && isCorrectDomain;
    } catch (error) {
      console.error('[Analyzer] Environment check failed:', error);
      return false;
    }
  }

  async verifyPageRequirements() {
    try {
      await Promise.all([
        this.waitForElement(SELECTORS.ITEM, 10000),
        this.waitForElement(SELECTORS.PRICE, 5000)
      ]);
    } catch (error) {
      throw new Error(`${ERROR_MESSAGES.ELEMENT_NOT_FOUND}: ${error.message}`);
    }
  }

  async getValidItems() {
    try {
      const items = Array.from(document.querySelectorAll(SELECTORS.ITEM));
      return items.filter(item => {
        try {
          return this.parsePrice(item) > 0;
        } catch {
          return false;
        }
      });
    } catch (error) {
      throw new Error(`${ERROR_MESSAGES.PARSE_ERROR}: ${error.message}`);
    }
  }

  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) return resolve(element);

      const observer = new MutationObserver((_, obs) => {
        const el = document.querySelector(selector);
        if (el) {
          obs.disconnect();
          clearTimeout(timer);
          resolve(el);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      const timer = setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found`));
      }, timeout);
    });
  }

  injectStyles() {
    const styleId = 'gaijin-stats-styles';
    if (document.getElementById(styleId)) return;

    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      #${this.containerId} {
        margin: 20px 0;
        padding: 15px;
        background: #f8f9fa;
        border-radius: 8px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      }
      .stats-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }
      .stats-header h3 {
        margin: 0;
        font-size: 1.1em;
        color: #333;
      }
      .refresh-btn {
        background: none;
        border: none;
        color: #0066cc;
        cursor: pointer;
        font-size: 1.2em;
      }
      .stats-content {
        display: grid;
        gap: 15px;
      }
      .stats-section {
        background: white;
        padding: 12px;
        border-radius: 6px;
      }
      .stats-section h4 {
        margin-top: 0;
        margin-bottom: 10px;
        font-size: 0.95em;
        color: #555;
      }
      .stat-row {
        display: flex;
        justify-content: space-between;
        margin-bottom: 6px;
        font-size: 0.9em;
      }
      .loading-message {
        padding: 10px;
        text-align: center;
        color: #666;
      }
    `;
    document.head.appendChild(style);
  }

  setupMessageHandler() {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
      if (request.action === 'refresh') {
        this.calculateStats()
          .then(() => sendResponse({ success: true }))
          .catch(error => sendResponse({ success: false, error: error.message }));
        return true; // Required for async response
      }
    });
  }

  handleError(error, context = 'Runtime') {
    console.error(`[Analyzer] ${context} error:`, error);
    this.showError(error.message);

    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      const delay = Math.min(2000 * this.retryCount, 10000);
      console.warn(`[Analyzer] Retrying in ${delay}ms (attempt ${this.retryCount})`);
      setTimeout(() => this.init(), delay);
    }
  }

  showError(message) {
    const container = document.getElementById(this.containerId);
    if (!container) return;

    const content = container.querySelector('.stats-content') || container;
    content.innerHTML = `
      <div class="error-message">
        <p>⚠️ ${message}</p>
        ${this.retryCount < this.maxRetries ?
          '<p>Retrying automatically...</p>' :
          '<button class="retry-btn">Try Again</button>'}
      </div>
    `;

    const retryBtn = content.querySelector('.retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => {
        this.retryCount = 0;
        this.init();
      });
    }
  }

  formatMonth(monthKey) {
    const [year, month] = monthKey.split('-');
    const date = new Date(year, month - 1);
    return date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  truncate(text, maxLength) {
    return text.length > maxLength ? text.substring(0, maxLength - 1) + '...' : text;
  }
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', () => {
  if (window.location.hostname.includes('store.gaijin.net')) {
    new PurchaseAnalyzer();
  }
});