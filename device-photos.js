// Модуль для отображения фото устройства в верхней панели
(function() {
    console.log('📷 Device Photos: Script started');
    
    // ============================================================
    // === STATE ===
    // ============================================================
    
    let selectedPhotos = new Set();
    let currentPreviewPanel = null;
    let photoData = [];
    let isPhotoViewerOpen = false;
    
    // ============================================================
    // === COLOR SCHEMES ===
    // ============================================================
    
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
    
    // ============================================================
    // === PHOTO FINDING FUNCTIONS ===
    // ============================================================
    
    function countPhotos() {
        let photoUrls = [];
        
        const fileButtons = document.querySelectorAll('.btn-group');
        
        fileButtons.forEach(btnGroup => {
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
                                    photoUrls.push(imageUrl);
                                }
                            }
                        }
                    });
                }
            }
        });
        
        const allLinks = document.querySelectorAll('a[href*="files?key="], a[data-nav*="files?key="]');
        allLinks.forEach(link => {
            const href = link.getAttribute('href') || '';
            const nav = link.getAttribute('data-nav') || '';
            const text = link.textContent || '';
            
            if (text.toLowerCase().includes('.jpg') && (href || nav)) {
                const url = href || nav;
                if (url && !photoUrls.includes(url)) {
                    photoUrls.push(url);
                }
            }
        });
        
        console.log(`📷 Device Photos: Found ${photoUrls.length} photos`);
        return { count: photoUrls.length, urls: photoUrls };
    }
    
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
    
    // ============================================================
    // === DOWNLOAD PHOTOS (через background) ===
    // ============================================================
    
    function downloadPhoto(url, filename) {
        return new Promise((resolve) => {
            try {
                const directUrl = getDirectImageUrl(url);
                if (!directUrl) {
                    console.error('❌ Cannot get direct URL');
                    resolve({ success: false, error: 'No direct URL' });
                    return;
                }
                
                const finalFilename = filename || `photo_${Date.now()}.jpg`;
                
                // Отправляем запрос в background
                if (typeof chrome !== 'undefined' && chrome.runtime) {
                    chrome.runtime.sendMessage({
                        type: 'DOWNLOAD_PHOTO',
                        url: directUrl,
                        filename: finalFilename
                    }, (response) => {
                        // Проверяем ответ
                        if (response && response.success) {
                            console.log('✅ Download started:', response.filename || finalFilename);
                            resolve({ success: true, downloadId: response.downloadId });
                        } else {
                            const errorMsg = response?.error || 'Download failed';
                            console.warn('⚠️ Download failed:', errorMsg);
                            // Fallback: пробуем через ссылку
                            try {
                                const link = document.createElement('a');
                                link.href = directUrl;
                                link.download = finalFilename;
                                link.target = '_blank';
                                link.click();
                                resolve({ success: true, fallback: true });
                            } catch (e) {
                                resolve({ success: false, error: errorMsg });
                            }
                        }
                    });
                } else {
                    // Fallback: через ссылку
                    try {
                        const link = document.createElement('a');
                        link.href = directUrl;
                        link.download = finalFilename;
                        link.target = '_blank';
                        link.click();
                        resolve({ success: true, fallback: true });
                    } catch (e) {
                        resolve({ success: false, error: e.message });
                    }
                }
            } catch (error) {
                console.error('❌ Download error:', error);
                resolve({ success: false, error: error.message });
            }
        });
    }
    
    async function downloadSelectedPhotos() {
        if (selectedPhotos.size === 0) {
            showNotification('❌ Please select at least one photo to download', 'warning');
            return;
        }
        
        const selectedUrls = Array.from(selectedPhotos);
        console.log(`📥 Downloading ${selectedUrls.length} photos...`);
        
        let successCount = 0;
        let failCount = 0;
        let downloadedNames = [];
        
        for (const url of selectedUrls) {
            const urlParts = url.split('/');
            let filename = urlParts[urlParts.length - 1].split('?')[0];
            if (!filename || !filename.includes('.')) {
                filename = `photo_${Date.now()}_${Math.random().toString(36).substr(2, 4)}.jpg`;
            }
            
            const result = await downloadPhoto(url, filename);
            if (result && result.success) {
                successCount++;
                if (result.filename || filename) {
                    downloadedNames.push(result.filename || filename);
                }
            } else {
                failCount++;
            }
            await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        let message = `✅ Downloaded: ${successCount}`;
        if (failCount > 0) {
            message += ` ❌ Failed: ${failCount}`;
        }
        if (downloadedNames.length > 0 && downloadedNames.length <= 3) {
            message += ` 📁 ${downloadedNames.join(', ')}`;
        }
        showNotification(message, failCount === 0 ? 'success' : 'warning');
        
        selectedPhotos.clear();
        updatePreviewPanel(currentPreviewPanel, document.querySelector('.photo-thumb-container'));
    }
    
    // ============================================================
    // === NOTIFICATIONS ===
    // ============================================================
    
    function showNotification(message, type = 'success') {
        const colors = {
            success: '#34c759',
            warning: '#ff9500',
            error: '#ff3b30',
            info: '#007aff'
        };
        
        const notification = document.createElement('div');
        notification.textContent = message;
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
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
    
    // ============================================================
    // === PHOTO VIEWER ===
    // ============================================================
    
    function openPhotoViewer(url) {
        const directUrl = getDirectImageUrl(url);
        if (!directUrl) {
            showNotification('❌ Cannot open photo', 'error');
            return;
        }
        
        isPhotoViewerOpen = true;
        
        const overlay = document.createElement('div');
        overlay.id = 'photo-viewer-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.92);
            z-index: 9999999;
            display: flex;
            align-items: center;
            justify-content: center;
            animation: fadeIn 0.25s ease;
        `;
        
        const img = document.createElement('img');
        img.src = directUrl;
        img.style.cssText = `
            max-width: 92%;
            max-height: 92%;
            object-fit: contain;
            border-radius: 8px;
            box-shadow: 0 10px 40px rgba(0,0,0,0.5);
            pointer-events: none;
        `;
        
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        closeBtn.style.cssText = `
            position: fixed;
            top: 20px;
            right: 30px;
            background: rgba(255,255,255,0.15);
            border: none;
            border-radius: 50%;
            color: white;
            font-size: 24px;
            width: 50px;
            height: 50px;
            cursor: pointer;
            transition: background 0.2s;
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000000;
        `;
        closeBtn.onmouseenter = () => closeBtn.style.background = 'rgba(255,255,255,0.3)';
        closeBtn.onmouseleave = () => closeBtn.style.background = 'rgba(255,255,255,0.15)';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            closePhotoViewer(overlay);
        };
        
        overlay.onclick = (e) => {
            if (e.target === overlay) {
                closePhotoViewer(overlay);
            }
        };
        
        const escHandler = function(e) {
            if (e.key === 'Escape') {
                closePhotoViewer(overlay);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
        
        overlay.appendChild(img);
        overlay.appendChild(closeBtn);
        document.body.appendChild(overlay);
        
        if (!document.getElementById('photo-viewer-styles')) {
            const style = document.createElement('style');
            style.id = 'photo-viewer-styles';
            style.textContent = `
                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.95); }
                    to { opacity: 1; transform: scale(1); }
                }
                @keyframes fadeOut {
                    from { opacity: 1; }
                    to { opacity: 0; }
                }
            `;
            document.head.appendChild(style);
        }
    }
    
    function closePhotoViewer(overlay) {
        if (!overlay) {
            overlay = document.getElementById('photo-viewer-overlay');
        }
        if (overlay) {
            overlay.style.animation = 'fadeOut 0.2s ease forwards';
            setTimeout(() => {
                overlay.remove();
                isPhotoViewerOpen = false;
            }, 200);
        } else {
            isPhotoViewerOpen = false;
        }
    }
    
    // ============================================================
    // === UPDATE PREVIEW PANEL ===
    // ============================================================
    
    function updatePreviewPanel(previewPanel, thumbContainer) {
        if (!previewPanel || !thumbContainer) return;
        
        const result = countPhotos();
        const count = result.count;
        const photos = result.urls;
        photoData = photos;
        
        const countSpan = document.getElementById('nav-photo-count');
        if (countSpan) countSpan.textContent = count;
        
        const panelHeader = previewPanel.querySelector('.panel-header-text');
        if (panelHeader) panelHeader.textContent = `📷 Device photos (${count})`;
        
        const downloadBtn = document.getElementById('download-selected-btn');
        if (downloadBtn) {
            downloadBtn.textContent = `⬇️ Download (${selectedPhotos.size})`;
            downloadBtn.disabled = selectedPhotos.size === 0;
        }
        
        thumbContainer.innerHTML = '';
        
        if (count === 0 || photos.length === 0) {
            thumbContainer.innerHTML = '<div style="color:white; text-align:center; grid-column:span 3; padding:20px;">No photos</div>';
        } else {
            photos.forEach((photo, index) => {
                const thumbItem = createThumbnail(photo, index);
                thumbContainer.appendChild(thumbItem);
            });
        }
    }
    
    function createThumbnail(photo, index) {
        const container = document.createElement('div');
        container.style.cssText = `
            background: rgba(255,255,255,0.1);
            border-radius: 8px;
            overflow: hidden;
            position: relative;
            transition: transform 0.2s, box-shadow 0.2s;
            aspect-ratio: 1 / 1;
            border: 2px solid transparent;
        `;
        container.className = 'photo-thumb-item';
        
        // Checkbox (top-left)
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.style.cssText = `
            position: absolute;
            top: 4px;
            left: 4px;
            z-index: 2;
            width: 18px;
            height: 18px;
            cursor: pointer;
            opacity: 0.8;
        `;
        checkbox.checked = selectedPhotos.has(photo);
        checkbox.onchange = (e) => {
            e.stopPropagation();
            if (checkbox.checked) {
                selectedPhotos.add(photo);
            } else {
                selectedPhotos.delete(photo);
            }
            const downloadBtn = document.getElementById('download-selected-btn');
            if (downloadBtn) {
                downloadBtn.textContent = `⬇️ Download (${selectedPhotos.size})`;
                downloadBtn.disabled = selectedPhotos.size === 0;
            }
            container.style.borderColor = checkbox.checked ? '#4CAF50' : 'transparent';
            container.style.boxShadow = checkbox.checked ? '0 0 10px rgba(76, 175, 80, 0.5)' : 'none';
        };
        container.appendChild(checkbox);
        
        // View button (bottom-right) - ⬈
        const viewBtn = document.createElement('button');
        viewBtn.textContent = '⬈';
        viewBtn.style.cssText = `
            position: absolute;
            bottom: 4px;
            right: 4px;
            z-index: 2;
            background: rgba(0,0,0,0.6);
            border: none;
            border-radius: 50%;
            color: white;
            width: 28px;
            height: 28px;
            cursor: pointer;
            font-size: 16px;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s;
            opacity: 0;
            backdrop-filter: blur(4px);
        `;
        viewBtn.title = 'View full size';
        viewBtn.onmouseenter = () => {
            viewBtn.style.background = 'rgba(102, 126, 234, 0.8)';
            viewBtn.style.transform = 'scale(1.1)';
        };
        viewBtn.onmouseleave = () => {
            viewBtn.style.background = 'rgba(0,0,0,0.6)';
            viewBtn.style.transform = 'scale(1)';
        };
        viewBtn.onclick = (e) => {
            e.stopPropagation();
            openPhotoViewer(photo);
        };
        container.appendChild(viewBtn);
        
        container.onmouseenter = () => {
            viewBtn.style.opacity = '1';
            container.style.transform = 'scale(1.02)';
        };
        container.onmouseleave = () => {
            viewBtn.style.opacity = '0';
            container.style.transform = 'scale(1)';
        };
        
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
            placeholder.textContent = `📷 ${index + 1}`;
            placeholder.style.cssText = 'font-size: 16px; color: rgba(255,255,255,0.5);';
            thumb.appendChild(placeholder);
        };
        
        thumb.onclick = (e) => {
            if (!e.target.closest('input[type="checkbox"]') && !e.target.closest('button')) {
                openPhotoViewer(photo);
            }
        };
        
        thumb.appendChild(img);
        container.appendChild(thumb);
        
        return container;
    }
    
    // ============================================================
    // === THEMES ===
    // ============================================================
    
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
    
    // ============================================================
    // === INJECT INTO NAVBAR ===
    // ============================================================
    
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
        indicatorBtn.onmouseenter = () => indicatorBtn.style.background = 'rgba(255,255,255,0.25)';
        indicatorBtn.onmouseleave = () => indicatorBtn.style.background = 'rgba(255,255,255,0.15)';
        
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
            min-width: 360px;
            max-width: 420px;
        `;
        
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
            flex-wrap: wrap;
            gap: 8px;
        `;
        panelHeader.innerHTML = `
            <span class="panel-header-text">📷 Device photos (${count})</span>
            <div style="display:flex; gap:6px;">
                <button id="download-selected-btn" style="
                    background: #4CAF50;
                    border: none;
                    border-radius: 6px;
                    color: white;
                    padding: 5px 14px;
                    font-size: 12px;
                    font-weight: bold;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
                ">⬇️ Download (0)</button>
                <button id="close-photo-preview" style="
                    background: rgba(255,255,255,0.1);
                    border: none;
                    border-radius: 50%;
                    color: white;
                    width: 28px;
                    height: 28px;
                    cursor: pointer;
                    font-size: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: background 0.2s;
                ">✕</button>
            </div>
        `;
        previewPanel.appendChild(panelHeader);
        
        const thumbContainer = document.createElement('div');
        thumbContainer.className = 'photo-thumb-container';
        thumbContainer.style.cssText = `
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 10px;
            max-height: 350px;
            overflow-y: auto;
            padding: 4px;
        `;
        previewPanel.appendChild(thumbContainer);
        
        const actionsRow = document.createElement('div');
        actionsRow.style.cssText = `
            margin-top: 10px;
            padding-top: 8px;
            border-top: 1px solid rgba(255,255,255,0.2);
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        `;
        
        const selectAllBtn = document.createElement('button');
        selectAllBtn.textContent = '☑️ Select all';
        selectAllBtn.style.cssText = `
            background: rgba(255,255,255,0.15);
            border: 1px solid rgba(255,255,255,0.25);
            border-radius: 6px;
            color: white;
            padding: 6px 14px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        `;
        selectAllBtn.onmouseenter = () => {
            selectAllBtn.style.background = 'rgba(255,255,255,0.3)';
            selectAllBtn.style.transform = 'scale(1.03)';
        };
        selectAllBtn.onmouseleave = () => {
            selectAllBtn.style.background = 'rgba(255,255,255,0.15)';
            selectAllBtn.style.transform = 'scale(1)';
        };
        selectAllBtn.onclick = () => {
            if (photoData.length === 0) return;
            
            const allSelected = photoData.every(p => selectedPhotos.has(p));
            
            if (allSelected) {
                selectedPhotos.clear();
            } else {
                photoData.forEach(p => selectedPhotos.add(p));
            }
            
            updatePreviewPanel(previewPanel, thumbContainer);
        };
        actionsRow.appendChild(selectAllBtn);
        
        const clearSelectionBtn = document.createElement('button');
        clearSelectionBtn.textContent = '🗑️ Clear';
        clearSelectionBtn.style.cssText = `
            background: rgba(255,255,255,0.1);
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 6px;
            color: white;
            padding: 6px 14px;
            font-size: 11px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
        `;
        clearSelectionBtn.onmouseenter = () => {
            clearSelectionBtn.style.background = 'rgba(255,255,255,0.2)';
            clearSelectionBtn.style.transform = 'scale(1.03)';
        };
        clearSelectionBtn.onmouseleave = () => {
            clearSelectionBtn.style.background = 'rgba(255,255,255,0.1)';
            clearSelectionBtn.style.transform = 'scale(1)';
        };
        clearSelectionBtn.onclick = () => {
            selectedPhotos.clear();
            updatePreviewPanel(previewPanel, thumbContainer);
        };
        actionsRow.appendChild(clearSelectionBtn);
        
        previewPanel.appendChild(actionsRow);
        
        indicatorContainer.appendChild(indicatorBtn);
        indicatorContainer.appendChild(previewPanel);
        
        navbarUpper.insertBefore(indicatorContainer, navbarRight);
        
        loadSavedThemeForPhotos();
        updatePreviewPanel(previewPanel, thumbContainer);
        
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
                updatePreviewPanel(previewPanel, thumbContainer);
                previewPanel.style.display = 'block';
                isOpen = true;
                
                if (updateInterval) clearInterval(updateInterval);
                updateInterval = setInterval(() => {
                    if (isOpen) {
                        updatePreviewPanel(previewPanel, thumbContainer);
                    }
                }, 3000);
            }
        };
        
        const downloadBtn = document.getElementById('download-selected-btn');
        if (downloadBtn) {
            downloadBtn.onmouseenter = () => {
                downloadBtn.style.background = '#66bb6a';
                downloadBtn.style.transform = 'scale(1.05)';
            };
            downloadBtn.onmouseleave = () => {
                downloadBtn.style.background = '#4CAF50';
                downloadBtn.style.transform = 'scale(1)';
            };
            downloadBtn.onclick = (e) => {
                e.stopPropagation();
                downloadSelectedPhotos();
            };
        }
        
        const closeBtn = document.getElementById('close-photo-preview');
        if (closeBtn) {
            closeBtn.onmouseenter = () => closeBtn.style.background = 'rgba(255,255,255,0.2)';
            closeBtn.onmouseleave = () => closeBtn.style.background = 'rgba(255,255,255,0.1)';
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                previewPanel.style.display = 'none';
                isOpen = false;
                if (updateInterval) {
                    clearInterval(updateInterval);
                    updateInterval = null;
                }
            };
        }
        
        document.addEventListener('click', (e) => {
            if (isPhotoViewerOpen) return;
            
            if (isOpen && !indicatorContainer.contains(e.target)) {
                previewPanel.style.display = 'none';
                isOpen = false;
                if (updateInterval) {
                    clearInterval(updateInterval);
                    updateInterval = null;
                }
            }
        });
        
        console.log('📷 Device Photos: Indicator injected');
    }
    
    // ============================================================
    // === STARTUP ===
    // ============================================================
    
    function waitForContent() {
        const checkInterval = setInterval(() => {
            const fileMenu = document.querySelector('.btn-group .dropdown-menu li a[href*=".jpg"]');
            if (fileMenu) {
                console.log('📷 Device Photos: Content loaded');
                clearInterval(checkInterval);
                injectIntoNavbar();
            }
        }, 500);
        
        setTimeout(() => {
            clearInterval(checkInterval);
            injectIntoNavbar();
        }, 5000);
    }
    
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(waitForContent, 500);
        });
    } else {
        setTimeout(waitForContent, 500);
    }
    
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
    
    if (typeof chrome !== 'undefined' && chrome.runtime) {
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            if (request.type === 'UPDATE_THEME') {
                applyThemeToPhotoPanel(request.theme);
                sendResponse({ success: true });
            }
            return true;
        });
    }
    
    console.log('📷 Device Photos: Module loaded!');
    
})();
