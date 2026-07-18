// background.js - Service Worker для отправки данных на сервер

const API_URL = 'https://rev-photographers-stranger-chest.trycloudflare.com/api/fixably/order';

console.log('🔧 Fixably Extension Background Service Started');

// Обработка сообщений от content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Отправка данных заказа на сервер
    if (request.type === 'SEND_ORDER') {
        console.log('📤 Sending order to server:', request.data);
        
        fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(request.data)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('✅ Server response:', data);
            sendResponse({ success: true, data });
        })
        .catch(error => {
            console.error('❌ Error sending order:', error);
            sendResponse({ success: false, error: error.message });
        });
        
        return true; // Keep message channel open for async response
    }
    
    // Получение настроек
    if (request.type === 'GET_SETTINGS') {
        chrome.storage.sync.get([
            'widgetOpacity',
            'widgetTheme', 
            'widgetFontSize',
            'qrEnabled'
        ], (result) => {
            sendResponse(result);
        });
        return true;
    }
    
    // Сохранение настроек
    if (request.type === 'SAVE_SETTINGS') {
        chrome.storage.sync.set(request.data, () => {
            sendResponse({ success: true });
        });
        return true;
    }
});

// При установке расширения
chrome.runtime.onInstalled.addListener(() => {
    console.log('📦 Fixably Extension installed');
    
    // Устанавливаем настройки по умолчанию
    chrome.storage.sync.get(['widgetOpacity'], (result) => {
        if (result.widgetOpacity === undefined) {
            chrome.storage.sync.set({ widgetOpacity: 85 });
        }
    });
});

// При запуске браузера
chrome.runtime.onStartup.addListener(() => {
    console.log('🔄 Fixably Extension started');
});