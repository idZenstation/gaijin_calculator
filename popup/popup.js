class PopupController {
  constructor() {
    this.initElements();
    this.setupEventListeners();
    this.checkActiveTab();
  }

  initElements() {
    this.elements = {
      refreshBtn: document.getElementById('refresh-btn'),
      statusText: document.getElementById('status-text'),
      errorContainer: document.getElementById('error-container')
    };
  }

  setupEventListeners() {
    this.elements.refreshBtn.addEventListener('click', () => this.handleRefresh());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.checkActiveTab();
      }
    });
  }

  async checkActiveTab() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab) {
        throw new Error('No active tab found');
      }

      if (tab.url?.includes('store.gaijin.net')) {
        this.showStatus('Ready to refresh data');
        this.elements.refreshBtn.disabled = false;
      } else {
        this.showError('Please open Gaijin Store first');
        this.elements.refreshBtn.disabled = true;
      }
    } catch (error) {
      this.showError(`Tab check failed: ${error.message}`);
      console.error('Tab check error:', error);
    }
  }

  async handleRefresh() {
    this.showStatus('Refreshing data...');
    this.elements.refreshBtn.disabled = true;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (!tab?.id) {
        throw new Error('No active tab');
      }

      await chrome.tabs.sendMessage(tab.id, { action: 'refresh' });
      this.showStatus('Data refreshed successfully');

      setTimeout(() => {
        window.close();
      }, 1000);

    } catch (error) {
      this.showError(`Refresh failed: ${error.message}`);
      console.error('Refresh error:', error);
    } finally {
      setTimeout(() => {
        this.elements.refreshBtn.disabled = false;
      }, 2000);
    }
  }

  showStatus(message) {
    this.elements.statusText.textContent = message;
    this.elements.statusText.style.color = 'inherit';
    this.elements.errorContainer.textContent = '';
  }

  showError(message) {
    this.elements.statusText.textContent = 'Error occurred';
    this.elements.statusText.style.color = '#d32f2f';
    this.elements.errorContainer.textContent = message;
  }
}

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', () => {
  new PopupController();
});