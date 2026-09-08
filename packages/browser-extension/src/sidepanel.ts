/**
 * Kloak Browser Extension — Side Panel Logic
 */

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('side-search') as HTMLInputElement;
  const container = document.getElementById('side-items');

  const loadItems = async (query = '') => {
    if (!container) return;
    const res = await chrome.runtime.sendMessage({
      type: 'SEARCH_VAULT',
      query
    });
    const items = res?.items || [];
    container.innerHTML = '';

    if (items.length === 0) {
      container.innerHTML = '<div style="color: #64748b; font-size: 13px; text-align: center; padding: 24px 0;">No passwords found</div>';
      return;
    }

    items.forEach((item: any) => {
      const card = document.createElement('div');
      card.className = 'item-card';
      card.innerHTML = `
        <div style="font-weight: 600; font-size: 14px;">${item.title}</div>
        <div style="color: #94a3b8; font-size: 12px;">${item.username || ''}</div>
      `;
      container.appendChild(card);
    });
  };

  loadItems('');
  searchInput?.addEventListener('input', () => {
    loadItems(searchInput.value);
  });
});
