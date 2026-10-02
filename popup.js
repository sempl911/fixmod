// popup.js - FixMod Popup

// ============================================================
// === ЦВЕТОВЫЕ СХЕМЫ ===
// ============================================================

const POPUP_COLOR_SCHEMES = {
    default: { c1: '#667eea', c2: '#764ba2', isDark: false, whiteNumbers: false },
    dark:    { c1: '#1a1a2e', c2: '#16213e', isDark: true,  whiteNumbers: true  },
    green:   { c1: '#11998e', c2: '#38ef7d', isDark: false, whiteNumbers: false },
    orange:  { c1: '#f12711', c2: '#f5af19', isDark: false, whiteNumbers: false },
    blue:    { c1: '#1e3c72', c2: '#2a5298', isDark: false, whiteNumbers: true  },
    red:     { c1: '#cb2d3e', c2: '#ef473a', isDark: false, whiteNumbers: false },
    teal:    { c1: '#00b4db', c2: '#0083b0', isDark: false, whiteNumbers: false },
    gray1:   { c1: '#ece9e6', c2: '#ffffff', isDark: false, whiteNumbers: false },
    gray2:   { c1: '#4b4b4b', c2: '#2c2c2c', isDark: true,  whiteNumbers: true  },
    gray3:   { c1: '#616161', c2: '#9e9e9e', isDark: false, whiteNumbers: false },
    gray4:   { c1: '#3a3a3a', c2: '#1a1a1a', isDark: true,  whiteNumbers: true  }
};

// ============================================================
// === УТИЛИТЫ ===
// ============================================================

function hexToRgba(hex, alpha = 1) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return `rgba(102, 126, 234, ${alpha})`;
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function darkenColor(hex, percent) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    let r = parseInt(hex.substr(0, 2), 16);
    let g = parseInt(hex.substr(2, 2), 16);
    let b = parseInt(hex.substr(4, 2), 16);
    
    r = Math.max(0, Math.floor(r * (1 - percent / 100)));
    g = Math.max(0, Math.floor(g * (1 - percent / 100)));
    b = Math.max(0, Math.floor(b * (1 - percent / 100)));
    
    return `rgb(${r}, ${g}, ${b})`;
}

function lightenColor(hex, percent) {
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('');
    let r = parseInt(hex.substr(0, 2), 16);
    let g = parseInt(hex.substr(2, 2), 16);
    let b = parseInt(hex.substr(4, 2), 16);
    
    r = Math.min(255, Math.floor(r + (255 - r) * percent / 100));
    g = Math.min(255, Math.floor(g + (255 - g) * percent / 100));
    b = Math.min(255, Math.floor(b + (255 - b) * percent / 100));
    
    return `rgb(${r}, ${g}, ${b})`;
}

// ============================================================
// === ПРИМЕНЕНИЕ ТЕМЫ ===
// ============================================================

function applyTheme(themeId) {
    const theme = POPUP_COLOR_SCHEMES[themeId] || POPUP_COLOR_SCHEMES.default;
    
    console.log('🎨 Popup: тема:', themeId, '| c1:', theme.c1, '| whiteNumbers:', theme.whiteNumbers);
    
    // CSS-переменные
    const root = document.documentElement;
    root.style.setProperty('--theme-c1', theme.c1);
    root.style.setProperty('--theme-c2', theme.c2);
    root.style.setProperty('--theme-c1-light', hexToRgba(theme.c1, 0.15));
    root.style.setProperty('--theme-c1-medium', hexToRgba(theme.c1, 0.3));
    root.style.setProperty('--theme-c1-strong', hexToRgba(theme.c1, 0.5));
    
    // Класс dark
    document.body.classList.toggle('dark', theme.isDark);
    
    // Цвета цифр
    const numberColor = theme.whiteNumbers ? '#ffffff' : '#1a1a2e';
    const labelColor = theme.whiteNumbers ? '#9ca3af' : '#6b7280';
    
    console.log('🎨 Цифры будут:', numberColor);
    
    // Avg / 30d — цвет по теме
    const avg30d = document.getElementById('avg-30d');
    if (avg30d) {
        avg30d.style.setProperty('color', numberColor, 'important');
    }
    
    // Today — c1 адаптированный
    const todayCount = document.getElementById('today-count');
    if (todayCount) {
        let todayColor = theme.c1;
        
        if (theme.whiteNumbers) {
            todayColor = lightenColor(theme.c1, 60);
        } else {
            todayColor = darkenColor(theme.c1, 30);
        }
        
        todayCount.style.setProperty('color', todayColor, 'important');
        console.log('🎨 Today цвет:', todayColor);
    }
    
    // Ready today — зелёный
    const repairedTodayCount = document.getElementById('repaired-today-count');
    if (repairedTodayCount) {
        repairedTodayCount.style.setProperty('color', theme.whiteNumbers ? '#34c759' : '#2db84e', 'important');
    }
    
    // Labels
    document.querySelectorAll('.stat-label').forEach(el => {
        el.style.setProperty('color', labelColor, 'important');
    });
}

// ============================================================
// === ЗАГРУЗКА ТЕМЫ ===
// ============================================================

async function loadTheme() {
    try {
        const result = await chrome.storage.local.get(['widgetTheme', 'globalThemeId']);
        const themeId = result.widgetTheme || result.globalThemeId || 'default';
        applyTheme(themeId);
    } catch (e) {
        console.warn('⚠️ Не удалось загрузить тему:', e);
        applyTheme('default');
    }
}

// ============================================================
// === ОСНОВНОЙ КОД ===
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    const iconUrl = chrome.runtime.getURL('fixIco/fixModIco_32.png');
    const settingsIconUrl = chrome.runtime.getURL('fixIco/settings_icon.png');
    
    document.getElementById('popup-icon').src = iconUrl;
    document.getElementById('settings-icon').src = settingsIconUrl;
    
    await loadTheme();
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
                
                // 👇 3 колонки: Today / Ready today / Avg 30d
                document.getElementById('today-count').textContent = stats.today_count || 0;
                document.getElementById('repaired-today-count').textContent = stats.repaired_today_count || 0;
                document.getElementById('avg-30d').textContent = (stats.avg_30d || 0).toFixed(1);
                
                // Footer
                document.getElementById('orders-count').textContent = (stats.total_orders || 0) + ' orders';
                
                console.log('📊 Popup stats:', {
                    today: stats.today_count,
                    repairedToday: stats.repaired_today_count,
                    avg30d: stats.avg_30d,
                    total: stats.total_orders,
                    total30d: stats.total_orders_30d,
                    workingDays30d: stats.working_days_30d
                });
            } else {
                document.getElementById('today-count').textContent = '?';
                document.getElementById('repaired-today-count').textContent = '?';
                document.getElementById('avg-30d').textContent = '?';
                document.getElementById('orders-count').textContent = '0 orders';
            }
            
            // После обновления цифр — переприменяем цвет
            chrome.storage.local.get(['widgetTheme'], (r) => {
                const themeId = r.widgetTheme || 'default';
                const theme = POPUP_COLOR_SCHEMES[themeId] || POPUP_COLOR_SCHEMES.default;
                const numberColor = theme.whiteNumbers ? '#ffffff' : '#1a1a2e';
                
                const avg30d = document.getElementById('avg-30d');
                if (avg30d) avg30d.style.setProperty('color', numberColor, 'important');
                
                const labelColor = theme.whiteNumbers ? '#9ca3af' : '#6b7280';
                document.querySelectorAll('.stat-label').forEach(el => {
                    el.style.setProperty('color', labelColor, 'important');
                });
            });
            
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
        
        const themeResult = await chrome.storage.local.get(['widgetTheme']);
        if (!themeResult.widgetTheme) {
            document.body.classList.toggle('dark', isDark);
        }
    } catch (error) {
        console.warn('Could not load dark mode:', error);
    }
}

// ============================================================
// СЛУШАЕМ ИЗМЕНЕНИЯ ТЕМЫ
// ============================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'UPDATE_DARK_MODE') {
        if (!localStorage.getItem('widgetTheme')) {
            document.body.classList.toggle('dark', request.enabled);
        }
        sendResponse({ success: true });
    }
    if (request.type === 'UPDATE_THEME') {
        applyTheme(request.theme);
        sendResponse({ success: true });
    }
    return true;
});

if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.widgetTheme) {
            const newTheme = changes.widgetTheme.newValue || 'default';
            console.log('🎨 Popup: тема изменилась:', newTheme);
            applyTheme(newTheme);
        }
    });
}

// ============================================================
// АВТООБНОВЛЕНИЕ
// ============================================================

setInterval(() => {
    loadStats();
}, 30000);