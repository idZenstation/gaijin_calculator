import { SELECTORS, ERROR_MESSAGES } from './config.js';

class PurchaseAnalyzer {
  constructor() {
    this.containerId = 'wt-purchase-stats-container';
    this.init();
  }

  async init() {
    if (!this.isValidEnvironment()) return;

    try {
      await this.verifyPageRequirements();
      this.injectStyles();
      this.createContainer();
      await this.calculateStats();
      this.setupMessageHandler();
    } catch (error) {
      console.error('[WT Analyzer] Error:', error);
      this.showError(error.message);
    }
  }

  // ========== Основные методы ==========

  async calculateStats() {
    try {
      const items = await this.getValidItems();
      if (items.length === 0) {
        throw new Error(ERROR_MESSAGES.NO_ITEMS);
      }

      const stats = this.processItems(items);
      this.updateUI(stats);
    } catch (error) {
      this.showError(error.message);
    }
  }

  // ========== Вспомогательные методы ==========

  parsePrice(priceText) {
    if (!priceText) return 0;
    return parseFloat(
      priceText.replace(/[^\d,.]/g, '')
        .replace(/\s+/g, '')
        .replace(',', '.')
    );
  }

  waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) return resolve(element);

      const observer = new MutationObserver((_, obs) => {
        const el = document.querySelector(selector);
        if (el) {
          obs.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Timeout: ${selector} not found`));
      }, timeout);
    });
  }

  // ... (остальные методы)
}

// Инициализация
if (typeof PurchaseAnalyzer === 'function') {
  new PurchaseAnalyzer();
}