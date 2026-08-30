// popup.js - FixMod Popup

document.addEventListener('DOMContentLoaded', async () => {
    // Устанавливаем иконки через chrome.runtime.getURL
    const iconUrl = chrome.runtime.getURL('fixIco/fixModIco_32.png');
    const settingsIconUrl = chrome.runtime.getURL('fixIco/settings_icon.png');
    
    document.getElementById('popup-icon').src = iconUrl;
    document.getElementById('settings-icon').src = settingsIconUrl;
    
    await loadStats();
    await loadDarkMode();
    
    const manifest = chrome.runtime.getManifest();
    document.getElementById('version-display').textContent = manifest.version;
    document.getElementById('version-info').textContent = 'FixMod v' + manifest.version;
    
    document.getElementById('settings-btn').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('settings.html') });
    });
    
    document.querySelectorAll('#stats-btn').forEach(el => {
        el.addEventListener('click', () => {
            chrome.tabs.create({ url: chrome.runtime.getURL('stats.html') });
        });
    });
    
    document.getElementById('stats-open-btn').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('stats.html') });
    });
    
    document.getElementById('refresh-btn').addEventListener('click', async () => {
        await loadStats();
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'REFRESH_DATA' });
            }
        });
    });
});

// ============================================================
// ЗАГРУЗКА СТАТИСТИКИ
// ============================================================
async function loadStats() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_STATS' }, (response) => {
            if (response && response.success) {
                const stats = response.data;
                document.getElementById('today-count').textContent = stats.today_count || 0;
                document.getElementById('repaired-count').textContent = stats.repaired_count || 0;
                document.getElementById('total-count').textContent = stats.total_orders || 0;
                document.getElementById('orders-count').textContent = (stats.total_orders || 0) + ' orders';
            } else {
                document.getElementById('today-count').textContent = '?';
                document.getElementById('repaired-count').textContent = '?';
                document.getElementById('total-count').textContent = '?';
                document.getElementById('orders-count').textContent = '0 orders';
            }
            resolve();
        });
    });
}

// ============================================================
// ЗАГРУЗКА ТЕМНОЙ ТЕМЫ
// ============================================================
async function loadDarkMode() {
    try {
        const result = await chrome.storage.local.get(['darkMode']);
        const isDark = result.darkMode === true;
        document.body.classList.toggle('dark', isDark);
    } catch (error) {
        console.warn('Could not load dark mode:', error);
    }
}

// ============================================================
// СЛУШАЕМ ИЗМЕНЕНИЯ ТЕМЫ ИЗ НАСТРОЕК
// ============================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'UPDATE_DARK_MODE') {
        document.body.classList.toggle('dark', request.enabled);
        sendResponse({ success: true });
    }
    return true;
});

// ============================================================
// АВТООБНОВЛЕНИЕ
// ============================================================
setInterval(() => {
    loadStats();
}, 30000);