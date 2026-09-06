// settings.js - FixMod Settings Page

document.addEventListener('DOMContentLoaded', async () => {
    const iconUrl = chrome.runtime.getURL('fixIco/fixModIco_32.png');
    document.getElementById('settings-icon').src = iconUrl;
    
    const manifest = chrome.runtime.getManifest();
    document.getElementById('version-info').textContent = 'FixMod v' + manifest.version;
    
    await loadAllSettings();
    await loadStats();
    await loadDarkMode();
    
    // ============================================================
    // ОБРАБОТЧИКИ
    // ============================================================
    
    document.getElementById('back-btn').addEventListener('click', () => {
        chrome.tabs.getCurrent((tab) => {
            chrome.tabs.remove(tab.id);
        });
    });
    
    document.getElementById('dark-mode-toggle').addEventListener('change', function() {
        const enabled = this.checked;
        document.body.classList.toggle('dark', enabled);
        chrome.storage.local.set({ darkMode: enabled });
        saveSetting('darkMode', enabled);
        sendToPopup({ type: 'UPDATE_DARK_MODE', enabled: enabled });
        sendToWidget({ type: 'UPDATE_DARK_MODE', enabled: enabled });
        showToast(enabled ? '🌙 Dark mode enabled' : '☀️ Light mode enabled');
    });
    
    document.getElementById('opacity-slider').addEventListener('input', function() {
        const value = this.value;
        document.getElementById('opacity-value').textContent = value + '%';
        const opacity = value / 100;
        chrome.storage.sync.set({ widgetOpacity: parseInt(value) });
        saveSetting('widgetOpacity', parseInt(value));
        sendToWidget({ type: 'UPDATE_OPACITY', opacity: opacity });
    });
    
    document.getElementById('font-size-slider').addEventListener('input', function() {
        const value = this.value;
        document.getElementById('font-size-value').textContent = value + 'px';
        chrome.storage.sync.set({ widgetFontSize: parseInt(value) });
        saveSetting('widgetFontSize', parseInt(value));
        sendToWidget({ type: 'UPDATE_FONT_SIZE', fontSize: parseInt(value) });
    });
    
    document.getElementById('qr-toggle').addEventListener('change', function() {
        const enabled = this.checked;
        chrome.storage.sync.set({ qrEnabled: enabled });
        saveSetting('qrEnabled', enabled);
        sendToWidget({ type: 'UPDATE_QR_ENABLED', enabled: enabled });
    });
    
    document.getElementById('suggestions-toggle').addEventListener('change', function() {
        const enabled = this.checked;
        chrome.storage.sync.set({ suggestionsEnabled: enabled });
        saveSetting('suggestionsEnabled', enabled);
        sendToWidget({ type: 'UPDATE_SUGGESTIONS', enabled: enabled });
        showToast(enabled ? '💡 Suggestions enabled' : '💡 Suggestions disabled');
    });
    
    document.getElementById('widget-toggle').addEventListener('change', function() {
        const enabled = this.checked;
        chrome.storage.sync.set({ widgetEnabled: enabled });
        saveSetting('widgetEnabled', enabled);
        sendToWidget({ type: 'UPDATE_WIDGET', enabled: enabled });
        showToast(enabled ? '📊 Widget enabled' : '📊 Widget disabled');
    });
    
    // ============================================================
    // === НАСТРОЙКА ПУТИ ДЛЯ СКАЧИВАНИЯ ФОТО ===
    // ============================================================
    
    const downloadPathInput = document.getElementById('download-path');
    const currentPathValue = document.getElementById('current-path-value');
    
    // Сохраняем путь при изменении (по Enter или потере фокуса)
    function saveDownloadPath() {
        const path = downloadPathInput.value.trim();
        chrome.storage.sync.set({ downloadPath: path });
        saveSetting('downloadPath', path);
        currentPathValue.textContent = path || 'Downloads/FixModPhotos/';
        showToast(path ? '📁 Download folder saved: ' + path : '📁 Reset to default');
        console.log('📁 Download path saved:', path || 'default');
    }
    
    downloadPathInput.addEventListener('change', saveDownloadPath);
    downloadPathInput.addEventListener('blur', saveDownloadPath);
    
    // Сохраняем по Enter
    downloadPathInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.blur();
        }
    });
    
    // Кнопка сброса
    document.getElementById('reset-download-path').addEventListener('click', function() {
        downloadPathInput.value = '';
        chrome.storage.sync.set({ downloadPath: '' });
        saveSetting('downloadPath', '');
        currentPathValue.textContent = 'Downloads/FixModPhotos/';
        showToast('↩️ Reset to default');
        console.log('📁 Download path reset to default');
    });
    
    // Загружаем путь при открытии
    chrome.storage.sync.get(['downloadPath'], (result) => {
        const path = result.downloadPath || '';
        downloadPathInput.value = path;
        currentPathValue.textContent = path || 'Downloads/FixModPhotos/';
    });
    
    document.getElementById('export-btn').addEventListener('click', exportData);
    document.getElementById('import-btn').addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input').addEventListener('change', importData);
    document.getElementById('restore-btn').addEventListener('click', restoreFromBackup);
    document.getElementById('refresh-stats-btn').addEventListener('click', async () => {
        await loadStats();
        showToast('✅ Stats refreshed');
    });
    document.getElementById('clear-data-btn').addEventListener('click', clearAllData);
});

// ============================================================
// ЗАГРУЗКА ТЕМНОЙ ТЕМЫ
// ============================================================

async function loadDarkMode() {
    try {
        const result = await chrome.storage.local.get(['darkMode']);
        const isDark = result.darkMode === true;
        document.getElementById('dark-mode-toggle').checked = isDark;
        document.body.classList.toggle('dark', isDark);
    } catch (error) {
        console.warn('Could not load dark mode:', error);
    }
}

// ============================================================
// ЗАГРУЗКА НАСТРОЕК
// ============================================================

async function loadAllSettings() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (result) => {
            if (result) {
                const opacity = result.widgetOpacity || 85;
                document.getElementById('opacity-slider').value = opacity;
                document.getElementById('opacity-value').textContent = opacity + '%';
                
                const fontSize = result.widgetFontSize || 10;
                document.getElementById('font-size-slider').value = fontSize;
                document.getElementById('font-size-value').textContent = fontSize + 'px';
                
                const qrEnabled = result.qrEnabled !== undefined ? result.qrEnabled : true;
                document.getElementById('qr-toggle').checked = qrEnabled;
                
                const suggestionsEnabled = result.suggestionsEnabled !== undefined ? result.suggestionsEnabled : true;
                document.getElementById('suggestions-toggle').checked = suggestionsEnabled;
                
                const widgetEnabled = result.widgetEnabled !== undefined ? result.widgetEnabled : true;
                document.getElementById('widget-toggle').checked = widgetEnabled;
            }
            resolve();
        });
    });
}

// ============================================================
// ЗАГРУЗКА СТАТИСТИКИ
// ============================================================

async function loadStats() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_STATS' }, (response) => {
            if (response && response.success) {
                const stats = response.data;
                document.getElementById('total-orders-db').textContent = stats.total_orders || 0;
                document.getElementById('repaired-count-db').textContent = stats.repaired_count || 0;
                document.getElementById('today-count-db').textContent = stats.today_count || 0;
            }
            resolve();
        });
    });
}

// ============================================================
// СОХРАНЕНИЕ НАСТРОЕК
// ============================================================

function saveSetting(key, value) {
    chrome.runtime.sendMessage({ 
        type: 'SAVE_SETTINGS', 
        data: { [key]: value } 
    });
}

function sendToWidget(message) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0] && tabs[0].url && tabs[0].url.includes('evy.fixably.com')) {
            chrome.tabs.sendMessage(tabs[0].id, message);
        }
    });
}

function sendToPopup(message) {
    chrome.runtime.sendMessage(message);
}

// ============================================================
// ЭКСПОРТ
// ============================================================

async function exportData() {
    const btn = document.getElementById('export-btn');
    btn.textContent = '⏳ Exporting...';
    btn.disabled = true;
    
    try {
        const response = await chrome.runtime.sendMessage({ type: 'EXPORT_DATA' });
        
        if (response && response.success) {
            const data = response.data;
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fixmod_export_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            btn.textContent = '✅ Exported!';
            showToast('✅ Data exported');
        } else {
            btn.textContent = '❌ Error';
            showToast('❌ Export error');
        }
        
        setTimeout(() => {
            btn.textContent = '📤 Export JSON';
            btn.disabled = false;
        }, 2000);
        
    } catch (error) {
        btn.textContent = '❌ Error';
        showToast('❌ Export error');
        setTimeout(() => {
            btn.textContent = '📤 Export JSON';
            btn.disabled = false;
        }, 2000);
    }
}

// ============================================================
// ИМПОРТ
// ============================================================

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (!data.orders || !Array.isArray(data.orders)) {
            showToast('❌ Invalid file format');
            return;
        }
        
        if (!confirm('⚠️ Import will replace all current data. Continue?')) {
            return;
        }
        
        const btn = document.getElementById('import-btn');
        btn.textContent = '⏳ Importing...';
        btn.disabled = true;
        
        const response = await chrome.runtime.sendMessage({ 
            type: 'IMPORT_DATA', 
            data: data 
        });
        
        if (response && response.success) {
            await loadStats();
            btn.textContent = '✅ Imported!';
            showToast(`✅ Imported ${data.orders.length} orders`);
        } else {
            btn.textContent = '❌ Error';
            showToast('❌ Import error');
        }
        
        setTimeout(() => {
            btn.textContent = '📥 Import JSON';
            btn.disabled = false;
        }, 2000);
        
    } catch (error) {
        showToast('❌ Error: ' + error.message);
        document.getElementById('import-btn').textContent = '📥 Import JSON';
        document.getElementById('import-btn').disabled = false;
    }
    
    event.target.value = '';
}

// ============================================================
// ВОССТАНОВЛЕНИЕ ИЗ БЭКАПА
// ============================================================

async function restoreFromBackup() {
    const btn = document.getElementById('restore-btn');
    btn.textContent = '⏳ Restoring...';
    btn.disabled = true;
    
    try {
        const response = await chrome.runtime.sendMessage({ type: 'FORCE_RESTORE' });
        
        if (response && response.success) {
            await loadStats();
            btn.textContent = '✅ Restored!';
            showToast('✅ Data restored from backup');
        } else {
            btn.textContent = '❌ No backup found';
            showToast('❌ No backup found or data already exists');
        }
        
        setTimeout(() => {
            btn.textContent = '🔄 Restore backup';
            btn.disabled = false;
        }, 3000);
        
    } catch (error) {
        btn.textContent = '❌ Error';
        showToast('❌ Restore error');
        setTimeout(() => {
            btn.textContent = '🔄 Restore backup';
            btn.disabled = false;
        }, 3000);
    }
}

// ============================================================
// ОЧИСТКА ДАННЫХ
// ============================================================

async function clearAllData() {
    if (!confirm('⚠️ Delete all data? This cannot be undone!')) return;
    if (!confirm('Are you sure? All orders will be permanently deleted.')) return;
    
    const btn = document.getElementById('clear-data-btn');
    btn.textContent = '⏳ Deleting...';
    btn.disabled = true;
    
    try {
        await chrome.runtime.sendMessage({ type: 'CLEAR_ALL_DATA' });
        await loadStats();
        btn.textContent = '✅ Deleted!';
        showToast('✅ All data deleted');
        
        setTimeout(() => {
            btn.textContent = '🗑️ Delete all data';
            btn.disabled = false;
        }, 2000);
        
    } catch (error) {
        btn.textContent = '❌ Error';
        showToast('❌ Delete error');
        setTimeout(() => {
            btn.textContent = '🗑️ Delete all data';
            btn.disabled = false;
        }, 2000);
    }
}

// ============================================================
// TOAST
// ============================================================

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

// ============================================================
// АВТООБНОВЛЕНИЕ
// ============================================================

setInterval(() => {
    loadStats();
}, 30000);