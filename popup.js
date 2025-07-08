document.getElementById('calculate').addEventListener('click', async () => {
  const resultDiv = document.getElementById('result');
  resultDiv.innerHTML = '<div class="loading">Calculating...</div>';

  try {
    console.log('[DEBUG] Sending fetch request...');
    const fetchResponse = await chrome.runtime.sendMessage({
      action: 'fetchPurchases'
    });

    if (!fetchResponse) {
      throw new Error('No response from background script');
    }

    console.log('[DEBUG] Fetch response:', fetchResponse.status);

    if (fetchResponse.status !== 'success') {
      throw new Error(fetchResponse.error || 'Failed to load purchase data');
    }

    console.log('[DEBUG] Sending parse request...');
    const parseResponse = await chrome.runtime.sendMessage({
      action: 'parsePurchases',
      html: fetchResponse.html
    });

    console.log('[DEBUG] Parse response:', parseResponse);

    if (!parseResponse || parseResponse.status !== 'success') {
      const errorDetails = parseResponse?.error
        ? `${parseResponse.error}\n${parseResponse.htmlSnippet || ''}`
        : 'Invalid parse response structure';
      throw new Error(errorDetails);
    }

    displayResults(parseResponse.data);

  } catch (error) {
    console.error('[ERROR] Main process failed:', error);
    resultDiv.innerHTML = `
      <div class="error">
        <h4>Calculation Error</h4>
        <pre>${error.message}</pre>
        <button id="debug-btn">Show Debug Info</button>
        <div id="debug-info" style="display: none;">
          <h5>Technical Details:</h5>
          <pre>${JSON.stringify({
            error: error.stack,
            timestamp: new Date().toISOString()
          }, null, 2)}</pre>
        </div>
      </div>
    `;

    document.getElementById('debug-btn').addEventListener('click', () => {
      const debugDiv = document.getElementById('debug-info');
      debugDiv.style.display = debugDiv.style.display === 'none' ? 'block' : 'none';
    });
  }
});