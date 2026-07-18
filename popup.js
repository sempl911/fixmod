// popup.js - настройки виджета

document.addEventListener('DOMContentLoaded', () => {
    // Загрузка сохраненных настроек
    chrome.storage.sync.get(['widgetOpacity', 'widgetTheme', 'widgetFontSize', 'qrEnabled'], (result) => {
        const opacity = result.widgetOpacity || 85;
        document.getElementById('opacity-slider').value = opacity;
        document.getElementById('opacity-value').textContent = opacity + '%';
        
        if (result.widgetTheme) {
            document.getElementById('theme-select').value = result.widgetTheme;
        }
        
        const fontSize = result.widgetFontSize || 12;
        document.getElementById('font-size-slider').value = fontSize;
        document.getElementById('font-size-value').textContent = fontSize + 'px';
        
        const qrEnabled = result.qrEnabled !== undefined ? result.qrEnabled : true;
        document.getElementById('qr-toggle').checked = qrEnabled;
    });
    
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
    
    // Версия
    const version = chrome.runtime.getManifest().version;
    document.getElementById('version-info').textContent = `v${version}`;
});