// Модуль для отображения фото устройства в верхней панели
(function() {
    console.log('Device Photos: Скрипт запущен');
    
    // Функция для поиска фото
    function countPhotos() {
        let photoCount = 0;
        let photoUrls = [];
        
        // Ищем кнопку "file" и её выпадающее меню
        const fileButtons = document.querySelectorAll('.btn-group');
        
        fileButtons.forEach(btnGroup => {
            // Проверяем, что это кнопка с иконкой file
            const btn = btnGroup.querySelector('.btn-default .fa-file, .btn-default .fa-fw.fa-file');
            if (btn || btnGroup.querySelector('[data-toggle="dropdown"] .fa-file')) {
                const dropdown = btnGroup.querySelector('.dropdown-menu');
                if (dropdown) {
                    const items = dropdown.querySelectorAll('li');
                    items.forEach(item => {
                        const link = item.querySelector('a');
                        if (link) {
                            const text = link.textContent || '';
                            const href = link.getAttribute('href') || '';
                            const nav = link.getAttribute('data-nav') || '';
                            
                            // Проверяем на наличие .jpg
                            if (text.toLowerCase().includes('.jpg') || 
                                href.toLowerCase().includes('.jpg') ||
                                nav.toLowerCase().includes('.jpg')) {
                                
                                let imageUrl = '';
                                if (nav && nav.includes('files?key=')) {
                                    imageUrl = nav;
                                } else if (href && href.includes('files?key=')) {
                                    imageUrl = href;
                                }
                                
                                if (imageUrl && !photoUrls.includes(imageUrl)) {
                                    photoCount++;
                                    photoUrls.push(imageUrl);
                                    console.log('Найдено фото:', imageUrl);
                                }
                            }
                        }
                    });
                }
            }
        });
        
        // Альтернативный поиск
        const allLinks = document.querySelectorAll('a[href*="files?key="], a[data-nav*="files?key="]');
        allLinks.forEach(link => {
            const href = link.getAttribute('href') || '';
            const nav = link.getAttribute('data-nav') || '';
            const text = link.textContent || '';
            
            if (text.toLowerCase().includes('.jpg') && (href || nav)) {
                const url = href || nav;
                if (url && !photoUrls.includes(url)) {
                    photoCount++;
                    photoUrls.push(url);
                    console.log('Найдено фото (альт):', url);
                }
            }
        });
        
        console.log('Device Photos: Найдено фото:', photoCount);
        return { count: photoCount, urls: photoUrls };
    }
    
    // Функция получения прямого URL
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
    
    // Функция открытия фото
    function openPhoto(url) {
        const directUrl = getDirectImageUrl(url);
        if (directUrl) {
            window.open(directUrl, '_blank');
        } else {
            alert('Не удалось открыть фото');
        }
    }
    
    // Цветовые схемы
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
    
    // Функция применения темы к панели
    let currentPreviewPanel = null;
    
    function applyThemeToPhotoPanel(themeId) {
        if (!currentPreviewPanel) return;
        const colors = colorSchemes[themeId];
        if (!colors) return;
        const gradient = `linear-gradient(135deg, ${colors.c1} 0%, ${colors.c2} 100%)`;
        currentPreviewPanel.style.background = gradient;
    }
    
    function loadSavedThemeForPhotos() {
        const savedTheme = localStorage.getItem('widgetTheme');
        if (savedTheme && colorSchemes[savedTheme]) {
            applyThemeToPhotoPanel(savedTheme);
        }
    }
    
    // Функция обновления панели превью
    function updatePreviewPanel(previewPanel, thumbContainer) {
        const result = countPhotos();
        const count = result.count;
        const photos = result.urls;
        
        // Обновляем счетчик
        const countSpan = document.getElementById('nav-photo-count');
        if (countSpan) countSpan.textContent = count;
        
        // Обновляем заголовок
        const panelHeader = previewPanel.querySelector('.panel-header-text');
        if (panelHeader) panelHeader.textContent = `📷 Фото устройства (${count})`;
        
        // Обновляем миниатюры
        thumbContainer.innerHTML = '';
        
        if (count === 0 || photos.length === 0) {
            thumbContainer.innerHTML = '<div style="color:white; text-align:center; grid-column:span 3;">Нет фото</div>';
        } else {
            photos.forEach((photo, index) => {
                const thumbItem = document.createElement('div');
                thumbItem.style.cssText = `
                    background: rgba(255,255,255,0.15);
                    border-radius: 8px;
                    overflow: hidden;
                    position: relative;
                    transition: transform 0.2s;
                    aspect-ratio: 1 / 1;
                    cursor: pointer;
                `;
                thumbItem.onmouseenter = () => {
                    thumbItem.style.transform = 'scale(1.02)';
                };
                thumbItem.onmouseleave = () => {
                    thumbItem.style.transform = 'scale(1)';
                };
                thumbItem.onclick = () => openPhoto(photo);
                
                const thumb = document.createElement('div');
                thumb.style.cssText = `
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: rgba(0,0,0,0.3);
                `;
                
                const img = document.createElement('img');
                const directUrl = getDirectImageUrl(photo);
                img.src = directUrl;
                img.style.cssText = `
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                `;
                img.onerror = () => {
                    img.style.display = 'none';
                    const placeholder = document.createElement('span');
                    placeholder.innerHTML = '📷';
                    placeholder.style.cssText = 'font-size: 24px;';
                    thumb.appendChild(placeholder);
                };
                
                thumb.appendChild(img);
                thumbItem.appendChild(thumb);
                thumbContainer.appendChild(thumbItem);
            });
        }
    }
    
    // Функция для встраивания индикатора
    function injectIntoNavbar() {
        const navbarUpper = document.querySelector('.navbar-upper .navbar-upper-collapse');
        const navbarRight = document.querySelector('.navbar-upper-right');
        
        if (!navbarUpper || !navbarRight) {
            setTimeout(injectIntoNavbar, 500);
            return;
        }
        
        if (document.getElementById('nav-photo-indicator')) return;
        
        const result = countPhotos();
        const count = result.count;
        
        const indicatorContainer = document.createElement('li');
        indicatorContainer.id = 'nav-photo-indicator';
        indicatorContainer.style.cssText = `
            display: inline-block;
            margin: 0 10px;
            position: relative;
        `;
        
        const indicatorBtn = document.createElement('a');
        indicatorBtn.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 8px 12px;
            background: rgba(255,255,255,0.15);
            border-radius: 20px;
            color: white;
            text-decoration: none;
            font-size: 13px;
            transition: all 0.2s;
            cursor: pointer;
        `;
        indicatorBtn.innerHTML = `
            <span>📷</span>
            <span id="nav-photo-count">${count}</span>
            <span style="font-size: 10px;">▼</span>
        `;
        
        const previewPanel = document.createElement('div');
        previewPanel.style.cssText = `
            position: absolute;
            top: 100%;
            right: 0;
            margin-top: 8px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.2);
            padding: 12px;
            display: none;
            z-index: 10000;
            min-width: 320px;
            max-width: 400px;
        `;
        
        // Сохраняем ссылку на панель для применения темы
        currentPreviewPanel = previewPanel;
        
        const panelHeader = document.createElement('div');
        panelHeader.style.cssText = `
            color: white;
            font-size: 12px;
            font-weight: bold;
            padding-bottom: 8px;
            margin-bottom: 8px;
            border-bottom: 1px solid rgba(255,255,255,0.3);
            display: flex;
            justify-content: space-between;
            align-items: center;
        `;
        panelHeader.innerHTML = `
            <span class="panel-header-text">📷 Фото устройства (${count})</span>
            <span id="close-photo-preview" style="cursor: pointer; font-size: 16px;">✕</span>
        `;
        previewPanel.appendChild(panelHeader);
        
        const thumbContainer = document.createElement('div');
        thumbContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            max-height: 350px;
            overflow-y: auto;
            padding: 4px;
        `;
        previewPanel.appendChild(thumbContainer);
        
        indicatorContainer.appendChild(indicatorBtn);
        indicatorContainer.appendChild(previewPanel);
        
        navbarUpper.insertBefore(indicatorContainer, navbarRight);
        
        // Загружаем сохраненную тему
        loadSavedThemeForPhotos();
        
        let isOpen = false;
        let updateInterval = null;
        
        indicatorBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isOpen) {
                previewPanel.style.display = 'none';
                isOpen = false;
                if (updateInterval) {
                    clearInterval(updateInterval);
                    updateInterval = null;
                }
            } else {
                // Принудительно обновляем данные перед показом
                updatePreviewPanel(previewPanel, thumbContainer);
                previewPanel.style.display = 'block';
                isOpen = true;
                
                // Запускаем периодическое обновление пока панель открыта
                if (updateInterval) clearInterval(updateInterval);
                updateInterval = setInterval(() => {
                    if (isOpen) {
                        updatePreviewPanel(previewPanel, thumbContainer);
                    }
                }, 2000);
            }
        };
        
        const closeBtn = document.getElementById('close-photo-preview');
        if (closeBtn) {
            closeBtn.onclick = () => {
                previewPanel.style.display = 'none';
                isOpen = false;
                if (updateInterval) {
                    clearInterval(updateInterval);
                    updateInterval = null;
                }
            };
        }
        
        document.addEventListener('click', (e) => {
            if (isOpen && !indicatorContainer.contains(e.target)) {
                previewPanel.style.display = 'none';
                isOpen = false;
                if (updateInterval) {
                    clearInterval(updateInterval);
                    updateInterval = null;
                }
            }
        });
        
        console.log('Device Photos: Индикатор встроен');
    }
    
    // Функция ожидания загрузки контента
    function waitForContent() {
        // Проверяем, загрузилось ли меню с фото
        const checkInterval = setInterval(() => {
            const fileMenu = document.querySelector('.btn-group .dropdown-menu li a[href*=".jpg"]');
            if (fileMenu) {
                console.log('Device Photos: Контент загружен');
                clearInterval(checkInterval);
                injectIntoNavbar();
            }
        }, 500);
        
        // Таймаут на случай если фото нет
        setTimeout(() => {
            clearInterval(checkInterval);
            injectIntoNavbar();
        }, 5000);
    }
    
    // Запускаем после полной загрузки страницы
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(waitForContent, 500);
        });
    } else {
        setTimeout(waitForContent, 500);
    }
    
    // Наблюдаем за изменениями для обновления счетчика
    let updateTimeout;
    const observer = new MutationObserver(() => {
        if (updateTimeout) clearTimeout(updateTimeout);
        updateTimeout = setTimeout(() => {
            const countSpan = document.getElementById('nav-photo-count');
            if (countSpan) {
                const newCount = countPhotos().count;
                if (newCount !== parseInt(countSpan.textContent)) {
                    countSpan.textContent = newCount;
                }
            }
        }, 1000);
    });
    
    setTimeout(() => {
        observer.observe(document.body, { childList: true, subtree: true });
    }, 3000);
    
    // Слушаем сообщения об изменении темы
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.type === 'UPDATE_THEME') {
                applyThemeToPhotoPanel(request.theme);
                sendResponse({ success: true });
            }
            return true;
        });
    }
    
})();