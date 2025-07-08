document.addEventListener('DOMContentLoaded', function() {
    const calculateBtn = document.getElementById('calculate');
    const statusDiv = document.getElementById('status');

    calculateBtn.addEventListener('click', function() {
        statusDiv.textContent = "Запрос отправлен...";

        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs.length === 0) {
                statusDiv.textContent = "Ошибка: нет активной вкладки";
                return;
            }

            const currentTab = tabs[0];

            if (!currentTab.url.includes('store.gaijin.net/user.php')) {
                statusDiv.textContent = "Откройте страницу покупок Gaijin";
                return;
            }

            chrome.scripting.executeScript({
                target: {tabId: currentTab.id},
                files: ['content.js']
            }).then(() => {
                statusDiv.textContent = "Расчёт выполнен!";
            }).catch(err => {
                statusDiv.textContent = "Ошибка: " + err.message;
                console.error(err);
            });
        });
    });
});