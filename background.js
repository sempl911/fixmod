// background.js - Service Worker с офлайн-режимом

console.log('🔧 FixMod Background Service Started');

// Конфигурация
let API_URL = 'http://167.99.138.93:8000/api/fixably/order';
let isOnline = false;

// Загружаем сохраненный URL
chrome.storage.sync.get(['apiUrl'], (result) => {
    if (result.apiUrl) {
        API_URL = result.apiUrl;
        console.log('📡 API URL loaded from settings:', API_URL);
    }
});

// ============================================================
// 1. ПРОВЕРКА СВЯЗИ С СЕРВЕРОМ
// ============================================================
async function checkServerConnection() {
    try {
        // Пробуем получить health статус
        const healthUrl = API_URL.replace('/api/fixably/order', '/health');
        const response = await fetch(healthUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });
        isOnline = response.ok;
    } catch (error) {
        isOnline = false;
    }
    
    // Обновляем статус в storage
    chrome.storage.local.set({ serverStatus: isOnline ? 'online' : 'offline' });
    
    return isOnline;
}

// ============================================================
// 2. ОТПРАВКА ДАННЫХ
// ============================================================
async function sendOrderToServer(orderData) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderData)
    });
    
    if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
}

// ============================================================
// 3. СОХРАНЕНИЕ В ОФЛАЙН
// ============================================================
async function saveOfflineOrder(orderData) {
    const result = await chrome.storage.local.get(['offlineOrders']);
    const offlineOrders = result.offlineOrders || [];
    
    const orderWithMeta = {
        ...orderData,
        _offlineId: Date.now() + '_' + Math.random().toString(36).substr(2, 6),
        _timestamp: new Date().toISOString(),
        _retryCount: 0
    };
    
    offlineOrders.push(orderWithMeta);
    await chrome.storage.local.set({ offlineOrders });
    
    updateBadge(offlineOrders.length);
    return offlineOrders.length;
}

// ============================================================
// 4. СИНХРОНИЗАЦИЯ ОФЛАЙН-ЗАКАЗОВ
// ============================================================
async function syncOfflineOrders() {
    const result = await chrome.storage.local.get(['offlineOrders']);
    const offlineOrders = result.offlineOrders || [];
    
    if (offlineOrders.length === 0) return;
    
    const isConnected = await checkServerConnection();
    if (!isConnected) {
        console.log('📶 Offline, cannot sync');
        return;
    }
    
    console.log(`🔄 Syncing ${offlineOrders.length} offline orders...`);
    const failedOrders = [];
    
    for (const order of offlineOrders) {
        try {
            const cleanOrder = { ...order };
            delete cleanOrder._offlineId;
            delete cleanOrder._timestamp;
            delete cleanOrder._retryCount;
            
            await sendOrderToServer(cleanOrder);
            console.log('✅ Offline order synced:', order.order_number);
        } catch (error) {
            console.warn('❌ Failed to sync order:', order.order_number, error.message);
            order._retryCount = (order._retryCount || 0) + 1;
            
            if (order._retryCount >= 5) {
                console.log('🗑️ Removing stuck order after 5 retries:', order.order_number);
                continue;
            }
            failedOrders.push(order);
        }
    }
    
    await chrome.storage.local.set({ offlineOrders: failedOrders });
    updateBadge(failedOrders.length);
    
    if (failedOrders.length === 0) {
        console.log('✅ All offline orders synced!');
    } else {
        console.log(`⚠️ ${failedOrders.length} orders still offline`);
    }
}

// ============================================================
// 5. ОБНОВЛЕНИЕ БЕЙДЖА
// ============================================================
function updateBadge(count) {
    if (count > 0) {
        chrome.action.setBadgeText({ text: String(count) });
        chrome.action.setBadgeBackgroundColor({ color: '#FF9500' });
    } else {
        chrome.action.setBadgeText({ text: '' });
    }
}

// ============================================================
// 6. ОБРАБОТКА СООБЩЕНИЙ
// ============================================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Сохранение заказа (с офлайн-поддержкой)
    if (request.type === 'SEND_ORDER') {
        console.log('📤 Saving order:', request.data.order_number);
        
        handleSaveOrder(request.data)
            .then(result => {
                sendResponse({ success: true, data: result });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
    
    // Обновление API URL
    if (request.type === 'UPDATE_API_URL') {
        API_URL = request.url;
        chrome.storage.sync.set({ apiUrl: request.url });
        console.log('📡 API URL updated:', API_URL);
        sendResponse({ success: true });
        return true;
    }
    
    // Проверка статуса сервера
    if (request.type === 'CHECK_STATUS') {
        checkServerConnection()
            .then(status => {
                sendResponse({ online: status });
            })
            .catch(() => {
                sendResponse({ online: false });
            });
        return true;
    }
    
    // Получение офлайн-заказов
    if (request.type === 'GET_OFFLINE_ORDERS') {
        chrome.storage.local.get(['offlineOrders'], (result) => {
            sendResponse({ orders: result.offlineOrders || [] });
        });
        return true;
    }
    
    // Принудительная синхронизация
    if (request.type === 'SYNC_NOW') {
        syncOfflineOrders()
            .then(() => {
                sendResponse({ success: true });
            })
            .catch((error) => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
    
    // Получение настроек
    if (request.type === 'GET_SETTINGS') {
        chrome.storage.sync.get([
            'widgetOpacity',
            'widgetTheme', 
            'widgetFontSize',
            'qrEnabled',
            'apiUrl'
        ], (result) => {
            sendResponse(result);
        });
        return true;
    }
    
    // Сохранение настроек
    if (request.type === 'SAVE_SETTINGS') {
        chrome.storage.sync.set(request.data, () => {
            if (request.data.apiUrl) {
                API_URL = request.data.apiUrl;
            }
            sendResponse({ success: true });
        });
        return true;
    }
});

// ============================================================
// 7. ОБРАБОТКА СОХРАНЕНИЯ ЗАКАЗА
// ============================================================
async function handleSaveOrder(orderData) {
    const isConnected = await checkServerConnection();
    
    if (isConnected) {
        try {
            const result = await sendOrderToServer(orderData);
            
            // После успешной отправки пробуем синхронизировать офлайн-заказы
            await syncOfflineOrders();
            
            return result;
        } catch (error) {
            console.warn('⚠️ Send failed, saving offline:', error.message);
            const count = await saveOfflineOrder(orderData);
            throw new Error(`Saved offline (${count} total)`);
        }
    } else {
        console.warn('📶 No connection, saving offline');
        const count = await saveOfflineOrder(orderData);
        throw new Error(`No connection, saved offline (${count} total)`);
    }
}

// ============================================================
// 8. ПЕРИОДИЧЕСКАЯ СИНХРОНИЗАЦИЯ
// ============================================================
// Создаём будильник для синхронизации каждые 30 секунд
chrome.alarms.create('syncOfflineOrders', { periodInMinutes: 0.5 });

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'syncOfflineOrders') {
        syncOfflineOrders();
    }
});

// Периодическая проверка статуса (каждые 15 секунд)
setInterval(() => {
    checkServerConnection();
}, 15000);

// ============================================================
// 9. СОБЫТИЯ УСТАНОВКИ И ЗАПУСКА
// ============================================================
chrome.runtime.onInstalled.addListener(() => {
    console.log('📦 FixMod installed');
    
    // Настройки по умолчанию
    chrome.storage.sync.get(['widgetOpacity', 'apiUrl'], (result) => {
        if (result.widgetOpacity === undefined) {
            chrome.storage.sync.set({ widgetOpacity: 85 });
        }
        if (!result.apiUrl) {
            chrome.storage.sync.set({ 
                apiUrl: 'http://167.99.138.93:8000/api/fixably/order' 
            });
        }
    });
    
    // Проверяем связь
    checkServerConnection();
});

chrome.runtime.onStartup.addListener(() => {
    console.log('🔄 FixMod started');
    checkServerConnection();
    syncOfflineOrders();
});

console.log('✅ FixMod Background ready');