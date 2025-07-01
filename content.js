// ===== КОНФИГУРАЦИЯ =====
const SELECTORS = {
  ITEM: '.showcase-item',
  PRICE: '.showcase-item__price',
  DATE: '.showcase-item__timestamp',
  POPUP: '.js-popup__trigger'
};

const ERROR_MESSAGES = {
  NO_ITEMS: 'No purchase items found on this page',
  PARSE_ERROR: 'Failed to parse purchase data',
  LOAD_ERROR: 'Failed to load purchase history',
  ENVIRONMENT: 'Extension works only on store.gaijin.net in Chrome browser',
  NETWORK_ERROR: 'Network request failed'
};

// ===== ОСНОВНОЙ КЛАСС =====
class PurchaseAnalyzer {
  constructor() {
    this.containerId = 'wt-purchase-stats-container';
    this.initialized = false;
    this.retryCount = 0;
    this.maxRetries = 3;
    this.init();
  }

  async init() {
    if (this.initialized || !this.isValidEnvironment()) return;

    try {
      await this.verifyPageRequirements();
      this.injectStyles();
      this.createContainer();
      await this.calculateStats();
      this.setupMessageHandler();
      this.initialized = true;
      this.retryCount = 0; // Сброс счетчика при успешной инициализации
    } catch (error) {
      this.handleError(error);
    }
  }

  // ===== ОБРАБОТКА ОШИБОК =====
  handleError(error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Логирование с дополнительной информацией
    console.error(
      `[WT Analyzer] Error at ${new Date().toISOString()}:\n` +
      `Message: ${errorMessage}\n` +
      `Stack: ${error.stack || 'No stack trace'}\n` +
      `Retry count: ${this.retryCount}/${this.maxRetries}`
    );

    // Показать пользователю понятное сообщение
    const userMessage = this.getUserFriendlyError(error);
    this.showError(userMessage);

    // Автоматический ретрай с экспоненциальной задержкой
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      const delay = Math.min(1000 * Math.pow(2, this.retryCount), 10000); // Макс 10 сек
      console.log(`Retrying in ${delay}ms...`);
      setTimeout(() => this.init(), delay);
    } else {
      console.error('Max retries reached, giving up');
    }
  }

  getUserFriendlyError(error) {
    if (error.message.includes('network')) {
      return ERROR_MESSAGES.NETWORK_ERROR;
    }
    if (error.message.includes('parse')) {
      return ERROR_MESSAGES.PARSE_ERROR;
    }
    return ERROR_MESSAGES.LOAD_ERROR;
  }

  // ===== ОСНОВНЫЕ МЕТОДЫ =====
  async calculateStats() {
    try {
      const items = await this.getValidItems();
      if (items.length === 0) {
        throw new Error(ERROR_MESSAGES.NO_ITEMS);
      }

      const stats = this.processItems(items);
      this.updateUI(stats);
    } catch (error) {
      throw new Error(`Failed to calculate stats: ${error.message}`);
    }
  }

  async getValidItems() {
    try {
      const items = Array.from(document.querySelectorAll(SELECTORS.ITEM));
      if (!items.length) return [];

      return items.filter(item => {
        try {
          const priceText = item.querySelector(SELECTORS.PRICE)?.textContent;
          return priceText && this.parsePrice(priceText) > 0;
        } catch (e) {
          console.warn('Skipping invalid item:', e.message);
          return false;
        }
      });
    } catch (error) {
      throw new Error(`Item parsing failed: ${error.message}`);
    }
  }

  // ===== ВСПОМОГАТЕЛЬНЫЕ МЕТОДЫ =====
  isValidEnvironment() {
    try {
      const isChrome = navigator.userAgent.includes('Chrome');
      const isGaijinStore = window.location.hostname.includes('store.gaijin.net');

      if (!isChrome || !isGaijinStore) {
        console.warn(ERROR_MESSAGES.ENVIRONMENT);
        return false;
      }
      return true;
    } catch (error) {
      console.error('Environment check failed:', error);
      return false;
    }
  }

  showError(message) {
    try {
      let container = document.getElementById(this.containerId);
      if (!container) {
        console.warn('Container not found, creating new one');
        this.createContainer();
        container = document.getElementById(this.containerId);
        if (!container) return;
      }

      const errorHTML = `
        <div class="wt-stats-error">
          <p>⚠️ ${message}</p>
          ${this.retryCount < this.maxRetries ?
            '<p>Retrying automatically...</p>' :
            '<button class="wt-retry-btn">Try Again</button>'}
        </div>
      `;

      const content = container.querySelector('.wt-stats-content') || container;
      content.innerHTML = errorHTML;

      const retryBtn = content.querySelector('.wt-retry-btn');
      if (retryBtn) {
        retryBtn.addEventListener('click', () => {
          this.retryCount = 0;
          this.init();
        });
      }
    } catch (error) {
      console.error('Failed to display error:', error);
    }
  }

  // ... (остальные методы: parsePrice, waitForElement, injectStyles и т.д.)
}

// ===== ИНИЦИАЛИЗАЦИЯ С ЗАЩИТОЙ =====
if (typeof PurchaseAnalyzer === 'function') {
  const initExtension = () => {
    try {
      if (!window.purchaseAnalyzerInstance) {
        window.purchaseAnalyzerInstance = new PurchaseAnalyzer();
      }
    } catch (error) {
      console.error('Extension initialization failed:', error);
    }
  };

  const initWithRetry = (attempt = 0) => {
    try {
      initExtension();
    } catch (error) {
      if (attempt < 3) {
        console.warn(`Initialization attempt ${attempt + 1} failed, retrying...`);
        setTimeout(() => initWithRetry(attempt + 1), 1000 * (attempt + 1));
      } else {
        console.error('Giving up after 3 initialization attempts');
      }
    }
  };

  if (document.readyState === 'complete') {
    setTimeout(initWithRetry, 500);
  } else {
    window.addEventListener('load', () => setTimeout(initWithRetry, 500));
  }
}