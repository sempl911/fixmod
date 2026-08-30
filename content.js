// content.js - FixMod Widget with Local Storage

// ============================================================
// === НАСТРОЙКИ ===
// ============================================================

// ============================================================
// === ХРАНЕНИЕ СОСТОЯНИЯ ДЛЯ ОТСЛЕЖИВАНИЯ ИЗМЕНЕНИЙ ===
// ============================================================

let lastOrderData = null;
let lastTechnician = null;
let lastStatus = null;
let lastStatusCode = null;
let lastImei = null;
let lastResolution = null;
let isFirstLoad = true;
let emailRetryCount = 0;
let imeiRetryCount = 0;
let currentOrderNumber = null;
const MAX_RETRIES = 15;

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
// === ФУНКЦИИ ДЛЯ ПАРСИНГА ДАТЫ ===
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
// === ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ ДАННЫХ ИЗ ТАЙМЛАЙНА ===
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
// === ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ RESOLUTION (ДИАГНОЗА) ===
// ============================================================

function getResolution() {
    console.log('🔍 Searching for diagnosis text...');
    
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
        console.log(`✅ ${bestMatch.type} found:`, bestMatch.text);
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
            console.log('✅ Diagnosis found (fallback):', trimmed);
            return trimmed;
        }
    }
    
    console.log('⚠️ No diagnosis found on page');
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
// === ЛОКАЛЬНОЕ СОХРАНЕНИЕ (вместо отправки на сервер) ===
// ============================================================

async function saveOrderLocally() {
    const currentData = await collectOrderData();
    
    if (!shouldSaveData(currentData)) {
        return null;
    }

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'SAVE_ORDER',
            data: currentData
        });
        
        if (response && response.success) {
            console.log('✅ Order saved locally:', currentData.order_number);
            
            lastOrderData = currentData;
            lastStatus = getCurrentStatus();
            lastTechnician = getCurrentTechnician();
            lastImei = getIMEI();
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
// === ФУНКЦИИ ДЛЯ ПОВТОРНОГО ПОИСКА ===
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
    console.log(`🔄 Retrying email search (${emailRetryCount}/${MAX_RETRIES})...`);
    
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
    console.log(`🔄 Retrying IMEI search (${imeiRetryCount}/${MAX_RETRIES})...`);
    
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

// ============================================================
// === ФУНКЦИЯ ДЛЯ СБРОСА ДАННЫХ ===
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
}

// ============================================================
// === ВЕСЬ ОСТАЛЬНОЙ КОД ВИДЖЕТА (НЕ ИЗМЕНЯЕТСЯ) ===
// ============================================================

if (!window.location.href.includes('evy.fixably.com')) {
    console.log('Расширение активно только на evy.fixably.com');
} else {
    
    function copyToClipboard(text, fieldName) {
        if (!text || text === 'N/A') {
            alert(`Нет данных для копирования (${fieldName})`);
            return;
        }
        
        navigator.clipboard.writeText(text).then(() => {
            const notification = document.createElement('div');
            notification.textContent = `📋 ${fieldName}: ${text} скопировано!`;
            notification.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #4CAF50;
                color: white;
                padding: 10px 16px;
                border-radius: 8px;
                font-size: 13px;
                z-index: 100000;
                animation: fadeOut 2s ease forwards;
                font-family: monospace;
            `;
            document.body.appendChild(notification);
            
            const style = document.createElement('style');
            style.textContent = `
                @keyframes fadeOut {
                    0% { opacity: 1; transform: translateY(0); }
                    70% { opacity: 1; transform: translateY(0); }
                    100% { opacity: 0; transform: translateY(-20px); visibility: hidden; }
                }
            `;
            document.head.appendChild(style);
            
            setTimeout(() => {
                notification.remove();
                style.remove();
            }, 2000);
        }).catch(() => {
            alert(`Не удалось скопировать ${fieldName}`);
        });
    }
    
    // === QR КОД ===
    
    let qrEnabled = true;
    let resizeFrame = null;
    let resizeObserver = null;
    let windowDiv = null;
    let isWidgetCreated = false;
    let isCollapsed = false;
    let qrSize = 100;
    let currentThemeId = 'default';
    
    function generateQRUrl(data, size) {
        return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&format=png&margin=10`;
    }
    
    const PADDING_CONFIG = {
        withQR: {
            windowBodyPadding: '4px 8px 4px 8px',
            infoSectionPadding: '2px 0',
            infoSectionGap: '1px',
            infoItemPadding: '2px 4px',
            qrPadding: '4px',
            qrMargin: '0 0 2px 0',
        },
        withoutQR: {
            windowBodyPadding: '1px 8px 1px 8px',
            infoSectionPadding: '0px 0',
            infoSectionGap: '0px',
            infoItemPadding: '0px 4px',
            qrPadding: '0',
            qrMargin: '0',
        }
    };
    
    function applyPaddingConfig(config) {
        const body = windowDiv?.querySelector('.window-body');
        const infoSection = document.querySelector('.info-section');
        const infoItems = document.querySelectorAll('.info-item');
        const qrContainer = document.querySelector('.qr-container');
        
        if (body) {
            body.style.padding = config.windowBodyPadding;
        }
        if (infoSection) {
            infoSection.style.padding = config.infoSectionPadding;
            infoSection.style.gap = config.infoSectionGap;
        }
        infoItems.forEach(item => {
            item.style.padding = config.infoItemPadding;
        });
        if (qrContainer && !qrEnabled) {
            qrContainer.style.padding = config.qrPadding;
            qrContainer.style.margin = config.qrMargin;
        }
    }
    
    function updateWindowSize() {
        if (!windowDiv || isCollapsed) return;
        
        const headerHeight = 32;
        const qrContainer = document.querySelector('.qr-container');
        const infoSection = document.querySelector('.info-section');
        
        const config = qrEnabled ? PADDING_CONFIG.withQR : PADDING_CONFIG.withoutQR;
        applyPaddingConfig(config);
        
        let totalHeight = headerHeight + 4;
        
        if (qrEnabled && qrContainer && qrContainer.style.display !== 'none') {
            const qrHeight = qrSize + 10;
            totalHeight += qrHeight + 2;
        }
        
        if (infoSection) {
            const infoHeight = infoSection.scrollHeight || 76;
            totalHeight += infoHeight;
        }
        
        totalHeight += 2;
        totalHeight = Math.max(120, Math.min(totalHeight, 380));
        
        windowDiv.style.height = totalHeight + 'px';
        windowDiv.style.transition = 'height 0.25s ease';
        
        if (infoSection) {
            if (qrEnabled) {
                infoSection.style.justifyContent = 'flex-start';
                infoSection.style.flex = '0';
            } else {
                infoSection.style.justifyContent = 'center';
                infoSection.style.flex = '1';
                infoSection.style.display = 'flex';
                infoSection.style.flexDirection = 'column';
                infoSection.style.height = '100%';
            }
        }
    }
    
    function resizeQRCode() {
        const qrImg = document.getElementById('qr-img');
        const qrContainer = document.querySelector('.qr-container');
        
        if (!qrImg || !qrContainer) return;
        
        if (!qrEnabled) {
            qrContainer.style.display = 'none';
            qrContainer.style.minHeight = '0';
            qrContainer.style.maxHeight = '0';
            qrContainer.style.padding = '0';
            qrContainer.style.margin = '0';
            updateWindowSize();
            return;
        }
        
        qrContainer.style.display = 'flex';
        qrContainer.style.minHeight = '40px';
        qrContainer.style.maxHeight = '120px';
        qrContainer.style.padding = '4px';
        qrContainer.style.margin = '0 0 2px 0';
        
        const containerWidth = windowDiv ? windowDiv.offsetWidth - 32 : 220;
        let newSize = Math.min(containerWidth, 110);
        newSize = Math.max(60, newSize);
        
        newSize = Math.round(newSize / 10) * 10;
        qrSize = newSize;
        
        qrImg.style.width = qrSize + 'px';
        qrImg.style.height = qrSize + 'px';
        qrImg.style.maxWidth = qrSize + 'px';
        qrImg.style.maxHeight = qrSize + 'px';
        qrImg.style.flexShrink = '0';
        qrImg.style.flexGrow = '0';
        qrImg.style.objectFit = 'contain';
        
        const orderNumber = getOrderNumber();
        if (orderNumber && orderNumber !== 'N/A' && isOrderPage()) {
            qrImg.src = generateQRUrl(orderNumber, qrSize);
        } else {
            qrImg.src = '';
        }
        
        updateWindowSize();
    }
    
    function initQRCode(orderNumber) {
        const qrContainer = document.querySelector('.qr-container');
        if (!qrContainer) return;
        
        qrContainer.innerHTML = '';
        qrContainer.style.cssText = `
            display: ${qrEnabled ? 'flex' : 'none'};
            justify-content: center;
            align-items: center;
            padding: ${qrEnabled ? '4px' : '0'};
            margin: ${qrEnabled ? '0 0 2px 0' : '0'};
            min-height: ${qrEnabled ? '40px' : '0'};
            max-height: ${qrEnabled ? '120px' : '0'};
            overflow: hidden;
            background: rgba(255,255,255,0.2);
            border-radius: 4px;
            transition: all 0.25s ease;
            flex-shrink: 0;
        `;
        
        if (!qrEnabled) {
            updateWindowSize();
            return;
        }
        
        const qrImg = document.createElement('img');
        qrImg.id = 'qr-img';
        qrImg.className = 'qr-image';
        qrImg.style.cssText = `
            display: block;
            margin: 0 auto;
            transition: all 0.25s ease;
            width: 90px;
            height: 90px;
            max-width: 100%;
            max-height: 100%;
            flex-shrink: 0;
            object-fit: contain;
        `;
        
        if (orderNumber && orderNumber !== 'N/A' && isOrderPage()) {
            qrImg.src = generateQRUrl(orderNumber, 90);
        }
        
        qrContainer.appendChild(qrImg);
        
        if (resizeObserver) resizeObserver.disconnect();
        resizeObserver = new ResizeObserver(() => {
            if (resizeFrame) cancelAnimationFrame(resizeFrame);
            resizeFrame = requestAnimationFrame(() => {
                resizeQRCode();
                resizeFrame = null;
            });
        });
        resizeObserver.observe(qrContainer);
        
        window.addEventListener('resize', () => {
            if (resizeFrame) cancelAnimationFrame(resizeFrame);
            resizeFrame = requestAnimationFrame(() => {
                resizeQRCode();
                resizeFrame = null;
            });
        });
        
        setTimeout(() => {
            resizeQRCode();
            updateWindowSize();
        }, 200);
    }
    
    function updateQRCode() {
        const orderNumber = getOrderNumber();
        const qrImg = document.getElementById('qr-img');
        
        if (qrImg && orderNumber && orderNumber !== 'N/A' && qrEnabled && isOrderPage()) {
            const currentSize = qrSize || 90;
            qrImg.src = generateQRUrl(orderNumber, currentSize);
        } else if (qrImg) {
            qrImg.src = '';
        }
    }
    
    function setQREnabled(enabled) {
        qrEnabled = enabled;
        const qrContainer = document.querySelector('.qr-container');
        const infoSection = document.querySelector('.info-section');
        
        if (qrContainer) {
            if (enabled) {
                qrContainer.style.display = 'flex';
                qrContainer.style.minHeight = '40px';
                qrContainer.style.maxHeight = '120px';
                qrContainer.style.padding = '4px';
                qrContainer.style.margin = '0 0 2px 0';
                const orderNumber = getOrderNumber();
                initQRCode(orderNumber);
            } else {
                qrContainer.style.display = 'none';
                qrContainer.style.minHeight = '0';
                qrContainer.style.maxHeight = '0';
                qrContainer.style.padding = '0';
                qrContainer.style.margin = '0';
                qrContainer.innerHTML = '';
            }
        }
        
        if (infoSection) {
            if (enabled) {
                infoSection.style.justifyContent = 'flex-start';
                infoSection.style.flex = '0';
                infoSection.style.padding = '2px 0';
            } else {
                infoSection.style.justifyContent = 'center';
                infoSection.style.flex = '1';
                infoSection.style.display = 'flex';
                infoSection.style.flexDirection = 'column';
                infoSection.style.height = '100%';
                infoSection.style.padding = '0px 0';
            }
        }
        
        localStorage.setItem('qrEnabled', enabled);
        
        setTimeout(() => {
            resizeQRCode();
            updateWindowSize();
        }, 150);
    }
    
    function loadQRSetting() {
        const saved = localStorage.getItem('qrEnabled');
        if (saved !== null) {
            qrEnabled = saved === 'true';
        } else {
            qrEnabled = true;
        }
    }
    
    // === НАСТРОЙКИ ===
    
    let currentFontSize = 10;
    
    function applyFontSize(size) {
        currentFontSize = size;
        const infoValues = document.querySelectorAll('.info-value');
        infoValues.forEach(el => {
            el.style.fontSize = size + 'px';
        });
        localStorage.setItem('widgetFontSize', size);
    }
    
    function loadSavedFontSize() {
        const savedSize = localStorage.getItem('widgetFontSize');
        if (savedSize) {
            const size = parseInt(savedSize);
            if (!isNaN(size)) {
                applyFontSize(size);
            }
        }
    }
    
    function updateAllData() {
        if (!isOrderPage()) {
            resetWidgetData();
            updateQRCode();
            console.log('📋 On orders list page - data reset to N/A');
            return;
        }
        
        const orderNumber = getOrderNumber();
        const offerTitle = getOfferTitle();
        const deviceName = getDeviceName();
        
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
            setTimeout(retryIMEISearch, 1000);
        }
        
        const soSpan = document.getElementById('order-number');
        const insSpan = document.getElementById('insurance-type');
        const emailSpan = document.getElementById('customer-email');
        const headerTitle = document.getElementById('widget-header-title');
        
        if (soSpan) soSpan.textContent = orderNumber;
        if (insSpan) insSpan.textContent = offerTitle || 'N/A';
        if (headerTitle) headerTitle.textContent = deviceName;
        
        if (emailSpan) {
            const customerEmail = getCustomerEmail();
            if (customerEmail) {
                emailSpan.textContent = customerEmail;
                emailRetryCount = 0;
            } else {
                emailSpan.textContent = 'N/A';
                emailRetryCount = 0;
                setTimeout(retryEmailSearch, 1000);
            }
        }
        
        updateQRCode();
        
        console.log('=== Данные обновлены ===');
        console.log('SO:', orderNumber);
        console.log('INS:', offerTitle);
        console.log('IMEI:', imei || 'N/A');
        console.log('Email:', document.getElementById('customer-email')?.textContent || 'N/A');
        
        // === ЗДЕСЬ БЫЛО sendOrderToServer(), ТЕПЕРЬ saveOrderLocally() ===
        saveOrderLocally();
    }
    
    // === ТЕМЫ ===
    
    const colorSchemes = {
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
    
    function applyTheme(themeId) {
        const colors = colorSchemes[themeId];
        if (!colors) return;
        currentThemeId = themeId;
        const gradient = `linear-gradient(135deg, ${colors.c1} 0%, ${colors.c2} 100%)`;
        
        const header = document.querySelector('.window-header');
        if (header) header.style.background = gradient;
        
        const infoIcons = document.querySelectorAll('.info-icon');
        const isDarkTheme = ['dark', 'gray2', 'gray4'].includes(themeId);
        infoIcons.forEach(icon => {
            if (isDarkTheme) {
                icon.style.filter = 'brightness(0) invert(1)';
                icon.style.opacity = '0.8';
            } else {
                icon.style.filter = 'none';
                icon.style.opacity = '0.6';
            }
        });
        
        const infoLabels = document.querySelectorAll('.info-label');
        if (isDarkTheme) {
            infoLabels.forEach(el => {
                el.style.color = '#cccccc';
            });
        } else {
            infoLabels.forEach(el => {
                el.style.color = '#555555';
            });
        }
        
        localStorage.setItem('widgetTheme', themeId);
    }
    
    function loadSavedTheme() {
        const savedTheme = localStorage.getItem('widgetTheme');
        if (savedTheme && colorSchemes[savedTheme]) {
            applyTheme(savedTheme);
            currentThemeId = savedTheme;
        }
    }
    
    // === ПРОЗРАЧНОСТЬ ===
    
    let currentOpacity = 0.85;
    
    function updateWindowOpacity(opacityValue) {
        windowDiv.style.backgroundColor = `rgba(255, 255, 255, ${opacityValue})`;
        
        const qrContainer = document.querySelector('.qr-container');
        if (qrContainer) {
            qrContainer.style.backgroundColor = `rgba(255, 255, 255, ${Math.min(1, opacityValue + 0.05)})`;
        }
        
        const infoItems = document.querySelectorAll('.info-item');
        infoItems.forEach(item => {
            item.style.backgroundColor = `rgba(255, 255, 255, ${opacityValue})`;
        });
    }
    
    function loadSavedOpacity() {
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.sync.get(['widgetOpacity'], (result) => {
                const savedOpacity = (result.widgetOpacity !== undefined ? result.widgetOpacity : 85) / 100;
                currentOpacity = savedOpacity;
                updateWindowOpacity(savedOpacity);
            });
        }
    }
    
    // === СОЗДАНИЕ ВИДЖЕТА ===
    
    const STORAGE_KEYS = {
        WIDGET_POSITION: 'fixmod_widget_position',
        WIDGET_SIZE: 'fixmod_widget_size',
        WIDGET_COLLAPSED: 'fixmod_widget_collapsed'
    };
    
    function loadSavedPosition() {
        if (!windowDiv) return;
        try {
            const savedPos = localStorage.getItem(STORAGE_KEYS.WIDGET_POSITION);
            if (savedPos) {
                const pos = JSON.parse(savedPos);
                if (pos.left && pos.top) {
                    windowDiv.style.left = pos.left + 'px';
                    windowDiv.style.top = pos.top + 'px';
                }
            }
            const savedSize = localStorage.getItem(STORAGE_KEYS.WIDGET_SIZE);
            if (savedSize) {
                const size = JSON.parse(savedSize);
                if (size.width && size.height) {
                    windowDiv.style.width = size.width + 'px';
                    windowDiv.style.height = size.height + 'px';
                }
            }
            const savedCollapsed = localStorage.getItem(STORAGE_KEYS.WIDGET_COLLAPSED);
            if (savedCollapsed === 'true') {
                isCollapsed = true;
                if (windowDiv) windowDiv.classList.add('collapsed');
            }
        } catch(e) {}
    }
    
    function savePositionAndSize() {
        if (!windowDiv) return;
        try {
            const left = parseInt(windowDiv.style.left);
            const top = parseInt(windowDiv.style.top);
            if (!isNaN(left) && !isNaN(top)) {
                localStorage.setItem(STORAGE_KEYS.WIDGET_POSITION, JSON.stringify({ left, top }));
            }
            const width = windowDiv.offsetWidth;
            const height = windowDiv.offsetHeight;
            if (width && height) {
                localStorage.setItem(STORAGE_KEYS.WIDGET_SIZE, JSON.stringify({ width, height }));
            }
        } catch(e) {}
    }
    
    function toggleCollapse(skipSave = false) {
        isCollapsed = !isCollapsed;
        if (isCollapsed) {
            windowDiv.classList.add('collapsed');
        } else {
            windowDiv.classList.remove('collapsed');
            setTimeout(() => {
                resizeQRCode();
                updateWindowSize();
            }, 150);
        }
        if (!skipSave) {
            localStorage.setItem(STORAGE_KEYS.WIDGET_COLLAPSED, isCollapsed);
            savePositionAndSize();
        }
    }
    
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
                }, 500);
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
        });
        
        domObserver.observe(document.body, {
            childList: true,
            subtree: true,
            characterData: true,
            attributes: true
        });
        
        return domObserver;
    }
    
    function createWidget() {
        if (isWidgetCreated && windowDiv) {
            updateAllData();
            return;
        }
        
        const orderNumber = getOrderNumber();
        const offerTitle = getOfferTitle();
        const deviceName = getDeviceName();
        const customerEmail = getCustomerEmail();
        const imei = getIMEI();
        
        currentOrderNumber = orderNumber;
        
        loadQRSetting();
        
        const iconPath = chrome.runtime.getURL('uiAssets/');
        
        const isOrder = isOrderPage();
        const displayOrderNumber = isOrder ? orderNumber : 'N/A';
        const displayOfferTitle = isOrder ? (offerTitle || 'N/A') : 'N/A';
        const displayImei = isOrder ? (imei || 'N/A') : 'N/A';
        const displayEmail = isOrder ? (customerEmail || 'N/A') : 'N/A';
        const displayDeviceName = isOrder ? deviceName : 'FixMod Widget';
        
        windowDiv = document.createElement('div');
        windowDiv.id = 'my-draggable-window';
        windowDiv.innerHTML = `
            <div class="window-header">
                <div class="header-left">
                    <span id="widget-header-title">${displayDeviceName}</span>
                </div>
                <div class="header-buttons">
                    <span class="collapse-btn" title="Свернуть/развернуть">−</span>
                    <span class="close-btn" title="Закрыть">✕</span>
                </div>
            </div>
            <div class="window-body" style="display: flex; flex-direction: column; min-height: 70px; padding: 4px 8px 4px 8px;">
                <div class="qr-container" style="display: ${qrEnabled ? 'flex' : 'none'};"></div>
                
                <div class="info-section" style="
                    display: flex; 
                    flex-direction: column; 
                    gap: 1px; 
                    justify-content: ${qrEnabled ? 'flex-start' : 'center'};
                    padding: ${qrEnabled ? '2px 0' : '0px 0'};
                    flex: ${qrEnabled ? '0' : '1'};
                ">
                    <div class="info-item">
                        <img src="${iconPath}orderNum.png" alt="SO" class="info-icon">
                        <span class="info-label">SO:</span>
                        <span class="info-value copyable" id="order-number" data-copy-field="SO" title="Кликните чтобы скопировать">${displayOrderNumber}</span>
                    </div>
                    
                    <div class="info-item">
                        <img src="${iconPath}ins.png" alt="INS" class="info-icon">
                        <span class="info-label">INS:</span>
                        <span class="info-value" id="insurance-type">${displayOfferTitle}</span>
                    </div>
                    
                    <div class="info-item">
                        <img src="${iconPath}imei.png" alt="IMEI" class="info-icon">
                        <span class="info-label">IMEI:</span>
                        <span class="info-value copyable" id="imei" data-copy-field="IMEI" title="Кликните чтобы скопировать">${displayImei}</span>
                    </div>
                    
                    <div class="info-item">
                        <img src="${iconPath}email.png" alt="Email" class="info-icon">
                        <span class="info-label">Email:</span>
                        <span class="info-value copyable" id="customer-email" data-copy-field="Email" title="Кликните чтобы скопировать">${displayEmail}</span>
                    </div>
                </div>
            </div>
            <div class="resize-handle"></div>
            <div class="resize-handle-right"></div>
        `;
        
        document.body.appendChild(windowDiv);
        isWidgetCreated = true;
        
        loadSavedPosition();
        loadSavedTheme();
        loadSavedFontSize();
        
        if (qrEnabled) {
            initQRCode(isOrder ? orderNumber : null);
        }
        
        const domObserver = setupDOMObserver();
        
        if (isOrder && !imei) {
            imeiRetryCount = 0;
            setTimeout(retryIMEISearch, 1000);
        }
        
        if (isOrder && !customerEmail) {
            emailRetryCount = 0;
            setTimeout(retryEmailSearch, 1000);
        }
        
        const style = document.createElement('style');
        style.textContent = `
            #my-draggable-window {
                position: fixed;
                width: 260px;
                min-width: 200px;
                max-width: 500px;
                background: rgba(255, 255, 255, 0.92);
                border-radius: 8px;
                box-shadow: 0 8px 32px rgba(0,0,0,0.12);
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                font-size: 10px;
                z-index: 99999;
                cursor: default;
                overflow: hidden;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.2);
                transition: height 0.25s ease;
                user-select: none;
                height: auto;
                resize: horizontal;
            }
            
            #my-draggable-window.collapsed .window-body {
                display: none;
            }
            
            #my-draggable-window.collapsed {
                height: 32px !important;
            }
            
            #my-draggable-window .window-header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 6px 8px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: move;
                border-radius: 8px 8px 0 0;
                min-height: 26px;
                flex-shrink: 0;
            }
            
            #my-draggable-window .header-left {
                font-weight: 600;
                font-size: 10px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 140px;
            }
            
            #my-draggable-window .header-buttons {
                display: flex;
                gap: 5px;
                flex-shrink: 0;
            }
            
            #my-draggable-window .collapse-btn,
            #my-draggable-window .close-btn {
                cursor: pointer;
                font-size: 12px;
                line-height: 1;
                opacity: 0.8;
                transition: opacity 0.2s, transform 0.2s;
                width: 14px;
                text-align: center;
                color: white;
            }
            
            #my-draggable-window .collapse-btn:hover,
            #my-draggable-window .close-btn:hover {
                opacity: 1;
                transform: scale(1.15);
            }
            
            #my-draggable-window .window-body {
                padding: 4px 8px 4px 8px;
                max-height: 350px;
                overflow-y: auto;
                display: flex;
                flex-direction: column;
                flex: 1;
            }
            
            #my-draggable-window .qr-container {
                display: flex;
                justify-content: center;
                align-items: center;
                padding: 4px;
                margin: 0 0 2px 0;
                min-height: 40px;
                max-height: 120px;
                overflow: hidden;
                background: rgba(255,255,255,0.2);
                border-radius: 4px;
                transition: all 0.25s ease;
                flex-shrink: 0;
            }
            
            #my-draggable-window .qr-container img {
                display: block;
                margin: 0 auto;
                transition: all 0.25s ease;
                max-width: 100%;
                max-height: 100%;
                flex-shrink: 0;
                object-fit: contain;
                image-rendering: pixelated;
            }
            
            #my-draggable-window .info-section {
                display: flex;
                flex-direction: column;
                gap: 1px;
                transition: all 0.25s ease;
                flex: 0;
            }
            
            #my-draggable-window .info-item {
                display: flex;
                align-items: center;
                gap: 4px;
                padding: 2px 4px;
                border-radius: 3px;
                background: rgba(255,255,255,0.4);
                min-height: 18px;
                white-space: nowrap;
            }
            
            #my-draggable-window .info-icon {
                width: 12px;
                height: 12px;
                flex-shrink: 0;
                opacity: 0.6;
                transition: all 0.3s ease;
            }
            
            #my-draggable-window .info-label {
                font-weight: 500;
                color: #555;
                font-size: 9px;
                min-width: 30px;
                flex-shrink: 0;
                transition: all 0.3s ease;
            }
            
            #my-draggable-window .info-value {
                font-weight: 600;
                color: #1a1a1a;
                font-size: 9px;
                flex: 1;
                min-width: 0;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }
            
            #my-draggable-window .info-value.copyable {
                cursor: pointer;
                text-decoration: underline;
                text-decoration-style: dotted;
                text-underline-offset: 1px;
                transition: color 0.2s;
            }
            
            #my-draggable-window .info-value.copyable:hover {
                color: #667eea;
            }
            
            #my-draggable-window .resize-handle {
                position: absolute;
                bottom: 0;
                right: 0;
                width: 12px;
                height: 12px;
                cursor: nwse-resize;
                background: linear-gradient(135deg, transparent 50%, rgba(0,0,0,0.06) 50%);
                border-radius: 0 0 8px 0;
            }
            
            #my-draggable-window .resize-handle-right {
                position: absolute;
                right: 0;
                top: 0;
                width: 6px;
                height: 100%;
                cursor: ew-resize;
                background: transparent;
                z-index: 10;
            }
            
            #my-draggable-window .resize-handle-right:hover {
                background: rgba(0,0,0,0.03);
            }
            
            #my-draggable-window.collapsed .resize-handle,
            #my-draggable-window.collapsed .resize-handle-right {
                display: none;
            }
            
            #my-draggable-window .window-body::-webkit-scrollbar {
                width: 2px;
            }
            
            #my-draggable-window .window-body::-webkit-scrollbar-track {
                background: transparent;
            }
            
            #my-draggable-window .window-body::-webkit-scrollbar-thumb {
                background: rgba(0,0,0,0.1);
                border-radius: 2px;
            }
            
            #my-draggable-window .window-body::-webkit-scrollbar-thumb:hover {
                background: rgba(0,0,0,0.18);
            }
        `;
        document.head.appendChild(style);
        
        setTimeout(() => {
            loadSavedTheme();
        }, 50);
        
        const copyableElements = windowDiv.querySelectorAll('.copyable');
        copyableElements.forEach(el => {
            el.addEventListener('click', () => {
                const text = el.textContent;
                const fieldName = el.getAttribute('data-copy-field');
                copyToClipboard(text, fieldName);
            });
        });
        
        const header = windowDiv.querySelector('.window-header');
        const resizeHandle = windowDiv.querySelector('.resize-handle');
        const resizeHandleRight = windowDiv.querySelector('.resize-handle-right');
        const collapseBtn = windowDiv.querySelector('.collapse-btn');
        const closeBtn = windowDiv.querySelector('.close-btn');
        
        let isDragging = false;
        let dragStartX = 0, dragStartY = 0;
        let startLeft = 0, startTop = 0;
        let saveTimeout = null;
        
        function savePositionDelayed() {
            if (saveTimeout) clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => savePositionAndSize(), 100);
        }
        
        let isResizingRight = false;
        let startResizeX = 0;
        let startResizeWidth = 0;
        
        resizeHandleRight.addEventListener('mousedown', (e) => {
            if (isCollapsed) return;
            isResizingRight = true;
            startResizeX = e.clientX;
            startResizeWidth = windowDiv.offsetWidth;
            e.preventDefault();
            e.stopPropagation();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizingRight) return;
            
            let newWidth = startResizeWidth + (e.clientX - startResizeX);
            newWidth = Math.max(200, Math.min(newWidth, 500));
            
            windowDiv.style.width = newWidth + 'px';
            windowDiv.style.transition = 'none';
            
            if (resizeFrame) cancelAnimationFrame(resizeFrame);
            resizeFrame = requestAnimationFrame(() => {
                resizeQRCode();
                resizeFrame = null;
            });
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizingRight) {
                isResizingRight = false;
                windowDiv.style.transition = '';
                resizeQRCode();
                savePositionDelayed();
            }
        });
        
        collapseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleCollapse();
        });
        
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            windowDiv.style.display = 'none';
        });
        
        header.addEventListener('mousedown', (e) => {
            if (e.target.classList.contains('collapse-btn') || 
                e.target.classList.contains('close-btn')) return;
            
            isDragging = true;
            dragStartX = e.clientX;
            dragStartY = e.clientY;
            
            const left = parseInt(windowDiv.style.left);
            const top = parseInt(windowDiv.style.top);
            startLeft = isNaN(left) ? 100 : left;
            startTop = isNaN(top) ? 100 : top;
            
            windowDiv.style.transition = 'none';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - dragStartX;
            const deltaY = e.clientY - dragStartY;
            
            let newLeft = startLeft + deltaX;
            let newTop = startTop + deltaY;
            
            newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - windowDiv.offsetWidth));
            newTop = Math.max(0, Math.min(newTop, window.innerHeight - 50));
            
            windowDiv.style.left = newLeft + 'px';
            windowDiv.style.top = newTop + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                windowDiv.style.transition = '';
                savePositionDelayed();
            }
        });
        
        let isResizing = false;
        let startX, startY, startWidth, startHeight;
        let resizeFrameTimer = null;
        
        resizeHandle.addEventListener('mousedown', (e) => {
            if (isCollapsed) return;
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = windowDiv.offsetWidth;
            startHeight = windowDiv.offsetHeight;
            e.preventDefault();
            e.stopPropagation();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            let newWidth = startWidth + (e.clientX - startX);
            let newHeight = startHeight + (e.clientY - startY);
            
            newWidth = Math.max(200, Math.min(newWidth, 500));
            newHeight = Math.max(130, Math.min(newHeight, 400));
            
            windowDiv.style.width = newWidth + 'px';
            windowDiv.style.height = newHeight + 'px';
            
            if (resizeFrameTimer) cancelAnimationFrame(resizeFrameTimer);
            resizeFrameTimer = requestAnimationFrame(() => {
                resizeQRCode();
                resizeFrameTimer = null;
            });
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                if (resizeFrameTimer) {
                    cancelAnimationFrame(resizeFrameTimer);
                    resizeFrameTimer = null;
                }
                resizeQRCode();
                savePositionDelayed();
            }
        });
        
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.type === 'UPDATE_OPACITY') {
                    updateWindowOpacity(request.opacity);
                    sendResponse({ success: true });
                } else if (request.type === 'UPDATE_THEME') {
                    applyTheme(request.theme);
                    sendResponse({ success: true });
                } else if (request.type === 'UPDATE_FONT_SIZE') {
                    applyFontSize(request.fontSize);
                    sendResponse({ success: true });
                } else if (request.type === 'UPDATE_QR_ENABLED') {
                    setQREnabled(request.enabled);
                    sendResponse({ success: true });
                }
                return true;
            });
        }
        
        loadSavedOpacity();
        window.addEventListener('beforeunload', () => savePositionAndSize());
        
        setTimeout(() => {
            setupResolutionMonitoring();
        }, 2000);
        
        // === ЗДЕСЬ БЫЛО sendOrderToServer(), ТЕПЕРЬ saveOrderLocally() ===
        setTimeout(() => {
            saveOrderLocally();
        }, 3000);
        
        setTimeout(() => {
            updateWindowSize();
            loadSavedTheme();
        }, 300);
        
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
                }, 1500);
            }
        });
    }
    
    createWidget();
    
    function waitForIMEI() {
        let attempts = 0;
        const maxAttempts = 20;
        
        if (!isOrderPage()) {
            console.log('ℹ️ Not on order page, skipping IMEI wait');
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
                console.log('IMEI не найден после', maxAttempts, 'попыток');
                clearInterval(checkInterval);
            }
            attempts++;
        }, 500);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(waitForIMEI, 1000);
            setTimeout(() => {
                const headerTitle = document.getElementById('widget-header-title');
                if (headerTitle) headerTitle.textContent = getDeviceName();
                if (!isOrderPage()) {
                    resetWidgetData();
                }
            }, 1500);
        });
    } else {
        setTimeout(waitForIMEI, 1000);
        setTimeout(() => {
            const headerTitle = document.getElementById('widget-header-title');
            if (headerTitle) headerTitle.textContent = getDeviceName();
            if (!isOrderPage()) {
                resetWidgetData();
            }
        }, 1500);
    }
    
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
            currentOrderNumber = null;
            
            setTimeout(() => {
                if (windowDiv) {
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
            }, 1500);
        }
    }
    
    const observer = new MutationObserver(() => checkForUrlChange());
    observer.observe(document.body, { childList: true, subtree: true });
    
    window.refreshWidgetData = updateAllData;
    console.log('✅ Виджет FixMod загружен!');
}