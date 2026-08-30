// background.js - FixMod Service Worker с двойным бэкапом и глобальной темой

console.log('🔧 FixMod Background Service Started');

// ============================================================
// === БАЗА ДАННЫХ (IndexedDB) ===
// ============================================================

const DB_NAME = 'FixModDB';
const DB_VERSION = 1;

let db = null;

function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const database = event.target.result;
            
            if (!database.objectStoreNames.contains('orders')) {
                const store = database.createObjectStore('orders', { keyPath: 'id' });
                store.createIndex('order_number', 'order_number', { unique: false });
                store.createIndex('status_code', 'status_code', { unique: false });
                store.createIndex('created_at', 'created_at', { unique: false });
            }
            
            if (!database.objectStoreNames.contains('history')) {
                const store = database.createObjectStore('history', { keyPath: 'id' });
                store.createIndex('order_id', 'order_id', { unique: false });
                store.createIndex('event_type', 'event_type', { unique: false });
            }
            
            if (!database.objectStoreNames.contains('statistics')) {
                database.createObjectStore('statistics', { keyPath: 'id' });
            }
        };
    });
}

async function getDB() {
    if (!db) {
        db = await openDatabase();
    }
    return db;
}

// ============================================================
// === ФУНКЦИИ РАБОТЫ С БД ===
// ============================================================

async function saveOrderToDB(orderData) {
    const database = await getDB();
    const id = `order_${orderData.order_number}`;
    const now = new Date().toISOString();
    
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(['orders', 'history'], 'readwrite');
        const ordersStore = transaction.objectStore('orders');
        const historyStore = transaction.objectStore('history');
        
        const getRequest = ordersStore.get(id);
        
        getRequest.onsuccess = async () => {
            const existing = getRequest.result;
            let hasChanges = false;
            
            if (existing) {
                // Проверяем, изменился ли статус или другие важные поля
                if (existing.status !== orderData.status) hasChanges = true;
                if (existing.technician !== orderData.technician) hasChanges = true;
                if (existing.resolution !== orderData.resolution) hasChanges = true;
                
                if (!hasChanges) {
                    resolve(id);
                    return;
                }
                
                const updatedOrder = {
                    ...existing,
                    ...orderData,
                    updated_at: now
                };
                ordersStore.put(updatedOrder);
                
                if (existing.status !== orderData.status) {
                    historyStore.add({
                        id: `${id}_${Date.now()}`,
                        order_id: id,
                        event_type: 'status_change',
                        old_value: existing.status || null,
                        new_value: orderData.status,
                        timestamp: now
                    });
                }
            } else {
                const newOrder = {
                    id: id,
                    ...orderData,
                    created_at: now,
                    updated_at: now
                };
                ordersStore.add(newOrder);
                
                if (orderData.status) {
                    historyStore.add({
                        id: `${id}_${Date.now()}`,
                        order_id: id,
                        event_type: 'status_change',
                        old_value: null,
                        new_value: orderData.status,
                        timestamp: now
                    });
                }
                hasChanges = true;
            }
            
            transaction.oncomplete = async () => {
                await updateStatistics();
                await updateBadge();
                // Бэкап создается отдельно, не при каждом сохранении
                resolve(id);
            };
            
            transaction.onerror = () => reject(transaction.error);
        };
        
        getRequest.onerror = () => reject(getRequest.error);
    });
}

async function updateStatistics() {
    const database = await getDB();
    
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(['orders', 'statistics'], 'readwrite');
        const ordersStore = transaction.objectStore('orders');
        const statsStore = transaction.objectStore('statistics');
        
        const getAllRequest = ordersStore.getAll();
        
        getAllRequest.onsuccess = () => {
            const allOrders = getAllRequest.result || [];
            
            const totalOrders = allOrders.length;
            const statusCounts = {};
            const monthlyStats = {};
            const dailyStats = {};
            let repairedCount = 0;
            let todayCount = 0;
            
            const today = new Date().toISOString().slice(0, 10);
            
            allOrders.forEach(order => {
                const status = order.status_code || 'unknown';
                statusCounts[status] = (statusCounts[status] || 0) + 1;
                
                if (order.created_at) {
                    const month = order.created_at.substring(0, 7);
                    monthlyStats[month] = (monthlyStats[month] || 0) + 1;
                    
                    const day = order.created_at.substring(0, 10);
                    dailyStats[day] = (dailyStats[day] || 0) + 1;
                    
                    if (day === today) {
                        todayCount++;
                    }
                }
                
                if (order.status_code === 'ready' || order.status_code === 'pickup') {
                    repairedCount++;
                }
            });
            
            const stats = {
                id: 'stats',
                total_orders: totalOrders,
                repaired_count: repairedCount,
                today_count: todayCount,
                status_counts: statusCounts,
                monthly_stats: monthlyStats,
                daily_stats: dailyStats,
                last_updated: new Date().toISOString()
            };
            
            statsStore.put(stats);
            
            transaction.oncomplete = () => resolve(stats);
            transaction.onerror = () => reject(transaction.error);
        };
        
        getAllRequest.onerror = () => reject(getAllRequest.error);
    });
}

async function getStatistics() {
    const database = await getDB();
    
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(['statistics'], 'readonly');
        const store = transaction.objectStore('statistics');
        const request = store.get('stats');
        
        request.onsuccess = () => {
            resolve(request.result || {
                id: 'stats',
                total_orders: 0,
                repaired_count: 0,
                today_count: 0,
                status_counts: {},
                monthly_stats: {},
                daily_stats: {},
                last_updated: new Date().toISOString()
            });
        };
        request.onerror = () => reject(request.error);
    });
}

async function getAllOrders() {
    const database = await getDB();
    
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(['orders'], 'readonly');
        const store = transaction.objectStore('orders');
        const request = store.getAll();
        
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
    });
}

async function getTodaysOrders() {
    const allOrders = await getAllOrders();
    const today = new Date().toISOString().slice(0, 10);
    
    return allOrders.filter(order => {
        return order.created_at && order.created_at.startsWith(today);
    });
}

async function exportData() {
    const orders = await getAllOrders();
    const stats = await getStatistics();
    
    return {
        version: 1,
        export_date: new Date().toISOString(),
        statistics: stats,
        orders: orders
    };
}

async function clearAllData() {
    const database = await getDB();
    
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(['orders', 'history', 'statistics'], 'readwrite');
        
        transaction.objectStore('orders').clear();
        transaction.objectStore('history').clear();
        transaction.objectStore('statistics').clear();
        
        transaction.oncomplete = async () => {
            await updateStatistics();
            await updateBadge();
            await doubleBackup();
            resolve();
        };
        transaction.onerror = () => reject(transaction.error);
    });
}

// ============================================================
// === ДВОЙНОЙ АВТОМАТИЧЕСКИЙ БЭКАП ===
// ============================================================

// 1. Бэкап в папку загрузок (исправлено для Service Worker)
async function backupToFolder() {
    try {
        const orders = await getAllOrders();
        const stats = await getStatistics();
        
        if (orders.length === 0) {
            console.log('ℹ️ No orders to backup to folder');
            return false;
        }
        
        const data = {
            version: 1,
            timestamp: new Date().toISOString(),
            orders: orders,
            statistics: stats,
            total: orders.length
        };
        
        const json = JSON.stringify(data, null, 2);
        
        // Используем Blob и FileReader (работает в Service Worker)
        const blob = new Blob([json], { type: 'application/json' });
        const reader = new FileReader();
        
        return new Promise((resolve, reject) => {
            reader.onload = async function() {
                try {
                    const dataUrl = reader.result;
                    const dateStr = new Date().toISOString().slice(0, 10);
                    
                    // Сохраняем latest.json
                    await chrome.downloads.download({
                        url: dataUrl,
                        filename: `FixModDB/latest.json`,
                        saveAs: false,
                        conflictAction: 'overwrite'
                    });
                    
                    // Архивируем с датой раз в день
                    const storageResult = await chrome.storage.local.get(['fixmod_last_backup_date']);
                    
                    if (storageResult.fixmod_last_backup_date !== dateStr) {
                        await chrome.downloads.download({
                            url: dataUrl,
                            filename: `FixModDB/backup_${dateStr}.json`,
                            saveAs: false,
                            conflictAction: 'overwrite'
                        });
                        await chrome.storage.local.set({ fixmod_last_backup_date: dateStr });
                    }
                    
                    console.log('💾 Backup saved to FixModDB folder, orders:', orders.length);
                    resolve(true);
                } catch (error) {
                    console.warn('⚠️ Could not download backup:', error);
                    resolve(false);
                }
            };
            
            reader.onerror = function() {
                console.warn('⚠️ Could not read blob:', reader.error);
                resolve(false);
            };
            
            reader.readAsDataURL(blob);
        });
    } catch (error) {
        console.warn('⚠️ Could not backup to folder:', error);
        return false;
    }
}

// 2. Бэкап в chrome.storage.local
async function backupToStorage() {
    try {
        const orders = await getAllOrders();
        const stats = await getStatistics();
        
        if (orders.length === 0) {
            console.log('ℹ️ No orders to backup to storage');
            return false;
        }
        
        const backup = {
            version: 1,
            timestamp: new Date().toISOString(),
            orders: orders,
            statistics: stats,
            total: orders.length
        };
        
        await chrome.storage.local.set({ 
            'fixmod_backup': backup,
            'fixmod_backup_timestamp': new Date().toISOString(),
            'fixmod_backup_count': orders.length
        });
        
        console.log('💾 Backup saved to chrome.storage.local, orders:', orders.length);
        return true;
    } catch (error) {
        console.warn('⚠️ Could not backup to storage:', error);
        return false;
    }
}

// 3. ДВОЙНОЙ БЭКАП
async function doubleBackup() {
    console.log('🔄 Creating manual backup...');
    
    const folderResult = await backupToFolder();
    const storageResult = await backupToStorage();
    
    console.log('✅ Backup complete:', {
        folder: folderResult ? '✅' : '❌',
        storage: storageResult ? '✅' : '❌'
    });
}

// ============================================================
// === АВТОМАТИЧЕСКОЕ ВОССТАНОВЛЕНИЕ ===
// ============================================================

async function restoreFromBackup() {
    try {
        const storageResult = await chrome.storage.local.get(['fixmod_backup']);
        const storageBackup = storageResult.fixmod_backup;
        
        if (storageBackup && storageBackup.orders && storageBackup.orders.length > 0) {
            console.log('📦 Found backup in chrome.storage.local, orders:', storageBackup.orders.length);
            
            const existingOrders = await getAllOrders();
            if (existingOrders.length === 0) {
                await importDataInternal(storageBackup);
                console.log('✅ Restored from chrome.storage.local');
                return true;
            }
        }
        
        console.log('🔍 No storage backup or DB not empty, trying folder...');
        
        const downloads = await new Promise((resolve) => {
            chrome.downloads.search({
                filenameRegex: 'FixModDB/latest.json',
                state: 'complete',
                limit: 1
            }, resolve);
        });
        
        if (downloads.length === 0) {
            console.log('ℹ️ No backup found in FixModDB folder');
            return false;
        }
        
        const file = downloads[0];
        const response = await fetch(file.url);
        const folderBackup = await response.json();
        
        if (!folderBackup.orders || folderBackup.orders.length === 0) {
            return false;
        }
        
        console.log('📦 Found backup in FixModDB folder, orders:', folderBackup.orders.length);
        
        const existingOrders = await getAllOrders();
        if (existingOrders.length === 0) {
            await importDataInternal(folderBackup);
            console.log('✅ Restored from FixModDB folder');
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('❌ Error restoring backup:', error);
        return false;
    }
}

// ============================================================
// === ОБНОВЛЕНИЕ БЕЙДЖА ===
// ============================================================

async function updateBadge() {
    try {
        const stats = await getStatistics();
        const todayCount = stats.today_count || 0;
        
        if (todayCount > 0) {
            let text = String(todayCount);
            if (todayCount > 9999) {
                text = '9k+';
            }
            chrome.action.setBadgeText({ text: text });
            chrome.action.setBadgeBackgroundColor({ color: '#FF6B35' });
        } else {
            chrome.action.setBadgeText({ text: '' });
        }
    } catch (error) {
        console.warn('⚠️ Could not update badge:', error);
    }
}

// ============================================================
// === ГЛОБАЛЬНАЯ ТЕМА ===
// ============================================================

const COLOR_SCHEMES = {
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

async function getGlobalTheme() {
    const result = await chrome.storage.local.get(['globalTheme', 'globalThemeId']);
    return {
        theme: result.globalTheme || { c1: '#667eea', c2: '#764ba2' },
        id: result.globalThemeId || 'default'
    };
}

async function saveGlobalTheme(themeId) {
    const theme = COLOR_SCHEMES[themeId] || COLOR_SCHEMES.default;
    await chrome.storage.local.set({ 
        globalTheme: theme,
        globalThemeId: themeId 
    });
    console.log('🎨 Global theme saved:', themeId);
}

// ============================================================
// === КОНФИГУРАЦИЯ ===
// ============================================================

let API_URL = 'http://167.99.138.93:8000/api/fixably/order';
let isOnline = false;

chrome.storage.sync.get(['apiUrl'], (result) => {
    if (result.apiUrl) {
        API_URL = result.apiUrl;
        console.log('📡 API URL loaded from settings:', API_URL);
    }
});

// ============================================================
// === ПРОВЕРКА СВЯЗИ С СЕРВЕРОМ ===
// ============================================================

async function checkServerConnection() {
    try {
        const healthUrl = API_URL.replace('/api/fixably/order', '/health');
        const response = await fetch(healthUrl, {
            method: 'GET',
            signal: AbortSignal.timeout(5000)
        });
        isOnline = response.ok;
    } catch (error) {
        isOnline = false;
    }
    
    chrome.storage.local.set({ serverStatus: isOnline ? 'online' : 'offline' });
    return isOnline;
}

// ============================================================
// === ИМПОРТ ДАННЫХ (внутренний) ===
// ============================================================

async function importDataInternal(data) {
    const database = await getDB();
    
    return new Promise((resolve, reject) => {
        const transaction = database.transaction(['orders', 'statistics'], 'readwrite');
        
        transaction.objectStore('orders').clear();
        transaction.objectStore('statistics').clear();
        
        data.orders.forEach(order => {
            transaction.objectStore('orders').put(order);
        });
        
        if (data.statistics) {
            transaction.objectStore('statistics').put(data.statistics);
        }
        
        transaction.oncomplete = async () => {
            await updateStatistics();
            await updateBadge();
            await doubleBackup();
            resolve();
        };
        
        transaction.onerror = () => reject(transaction.error);
    });
}

// ============================================================
// === ОБРАБОТКА СООБЩЕНИЙ ===
// ============================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    if (request.type === 'SAVE_ORDER') {
        console.log('💾 Saving order locally:', request.data.order_number);
        
        saveOrderToDB(request.data)
            .then(() => {
                sendResponse({ success: true });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
    
    if (request.type === 'GET_STATS') {
        getStatistics()
            .then(stats => {
                sendResponse({ success: true, data: stats });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
    
    if (request.type === 'GET_ALL_ORDERS') {
        getAllOrders()
            .then(orders => {
                sendResponse({ success: true, data: orders });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
    
    if (request.type === 'GET_TODAY_ORDERS') {
        getTodaysOrders()
            .then(orders => {
                sendResponse({ success: true, data: orders });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
    
    if (request.type === 'EXPORT_DATA') {
        exportData()
            .then(data => {
                sendResponse({ success: true, data: data });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
    
    if (request.type === 'IMPORT_DATA') {
        try {
            const data = request.data;
            
            if (!data.orders || !Array.isArray(data.orders)) {
                throw new Error('Invalid data format');
            }
            
            importDataInternal(data)
                .then(() => {
                    sendResponse({ success: true });
                })
                .catch(error => {
                    sendResponse({ success: false, error: error.message });
                });
        } catch (error) {
            sendResponse({ success: false, error: error.message });
        }
        return true;
    }
    
    if (request.type === 'CLEAR_ALL_DATA') {
        clearAllData()
            .then(() => {
                sendResponse({ success: true });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
    
    if (request.type === 'UPDATE_API_URL') {
        API_URL = request.url;
        chrome.storage.sync.set({ apiUrl: request.url });
        console.log('📡 API URL updated:', API_URL);
        sendResponse({ success: true });
        return true;
    }
    
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
    
    if (request.type === 'OPEN_STATS') {
        chrome.tabs.create({ url: chrome.runtime.getURL('stats.html') });
        sendResponse({ success: true });
        return true;
    }
    
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
    
    if (request.type === 'SAVE_SETTINGS') {
        chrome.storage.sync.set(request.data, () => {
            if (request.data.apiUrl) {
                API_URL = request.data.apiUrl;
            }
            sendResponse({ success: true });
        });
        return true;
    }
    
    if (request.type === 'GET_BACKUP_INFO') {
        chrome.storage.local.get(['fixmod_backup_timestamp', 'fixmod_backup_count'], (result) => {
            sendResponse({
                timestamp: result.fixmod_backup_timestamp || null,
                count: result.fixmod_backup_count || 0
            });
        });
        return true;
    }
    
    if (request.type === 'FORCE_RESTORE') {
        restoreFromBackup()
            .then(result => {
                sendResponse({ success: result });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
    
    if (request.type === 'BACKUP_NOW') {
        doubleBackup()
            .then(() => {
                sendResponse({ success: true });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
    
    // ============================================================
    // === НОВЫЕ ОБРАБОТЧИКИ ДЛЯ ГЛОБАЛЬНОЙ ТЕМЫ ===
    // ============================================================
    
    if (request.type === 'GET_GLOBAL_THEME') {
        getGlobalTheme()
            .then(data => {
                sendResponse({ success: true, data: data });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
    
    if (request.type === 'SAVE_GLOBAL_THEME') {
        saveGlobalTheme(request.themeId)
            .then(() => {
                sendResponse({ success: true });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
    
    return false;
});

// ============================================================
// === ПЕРИОДИЧЕСКОЕ ОБНОВЛЕНИЕ ===
// ============================================================

// Обновление бейджа каждые 5 минут
setInterval(() => {
    updateBadge();
}, 300000);

// Проверка соединения каждые 15 секунд
setInterval(() => {
    checkServerConnection();
}, 15000);

// Бэкап раз в 6 часов (вместо 30 минут)
setInterval(async () => {
    console.log('🔄 Scheduled backup (every 6 hours)...');
    await doubleBackup();
}, 6 * 60 * 60 * 1000);

// Бэкап при закрытии браузера
chrome.runtime.onSuspend.addListener(async () => {
    console.log('🔄 Browser closing, creating backup...');
    await doubleBackup();
});

// ============================================================
// === СОБЫТИЯ УСТАНОВКИ ===
// ============================================================

chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('📦 FixMod installed/updated:', details.reason);
    
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
    
    if (details.reason === 'install') {
        await saveGlobalTheme('default');
    }
    
    const orders = await getAllOrders();
    
    if (orders.length === 0) {
        console.log('🔍 No data in DB, trying to restore...');
        const restored = await restoreFromBackup();
        
        if (restored) {
            console.log('✅ Data restored from backup!');
            await chrome.storage.local.set({ 'fixmod_restored': true });
        } else {
            console.log('ℹ️ No backup found, starting fresh');
            await updateStatistics();
        }
    } else {
        console.log('✅ Database already has', orders.length, 'orders');
    }
    
    await updateBadge();
    await checkServerConnection();
});

chrome.runtime.onStartup.addListener(async () => {
    console.log('🔄 FixMod started');
    await checkServerConnection();
    await updateBadge();
});

console.log('✅ FixMod Background ready');