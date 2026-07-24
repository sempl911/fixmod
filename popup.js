// popup.js - FixMod Settings

document.addEventListener('DOMContentLoaded', async () => {
    // ============================================================
    // 1. ЗАГРУЗКА НАСТРОЕК
    // ============================================================
    await loadSettings();
    await updateStatus();
    await updateOfflineCount();
    
    // ============================================================
    // 2. ОБРАБОТЧИКИ СОБЫТИЙ
    // ============================================================
    
    // Сохранение URL
    document.getElementById('saveUrlBtn').addEventListener('click', saveApiUrl);
    
    // Синхронизация
    document.getElementById('syncBtn').addEventListener('click', syncNow);
    
    // Прозрачность
    document.getElementById('opacity-slider').addEventListener('input', function() {
        const value = this.value;
        document.getElementById('opacity-value').textContent = value + '%';
        const opacity = value / 100;
        
        chrome.storage.sync.set({ widgetOpacity: parseInt(value) });
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url && tabs[0].url.includes('evy.fixably.com')) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'UPDATE_OPACITY',
                    opacity: opacity
                });
            }
        });
    });
    
    // Размер шрифта
    document.getElementById('font-size-slider').addEventListener('input', function() {
        const value = this.value;
        document.getElementById('font-size-value').textContent = value + 'px';
        
        chrome.storage.sync.set({ widgetFontSize: parseInt(value) });
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url && tabs[0].url.includes('evy.fixably.com')) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'UPDATE_FONT_SIZE',
                    fontSize: parseInt(value)
                });
            }
        });
    });
    
    // Тема
    document.getElementById('theme-select').addEventListener('change', function() {
        const theme = this.value;
        
        chrome.storage.sync.set({ widgetTheme: theme });
        applyTheme(theme);
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url && tabs[0].url.includes('evy.fixably.com')) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'UPDATE_THEME',
                    theme: theme
                });
            }
        });
    });
    
    // QR код
    document.getElementById('qr-toggle').addEventListener('change', function() {
        const enabled = this.checked;
        
        chrome.storage.sync.set({ qrEnabled: enabled });
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url && tabs[0].url.includes('evy.fixably.com')) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'UPDATE_QR_ENABLED',
                    enabled: enabled
                });
            }
        });
    });
    
    // Сброс
    document.getElementById('reset-btn').addEventListener('click', function() {
        document.getElementById('opacity-slider').value = 85;
        document.getElementById('opacity-value').textContent = '85%';
        
        chrome.storage.sync.set({ widgetOpacity: 85 });
        
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url && tabs[0].url.includes('evy.fixably.com')) {
                chrome.tabs.sendMessage(tabs[0].id, {
                    type: 'UPDATE_OPACITY',
                    opacity: 0.85
                });
            }
        });
    });
    
    // ============================================================
    // 3. ПЕРИОДИЧЕСКОЕ ОБНОВЛЕНИЕ
    // ============================================================
    setInterval(updateStatus, 10000);
    setInterval(updateOfflineCount, 15000);
});

// ============================================================
// 4. ЗАГРУЗКА НАСТРОЕК
// ============================================================
async function loadSettings() {
    const result = await chrome.storage.sync.get([
        'widgetOpacity', 
        'widgetTheme', 
        'widgetFontSize', 
        'qrEnabled',
        'apiUrl'
    ]);
    
    // Прозрачность
    const opacity = result.widgetOpacity || 85;
    document.getElementById('opacity-slider').value = opacity;
    document.getElementById('opacity-value').textContent = opacity + '%';
    
    // Тема
    if (result.widgetTheme) {
        document.getElementById('theme-select').value = result.widgetTheme;
        applyTheme(result.widgetTheme);
    }
    
    // Размер шрифта
    const fontSize = result.widgetFontSize || 12;
    document.getElementById('font-size-slider').value = fontSize;
    document.getElementById('font-size-value').textContent = fontSize + 'px';
    
    // QR код
    const qrEnabled = result.qrEnabled !== undefined ? result.qrEnabled : true;
    document.getElementById('qr-toggle').checked = qrEnabled;
    
    // API URL
    const apiUrl = result.apiUrl || 'http://167.99.138.93:8000/api/fixably/order';
    document.getElementById('apiUrl').value = apiUrl;
    
    // Версия
    const version = chrome.runtime.getManifest().version;
    document.getElementById('version-info').textContent = 'FixMod v' + version;
}

// ============================================================
// 5. СТАТУС СОЕДИНЕНИЯ
// ============================================================
async function updateStatus() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'CHECK_STATUS' });
        const dot = document.getElementById('statusDot');
        const label = document.getElementById('statusLabel');
        
        if (response && response.online) {
            dot.className = 'status-dot online';
            label.textContent = 'Online ✅';
        } else {
            dot.className = 'status-dot offline';
            label.textContent = 'Offline 📶';
        }
    } catch (error) {
        const dot = document.getElementById('statusDot');
        const label = document.getElementById('statusLabel');
        dot.className = 'status-dot error';
        label.textContent = 'Error ❌';
    }
}

// ============================================================
// 6. СЧЕТЧИК ОФЛАЙН-ЗАКАЗОВ
// ============================================================
async function updateOfflineCount() {
    try {
        const response = await chrome.runtime.sendMessage({ type: 'GET_OFFLINE_ORDERS' });
        const orders = response.orders || [];
        const count = orders.length;
        document.getElementById('offlineCount').textContent = '📶 Offline orders: ' + count;
        
        // Если есть офлайн-заказы, показываем жёлтый бейдж
        if (count > 0) {
            document.getElementById('syncBtn').style.borderColor = 'rgba(255,149,0,0.5)';
        } else {
            document.getElementById('syncBtn').style.borderColor = 'rgba(255,255,255,0.2)';
        }
    } catch (error) {
        console.error('Error getting offline orders:', error);
    }
}

// ============================================================
// 7. СОХРАНЕНИЕ URL
// ============================================================
async function saveApiUrl() {
    const url = document.getElementById('apiUrl').value.trim();
    if (!url) {
        alert('Please enter a valid URL');
        return;
    }
    
    const btn = document.getElementById('saveUrlBtn');
    btn.textContent = '⏳ Saving...';
    btn.disabled = true;
    
    try {
        // Сохраняем в storage
        await chrome.storage.sync.set({ apiUrl: url });
        
        // Отправляем в background
        await chrome.runtime.sendMessage({ 
            type: 'UPDATE_API_URL', 
            url: url 
        });
        
        btn.textContent = '✅ Saved!';
        btn.style.borderColor = 'rgba(52, 199, 89, 0.5)';
        
        setTimeout(() => {
            btn.textContent = '💾 Save URL';
            btn.disabled = false;
            btn.style.borderColor = 'rgba(255,255,255,0.2)';
        }, 2000);
        
    } catch (error) {
        btn.textContent = '❌ Error';
        setTimeout(() => {
            btn.textContent = '💾 Save URL';
            btn.disabled = false;
        }, 2000);
    }
}

// ============================================================
// 8. СИНХРОНИЗАЦИЯ ОФЛАЙН-ЗАКАЗОВ
// ============================================================
async function syncNow() {
    const btn = document.getElementById('syncBtn');
    btn.textContent = '⏳ Syncing...';
    btn.disabled = true;
    
    try {
        const response = await chrome.runtime.sendMessage({ type: 'SYNC_NOW' });
        
        if (response && response.success) {
            btn.textContent = '✅ Synced!';
            btn.style.borderColor = 'rgba(52, 199, 89, 0.5)';
            await updateOfflineCount();
            await updateStatus();
        } else {
            btn.textContent = '❌ Failed';
        }
        
        setTimeout(() => {
            btn.textContent = '🔄 Sync Offline Orders';
            btn.disabled = false;
            btn.style.borderColor = 'rgba(255,255,255,0.2)';
        }, 2000);
        
    } catch (error) {
        btn.textContent = '❌ Error';
        setTimeout(() => {
            btn.textContent = '🔄 Sync Offline Orders';
            btn.disabled = false;
        }, 2000);
    }
}

// ============================================================
// 9. ПРИМЕНЕНИЕ ТЕМЫ К ПОПАПУ
// ============================================================
function applyTheme(theme) {
    const themes = {
        default: { c1: '#667eea', c2: '#764ba2' },
        dark: { c1: '#1a1a2e', c2: '#16213e' },
        green: { c1: '#11998e', c2: '#38ef7d' },
        orange: { c1: '#f12711', c2: '#f5af19' },
        blue: { c1: '#1e3c72', c2: '#2a5298' },
        red: { c1: '#cb2d3e', c2: '#ef473a' },
        teal: { c1: '#00b4db', c2: '#0083b0' },
        gray1: { c1: '#ece9e6', c2: '#ffffff' },
        gray2: { c1: '#4b4b4b', c2: '#2c2c2c' },
        gray3: { c1: '#616161', c2: '#9e9e9e' },
        gray4: { c1: '#3a3a3a', c2: '#1a1a1a' }
    };
    
    const colors = themes[theme] || themes.default;
    document.body.style.background = 'linear-gradient(135deg, ' + colors.c1 + ' 0%, ' + colors.c2 + ' 100%)';
}