// Фоновая служба для обработки событий
chrome.runtime.onInstalled.addListener(() => {
  console.log('Extension installed');
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getStats") {
    chrome.storage.local.get('gaijinStats', (data) => {
      sendResponse(data.gaijinStats || null);
    });
    return true;
  }
});