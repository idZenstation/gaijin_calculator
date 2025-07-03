document.addEventListener('DOMContentLoaded', () => {
  const statsDiv = document.getElementById('stats');
  const refreshBtn = document.getElementById('refresh');

  function updateStats() {
    chrome.storage.local.get('gaijinStats', (data) => {
      if (data.gaijinStats) {
        statsDiv.innerHTML = `
          <p>Total purchases: ${data.gaijinStats.count}</p>
          <p>Total spent: $${data.gaijinStats.total}</p>
        `;
      } else {
        statsDiv.textContent = 'No data found. Visit store.gaijin.net/user.php';
      }
    });
  }

  refreshBtn.addEventListener('click', () => {
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
      chrome.tabs.sendMessage(tabs[0].id, {action: "refresh"});
      updateStats();
    });
  });

  updateStats();
});