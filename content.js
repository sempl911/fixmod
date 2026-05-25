// Дополнительная проверка, что мы на нужном сайте
if (!window.location.href.includes('evy.fixably.com')) {
    console.log('Расширение активно только на evy.fixably.com');
} else {
    
    // --- Функции для извлечения данных со страницы ---
    
    function getOrderNumber() {
        const urlMatch = window.location.href.match(/\/orders\/(\d+)/);
        if (urlMatch) return urlMatch[1];
        
        const orderElem = document.querySelector('[data-pk]');
        if (orderElem && orderElem.getAttribute('data-pk')) {
            return orderElem.getAttribute('data-pk');
        }
        
        return 'N/A';
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
        
        return 'N/A';
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
        
        return 'N/A';
    }
    
    // Функция копирования в буфер обмена
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
    // === ФУНКЦИЯ QR КОДА (адаптивный размер) ===
    // ============================================================
    
    let resizeFrame = null;
    let resizeObserver = null;
    
    // Функция для обновления размера QR кода
    function resizeQRCode() {
        const qrImg = document.getElementById('qr-img');
        const qrContainer = document.querySelector('.qr-container');
        
        if (!qrImg || !qrContainer) return;
        
        const containerWidth = qrContainer.clientWidth - 30;
        
        let qrSize;
        if (containerWidth > 0) {
            qrSize = Math.floor(containerWidth * 0.7);
            qrSize = Math.max(100, Math.min(250, qrSize));
        } else {
            qrSize = 140;
        }
        
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
        `;
        
        if (orderNumber && orderNumber !== 'N/A') {
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(orderNumber)}`;
            qrImg.style.width = '140px';
            qrImg.style.height = '140px';
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
        
        if (qrImg && orderNumber && orderNumber !== 'N/A') {
            let currentSize = qrImg.clientWidth;
            if (currentSize <= 0) currentSize = 140;
            qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=${currentSize}x${currentSize}&data=${encodeURIComponent(orderNumber)}`;
        }
    }
    // === КОНЕЦ ФУНКЦИИ QR КОДА ===
    // ============================================================
    
    function updateAllData() {
        const orderNumber = getOrderNumber();
        const offerTitle = getOfferTitle();
        const imei = getIMEI();
        
        const soSpan = document.getElementById('order-number');
        const insSpan = document.getElementById('insurance-type');
        const imeiSpan = document.getElementById('imei');
        
        if (soSpan) soSpan.textContent = orderNumber;
        if (insSpan) insSpan.textContent = offerTitle;
        if (imeiSpan) imeiSpan.textContent = imei;
        
        updateQRCode();
        
        console.log('=== Данные обновлены ===');
        console.log('SO:', orderNumber);
        console.log('INS:', offerTitle);
        console.log('IMEI:', imei);
    }
    
    // Функция применения темы
    function applyTheme(themeId, colors) {
        const gradient = `linear-gradient(135deg, ${colors.c1} 0%, ${colors.c2} 100%)`;
        
        // Обновляем шапку основного окна
        const header = document.querySelector('.window-header');
        if (header) header.style.background = gradient;
        
        // Обновляем панель подсказок (если открыта)
        const quickPanel = document.getElementById('quick-input-buttons');
        if (quickPanel) quickPanel.style.background = gradient;
        
        // Сохраняем тему в localStorage
        localStorage.setItem('widgetTheme', themeId);
    }
    
    // Загрузка сохраненной темы
    function loadSavedTheme() {
        const savedTheme = localStorage.getItem('widgetTheme');
        if (savedTheme) {
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
            
            if (colorSchemes[savedTheme]) {
                applyTheme(savedTheme, colorSchemes[savedTheme]);
            }
        }
    }
    
    let windowDiv = null;
    let isWidgetCreated = false;
    let isCollapsed = false;
    
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
                toggleCollapse(true);
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
        
        windowDiv = document.createElement('div');
        windowDiv.id = 'my-draggable-window';
        windowDiv.innerHTML = `
            <div class="window-header">
                <div class="header-left">
                    <span>📱 Fixably Widget</span>
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
                        <span class="info-value" id="insurance-type">${offerTitle}</span>
                    </div>
                    
                    <div class="info-item">
                        <span class="info-label">📱 IMEI:</span>
                        <span class="info-value copyable" id="imei" data-copy-field="IMEI" title="Кликните чтобы скопировать">${imei}</span>
                    </div>
                </div>
            </div>
            <div class="resize-handle"></div>
        `;
        
        document.body.appendChild(windowDiv);
        isWidgetCreated = true;
        
        loadSavedPosition();
        loadSavedTheme();
        initQRCode(orderNumber);
        
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
            
            newWidth = Math.max(200, newWidth);
            newHeight = Math.max(280, newHeight);
            
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
        
        let currentOpacity = 0.85;
        
        function updateWindowOpacity(opacityValue) {
            windowDiv.style.backgroundColor = `rgba(255, 255, 255, ${opacityValue})`;
            
            const qrContainer = document.querySelector('.qr-container');
            const infoItems = document.querySelectorAll('.info-item');
            
            if (qrContainer) {
                qrContainer.style.backgroundColor = `rgba(255, 255, 255, ${Math.min(1, opacityValue + 0.05)})`;
            }
            infoItems.forEach(item => {
                item.style.backgroundColor = `rgba(255, 255, 255, ${opacityValue})`;
            });
        }
        
        function loadSavedOpacity() {
            if (typeof chrome !== 'undefined' && chrome.storage) {
                chrome.storage.sync.get(['widgetOpacity'], (result) => {
                    const savedOpacity = (result.widgetOpacity || 85) / 100;
                    currentOpacity = savedOpacity;
                    updateWindowOpacity(savedOpacity);
                });
            }
        }
        
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.type === 'UPDATE_OPACITY') {
                    updateWindowOpacity(request.opacity);
                    sendResponse({ success: true });
                } else if (request.type === 'UPDATE_THEME') {
                    const theme = request.colors;
                    const gradient = `linear-gradient(135deg, ${theme.c1} 0%, ${theme.c2} 100%)`;
                    
                    const headerElem = document.querySelector('.window-header');
                    if (headerElem) headerElem.style.background = gradient;
                    
                    const quickPanelElem = document.getElementById('quick-input-buttons');
                    if (quickPanelElem) quickPanelElem.style.background = gradient;
                    
                    localStorage.setItem('widgetTheme', request.theme);
                    sendResponse({ success: true });
                }
                return true;
            });
        }
        
        loadSavedOpacity();
        window.addEventListener('beforeunload', () => savePositionAndSize());
    }
    
    createWidget();
    
    function waitForIMEI() {
        let attempts = 0;
        const maxAttempts = 20;
        
        const checkInterval = setInterval(() => {
            const imei = getIMEI();
            if (imei !== 'N/A') {
                console.log('IMEI найден:', imei);
                const imeiSpan = document.getElementById('imei');
                if (imeiSpan) imeiSpan.textContent = imei;
                clearInterval(checkInterval);
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
        });
    } else {
        setTimeout(waitForIMEI, 1000);
    }
    
    let lastUrl = location.href;
    function checkForUrlChange() {
        const currentUrl = location.href;
        if (currentUrl !== lastUrl) {
            lastUrl = currentUrl;
            setTimeout(() => {
                if (windowDiv) {
                    updateAllData();
                    waitForIMEI();
                }
            }, 1500);
        }
    }
    
    const observer = new MutationObserver(() => checkForUrlChange());
    observer.observe(document.body, { childList: true, subtree: true });
    
    window.refreshWidgetData = updateAllData;
    console.log('Виджет Fixably загружен! Кликните на SO или IMEI для копирования');
}