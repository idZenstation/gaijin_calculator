class PurchaseAnalyzer {
  constructor() {
    this.containerId = 'wt-purchase-stats-container';
    this.requiredElements = [
      '.profile__title.profile__title_small-margin',
      '.showcase-item',
      '.showcase-item__price'
    ];
    this.init();
  }

  async init() {
    if (!this.isValidEnvironment()) return;

    try {
      await this.verifyPageRequirements();
      this.injectStyles();
      this.createContainer();
      await this.calculateStats();
    } catch (error) {
      console.error('[WT Purchase Analyzer] Error:', error);
      this.showError();
    }
  }

  isValidEnvironment() {
    // Проверка, что код выполняется в Chrome и на нужном домене
    if (!navigator.userAgent.includes('Chrome')) {
      console.warn('Extension works only in Chrome browsers');
      return false;
    }
    
    if (!window.location.href.includes('store.gaijin.net')) {
      console.warn('Extension works only on store.gaijin.net');
      return false;
    }

    return true;
  }

  async verifyPageRequirements() {
    const checks = this.requiredElements.map(selector => 
      this.waitForElement(selector, 5000)
    );
    
    await Promise.all(checks).catch(() => {
      throw new Error('Required page elements not found');
    });
  }

  // ... (остальные методы остаются без изменений, но с заменой gaijin на wt)
}

// Инициализация с задержкой для полной загрузки страницы
if (document.readyState === 'complete') {
  setTimeout(() => new PurchaseAnalyzer(), 500);
} else {
  window.addEventListener('load', () => {
    setTimeout(() => new PurchaseAnalyzer(), 500);
  });
}