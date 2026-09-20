// content.js - FixMod (только логика сбора данных и сохранения)

console.log('🔧 FixMod Content Script Started');

// ============================================================
// ⚙️ НАСТРОЙКИ ЗАДЕРЖЕК (ЛЕГКО МЕНЯТЬ ЗДЕСЬ) ⚙️
// ============================================================

const DELAYS = {
    INIT_WIDGET: 2000,
    UPDATE_DATA_AFTER_LOAD: 1500,
    SAVE_ORDER: 3000,
    SETUP_MONITORING: 2000,
    WAIT_IMEI_START: 1000,
    URL_CHANGE: 1500,
    RETRY_EMAIL: 1000,
    RETRY_IMEI: 1000,
    RETRY_DEVICE: 1000,
    ACTION_DETECTED: 1500,
    ORDER_CHANGED: 500
};

// ============================================================
// === ПРОВЕРКА ЗАГРУЗКИ МОДУЛЕЙ ===
// ============================================================

console.log('📊 Проверка модулей:');
console.log('  ThemeManager:', typeof ThemeManager !== 'undefined' ? '✅' : '❌');
console.log('  SuggestionsManager:', typeof SuggestionsManager !== 'undefined' ? '✅' : '❌');
console.log('  FixModWidget:', typeof FixModWidget !== 'undefined' ? '✅' : '❌');

if (typeof SuggestionsManager !== 'undefined') {
    try {
        SuggestionsManager.init();
        console.log('💡 Подсказки инициализированы');
    } catch (e) {
        console.warn('⚠️ Ошибка инициализации подсказок:', e);
    }
} else {
    console.warn('⚠️ SuggestionsManager не загружен!');
}

// ============================================================
// === 👤 ОПРЕДЕЛЕНИЕ ТЕКУЩЕГО ПОЛЬЗОВАТЕЛЯ ===
// ============================================================

let currentUser = null;   // Имя залогиненного пользователя

/**
 * Получить имя залогиненного пользователя со страницы Fixably
 * Работает на любой странице: заказ, список заказов, главная
 */
function getCurrentUser() {
    // Способ 1: из навбара (самый надёжный)
    const userBold = document.querySelector('.mnu-user b');
    if (userBold) {
        // Клонируем чтобы не менять оригинал
        const clone = userBold.cloneNode(true);
        // Убираем иконки (стрелочки, значки)
        clone.querySelectorAll('i, svg').forEach(el => el.remove());
        const name = clone.textContent.trim();
        
        if (name && name.length > 1 && name.length < 50) {
            return name;
        }
    }
    
    // Fallback: из #user-options-dropdown
    const dropdown = document.querySelector('#user-options-dropdown b');
    if (dropdown) {
        const clone = dropdown.cloneNode(true);
        clone.querySelectorAll('i, svg').forEach(el => el.remove());
        const name = clone.textContent.trim();
        if (name && name.length > 1 && name.length < 50) {
            return name;
        }
    }
    
    return null;
}

/**
 * Обновить имя пользователя и сохранить в storage
 */
async function updateCurrentUser() {
    const user = getCurrentUser();
    
    if (!user) {
        console.log('⚠️ Не удалось определить пользователя');
        return null;
    }
    
    // Если имя изменилось — сохраняем
    if (user !== currentUser) {
        currentUser = user;
        console.log('👤 Текущий пользователь:', user);
        
        try {
            await chrome.storage.local.set({ 
                fixmod_current_user: user,
                fixmod_current_user_updated: new Date().toISOString()
            });
            console.log('💾 Имя пользователя сохранено в storage');
        } catch (e) {
            console.warn('⚠️ Не удалось сохранить имя пользователя:', e);
        }
    }
    
    return user;
}

// Загружаем имя сразу при старте
(async () => {
    const user = getCurrentUser();
    if (user) {
        currentUser = user;
        await chrome.storage.local.set({ 
            fixmod_current_user: user,
            fixmod_current_user_updated: new Date().toISOString()
        });
        console.log('👤 Пользователь при старте:', user);
    }
})();

// ============================================================
// === ХРАНЕНИЕ СОСТОЯНИЯ ===
// ============================================================

let lastOrderData = null;
let lastTechnician = null;
let lastStatus = null;
let lastStatusCode = null;
let lastImei = null;
let lastResolution = null;
let lastDeviceModel = null;
let isFirstLoad = true;
let emailRetryCount = 0;
let imeiRetryCount = 0;
let deviceRetryCount = 0;
let currentOrderNumber = null;
const MAX_RETRIES = 15;
const MAX_DEVICE_RETRIES = 20;

// ============================================================
// === ФУНКЦИИ ДЛЯ ПРОВЕРКИ СТРАНИЦЫ ===
// ============================================================

function isOrderPage() {
    const url = window.location.href;
    const orderMatch = url.match(/\/orders\/(\d+)/);
    if (orderMatch) {
        return true;
    }
    
    const orderHeader = document.querySelector('#order-header');
    const orderBody = document.querySelector('#order-body');
    const orderDevice = document.querySelector('#order-device');
    
    if (orderHeader || orderBody || orderDevice) {
        const orderNumber = getOrderNumber();
        if (orderNumber && orderNumber !== 'N/A') {
            return true;
        }
    }
    
    return false;
}

function isOrdersListPage() {
    const url = window.location.href;
    const listPatterns = [
        '/orders/me',
        '/orders/queue',
        '/orders/queueall',
        '/orders/incoming',
        '/orders/pickup',
        '/orders/ready',
        '/orders/batch',
        '/index/'
    ];
    
    for (let pattern of listPatterns) {
        if (url.includes(pattern)) {
            return true;
        }
    }
    
    if (!url.match(/\/orders\/(\d+)/) && !document.querySelector('#order-header')) {
        return true;
    }
    
    return false;
}

// ============================================================
// === ФУНКЦИИ ДЛЯ ПОЛУЧЕНИЯ ДАННЫХ ===
// ============================================================

function getOrderNumber() {
    const urlMatch = window.location.href.match(/\/orders\/(\d+)/);
    if (urlMatch) return urlMatch[1];
    
    const orderElem = document.querySelector('[data-pk]');
    if (orderElem && orderElem.getAttribute('data-pk')) {
        return orderElem.getAttribute('data-pk');
    }
    
    return 'N/A';
}

function getCustomerEmail() {
    if (!isOrderPage()) {
        return null;
    }
    
    const pageLabel = document.getElementById('page-label');
    if (pageLabel) {
        const text = pageLabel.textContent || '';
        const emailMatch = text.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
        if (emailMatch) return emailMatch[1];
    }
    
    const allText = document.body.textContent;
    const emailRegex = /\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g;
    const matches = allText.match(emailRegex);
    if (matches && matches.length > 0) {
        return matches[0];
    }
    
    const buttonsAndLinks = document.querySelectorAll('button, a, .btn, [role="button"]');
    for (let el of buttonsAndLinks) {
        const text = el.textContent.trim();
        if (text && text.includes('@') && text.length > 3 && text.length < 50) {
            const emailMatch = text.match(/\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/);
            if (emailMatch) return emailMatch[1];
        }
    }
    
    const emailElements = document.querySelectorAll('[data-field="email"], [data-name="email"], .field-email, .customer-email, [class*="email"]');
    for (let el of emailElements) {
        const email = el.textContent.trim();
        if (email && email.includes('@') && email.length > 3) {
            return email;
        }
    }
    
    const hiddenInputs = document.querySelectorAll('input[type="hidden"]');
    for (let input of hiddenInputs) {
        const value = input.value;
        if (value && value.includes('@') && value.length > 3) {
            return value;
        }
    }
    
    return null;
}

function getCurrentTechnician() {
    if (!isOrderPage()) {
        return null;
    }
    
    const techElement = document.querySelector('[data-name="handler"]');
    if (techElement) {
        const tech = techElement.textContent.trim();
        return tech && tech.length > 0 ? tech : null;
    }
    return null;
}

function getCurrentStatus() {
    if (!isOrderPage()) {
        return null;
    }
    
    const statusElement = document.querySelector('#status_editable');
    if (statusElement) {
        const status = statusElement.textContent.trim();
        return status && status.length > 0 ? status : null;
    }
    return null;
}

function getStatusCode(statusText) {
    if (!statusText) return null;
    const s = statusText.toLowerCase();
    if (s.includes('cancel')) return 'cancelled';
    if (s.includes('ready') || s.includes('pickup')) return 'ready';
    if (s.includes('queue')) return 'queue';
    if (s.includes('incoming')) return 'incoming';
    if (s.includes('withdraw')) return 'withdraw';
    if (s.includes('waiting')) return 'waiting';
    if (s.includes('shipped')) return 'shipped';
    return 'unknown';
}

function getOfferTitle() {
    if (!isOrderPage()) {
        return null;
    }
    
    const listItems = document.querySelectorAll('.list-group-item');
    for (let item of listItems) {
        const text = item.innerText;
        if (text.includes('Evy Offer Title')) {
            const valueDiv = item.querySelector('.order-right-field-col-2, .editable');
            if (valueDiv) {
                const value = valueDiv.innerText.trim();
                if (value && value !== 'No information' && !value.includes('Evy Offer Title')) {
                    return value;
                }
            }
        }
    }
    return null;
}

function getDeclinedReason() {
    if (!isOrderPage()) {
        return null;
    }
    
    const declinedElement = document.querySelector('#customfield_7');
    if (declinedElement && declinedElement.textContent) {
        const reason = declinedElement.textContent.trim();
        if (reason && reason !== 'No information') {
            return reason;
        }
    }
    return null;
}

function getDeviceName() {
    if (!isOrderPage()) {
        return 'FixMod Widget';
    }
    
    const deviceLink = document.querySelector('#order-device-panel .panel-heading a, #order-device .panel-heading a');
    if (deviceLink) {
        let fullText = deviceLink.textContent || deviceLink.innerText;
        fullText = fullText.trim().replace(/\s+/g, ' ').replace(/<i[^>]*>.*?<\/i>/g, '');
        return fullText || 'FixMod Widget';
    }
    return 'FixMod Widget';
}

function getIMEI() {
    if (!isOrderPage()) {
        return null;
    }
    
    const devicePanel = document.getElementById('order-device');
    if (devicePanel) {
        const panelText = devicePanel.innerText;
        let imeiMatch = panelText.match(/IMEI[:\s]+([0-9]{15,})/i);
        if (imeiMatch) return imeiMatch[1];
        imeiMatch = panelText.match(/\b([0-9]{15})\b/);
        if (imeiMatch) return imeiMatch[1];
    }
    
    const allTextElements = document.querySelectorAll('.editable, .order-right-field-col-2, .form-control-static, .dl-horizontal dd, .panel-body');
    for (let el of allTextElements) {
        const text = el.textContent || '';
        const match = text.match(/\b([0-9]{15})\b/);
        if (match) return match[1];
    }
    
    const bodyText = document.body.innerText;
    const imeiRegex = /\b([0-9]{15})\b/;
    const imeiMatch = bodyText.match(imeiRegex);
    if (imeiMatch) return imeiMatch[1];
    
    const imeiLooseRegex = /\b([0-9]{8,}[- ]?[0-9]{6,})\b/;
    const looseMatch = bodyText.match(imeiLooseRegex);
    if (looseMatch) {
        return looseMatch[1].replace(/[-\s]/g, '');
    }
    
    return null;
}

// ============================================================
// === ПАРСИНГ ДАТЫ ===
// ============================================================

function parseDateFromText(text) {
    const dateMatch = text.match(/(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+(\d{1,2})\s+(\w+)\s+(\d{4})/i);
    if (dateMatch) {
        const day = parseInt(dateMatch[2]);
        const month = getMonthNumber(dateMatch[3]);
        const year = parseInt(dateMatch[4]);
        return new Date(year, month, day);
    }
    return null;
}

function getMonthNumber(monthName) {
    const months = {
        'january': 0, 'jan': 0,
        'february': 1, 'feb': 1,
        'march': 2, 'mar': 2,
        'april': 3, 'apr': 3,
        'may': 4,
        'june': 5, 'jun': 5,
        'july': 6, 'jul': 6,
        'august': 7, 'aug': 7,
        'september': 8, 'sep': 8,
        'october': 9, 'oct': 9,
        'november': 10, 'nov': 10,
        'december': 11, 'dec': 11
    };
    return months[monthName.toLowerCase()] || 0;
}

// ============================================================
// === ТАЙМЛАЙН ===
// ============================================================

async function getTimelineData() {
    console.log('📡 Загрузка таймлайна...');
    
    if (!isOrderPage()) {
        return null;
    }
    
    const timelineContainer = document.querySelector("#order-timeline");
    if (!timelineContainer) {
        return null;
    }

    const url = timelineContainer.dataset.href;
    if (!url) {
        return null;
    }

    try {
        const response = await fetch(url, {
            credentials: 'include',
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });

        if (!response.ok) {
            return null;
        }

        const html = await response.text();
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');

        const result = {
            statusChanges: [],
            handlerChanges: [],
            diagnoses: [],
            resolutions: []
        };

        const panels = doc.querySelectorAll('.timeline-panel');
        console.log(`📦 Найдено панелей: ${panels.length}`);

        panels.forEach((panel) => {
            const fullText = panel.innerText || panel.textContent || '';
            const timeEl = panel.querySelector('.timeline-time');
            const timeText = timeEl ? timeEl.textContent.trim() : null;

            let eventDate = null;
            if (fullText) {
                eventDate = parseDateFromText(fullText);
            }

            let fullDate = null;
            if (eventDate) {
                if (timeText) {
                    const timeMatch = timeText.match(/(\d{1,2}):(\d{2})/);
                    if (timeMatch) {
                        let hours = parseInt(timeMatch[1]);
                        const minutes = parseInt(timeMatch[2]);
                        if (hours < 6) hours += 12;
                        eventDate.setHours(hours, minutes, 0, 0);
                    }
                }
                fullDate = eventDate.toISOString();
            }

            if (fullText.includes('Status was set to')) {
                const match = fullText.match(/Status was set to "([^"]+)"/);
                if (match) {
                    result.statusChanges.push({
                        new_status: match[1],
                        time: timeText,
                        date: fullDate
                    });
                }
            }
            else if (fullText.includes('Handler was set to')) {
                const match = fullText.match(/Handler was set to "([^"]+)"/);
                if (match) {
                    result.handlerChanges.push({
                        handler: match[1],
                        time: timeText,
                        date: fullDate
                    });
                }
            }
            else if (fullText.includes('Handler was removed')) {
                result.handlerChanges.push({
                    handler: 'REMOVED',
                    time: timeText,
                    date: fullDate
                });
            }
            else if (fullText.includes('Diagnosis')) {
                const content = panel.querySelector('.content-container.toggle-full-content');
                let text = null;
                if (content) {
                    const p = content.querySelector('p');
                    if (p) text = p.textContent.trim();
                }
                if (!text) {
                    const lines = fullText.split('\n');
                    for (let line of lines) {
                        const trimmed = line.trim();
                        if (trimmed && trimmed.length > 10 && 
                            !trimmed.includes('Diagnosis') && 
                            !trimmed.includes('Toggle Dropdown') &&
                            !trimmed.includes('API')) {
                            text = trimmed;
                            break;
                        }
                    }
                }
                if (text && text.length > 5) {
                    result.diagnoses.push({
                        text: text,
                        time: timeText,
                        date: fullDate
                    });
                }
            }
            else if (fullText.includes('Resolution')) {
                const content = panel.querySelector('.content-container.toggle-full-content');
                let text = null;
                if (content) {
                    const p = content.querySelector('p');
                    if (p) text = p.textContent.trim();
                }
                if (!text) {
                    const lines = fullText.split('\n');
                    for (let line of lines) {
                        const trimmed = line.trim();
                        if (trimmed && trimmed.length > 10 && 
                            !trimmed.includes('Resolution') && 
                            !trimmed.includes('Toggle Dropdown') &&
                            !trimmed.includes('API')) {
                            text = trimmed;
                            break;
                        }
                    }
                }
                if (text && text.length > 5) {
                    result.resolutions.push({
                        text: text,
                        time: timeText,
                        date: fullDate
                    });
                }
            }
        });

        return result;

    } catch (error) {
        console.warn('⚠️ Ошибка при загрузке таймлайна:', error);
        return null;
    }
}

// ============================================================
// === RESOLUTION ===
// ============================================================

function getResolution() {
    // console.log('🔍 Searching for diagnosis text...');
    
    if (!isOrderPage()) {
        return null;
    }
    
    const timelinePanels = document.querySelectorAll('.timeline-panel');
    let foundResolutions = [];
    
    for (let panel of timelinePanels) {
        const text = panel.innerText || panel.textContent || '';
        
        if (text.includes('Diagnosis') || text.includes('Resolution')) {
            const contentContainer = panel.querySelector('.content-container.toggle-full-content');
            if (contentContainer) {
                const p = contentContainer.querySelector('p');
                if (p) {
                    const diagnosisText = p.innerText || p.textContent || '';
                    const trimmed = diagnosisText.trim();
                    
                    if (trimmed && trimmed.length > 5 && 
                        !trimmed.includes('Order created') &&
                        !trimmed.includes('No information') &&
                        !trimmed.includes('You canceled') &&
                        !trimmed.includes('canceled this order') &&
                        !trimmed.includes('Please select the reason') &&
                        !trimmed.includes('Status:') &&
                        !trimmed.includes('Technician:') &&
                        !trimmed.includes('Visual inspection') &&
                        !trimmed.includes('Reported problems') &&
                        !trimmed.includes('Battery malfunction')) {
                        
                        let type = 'unknown';
                        if (text.includes('Resolution')) {
                            type = 'resolution';
                        } else if (text.includes('Diagnosis')) {
                            type = 'diagnosis';
                        }
                        
                        foundResolutions.push({
                            type: type,
                            text: trimmed,
                            panel: panel,
                            timestamp: panel.querySelector('.timeline-time')?.innerText || ''
                        });
                    }
                }
            }
            
            if (!foundResolutions.length || foundResolutions[foundResolutions.length - 1].text === '') {
                const container = panel.querySelector('.content-container.toggle-full-content');
                if (container) {
                    const containerText = container.innerText || container.textContent || '';
                    const trimmed = containerText.trim();
                    
                    if (trimmed && trimmed.length > 10 && 
                        !trimmed.includes('Diagnosis') &&
                        !trimmed.includes('Diagnostic') &&
                        !trimmed.includes('Order created') &&
                        !trimmed.includes('No information') &&
                        !trimmed.includes('You canceled') &&
                        !trimmed.includes('canceled this order') &&
                        !trimmed.includes('Please select the reason') &&
                        !trimmed.includes('Visual inspection') &&
                        !trimmed.includes('Reported problems') &&
                        !trimmed.includes('Battery malfunction')) {
                        
                        let type = 'unknown';
                        if (text.includes('Resolution')) {
                            type = 'resolution';
                        } else if (text.includes('Diagnosis')) {
                            type = 'diagnosis';
                        }
                        
                        foundResolutions.push({
                            type: type,
                            text: trimmed,
                            panel: panel,
                            timestamp: panel.querySelector('.timeline-time')?.innerText || ''
                        });
                    }
                }
            }
        }
    }
    
    let bestMatch = null;
    
    for (let item of foundResolutions) {
        if (item.type === 'resolution') {
            bestMatch = item;
            break;
        }
    }
    
    if (!bestMatch && foundResolutions.length > 0) {
        bestMatch = foundResolutions[foundResolutions.length - 1];
    }
    
    if (bestMatch) {
        // console.log(`✅ ${bestMatch.type} found:`, bestMatch.text);
        return bestMatch.text;
    }
    
    const allElements = document.querySelectorAll('.content-container.toggle-full-content');
    for (let el of allElements) {
        const text = el.innerText || el.textContent || '';
        const trimmed = text.trim();
        
        if (trimmed && trimmed.length > 10 && 
            !trimmed.includes('Order created') &&
            !trimmed.includes('No information') &&
            !trimmed.includes('You canceled') &&
            !trimmed.includes('canceled this order') &&
            !trimmed.includes('Please select the reason') &&
            !trimmed.includes('Visual inspection') &&
            !trimmed.includes('Reported problems') &&
            !trimmed.includes('Battery malfunction') &&
            !trimmed.includes('Status:') &&
            !trimmed.includes('Technician:')) {
            return trimmed;
        }
    }
    
    return null;
}

// ============================================================
// === СБОР ДАННЫХ ===
// ============================================================

async function collectOrderData() {
    const data = {
        order_number: null,
        status: null,
        status_code: null,
        technician: null,
        technician_id: null,
        current_user: null,        // 👈 НОВОЕ: имя залогиненного
        customer: null,
        customer_id: null,
        customer_email: null,
        device_model: null,
        imei: null,
        notes: null,
        resolution: null,
        declined_reason: null,
        status_changes: [],
        handler_changes: [],
        diagnoses: [],
        resolutions: [],
        raw_data: {}
    };

    const orderNumber = getOrderNumber();
    if (orderNumber && orderNumber !== 'N/A') {
        data.order_number = orderNumber;
    }

    const status = getCurrentStatus();
    if (status) {
        data.status = status;
        data.status_code = getStatusCode(status);
    }

    const technician = getCurrentTechnician();
    if (technician) {
        data.technician = technician;
    }

    // 👇 ТЕКУЩИЙ ПОЛЬЗОВАТЕЛЬ (кто работает в системе)
    const user = currentUser || getCurrentUser();
    if (user) {
        data.current_user = user;
        // Сохраняем в storage на всякий случай
        chrome.storage.local.set({ fixmod_current_user: user });
    }

    const deviceName = getDeviceName();
    if (deviceName && deviceName !== 'FixMod Widget') {
        data.device_model = deviceName;
    }

    const imei = getIMEI();
    if (imei && imei !== 'N/A') {
        data.imei = imei;
    }

    const customerEmail = getCustomerEmail();
    if (customerEmail) {
        data.customer_email = customerEmail;
    }

    const offerTitle = getOfferTitle();
    if (offerTitle && offerTitle !== 'N/A') {
        data.notes = `Offer: ${offerTitle}`;
    }

    const declinedReason = getDeclinedReason();
    if (declinedReason) {
        data.declined_reason = declinedReason;
    }

    const timelineData = await getTimelineData();
    if (timelineData) {
        data.status_changes = timelineData.statusChanges || [];
        data.handler_changes = timelineData.handlerChanges || [];
        data.diagnoses = timelineData.diagnoses || [];
        data.resolutions = timelineData.resolutions || [];
        
        if (data.resolutions.length > 0) {
            const lastResolution = data.resolutions[data.resolutions.length - 1];
            data.resolution = lastResolution.text;
        }
    }

    if (!data.resolution) {
        const resolution = getResolution();
        if (resolution) {
            data.resolution = resolution;
        }
    }

    data.raw_data = {
        url: window.location.href,
        title: document.title,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent
    };

    return data;
}

// ============================================================
// === ПРОВЕРКА ИЗМЕНЕНИЙ ===
// ============================================================

function hasTechnician() {
    const tech = getCurrentTechnician();
    return tech && tech.length > 0 && tech !== 'No information';
}

function hasStatusChanged() {
    const currentStatus = getCurrentStatus();
    return currentStatus !== lastStatus;
}

function hasTechnicianChanged() {
    const currentTech = getCurrentTechnician();
    return currentTech !== lastTechnician;
}

function hasImeiChanged() {
    const currentImei = getIMEI();
    return currentImei && currentImei !== 'N/A' && currentImei !== lastImei;
}

function hasResolutionChanged() {
    const currentResolution = getResolution();
    return currentResolution !== lastResolution;
}

function hasDeviceChanged() {
    const currentDevice = getDeviceName();
    return currentDevice && 
           currentDevice !== 'FixMod Widget' && 
           currentDevice !== lastDeviceModel;
}

function shouldSaveData(currentData) {
    if (!hasTechnician()) {
        console.log('ℹ️ No technician assigned, skipping save');
        return false;
    }

    if (!currentData.order_number || currentData.order_number === 'N/A') {
        console.log('ℹ️ No order number, skipping save');
        return false;
    }

    if (isFirstLoad) {
        console.log('📦 First load, saving initial data');
        isFirstLoad = false;
        return true;
    }

    if (hasDeviceChanged()) {
        const currentDevice = getDeviceName();
        console.log('📱 Device model appeared/changed:', currentDevice);
        lastDeviceModel = currentDevice;
        return true;
    }

    const currentResolution = getResolution();
    if (currentResolution && currentResolution !== lastResolution) {
        console.log('🔄 Resolution changed, saving update');
        lastResolution = currentResolution;
        return true;
    }

    if (currentResolution && !lastResolution) {
        console.log('📝 New resolution found, saving update');
        lastResolution = currentResolution;
        return true;
    }

    if (hasStatusChanged()) {
        console.log('🔄 Status changed, saving update');
        return true;
    }

    if (hasTechnicianChanged()) {
        console.log('🔄 Technician changed, saving update');
        return true;
    }

    if (hasImeiChanged()) {
        console.log('🔄 IMEI changed, saving update');
        return true;
    }

    console.log('ℹ️ No changes detected, skipping save');
    return false;
}

// ============================================================
// === УВЕДОМЛЕНИЯ ===
// ============================================================

function showNotification(message, type = 'success') {
    const colors = {
        success: '#34c759',
        warning: '#ff9500',
        error: '#ff3b30',
        info: '#007aff'
    };
    
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${colors[type] || '#34c759'};
        color: white;
        padding: 12px 20px;
        border-radius: 10px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        font-weight: 500;
        z-index: 999999;
        box-shadow: 0 4px 16px rgba(0,0,0,0.15);
        animation: slideInRight 0.3s ease;
        max-width: 350px;
        pointer-events: none;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    if (!document.getElementById('fixmod-notification-styles')) {
        const style = document.createElement('style');
        style.id = 'fixmod-notification-styles';
        style.textContent = `
            @keyframes slideInRight {
                from { transform: translateX(100px); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
            @keyframes fadeOut {
                from { opacity: 1; }
                to { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }

    setTimeout(() => {
        notification.style.animation = 'fadeOut 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// ============================================================
// === СОХРАНЕНИЕ ===
// ============================================================

async function saveOrderLocally() {
    const currentData = await collectOrderData();
    
    console.log('💾 Попытка сохранения:', {
        order_number: currentData.order_number,
        device_model: currentData.device_model,
        imei: currentData.imei,
        technician: currentData.technician,
        current_user: currentData.current_user,
        has_technician: hasTechnician()
    });
    
    if (!shouldSaveData(currentData)) {
        return null;
    }

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'SAVE_ORDER',
            data: currentData
        });
        
        if (response && response.success) {
            console.log('✅ Order saved locally:', currentData.order_number, '| user:', currentData.current_user);
            
            lastOrderData = currentData;
            lastStatus = getCurrentStatus();
            lastTechnician = getCurrentTechnician();
            lastImei = getIMEI();
            lastDeviceModel = currentData.device_model;
            lastStatusCode = getStatusCode(lastStatus);
            lastResolution = currentData.resolution;
            
            showNotification(`Order ${currentData.order_number} saved 💾`, 'success');
            return response.data;
        } else {
            console.warn('⚠️ Failed to save order:', response?.error);
            showNotification('Error saving order', 'error');
            return null;
        }
        
    } catch (error) {
        console.error('❌ Error saving order:', error);
        showNotification('Error saving order', 'error');
        return null;
    }
}

// ============================================================
// === МОНИТОРИНГ ИЗМЕНЕНИЙ ===
// ============================================================

function setupResolutionMonitoring() {
    console.log('🔍 Setting up Resolution monitoring...');
    
    if (!isOrderPage()) {
        return;
    }
    
    const timelineObserver = new MutationObserver(() => {
        const currentResolution = getResolution();
        if (currentResolution && currentResolution !== lastResolution) {
            console.log('🔄 Resolution changed in timeline:', currentResolution);
            lastResolution = currentResolution;
            saveOrderLocally();
        }
    });
    
    timelineObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    const diagText = document.getElementById('diagnosticText');
    if (diagText) {
        diagText.addEventListener('change', () => {
            const currentResolution = getResolution();
            if (currentResolution && currentResolution !== lastResolution) {
                console.log('🔄 Resolution changed in diagnostic:', currentResolution);
                lastResolution = currentResolution;
                saveOrderLocally();
            }
        });
    }
}

// ============================================================
// === ПОВТОРНЫЙ ПОИСК ===
// ============================================================

function retryEmailSearch() {
    if (!isOrderPage()) {
        return;
    }
    
    if (emailRetryCount >= MAX_RETRIES) {
        console.log('❌ Email not found after', MAX_RETRIES, 'retries');
        return;
    }
    
    emailRetryCount++;
    
    const email = getCustomerEmail();
    const emailSpan = document.getElementById('customer-email');
    
    if (email && emailSpan) {
        console.log('✅ Email found on retry:', email);
        emailSpan.textContent = email;
        emailRetryCount = 0;
        return;
    }
    
    setTimeout(retryEmailSearch, 500);
}

function retryIMEISearch() {
    if (!isOrderPage()) {
        return;
    }
    
    if (imeiRetryCount >= MAX_RETRIES) {
        console.log('❌ IMEI not found after', MAX_RETRIES, 'retries');
        imeiRetryCount = 0;
        return;
    }
    
    imeiRetryCount++;
    
    const imei = getIMEI();
    const imeiSpan = document.getElementById('imei');
    
    if (imei && imeiSpan) {
        console.log('✅ IMEI found on retry:', imei);
        imeiSpan.textContent = imei;
        imeiRetryCount = 0;
        return;
    }
    
    setTimeout(retryIMEISearch, 500);
}

function retryDeviceSearch() {
    if (!isOrderPage()) {
        return;
    }
    
    if (deviceRetryCount >= MAX_DEVICE_RETRIES) {
        console.log('❌ Device model not found after', MAX_DEVICE_RETRIES, 'retries');
        deviceRetryCount = 0;
        return;
    }
    
    deviceRetryCount++;
    
    const deviceName = getDeviceName();
    const headerTitle = document.getElementById('widget-header-title');
    
    if (deviceName && deviceName !== 'FixMod Widget') {
        console.log('✅ Device model found on retry:', deviceName);
        
        if (headerTitle) {
            headerTitle.textContent = deviceName;
        }
        
        saveOrderLocally();
        
        deviceRetryCount = 0;
        return;
    }
    
    setTimeout(retryDeviceSearch, 500);
}

// ============================================================
// === СБРОС ДАННЫХ ===
// ============================================================

function resetWidgetData() {
    console.log('🔄 Resetting widget data for non-order page');
    
    const soSpan = document.getElementById('order-number');
    const insSpan = document.getElementById('insurance-type');
    const imeiSpan = document.getElementById('imei');
    const emailSpan = document.getElementById('customer-email');
    const headerTitle = document.getElementById('widget-header-title');
    
    if (soSpan) soSpan.textContent = 'N/A';
    if (insSpan) insSpan.textContent = 'N/A';
    if (imeiSpan) imeiSpan.textContent = 'N/A';
    if (emailSpan) emailSpan.textContent = 'N/A';
    if (headerTitle) headerTitle.textContent = 'FixMod Widget';
    
    emailRetryCount = 0;
    imeiRetryCount = 0;
    deviceRetryCount = 0;
}

// ============================================================
// === ОБНОВЛЕНИЕ ДАННЫХ ===
// ============================================================

function updateAllData() {
    if (!isOrderPage()) {
        resetWidgetData();
        if (window.FixModWidget) {
            window.FixModWidget.updateQRCode();
        }
        console.log('📋 On orders list page - data reset to N/A');
        return;
    }
    
    const orderNumber = getOrderNumber();
    const offerTitle = getOfferTitle();
    const deviceName = getDeviceName();
    
    // Обновляем имя пользователя
    updateCurrentUser();
    
    const headerTitle = document.getElementById('widget-header-title');
    if (deviceName && deviceName !== 'FixMod Widget') {
        console.log('📱 Модель найдена:', deviceName);
        if (headerTitle) headerTitle.textContent = deviceName;
        deviceRetryCount = 0;
    } else {
        console.log('⏳ Модель ещё не загружена, запускаем повторный поиск');
        deviceRetryCount = 0;
        setTimeout(retryDeviceSearch, DELAYS.RETRY_DEVICE);
    }
    
    const imeiSpan = document.getElementById('imei');
    if (imeiSpan) {
        imeiSpan.textContent = 'N/A';
    }
    
    const imei = getIMEI();
    if (imei && imeiSpan) {
        console.log('📱 IMEI found:', imei);
        imeiSpan.textContent = imei;
        imeiRetryCount = 0;
    } else if (imeiSpan) {
        imeiRetryCount = 0;
        setTimeout(retryIMEISearch, DELAYS.RETRY_IMEI);
    }
    
    const soSpan = document.getElementById('order-number');
    const insSpan = document.getElementById('insurance-type');
    const emailSpan = document.getElementById('customer-email');
    
    if (soSpan) soSpan.textContent = orderNumber;
    if (insSpan) insSpan.textContent = offerTitle || 'N/A';
    
    if (emailSpan) {
        const customerEmail = getCustomerEmail();
        if (customerEmail) {
            emailSpan.textContent = customerEmail;
            emailRetryCount = 0;
        } else {
            emailSpan.textContent = 'N/A';
            emailRetryCount = 0;
            setTimeout(retryEmailSearch, DELAYS.RETRY_EMAIL);
        }
    }
    
    if (window.FixModWidget) {
        window.FixModWidget.updateQRCode();
    }
    
    console.log('=== Данные обновлены ===');
    console.log('SO:', orderNumber);
    console.log('User:', currentUser);
    
    saveOrderLocally();
}

// ============================================================
// === DOM НАБЛЮДАТЕЛЬ ===
// ============================================================

function setupDOMObserver() {
    const domObserver = new MutationObserver(() => {
        const currentOrder = getOrderNumber();
        if (currentOrder && currentOrder !== currentOrderNumber) {
            currentOrderNumber = currentOrder;
            console.log('🔄 Order changed, refreshing data...');
            const imeiSpan = document.getElementById('imei');
            if (imeiSpan) {
                imeiSpan.textContent = 'N/A';
            }
            imeiRetryCount = 0;
            setTimeout(() => {
                updateAllData();
            }, DELAYS.ORDER_CHANGED);
        }
        
        const imeiSpan = document.getElementById('imei');
        if (imeiSpan && imeiSpan.textContent === 'N/A' && isOrderPage()) {
            const imei = getIMEI();
            if (imei) {
                console.log('📱 IMEI found via observer:', imei);
                imeiSpan.textContent = imei;
                imeiRetryCount = 0;
            }
        }
        
        const emailSpan = document.getElementById('customer-email');
        if (emailSpan && emailSpan.textContent === 'N/A' && isOrderPage()) {
            const email = getCustomerEmail();
            if (email) {
                console.log('📧 Email found via observer:', email);
                emailSpan.textContent = email;
                emailRetryCount = 0;
            }
        }
        
        const headerTitle = document.getElementById('widget-header-title');
        if (headerTitle && headerTitle.textContent === 'FixMod Widget' && isOrderPage()) {
            const deviceName = getDeviceName();
            if (deviceName && deviceName !== 'FixMod Widget') {
                console.log('📱 Device model found via observer:', deviceName);
                headerTitle.textContent = deviceName;
                deviceRetryCount = 0;
            }
        }
    });
    
    domObserver.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
        attributes: true
    });
    
    return domObserver;
}

// ============================================================
// === ОЖИДАНИЕ IMEI ===
// ============================================================

function waitForIMEI() {
    let attempts = 0;
    const maxAttempts = 20;
    
    if (!isOrderPage()) {
        return;
    }
    
    const checkInterval = setInterval(() => {
        const imei = getIMEI();
        if (imei && imei !== 'N/A') {
            console.log('IMEI найден:', imei);
            const imeiSpan = document.getElementById('imei');
            if (imeiSpan) {
                imeiSpan.textContent = imei;
                imeiRetryCount = 0;
            }
            clearInterval(checkInterval);
            saveOrderLocally();
        } else if (attempts >= maxAttempts) {
            clearInterval(checkInterval);
        }
        attempts++;
    }, 500);
}

// ============================================================
// === ОТСЛЕЖИВАНИЕ СМЕНЫ URL ===
// ============================================================

let lastUrl = location.href;

function checkForUrlChange() {
    const currentUrl = location.href;
    if (currentUrl !== lastUrl) {
        lastUrl = currentUrl;
        isFirstLoad = true;
        lastStatus = null;
        lastTechnician = null;
        lastImei = null;
        lastResolution = null;
        lastDeviceModel = null;
        currentOrderNumber = null;
        
        // Обновляем пользователя при смене URL
        updateCurrentUser();
        
        setTimeout(() => {
            if (window.FixModWidget && window.FixModWidget.getElement()) {
                if (!isOrderPage()) {
                    resetWidgetData();
                    console.log('📋 On orders list page - data reset to N/A');
                } else {
                    const imeiSpan = document.getElementById('imei');
                    if (imeiSpan) {
                        imeiSpan.textContent = 'N/A';
                    }
                    imeiRetryCount = 0;
                    updateAllData();
                    waitForIMEI();
                    setupResolutionMonitoring();
                }
            }
        }, DELAYS.URL_CHANGE);
    }
}

// ============================================================
// === ЗАПУСК ===
// ============================================================

if (!window.location.href.includes('evy.fixably.com')) {
    console.log('Расширение активно только на evy.fixably.com');
} else {
    
    function initWidget() {
        if (window.FixModWidget) {
            const orderNumber = getOrderNumber();
            const offerTitle = getOfferTitle();
            const deviceName = getDeviceName();
            const imei = getIMEI();
            const email = getCustomerEmail();
            const isOrder = isOrderPage();
            
            window.FixModWidget.create(orderNumber, offerTitle, deviceName, email, imei, isOrder);
            
            setupDOMObserver();
            
            setTimeout(() => {
                setupResolutionMonitoring();
            }, DELAYS.SETUP_MONITORING);
            
            setTimeout(() => {
                const deviceName = getDeviceName();
                if (deviceName && deviceName !== 'FixMod Widget') {
                    console.log('📱 Модель готова, сохраняем:', deviceName);
                    saveOrderLocally();
                } else {
                    console.log('⏳ Модель ещё не загружена, ждём...');
                    deviceRetryCount = 0;
                    setTimeout(retryDeviceSearch, DELAYS.RETRY_DEVICE);
                }
            }, DELAYS.SAVE_ORDER);
            
            document.addEventListener('click', function(e) {
                const target = e.target;
                if (target && (
                    target.closest('.btn') ||
                    target.closest('button') ||
                    target.closest('[data-action-post]') ||
                    target.closest('[data-nav]') ||
                    target.closest('[data-inline]')
                )) {
                    setTimeout(() => {
                        console.log('🔄 Action detected, refreshing data...');
                        const imeiSpan = document.getElementById('imei');
                        if (imeiSpan) {
                            imeiSpan.textContent = 'N/A';
                        }
                        imeiRetryCount = 0;
                        updateAllData();
                    }, DELAYS.ACTION_DETECTED);
                }
            });
        } else {
            console.warn('⚠️ FixModWidget not loaded');
        }
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(waitForIMEI, DELAYS.WAIT_IMEI_START);
            setTimeout(() => {
                const headerTitle = document.getElementById('widget-header-title');
                if (headerTitle) headerTitle.textContent = getDeviceName();
                if (!isOrderPage()) {
                    resetWidgetData();
                }
            }, DELAYS.UPDATE_DATA_AFTER_LOAD);
            setTimeout(initWidget, DELAYS.INIT_WIDGET);
        });
    } else {
        setTimeout(waitForIMEI, DELAYS.WAIT_IMEI_START);
        setTimeout(() => {
            const headerTitle = document.getElementById('widget-header-title');
            if (headerTitle) headerTitle.textContent = getDeviceName();
            if (!isOrderPage()) {
                resetWidgetData();
            }
        }, DELAYS.UPDATE_DATA_AFTER_LOAD);
        setTimeout(initWidget, DELAYS.INIT_WIDGET);
    }
    
    const observer = new MutationObserver(() => checkForUrlChange());
    observer.observe(document.body, { childList: true, subtree: true });
    
    window.refreshWidgetData = updateAllData;
    console.log('✅ Виджет FixMod готов. Пользователь:', currentUser || 'не определён');
}