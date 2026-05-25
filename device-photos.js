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
    
})();