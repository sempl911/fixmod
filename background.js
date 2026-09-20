// background.js - FixMod Service Worker

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
                store.createIndex('current_user', 'current_user', { unique: false });
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
                // === СУЩЕСТВУЮЩИЙ ЗАКАЗ ===
                
                if (existing.status !== orderData.status) hasChanges = true;
                if (existing.technician !== orderData.technician) hasChanges = true;
                if (existing.resolution !== orderData.resolution) hasChanges = true;
                
                // Проверка current_user
                if (existing.current_user !== orderData.current_user && orderData.current_user) {
                    console.log('👤 Обновляем current_user:', existing.current_user, '→', orderData.current_user);
                    hasChanges = true;
                }
                
                if (!existing.current_user && orderData.current_user && 
                    existing.technician === orderData.current_user) {
                    console.log('👤 Миграция: подставляем current_user');
                    hasChanges = true;
                }
                
                if (!existing.device_model && orderData.device_model) {
                    console.log('📱 Обновляем device_model');
                    hasChanges = true;
                }
                if (!existing.imei && orderData.imei) {
                    console.log('🔢 Обновляем imei');
                    hasChanges = true;
                }
                if (!existing.customer_email && orderData.customer_email) {
                    console.log('📧 Обновляем email');
                    hasChanges = true;
                }
                
                if (existing.device_model !== orderData.device_model && orderData.device_model) {
                    hasChanges = true;
                }
                if (existing.imei !== orderData.imei && orderData.imei) {
                    hasChanges = true;
                }
                
                // Проверка диагнозов
                const existingDiagCount = (existing.diagnoses || []).length;
                const newDiagCount = (orderData.diagnoses || []).length;
                if (newDiagCount > existingDiagCount) {
                    console.log('🔬 Обновляем diagnoses:', existingDiagCount, '→', newDiagCount);
                    hasChanges = true;
                }
                
                // Проверка резолюций
                const existingResCount = (existing.resolutions || []).length;
                const newResCount = (orderData.resolutions || []).length;
                if (newResCount > existingResCount) {
                    console.log('✅ Обновляем resolutions:', existingResCount, '→', newResCount);
                    hasChanges = true;
                }
                
                if (!hasChanges) {
                    console.log('ℹ️ Нет изменений для заказа:', orderData.order_number);
                    resolve(id);
                    return;
                }
                
                console.log('🔄 Обновляем заказ:', orderData.order_number);
                
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
                // === НОВЫЙ ЗАКАЗ ===
                console.log('🆕 Создаём заказ:', orderData.order_number, '| user:', orderData.current_user);
                
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
                resolve(id);
            };
            
            transaction.onerror = () => reject(transaction.error);
        };
        
        getRequest.onerror = () => reject(getRequest.error);
    });
}

// ============================================================
// === ОПРЕДЕЛЕНИЕ РАБОЧЕЙ ДАТЫ ЗАКАЗА ===
// ============================================================
//
// Приоритет:
// 1. Самая свежая резолюция (работа выполнена) 
// 2. Самый свежий диагноз (работа в процессе)
// 3. Самое свежее изменение статуса
// 4. last_status_change
// 5. created_at (крайний случай)
//
// ВАЖНО: берём САМУЮ СВЕЖУЮ дату, а не последний элемент в массиве
// (Fixably отдаёт данные в порядке "от свежего к старому",
//  но мы не зависим от порядка — сравниваем timestamps)
//
function getLatestDate(items) {
    if (!items || items.length === 0) return null;
    
    let latestDate = null;
    let latestTimestamp = 0;
    
    items.forEach(item => {
        if (item && item.date) {
            const ts = new Date(item.date).getTime();
            if (!isNaN(ts) && ts > latestTimestamp) {
                latestTimestamp = ts;
                latestDate = item.date;
            }
        }
    });
    
    return latestDate;
}

function getOrderWorkDate(order) {
    if (!order) return null;
    
    // 1. Резолюция — самая свежая (приоритет: работа выполнена)
    const latestResolution = getLatestDate(order.resolutions);
    if (latestResolution) return latestResolution;
    
    // 2. Диагноз — самый свежий (работа в процессе)
    const latestDiagnosis = getLatestDate(order.diagnoses);
    if (latestDiagnosis) return latestDiagnosis;
    
    // 3. Изменение статуса — самое свежее
    const latestStatusChange = getLatestDate(order.status_changes);
    if (latestStatusChange) return latestStatusChange;
    
    // 4. Изменение техника — самое свежее
    const latestHandlerChange = getLatestDate(order.handler_changes);
    if (latestHandlerChange) return latestHandlerChange;
    
    // 5. last_status_change
    if (order.last_status_change) return order.last_status_change;
    
    // 6. Крайний случай — created_at
    return order.created_at || null;
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
                
                // 👇 Используем РАБОЧУЮ ДАТУ (самую свежую из diagnoses/resolutions)
                const workDate = getOrderWorkDate(order);
                if (workDate) {
                    const month = workDate.substring(0, 7);
                    monthlyStats[month] = (monthlyStats[month] || 0) + 1;
                    
                    const day = workDate.substring(0, 10);
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
    
    // Используем рабочую дату
    return allOrders.filter(order => {
        const workDate = getOrderWorkDate(order);
        return workDate && workDate.slice(0, 10) === today;
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
        const blob = new Blob([json], { type: 'application/json' });
        const reader = new FileReader();
        
        return new Promise((resolve, reject) => {
            reader.onload = async function() {
                try {
                    const dataUrl = reader.result;
                    const dateStr = new Date().toISOString().slice(0, 10);
                    
                    await chrome.downloads.download({
                        url: dataUrl,
                        filename: `FixModDB/latest.json`,
                        saveAs: false,
                        conflictAction: 'overwrite'
                    });
                    
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
            } else {
                console.log('ℹ️ DB not empty, skipping storage restore');
            }
        } else {
            console.log('ℹ️ No backup in chrome.storage.local');
        }
        
        console.log('🔍 Trying folder backup...');
        
        const downloads = await new Promise((resolve) => {
            chrome.downloads.search({
                filenameRegex: 'FixModDB/latest\\.json$',
                state: 'complete',
                limit: 1
            }, resolve);
        });
        
        if (!downloads || downloads.length === 0) {
            console.log('ℹ️ No backup file found in FixModDB folder');
            return false;
        }
        
        const file = downloads[0];
        console.log('📁 Found backup file:', file.filename);
        
        let response;
        try {
            response = await fetch(file.url);
        } catch (fetchError) {
            console.warn('⚠️ Could not fetch backup file:', fetchError.message);
            return false;
        }
        
        if (!response.ok) {
            console.warn('⚠️ Backup file not accessible, status:', response.status);
            return false;
        }
        
        const text = await response.text();
        
        if (!text || text.trim() === '') {
            console.warn('⚠️ Backup file is EMPTY, skipping restore');
            return false;
        }
        
        let folderBackup;
        try {
            folderBackup = JSON.parse(text);
        } catch (parseError) {
            console.warn('⚠️ Backup file is CORRUPTED:', parseError.message);
            return false;
        }
        
        if (!folderBackup || !folderBackup.orders || !Array.isArray(folderBackup.orders)) {
            console.warn('⚠️ Backup file has invalid structure');
            return false;
        }
        
        if (folderBackup.orders.length === 0) {
            console.log('ℹ️ Backup file has 0 orders, skipping');
            return false;
        }
        
        console.log('📦 Found backup in FixModDB folder, orders:', folderBackup.orders.length);
        
        const existingOrders = await getAllOrders();
        if (existingOrders.length > 0) {
            console.log('ℹ️ DB already has', existingOrders.length, 'orders, skipping folder restore');
            return false;
        }
        
        await importDataInternal(folderBackup);
        console.log('✅ Restored from FixModDB folder');
        return true;
        
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
    }
});

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
// === ИМПОРТ ДАННЫХ ===
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
// === ПОЛУЧЕНИЕ ПУТИ ДЛЯ СКАЧИВАНИЯ ===
// ============================================================

function getDownloadPath() {
    return new Promise((resolve) => {
        chrome.storage.sync.get(['downloadPath'], (result) => {
            resolve(result.downloadPath || '');
        });
    });
}

// ============================================================
// === СКАЧИВАНИЕ ФОТО ===
// ============================================================

function getDirectImageUrl(url) {
    if (!url) return null;
    
    if (url.startsWith('http') && url.includes('amazonaws.com')) {
        return url;
    }
    
    const match = url.match(/key=([^&]+)/);
    if (match) {
        return `https://evy.fixably.com/en/files?key=${match[1]}&type=private`;
    }
    
    return url;
}

async function downloadPhoto(url, filename) {
    return new Promise(async (resolve, reject) => {
        const directUrl = getDirectImageUrl(url);
        if (!directUrl) {
            reject(new Error('Failed to get direct URL'));
            return;
        }
        
        try {
            new URL(directUrl);
        } catch (e) {
            reject(new Error('Invalid URL: ' + directUrl));
            return;
        }
        
        const downloadPath = await getDownloadPath();
        let filenameOnly = filename || 'photo.jpg';
        
        let useSaveAs = false;
        let fullPath = filenameOnly;
        
        if (downloadPath && downloadPath.trim()) {
            const cleanPath = downloadPath.replace(/\/+$/, '').replace(/\\+$/, '');
            
            const isAbsolute = cleanPath.startsWith('/') || /^[A-Za-z]:[\\/]/.test(cleanPath);
            const isDesktop = cleanPath.includes('Desktop') || cleanPath.includes('Рабочий стол');
            
            if (isAbsolute || isDesktop) {
                useSaveAs = true;
                fullPath = filenameOnly;
            } else {
                fullPath = `${cleanPath}/${filenameOnly}`;
            }
        }
        
        const downloadOptions = {
            url: directUrl,
            filename: fullPath,
            conflictAction: 'uniquify'
        };
        
        if (useSaveAs) {
            downloadOptions.saveAs = true;
        } else {
            downloadOptions.saveAs = false;
        }
        
        chrome.downloads.download(downloadOptions, (downloadId) => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve({ success: true, downloadId: downloadId, filename: fullPath });
            }
        });
    });
}

// ============================================================
// === ОБРАБОТКА СООБЩЕНИЙ ===
// ============================================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    
    if (request.type === 'SAVE_ORDER') {
        console.log('💾 Saving order locally:', request.data.order_number, '| user:', request.data.current_user);
        
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
            'apiUrl',
            'suggestionsEnabled',
            'widgetEnabled',
            'downloadPath'
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
    
    if (request.type === 'CHOOSE_FOLDER') {
        getDownloadPath().then(path => {
            sendResponse({ success: true, path: path });
        });
        return true;
    }
    
    if (request.type === 'DOWNLOAD_PHOTO') {
        downloadPhoto(request.url, request.filename)
            .then(result => {
                sendResponse({ success: true, data: result });
            })
            .catch(error => {
                sendResponse({ success: false, error: error.message });
            });
        return true;
    }
    
    if (request.type === 'DOWNLOAD_MULTIPLE_PHOTOS') {
        const photos = request.photos || [];
        const results = [];
        
        Promise.all(photos.map(async (photo, index) => {
            try {
                const filename = photo.filename || `photo_${index + 1}.jpg`;
                await downloadPhoto(photo.url, filename);
                results.push({ success: true, url: photo.url });
            } catch (error) {
                results.push({ success: false, url: photo.url, error: error.message });
            }
        }))
        .then(() => {
            sendResponse({ 
                success: true, 
                results: results,
                total: results.length,
                successful: results.filter(r => r.success).length
            });
        })
        .catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        
        return true;
    }
    
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

setInterval(() => {
    updateBadge();
}, 300000);

setInterval(() => {
    checkServerConnection();
}, 15000);

setInterval(async () => {
    console.log('🔄 Scheduled backup (every 2 hours)...');
    await doubleBackup();
}, 2 * 60 * 60 * 1000);

chrome.runtime.onSuspend.addListener(async () => {
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
        const restored = await restoreFromBackup();
        if (restored) {
            await chrome.storage.local.set({ 'fixmod_restored': true });
        } else {
            await updateStatistics();
        }
    }
    
    await updateBadge();
    await checkServerConnection();
});

chrome.runtime.onStartup.addListener(async () => {
    await checkServerConnection();
    await updateBadge();
});

console.log('✅ FixMod Background ready');