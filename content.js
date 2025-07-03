// Глобальная функция для доступа из popup
window.getPurchaseData = function() {
  try {
    // 1. Находим таблицу
    const table = document.querySelector('.table.user-payments');
    if (!table) {
      return { status: 'error', error: 'Purchase table not found' };
    }

    // 2. Получаем все строки
    const rows = Array.from(table.querySelectorAll('tbody tr'));
    if (rows.length === 0) {
      return { status: 'no_data' };
    }

    // 3. Парсим данные
    let total = 0;
    let count = 0;
    const failed = [];

    rows.forEach((row, i) => {
      try {
        const priceCell = row.querySelector('td:nth-child(3)') || 
                         row.querySelector('td.price');
        
        if (!priceCell) {
          failed.push(`Row ${i}: No price cell`);
          return;
        }

        const priceText = priceCell.textContent.trim();
        const price = parsePrice(priceText);
        
        if (isNaN(price)) {
          failed.push(`Row ${i}: Invalid price (${priceText})`);
          return;
        }

        total += price;
        count++;
      } catch (e) {
        failed.push(`Row ${i}: ${e.message}`);
      }
    });

    return {
      status: count > 0 ? 'success' : 'no_data',
      total: total.toFixed(2),
      count,
      currency: 'USD',
      failedParses: failed.length
    };

  } catch (error) {
    return {
      status: 'error',
      error: error.message,
      stack: error.stack
    };
  }
};

// Функция парсинга цены
function parsePrice(text) {
  const clean = text
    .replace(/[^\d.,]/g, '') // Оставляем только цифры и разделители
    .replace(',', '.');      // Приводим к float формату
  
  return parseFloat(clean);
}