// widget.js - Управление виджетом

console.log('🖼️ Widget module loading...');

// ============================================================
// === КОПИРОВАНИЕ В БУФЕР ===
// ============================================================

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

// ============================================================
// === QR КОД ===
// ============================================================

function generateQRUrl(data, size) {
    return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(data)}&format=png&margin=10`;
}

// ============================================================
// === СОСТОЯНИЕ ВИДЖЕТА ===
// ============================================================

let windowDiv = null;
let isWidgetCreated = false;
let isCollapsed = false;
let qrEnabled = true;
let qrSize = 100;
let resizeFrame = null;
let resizeObserver = null;
let currentFontSize = 10;

const STORAGE_KEYS = {
    WIDGET_POSITION: 'fixmod_widget_position',
    WIDGET_SIZE: 'fixmod_widget_size',
    WIDGET_COLLAPSED: 'fixmod_widget_collapsed'
};

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

// ============================================================
// === ЗАГРУЗКА НАСТРОЕК ===
// ============================================================

function loadQRSetting() {
    const saved = localStorage.getItem('qrEnabled');
    if (saved !== null) {
        qrEnabled = saved === 'true';
    } else {
        qrEnabled = true;
    }
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

function loadSavedOpacity() {
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get(['widgetOpacity'], (result) => {
            const savedOpacity = (result.widgetOpacity !== undefined ? result.widgetOpacity : 85) / 100;
            currentOpacity = savedOpacity;
            updateWindowOpacity(savedOpacity);
        });
    }
}

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

// ============================================================
// === ЗАГРУЗКА ТЕМЫ ===
// ============================================================

function loadSavedTheme() {
    if (!window.ThemeManager) {
        console.warn('⚠️ ThemeManager не загружен');
        return;
    }
    
    // Передаем виджет в ThemeManager
    if (typeof window.ThemeManager.setWidgetElement === 'function') {
        window.ThemeManager.setWidgetElement(windowDiv);
    }
    
    if (typeof window.ThemeManager.loadSavedTheme !== 'function') {
        console.warn('⚠️ ThemeManager.loadSavedTheme не найден');
        return;
    }
    
    const themeId = window.ThemeManager.loadSavedTheme();
    console.log('🎨 Тема загружена:', themeId);
    
    if (window.ThemeManager.applyTheme) {
        const savedTheme = localStorage.getItem('widgetTheme') || 'default';
        window.ThemeManager.applyTheme(savedTheme);
        console.log('🎨 Тема применена:', savedTheme);
    }
}

// ============================================================
// === ПРИМЕНЕНИЕ НАСТРОЕК ===
// ============================================================

function applyFontSize(size) {
    currentFontSize = size;
    const infoValues = document.querySelectorAll('.info-value');
    infoValues.forEach(el => {
        el.style.fontSize = size + 'px';
    });
    localStorage.setItem('widgetFontSize', size);
}

function updateWindowOpacity(opacityValue) {
    if (!windowDiv) return;
    
    currentOpacity = opacityValue;
    
    // Основной фон виджета
    windowDiv.style.backgroundColor = `rgba(255, 255, 255, ${opacityValue})`;
    
    // QR контейнер
    const qrContainer = windowDiv?.querySelector('.qr-container');
    if (qrContainer) {
        qrContainer.style.backgroundColor = `rgba(255, 255, 255, ${Math.min(1, opacityValue + 0.05)})`;
    }
    
    // Инфо-элементы
    const infoItems = windowDiv?.querySelectorAll('.info-item');
    infoItems?.forEach(item => {
        item.style.backgroundColor = `rgba(255, 255, 255, ${opacityValue})`;
    });
    
    // 👇 Применяем прозрачность к заголовку через ThemeManager
    if (window.ThemeManager && typeof window.ThemeManager.setOpacity === 'function') {
        window.ThemeManager.setOpacity(opacityValue);
        console.log('🎨 Прозрачность заголовка обновлена:', opacityValue);
    }
}

function applyPaddingConfig(config) {
    const body = windowDiv?.querySelector('.window-body');
    const infoSection = windowDiv?.querySelector('.info-section');
    const infoItems = windowDiv?.querySelectorAll('.info-item');
    const qrContainer = windowDiv?.querySelector('.qr-container');
    
    if (body) {
        body.style.padding = config.windowBodyPadding;
    }
    if (infoSection) {
        infoSection.style.padding = config.infoSectionPadding;
        infoSection.style.gap = config.infoSectionGap;
    }
    infoItems?.forEach(item => {
        item.style.padding = config.infoItemPadding;
    });
    if (qrContainer && !qrEnabled) {
        qrContainer.style.padding = config.qrPadding;
        qrContainer.style.margin = config.qrMargin;
    }
}

// ============================================================
// === РАЗМЕРЫ И ПОЗИЦИЯ ===
// ============================================================

function updateWindowSize() {
    if (!windowDiv || isCollapsed) return;
    
    // Не пересчитываем высоту, если пользователь уже задал размер вручную
    const savedSize = localStorage.getItem(STORAGE_KEYS.WIDGET_SIZE);
    if (savedSize) {
        return;
    }
    
    const headerHeight = 32;
    const qrContainer = windowDiv?.querySelector('.qr-container');
    const infoSection = windowDiv?.querySelector('.info-section');
    
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
    const qrContainer = windowDiv?.querySelector('.qr-container');
    
    if (!qrImg || !qrContainer) return;
    
    if (!qrEnabled) {
        qrContainer.style.display = 'none';
        qrContainer.style.minHeight = '0';
        qrContainer.style.maxHeight = '0';
        qrContainer.style.padding = '0';
        qrContainer.style.margin = '0';
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
    
    const orderNumber = typeof getOrderNumber === 'function' ? getOrderNumber() : 'N/A';
    if (orderNumber && orderNumber !== 'N/A' && typeof isOrderPage === 'function' && isOrderPage()) {
        qrImg.src = generateQRUrl(orderNumber, qrSize);
    } else {
        qrImg.src = '';
    }
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
            console.log('💾 Размер сохранен:', width, 'x', height);
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
        }, 150);
    }
    if (!skipSave) {
        localStorage.setItem(STORAGE_KEYS.WIDGET_COLLAPSED, isCollapsed);
        savePositionAndSize();
    }
}

// ============================================================
// === QR КОД ===
// ============================================================

function initQRCode(orderNumber) {
    const qrContainer = windowDiv?.querySelector('.qr-container');
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
    
    if (orderNumber && orderNumber !== 'N/A' && typeof isOrderPage === 'function' && isOrderPage()) {
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
    
    setTimeout(() => {
        resizeQRCode();
    }, 200);
}

function updateQRCode() {
    const orderNumber = typeof getOrderNumber === 'function' ? getOrderNumber() : 'N/A';
    const qrImg = document.getElementById('qr-img');
    
    if (qrImg && orderNumber && orderNumber !== 'N/A' && qrEnabled && typeof isOrderPage === 'function' && isOrderPage()) {
        const currentSize = qrSize || 90;
        qrImg.src = generateQRUrl(orderNumber, currentSize);
    } else if (qrImg) {
        qrImg.src = '';
    }
}

function setQREnabled(enabled) {
    qrEnabled = enabled;
    const qrContainer = windowDiv?.querySelector('.qr-container');
    const infoSection = windowDiv?.querySelector('.info-section');
    
    if (qrContainer) {
        if (enabled) {
            qrContainer.style.display = 'flex';
            qrContainer.style.minHeight = '40px';
            qrContainer.style.maxHeight = '120px';
            qrContainer.style.padding = '4px';
            qrContainer.style.margin = '0 0 2px 0';
            const orderNumber = typeof getOrderNumber === 'function' ? getOrderNumber() : 'N/A';
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
    }, 150);
}

// ============================================================
// === ПЕРЕТАСКИВАНИЕ И РАЗМЕР ===
// ============================================================

function setupDragAndDrop() {
    const header = windowDiv?.querySelector('.window-header');
    const resizeHandle = windowDiv?.querySelector('.resize-handle');
    const resizeHandleRight = windowDiv?.querySelector('.resize-handle-right');
    
    if (!header) return;
    
    let saveTimeout = null;
    const savePositionDelayed = () => {
        if (saveTimeout) clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => savePositionAndSize(), 100);
    };
    
    // ============================================================
    // ПЕРЕТАСКИВАНИЕ
    // ============================================================
    
    let isDragging = false;
    let dragStartX = 0, dragStartY = 0;
    let startLeft = 0, startTop = 0;
    
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
    
    // ============================================================
    // ИЗМЕНЕНИЕ РАЗМЕРА (правый край — только ширина)
    // ============================================================
    
    if (resizeHandleRight) {
        let isResizingRight = false;
        let startResizeX = 0;
        let startResizeWidth = 0;
        
        resizeHandleRight.addEventListener('mousedown', (e) => {
            if (isCollapsed) return;
            isResizingRight = true;
            startResizeX = e.clientX;
            startResizeWidth = windowDiv.offsetWidth;
            windowDiv.style.transition = 'none';
            e.preventDefault();
            e.stopPropagation();
            console.log('🔧 Right resize started');
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizingRight) return;
            
            let newWidth = startResizeWidth + (e.clientX - startResizeX);
            newWidth = Math.max(200, Math.min(newWidth, 800));
            
            windowDiv.style.width = newWidth + 'px';
            
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
    }
    
    // ============================================================
    // ИЗМЕНЕНИЕ РАЗМЕРА (правый нижний угол — ширина + высота)
    // ============================================================
    
    if (resizeHandle) {
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
            windowDiv.style.transition = 'none';
            e.preventDefault();
            e.stopPropagation();
            console.log('🔧 Corner resize started:', startWidth, 'x', startHeight);
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            let newWidth = startWidth + deltaX;
            let newHeight = startHeight + deltaY;
            
            newWidth = Math.max(200, Math.min(newWidth, 800));
            newHeight = Math.max(130, Math.min(newHeight, 700));
            
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
                windowDiv.style.transition = '';
                resizeQRCode();
                savePositionDelayed();
                console.log('🔧 Corner resize ended');
            }
        });
    }
}

// ============================================================
// === СОЗДАНИЕ ВИДЖЕТА ===
// ============================================================

function createWidget(orderNumber, offerTitle, deviceName, customerEmail, imei, isOrder) {
    // Проверяем, включен ли виджет в настройках
    if (typeof chrome !== 'undefined' && chrome.storage) {
        chrome.storage.sync.get(['widgetEnabled'], (result) => {
            const widgetEnabled = result.widgetEnabled !== undefined ? result.widgetEnabled : true;
            if (!widgetEnabled) {
                console.log('📊 Виджет отключен в настройках');
                return;
            }
            createWidgetInternal(orderNumber, offerTitle, deviceName, customerEmail, imei, isOrder);
        });
    } else {
        createWidgetInternal(orderNumber, offerTitle, deviceName, customerEmail, imei, isOrder);
    }
}

function createWidgetInternal(orderNumber, offerTitle, deviceName, customerEmail, imei, isOrder) {
    if (isWidgetCreated && windowDiv) {
        console.log('🖼️ Widget already exists, updating...');
        updateWidgetData();
        return;
    }
    
    console.log('🖼️ Creating widget...');
    
    loadQRSetting();
    
    const iconPath = chrome.runtime.getURL('uiAssets/');
    
    const displayOrderNumber = isOrder ? (orderNumber || 'N/A') : 'N/A';
    const displayOfferTitle = isOrder ? (offerTitle || 'N/A') : 'N/A';
    const displayImei = isOrder ? (imei || 'N/A') : 'N/A';
    const displayEmail = isOrder ? (customerEmail || 'N/A') : 'N/A';
    const displayDeviceName = isOrder ? (deviceName || 'FixMod Widget') : 'FixMod Widget';
    
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
    
    // Загружаем позицию и размер шрифта
    loadSavedPosition();
    loadSavedFontSize();
    
    // 👇 Применяем тему и прозрачность ПОСЛЕ добавления виджета в DOM
    setTimeout(() => {
        // Передаем виджет в ThemeManager
        if (window.ThemeManager && typeof window.ThemeManager.setWidgetElement === 'function') {
            window.ThemeManager.setWidgetElement(windowDiv);
        }
        
        // Загружаем прозрачность из storage
        if (typeof chrome !== 'undefined' && chrome.storage) {
            chrome.storage.sync.get(['widgetOpacity'], (result) => {
                const opacity = (result.widgetOpacity !== undefined ? result.widgetOpacity : 85) / 100;
                currentOpacity = opacity;
                
                // Устанавливаем прозрачность в ThemeManager
                if (window.ThemeManager && typeof window.ThemeManager.setOpacity === 'function') {
                    window.ThemeManager.setOpacity(opacity);
                }
                
                // Применяем ко всем элементам виджета
                updateWindowOpacity(opacity);
                
                // Загружаем тему (уже с правильной прозрачностью)
                loadSavedTheme();
                
                console.log('🎨 Тема и прозрачность применены:', {
                    theme: localStorage.getItem('widgetTheme') || 'default',
                    opacity: opacity
                });
            });
        } else {
            loadSavedTheme();
        }
    }, 50);
    
    // Инициализируем QR
    if (qrEnabled && isOrder && orderNumber && orderNumber !== 'N/A') {
        initQRCode(orderNumber);
    }
    
    // Настройка копирования
    const copyableElements = windowDiv.querySelectorAll('.copyable');
    copyableElements.forEach(el => {
        el.addEventListener('click', () => {
            const text = el.textContent;
            const fieldName = el.getAttribute('data-copy-field');
            copyToClipboard(text, fieldName);
        });
    });
    
    // Кнопки
    const collapseBtn = windowDiv.querySelector('.collapse-btn');
    const closeBtn = windowDiv.querySelector('.close-btn');
    
    collapseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCollapse();
    });
    
    closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        windowDiv.style.display = 'none';
    });
    
    // Перетаскивание и изменение размера
    setupDragAndDrop();
    
    // Добавляем стили
    addWidgetStyles();
    
    // Если у пользователя сохранен размер — не трогаем его
    const savedSize = localStorage.getItem(STORAGE_KEYS.WIDGET_SIZE);
    if (!savedSize) {
        setTimeout(() => {
            updateWindowSize();
        }, 100);
    }
    
    console.log('🖼️ Виджет создан');
}

// ============================================================
// === СТИЛИ ВИДЖЕТА ===
// ============================================================

function addWidgetStyles() {
    if (document.getElementById('fixmod-widget-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'fixmod-widget-styles';
    style.textContent = `
        #my-draggable-window {
            position: fixed;
            width: 260px;
            min-width: 200px;
            max-width: 800px;
            min-height: 130px;
            max-height: 700px;
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
            display: flex;
            flex-direction: column;
        }
        
        #my-draggable-window.collapsed .window-body {
            display: none;
        }
        
        #my-draggable-window.collapsed {
            height: 32px !important;
            min-height: 32px !important;
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
            padding: 4px 8px 20px 8px;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            flex: 1;
            min-height: 0;
            position: relative;
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
            width: 20px;
            height: 20px;
            cursor: nwse-resize;
            background: linear-gradient(135deg, transparent 50%, rgba(102,126,234,0.4) 50%);
            border-radius: 0 0 8px 0;
            z-index: 9999;
            pointer-events: auto;
        }
        
        #my-draggable-window .resize-handle:hover {
            background: linear-gradient(135deg, transparent 50%, rgba(102,126,234,0.6) 50%);
        }
        
        #my-draggable-window .resize-handle-right {
            position: absolute;
            right: 0;
            top: 32px;
            bottom: 20px;
            width: 10px;
            cursor: ew-resize;
            background: transparent;
            z-index: 9998;
            pointer-events: auto;
        }
        
        #my-draggable-window .resize-handle-right:hover {
            background: rgba(102,126,234,0.2);
        }
        
        #my-draggable-window.collapsed .resize-handle,
        #my-draggable-window.collapsed .resize-handle-right {
            display: none;
        }
        
        #my-draggable-window .window-body::-webkit-scrollbar {
            width: 4px;
        }
        
        #my-draggable-window .window-body::-webkit-scrollbar-track {
            background: transparent;
        }
        
        #my-draggable-window .window-body::-webkit-scrollbar-thumb {
            background: rgba(0,0,0,0.15);
            border-radius: 2px;
        }
        
        #my-draggable-window .window-body::-webkit-scrollbar-thumb:hover {
            background: rgba(0,0,0,0.25);
        }
    `;
    document.head.appendChild(style);
}

// ============================================================
// === ОБНОВЛЕНИЕ ДАННЫХ В ВИДЖЕТЕ ===
// ============================================================

function updateWidgetData() {
    if (!windowDiv) return;
    
    const orderNumber = typeof getOrderNumber === 'function' ? getOrderNumber() : 'N/A';
    const offerTitle = typeof getOfferTitle === 'function' ? getOfferTitle() : 'N/A';
    const deviceName = typeof getDeviceName === 'function' ? getDeviceName() : 'FixMod Widget';
    const imei = typeof getIMEI === 'function' ? getIMEI() : 'N/A';
    const email = typeof getCustomerEmail === 'function' ? getCustomerEmail() : 'N/A';
    
    const soSpan = document.getElementById('order-number');
    const insSpan = document.getElementById('insurance-type');
    const headerTitle = document.getElementById('widget-header-title');
    const imeiSpan = document.getElementById('imei');
    const emailSpan = document.getElementById('customer-email');
    
    if (soSpan) soSpan.textContent = orderNumber;
    if (insSpan) insSpan.textContent = offerTitle || 'N/A';
    if (headerTitle) headerTitle.textContent = deviceName;
    if (imeiSpan) imeiSpan.textContent = imei || 'N/A';
    if (emailSpan) emailSpan.textContent = email || 'N/A';
    
    updateQRCode();
}

function resetWidgetData() {
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
}

// ============================================================
// === ОБРАБОТЧИК СООБЩЕНИЙ ОТ SETTINGS ===
// ============================================================

if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        console.log('📩 Widget получил сообщение:', request.type, request);
        
        try {
            switch(request.type) {
                case 'UPDATE_OPACITY':
                    updateWindowOpacity(request.opacity);
                    console.log('✅ Opacity обновлена:', request.opacity);
                    sendResponse({ success: true });
                    break;
                    
                case 'UPDATE_THEME':
                    if (window.ThemeManager && typeof window.ThemeManager.applyTheme === 'function') {
                        if (typeof window.ThemeManager.setWidgetElement === 'function') {
                            window.ThemeManager.setWidgetElement(windowDiv);
                        }
                        window.ThemeManager.applyTheme(request.theme);
                        console.log('✅ Тема обновлена:', request.theme);
                    } else {
                        console.warn('⚠️ ThemeManager недоступен');
                    }
                    sendResponse({ success: true });
                    break;
                    
                case 'UPDATE_FONT_SIZE':
                    applyFontSize(request.fontSize);
                    console.log('✅ Размер шрифта обновлен:', request.fontSize);
                    sendResponse({ success: true });
                    break;
                    
                case 'UPDATE_QR_ENABLED':
                    setQREnabled(request.enabled);
                    console.log('✅ QR обновлен:', request.enabled);
                    sendResponse({ success: true });
                    break;
                    
                case 'UPDATE_WIDGET':
                    if (request.enabled) {
                        if (windowDiv) {
                            windowDiv.style.display = 'flex';
                            console.log('✅ Виджет показан');
                        } else if (typeof createWidgetInternal === 'function') {
                            console.log('🔄 Пересоздание виджета...');
                            const orderNumber = typeof getOrderNumber === 'function' ? getOrderNumber() : 'N/A';
                            const offerTitle = typeof getOfferTitle === 'function' ? getOfferTitle() : 'N/A';
                            const deviceName = typeof getDeviceName === 'function' ? getDeviceName() : 'FixMod Widget';
                            const imei = typeof getIMEI === 'function' ? getIMEI() : 'N/A';
                            const email = typeof getCustomerEmail === 'function' ? getCustomerEmail() : 'N/A';
                            const isOrder = typeof isOrderPage === 'function' ? isOrderPage() : false;
                            createWidgetInternal(orderNumber, offerTitle, deviceName, email, imei, isOrder);
                        }
                    } else {
                        if (windowDiv) {
                            windowDiv.style.display = 'none';
                            console.log('✅ Виджет скрыт');
                        }
                    }
                    sendResponse({ success: true });
                    break;
                    
                case 'UPDATE_DARK_MODE':
                    if (window.ThemeManager && typeof window.ThemeManager.applyTheme === 'function') {
                        if (typeof window.ThemeManager.setWidgetElement === 'function') {
                            window.ThemeManager.setWidgetElement(windowDiv);
                        }
                        const themeId = request.enabled ? 'dark' : 'default';
                        window.ThemeManager.applyTheme(themeId);
                        console.log('✅ Dark mode:', request.enabled, '→ тема:', themeId);
                    }
                    sendResponse({ success: true });
                    break;
                    
                case 'UPDATE_SUGGESTIONS':
                    if (window.SuggestionsManager && typeof window.SuggestionsManager.setEnabled === 'function') {
                        window.SuggestionsManager.setEnabled(request.enabled);
                        console.log('✅ Подсказки:', request.enabled);
                    } else {
                        console.warn('⚠️ SuggestionsManager недоступен');
                    }
                    sendResponse({ success: true });
                    break;
                    
                default:
                    console.log('⚠️ Неизвестный тип:', request.type);
                    sendResponse({ success: false, error: 'Unknown message type' });
            }
        } catch (e) {
            console.error('❌ Ошибка обработки сообщения:', e);
            sendResponse({ success: false, error: e.message });
        }
        
        return true;
    });
    
    console.log('📩 Обработчик сообщений зарегистрирован в widget.js');
}

// ============================================================
// === ГЛОБАЛЬНЫЙ ОБЪЕКТ ===
// ============================================================

window.FixModWidget = {
    create: function(orderNumber, offerTitle, deviceName, customerEmail, imei, isOrder) {
        console.log('🖼️ Creating widget via FixModWidget.create...');
        try {
            createWidget(orderNumber, offerTitle, deviceName, customerEmail, imei, isOrder);
        } catch (e) {
            console.warn('⚠️ Error creating widget:', e);
        }
    },
    
    createWidget: createWidget,
    createWidgetInternal: createWidgetInternal,
    updateQRCode: updateQRCode,
    updateWidgetData: updateWidgetData,
    resetWidgetData: resetWidgetData,
    setQREnabled: setQREnabled,
    updateWindowOpacity: updateWindowOpacity,
    toggleCollapse: toggleCollapse,
    applyTheme: loadSavedTheme,
    updateSize: updateWindowSize,
    
    setWidgetElement: function() {
        if (window.ThemeManager && typeof window.ThemeManager.setWidgetElement === 'function') {
            window.ThemeManager.setWidgetElement(windowDiv);
        }
    },
    
    getElement: function() { return windowDiv; },
    isCreated: function() { return isWidgetCreated; },
    getCollapsed: function() { return isCollapsed; }
};

console.log('🖼️ FixModWidget loaded');