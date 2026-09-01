"use strict";
/**
 * Kloak Browser Extension — Side Panel Logic
 */
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('side-search');
    searchInput?.addEventListener('input', async () => {
        const query = searchInput.value;
        const res = await chrome.runtime.sendMessage({
            type: 'SEARCH_VAULT',
            query
        });
        const container = document.getElementById('side-items');
        if (!container)
            return;
        const items = res?.items || [];
        container.innerHTML = '';
        items.forEach((item) => {
            const card = document.createElement('div');
            card.className = 'item-card';
            card.innerHTML = `
        <div style="font-weight: 600; font-size: 14px;">${item.title}</div>
        <div style="color: #94a3b8; font-size: 12px;">${item.username || ''}</div>
      `;
            container.appendChild(card);
        });
    });
});
