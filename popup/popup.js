document.addEventListener('DOMContentLoaded', () = {
  const privacyLink = document.getElementById('privacy-link');
  
  privacyLink.addEventListener('click', (e) = {
    e.preventDefault();
    chrome.tabs.create({ url chrome.runtime.getURL('privacy.html') });
  });

   Добавляем проверку текущей вкладки
  chrome.tabs.query({ active true, currentWindow true }, (tabs) = {
    if (!tabs[0].url.includes('store.gaijin.net')) {
      document.querySelector('main').innerHTML = `
        div class=warning
          pPlease visit War Thunder Store to use this extensionp
        div
      `;
    }
  });
});