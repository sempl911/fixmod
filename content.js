// content.js - Fixably Widget + Server Integration with Offline Support

// ============================================================
// === НАСТРОЙКИ ===
// ============================================================

// API URL теперь хранится в background, используем отправку через сообщения

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

function getCurrentTechnician() {
    const techElement = document.querySelector('[data-name="handler"]');
    if (techElement) {
        const tech = techElement.textContent.trim();
        return tech && tech.length > 0 ? tech : null;
    }
    return null;
}

function getCurrentStatus() {
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
    return 'unknown';
}

function getOfferTitle() {
    const offerField = document.getElementById('customfield_13');
    if (offerField && offerField.textContent) {
        const title = offerField.textContent.trim();
        if (title && title !== 'No information') {
            return title;
        }
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

function getDeviceName() {
    const deviceLink = document.querySelector('#order-device-panel .panel-heading a, #order-device .panel-heading a');
    if (deviceLink) {
        let fullText = deviceLink.textContent || deviceLink.innerText;
        fullText = fullText.trim().replace(/\s+/g, ' ').replace(/<i[^>]*>.*?<\/i>/g, '');
        return fullText || 'Fixably Widget';
    }
    return 'Fixably Widget';
}

function getIMEI() {
    const devicePanel = document.getElementById('order-device');
    if (devicePanel) {
        const panelText = devicePanel.innerText;
        let imeiMatch = panelText.match(/IMEI[:\s]+([0-9]{15,})/i);
        if (imeiMatch) return imeiMatch[1];
        imeiMatch = panelText.match(/\b([0-9]{15})\b/);
        if (imeiMatch) return imeiMatch[1];
    }
    
    const allTextElements = document.querySelectorAll('.editable, .order-right-field-col-2, .form-control-static, .dl-horizontal dd');
    for (let el of allTextElements) {
        const text = el.textContent;
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

function getCustomer() {
    const customerElement = document.querySelector('#page-label');
    if (customerElement) {
        return customerElement.textContent.trim();
    }
    return null;
}

// ============================================================
// === ФУНКЦИЯ ДЛЯ ПОЛУЧЕНИЯ RESOLUTION (ДИАГНОЗА) ===
// ============================================================

function getResolution() {
    console.log('🔍 Searching for diagnosis text...');
    
    // Ищем все записи в таймлайне
    const timelinePanels = document.querySelectorAll('.timeline-panel');
    let foundResolutions = [];
    
    for (let panel of timelinePanels) {
        const text = panel.innerText || panel.textContent || '';
        
        // Проверяем, что это запись с диагнозом или резолюцией
        if (text.includes('Diagnosis') || text.includes('Resolution')) {
            // Ищем контейнер с текстом
            const contentContainer = panel.querySelector('.content-container.toggle-full-content');
            if (contentContainer) {
                const p = contentContainer.querySelector('p');
                if (p) {
                    const diagnosisText = p.innerText || p.textContent || '';
                    const trimmed = diagnosisText.trim();
                    
                    // Проверяем, что это не служебный текст
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
                        
                        // Определяем тип записи
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
            
            // Если не нашли в p, ищем в контейнере
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
    
    // Сортируем найденные записи по времени (если есть)
    // И выбираем сначала Resolution, потом Diagnosis
    let bestMatch = null;
    
    // Сначала ищем Resolution
    for (let item of foundResolutions) {
        if (item.type === 'resolution') {
            bestMatch = item;
            break;
        }
    }
    
    // Если Resolution не найден, берем последний Diagnosis
    if (!bestMatch && foundResolutions.length > 0) {
        // Берем последний (самый свежий)
        bestMatch = foundResolutions[foundResolutions.length - 1];
    }
    
    if (bestMatch) {
        console.log(`✅ ${bestMatch.type} found:`, bestMatch.text);
        return bestMatch.text;
    }
    
    // === ЗАПАСНОЙ ВАРИАНТ: Ищем в любом элементе с текстом диагноза ===
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

function collectOrderData() {
    const data = {
        order_number: null,
        status: null,
        status_code: null,
        technician: null,
        technician_id: null,
        customer: null,
        customer_id: null,
        device_model: null,
        imei: null,
        notes: null,
        resolution: null,
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

    const customer = getCustomer();
    if (customer) {
        data.customer = customer;
    }

    const deviceName = getDeviceName();
    if (deviceName && deviceName !== 'Fixably Widget') {
        data.device_model = deviceName;
    }

    const imei = getIMEI();
    if (imei && imei !== 'N/A') {
        data.imei = imei;
    }

    const offerTitle = getOfferTitle();
    if (offerTitle && offerTitle !== 'N/A') {
        data.notes = `Offer: ${offerTitle}`;
    }

    // Resolution - ищем диагноз
    const resolution = getResolution();
    if (resolution) {
        data.resolution = resolution;
        console.log('📝 Resolution collected:', resolution);
    } else {
        console.log('ℹ️ No resolution found on page');
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

// ============================================================
// === ПРОВЕРКА ИЗМЕНЕНИЯ RESOLUTION ===
// ============================================================

function hasResolutionChanged() {
    const currentResolution = getResolution();
    return currentResolution !== lastResolution;
}

function shouldSendData(currentData) {
    if (!hasTechnician()) {
        console.log('ℹ️ No technician assigned, skipping send');
        return false;
    }

    if (!currentData.order_number || currentData.order_number === 'N/A') {
        console.log('ℹ️ No order number, skipping send');
        return false;
    }

    if (isFirstLoad) {
        console.log('📦 First load, sending initial data');
        isFirstLoad = false;
        return true;
    }

    // Проверяем изменение resolution (всегда отправляем если есть resolution)
    const currentResolution = getResolution();
    if (currentResolution && currentResolution !== lastResolution) {
        console.log('🔄 Resolution changed, sending update');
        lastResolution = currentResolution;
        return true;
    }

    // Если resolution есть, но его еще не отправляли - отправляем
    if (currentResolution && !lastResolution) {
        console.log('📝 New resolution found, sending update');
        lastResolution = currentResolution;
        return true;
    }

    if (hasStatusChanged()) {
        console.log('🔄 Status changed, sending update');
        return true;
    }

    if (hasTechnicianChanged()) {
        console.log('🔄 Technician changed, sending update');
        return true;
    }

    if (hasImeiChanged()) {
        console.log('🔄 IMEI changed, sending update');
        return true;
    }

    console.log('ℹ️ No changes detected, skipping send');
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

    if (!document.getElementById('fixably-notification-styles')) {
        const style = document.createElement('style');
        style.id = 'fixably-notification-styles';
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
// === ОТПРАВКА НА СЕРВЕР (через background с офлайн-поддержкой) ===
// ============================================================

async function sendOrderToServer() {
    const currentData = collectOrderData();
    
    if (!shouldSendData(currentData)) {
        return null;
    }

    try {
        const response = await chrome.runtime.sendMessage({
            type: 'SEND_ORDER',
            data: currentData
        });
        
        if (response && response.success) {
            console.log('✅ Order saved to server:', response.data);
            
            lastOrderData = currentData;
            lastStatus = getCurrentStatus();
            lastTechnician = getCurrentTechnician();
            lastImei = getIMEI();
            lastStatusCode = getStatusCode(lastStatus);
            lastResolution = getResolution();
            
            if (response.data && response.data.status_changed) {
                showNotification(`Status: ${response.data.previous_status || ''} → ${response.data.new_status || ''}`, 'success');
            } else {
                showNotification(`Order ${currentData.order_number} saved ✅`, 'success');
            }
            
            return response.data;
        } else {
            const errorMsg = response?.error || 'Unknown error';
            console.warn('⚠️ Order saved offline or error:', errorMsg);
            showNotification(`Order ${currentData.order_number} saved offline 📶`, 'warning');
            return null;
        }
        
    } catch (error) {
        console.error('❌ Error saving order:', error);
        showNotification('Error saving order', 'error');
        return null;
    }
}

// ============================================================
// === МОНИТОРИНГ ИЗМЕНЕНИЙ RESOLUTION ===
// ============================================================

function setupResolutionMonitoring() {
    console.log('🔍 Setting up Resolution monitoring...');
    
    // Наблюдаем за изменениями в таймлайне
    const timelineObserver = new MutationObserver(() => {
        const currentResolution = getResolution();
        if (currentResolution && currentResolution !== lastResolution) {
            console.log('🔄 Resolution changed in timeline:', currentResolution);
            lastResolution = currentResolution;
            sendOrderToServer();
        }
    });
    
    // Наблюдаем за всем телом на предмет появления новых элементов
    timelineObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
    
    // Наблюдаем за модальным окном диагностики
    const diagText = document.getElementById('diagnosticText');
    if (diagText) {
        diagText.addEventListener('change', () => {
            const currentResolution = getResolution();
            if (currentResolution && currentResolution !== lastResolution) {
                console.log('🔄 Resolution changed in diagnostic:', currentResolution);
                lastResolution = currentResolution;
                sendOrderToServer();
            }
        });
    }
}

// ============================================================
// === ВАШ СУЩЕСТВУЮЩИЙ КОД ВИДЖЕТА ===
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
    
    function resizeQRCode() {
        const qrImg = document.getElementById('qr-img');
        const qrContainer = document.querySelector('.qr-container');
        
        if (!qrImg || !qrContainer) return;
        
        if (!qrEnabled) {
            qrContainer.style.display = 'none';
            return;
        }
        
        if (windowDiv && windowDiv.offsetWidth < 220) {
            qrContainer.style.display = 'none';
            return;
        }
        
        qrContainer.style.display = 'flex';
        
        const containerWidth = qrContainer.clientWidth - 20;
        let qrSize = containerWidth > 0 ? Math.min(containerWidth, 140) : 100;
        qrSize = Math.max(60, qrSize);
        
        qrImg.style.width = qrSize + 'px';
        qrImg.style.height = qrSize + 'px';
        
        const orderNumber = getOrderNumber();
        if (orderNumber && orderNumber !== 'N/A') {
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=${qrSize}x${qrSize}&data=${encodeURIComponent(orderNumber)}`;
        }
    }
    
    function initQRCode(orderNumber) {
        const qrContainer = document.querySelector('.qr-container');
        if (!qrContainer) return;
        
        qrContainer.innerHTML = '';
        
        const qrImg = document.createElement('img');
        qrImg.id = 'qr-img';
        qrImg.className = 'qr-image';
        qrImg.style.cssText = `
            display: block;
            margin: 0 auto;
            transition: all 0.2s ease;
            max-width: 100%;
            height: auto;
        `;
        
        if (orderNumber && orderNumber !== 'N/A') {
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(orderNumber)}`;
            qrImg.style.width = '100px';
            qrImg.style.height = '100px';
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
        
        setTimeout(() => resizeQRCode(), 100);
    }
    
    function updateQRCode() {
        const orderNumber = getOrderNumber();
        const qrImg = document.getElementById('qr-img');
        
        if (qrImg && orderNumber && orderNumber !== 'N/A' && qrEnabled) {
            let currentSize = qrImg.clientWidth;
            if (currentSize <= 0) currentSize = 100;
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=${currentSize}x${currentSize}&data=${encodeURIComponent(orderNumber)}`;
        }
    }
    
    function setQREnabled(enabled) {
        qrEnabled = enabled;
        const qrContainer = document.querySelector('.qr-container');
        if (qrContainer) {
            qrContainer.style.display = enabled ? 'flex' : 'none';
        }
        localStorage.setItem('qrEnabled', enabled);
    }
    
    function loadQRSetting() {
        const saved = localStorage.getItem('qrEnabled');
        if (saved !== null) {
            qrEnabled = saved === 'true';
        } else {
            qrEnabled = true;
        }
        setQREnabled(qrEnabled);
    }
    
    // === НАСТРОЙКИ ===
    
    let currentFontSize = 12;
    
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
        const orderNumber = getOrderNumber();
        const offerTitle = getOfferTitle();
        const imei = getIMEI();
        const deviceName = getDeviceName();
        
        const soSpan = document.getElementById('order-number');
        const insSpan = document.getElementById('insurance-type');
        const imeiSpan = document.getElementById('imei');
        const headerTitle = document.getElementById('widget-header-title');
        
        if (soSpan) soSpan.textContent = orderNumber;
        if (insSpan) insSpan.textContent = offerTitle || 'N/A';
        if (imeiSpan) imeiSpan.textContent = imei || 'N/A';
        if (headerTitle) headerTitle.textContent = deviceName;
        
        updateQRCode();
        
        console.log('=== Данные обновлены ===');
        console.log('SO:', orderNumber);
        console.log('INS:', offerTitle);
        console.log('IMEI:', imei);
        
        sendOrderToServer();
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
        const gradient = `linear-gradient(135deg, ${colors.c1} 0%, ${colors.c2} 100%)`;
        
        const header = document.querySelector('.window-header');
        if (header) header.style.background = gradient;
        
        localStorage.setItem('widgetTheme', themeId);
    }
    
    function loadSavedTheme() {
        const savedTheme = localStorage.getItem('widgetTheme');
        if (savedTheme && colorSchemes[savedTheme]) {
            applyTheme(savedTheme);
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
        WIDGET_POSITION: 'fixably_widget_position',
        WIDGET_SIZE: 'fixably_widget_size',
        WIDGET_COLLAPSED: 'fixably_widget_collapsed'
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
            resizeQRCode();
        }
        if (!skipSave) {
            localStorage.setItem(STORAGE_KEYS.WIDGET_COLLAPSED, isCollapsed);
            savePositionAndSize();
        }
    }
    
    function createWidget() {
        if (isWidgetCreated && windowDiv) {
            updateAllData();
            return;
        }
        
        const orderNumber = getOrderNumber();
        const offerTitle = getOfferTitle();
        const imei = getIMEI();
        const deviceName = getDeviceName();
        
        windowDiv = document.createElement('div');
        windowDiv.id = 'my-draggable-window';
        windowDiv.innerHTML = `
            <div class="window-header">
                <div class="header-left">
                    <span id="widget-header-title">${deviceName}</span>
                </div>
                <div class="header-buttons">
                    <span class="collapse-btn" title="Свернуть/развернуть">−</span>
                    <span class="close-btn" title="Закрыть">✕</span>
                </div>
            </div>
            <div class="window-body">
                <div class="qr-container"></div>
                
                <div class="info-section">
                    <div class="info-item">
                        <span class="info-label">📋 SO:</span>
                        <span class="info-value copyable" id="order-number" data-copy-field="SO" title="Кликните чтобы скопировать">${orderNumber}</span>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-label">📄 INS:</span>
                        <span class="info-value" id="insurance-type">${offerTitle || 'N/A'}</span>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-label">📱 IMEI:</span>
                        <span class="info-value copyable" id="imei" data-copy-field="IMEI" title="Кликните чтобы скопировать">${imei || 'N/A'}</span>
                    </div>
                </div>
            </div>
            <div class="resize-handle"></div>
        `;
        
        document.body.appendChild(windowDiv);
        isWidgetCreated = true;
        
        loadSavedPosition();
        loadSavedTheme();
        loadSavedFontSize();
        loadQRSetting();
        initQRCode(orderNumber);
        
        const infoValues = windowDiv.querySelectorAll('.info-value');
        infoValues.forEach(el => {
            el.style.fontWeight = 'bold';
            el.style.color = '#000';
            el.style.opacity = '1';
        });
        
        const infoLabels = windowDiv.querySelectorAll('.info-label');
        infoLabels.forEach(el => {
            el.style.fontWeight = 'normal';
            el.style.color = '#333';
            el.style.opacity = '1';
        });
        
        const copyableElements = windowDiv.querySelectorAll('.copyable');
        copyableElements.forEach(el => {
            el.style.cursor = 'pointer';
            el.style.textDecoration = 'underline';
            el.style.textDecorationStyle = 'dotted';
            el.addEventListener('click', () => {
                const text = el.textContent;
                const fieldName = el.getAttribute('data-copy-field');
                copyToClipboard(text, fieldName);
            });
        });
        
        // --- Обработчики ---
        const header = windowDiv.querySelector('.window-header');
        const resizeHandle = windowDiv.querySelector('.resize-handle');
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
            
            newWidth = Math.max(180, newWidth);
            newHeight = Math.max(150, newHeight);
            
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
        
        // Сообщения от popup
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
                    resizeQRCode();
                    sendResponse({ success: true });
                }
                return true;
            });
        }
        
        loadSavedOpacity();
        window.addEventListener('beforeunload', () => savePositionAndSize());
        
        // Запускаем мониторинг resolution
        setTimeout(() => {
            setupResolutionMonitoring();
        }, 2000);
        
        setTimeout(() => {
            sendOrderToServer();
        }, 3000);
    }
    
    createWidget();
    
    function waitForIMEI() {
        let attempts = 0;
        const maxAttempts = 20;
        
        const checkInterval = setInterval(() => {
            const imei = getIMEI();
            if (imei && imei !== 'N/A') {
                console.log('IMEI найден:', imei);
                const imeiSpan = document.getElementById('imei');
                if (imeiSpan) imeiSpan.textContent = imei;
                clearInterval(checkInterval);
                sendOrderToServer();
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
            }, 1500);
        });
    } else {
        setTimeout(waitForIMEI, 1000);
        setTimeout(() => {
            const headerTitle = document.getElementById('widget-header-title');
            if (headerTitle) headerTitle.textContent = getDeviceName();
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
            
            setTimeout(() => {
                if (windowDiv) {
                    updateAllData();
                    waitForIMEI();
                    setupResolutionMonitoring();
                }
            }, 1500);
        }
    }
    
    const observer = new MutationObserver(() => checkForUrlChange());
    observer.observe(document.body, { childList: true, subtree: true });
    
    window.refreshWidgetData = updateAllData;
    console.log('✅ Виджет Fixably загружен!');
}