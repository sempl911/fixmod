// Module for displaying device photos in the top panel
(function() {
    console.log('Device Photos: Script started');
    
    // State
    let selectedPhotos = new Set();
    let previewPhotoUrl = null;
    let previewOverlay = null;
    let currentPhotos = [];
    let isPreviewOpen = false;
    let isPanelOpen = false;
    let currentTheme = 'default';
    let totalPhotoCount = 0;
    
    // Function to find photos
    function countPhotos() {
        let photoCount = 0;
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
                                    photoCount++;
                                    photoUrls.push(imageUrl);
                                    console.log('Found photo:', imageUrl);
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
                    photoCount++;
                    photoUrls.push(url);
                    console.log('Found photo (alt):', url);
                }
            }
        });
        
        console.log('Device Photos: Found photos:', photoCount);
        totalPhotoCount = photoCount;
        return { count: photoCount, urls: photoUrls };
    }
    
    // Function to get direct URL (only for display, not for downloading)
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
    // DOWNLOAD FUNCTION - SEND TO BACKGROUND
    // ============================================================
    function downloadPhoto(url, filename) {
        return new Promise((resolve, reject) => {
            if (typeof chrome === 'undefined' || !chrome.runtime) {
                reject(new Error('Chrome runtime not available'));
                return;
            }
            
            console.log('📤 Sending download request to background:', url);
            
            chrome.runtime.sendMessage({
                type: 'DOWNLOAD_PHOTO',
                url: url,
                filename: filename || 'photo.jpg'
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ Runtime error:', chrome.runtime.lastError);
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                if (response && response.success) {
                    console.log('✅ Download started successfully');
                    resolve(true);
                } else {
                    console.error('❌ Download failed:', response?.error || 'Unknown error');
                    reject(new Error(response?.error || 'Download failed'));
                }
            });
        });
    }
    
    // ============================================================
    // BATCH DOWNLOAD - SEND TO BACKGROUND
    // ============================================================
    function downloadMultiplePhotos(photos) {
        return new Promise((resolve, reject) => {
            if (typeof chrome === 'undefined' || !chrome.runtime) {
                reject(new Error('Chrome runtime not available'));
                return;
            }
            
            console.log('📤 Sending batch download request to background:', photos.length);
            
            chrome.runtime.sendMessage({
                type: 'DOWNLOAD_MULTIPLE_PHOTOS',
                photos: photos
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.error('❌ Runtime error:', chrome.runtime.lastError);
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }
                
                if (response && response.success) {
                    console.log(`✅ Batch download: ${response.successful}/${response.total} successful`);
                    resolve(response);
                } else {
                    console.error('❌ Batch download failed:', response?.error || 'Unknown error');
                    reject(new Error(response?.error || 'Batch download failed'));
                }
            });
        });
    }
    
    // Open photo in fullscreen viewer
    function openPhotoPreview(url) {
        previewPhotoUrl = url;
        isPreviewOpen = true;
        const directUrl = getDirectImageUrl(url);
        
        if (!previewOverlay) {
            createPreviewOverlay();
        }
        
        const img = previewOverlay.querySelector('.preview-image');
        if (img) {
            img.src = directUrl;
            img.style.display = 'none';
        }
        
        const loading = previewOverlay.querySelector('.preview-loading');
        if (loading) {
            loading.style.display = 'block';
            loading.textContent = '⏳ Loading...';
        }
        
        previewOverlay.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
    
    // Create preview overlay
    function createPreviewOverlay() {
        previewOverlay = document.createElement('div');
        previewOverlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.85);
            display: none;
            justify-content: center;
            align-items: center;
            z-index: 999999;
        `;
        
        const container = document.createElement('div');
        container.style.cssText = `
            position: relative;
            max-width: 90%;
            max-height: 90%;
            cursor: default;
        `;
        
        const loading = document.createElement('div');
        loading.className = 'preview-loading';
        loading.style.cssText = `
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            color: white;
            font-size: 24px;
            z-index: 1;
        `;
        loading.textContent = '⏳ Loading...';
        container.appendChild(loading);
        
        const img = document.createElement('img');
        img.className = 'preview-image';
        img.style.cssText = `
            max-width: 100%;
            max-height: 85vh;
            border-radius: 8px;
            box-shadow: 0 8px 40px rgba(0,0,0,0.5);
            display: none;
            object-fit: contain;
            position: relative;
            z-index: 2;
        `;
        img.onload = () => {
            const loadingEl = container.querySelector('.preview-loading');
            if (loadingEl) loadingEl.style.display = 'none';
            img.style.display = 'block';
        };
        img.onerror = () => {
            const loadingEl = container.querySelector('.preview-loading');
            if (loadingEl) {
                loadingEl.textContent = '❌ Error loading';
                loadingEl.style.color = '#ff6b6b';
            }
        };
        container.appendChild(img);
        
        // Close button
        const closeBtn = document.createElement('div');
        closeBtn.style.cssText = `
            position: absolute;
            top: -40px;
            right: -40px;
            color: white;
            font-size: 30px;
            cursor: pointer;
            background: rgba(0,0,0,0.5);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: background 0.2s;
            z-index: 3;
        `;
        closeBtn.textContent = '✕';
        closeBtn.onmouseenter = () => {
            closeBtn.style.background = 'rgba(255,0,0,0.6)';
        };
        closeBtn.onmouseleave = () => {
            closeBtn.style.background = 'rgba(0,0,0,0.5)';
        };
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            closePreview();
        };
        container.appendChild(closeBtn);
        
        // Download button in viewer with theme support
        const downloadBtn = document.createElement('div');
        downloadBtn.id = 'preview-download-btn';
        downloadBtn.style.cssText = `
            position: absolute;
            bottom: -50px;
            left: 50%;
            transform: translateX(-50%);
            color: white;
            font-size: 16px;
            cursor: pointer;
            padding: 10px 24px;
            border-radius: 8px;
            transition: all 0.2s;
            z-index: 3;
            border: none;
            font-weight: bold;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        `;
        downloadBtn.textContent = '⬇️ Download photo';
        downloadBtn.onmouseenter = () => {
            downloadBtn.style.transform = 'translateX(-50%) scale(1.05)';
            downloadBtn.style.boxShadow = '0 4px 15px rgba(0,0,0,0.3)';
        };
        downloadBtn.onmouseleave = () => {
            downloadBtn.style.transform = 'translateX(-50%) scale(1)';
            downloadBtn.style.boxShadow = 'none';
        };
        downloadBtn.onclick = async (e) => {
            e.stopPropagation();
            if (previewPhotoUrl) {
                const btn = e.target;
                const originalText = btn.textContent;
                btn.textContent = '⏳ Downloading...';
                btn.style.opacity = '0.7';
                btn.style.pointerEvents = 'none';
                
                try {
                    await downloadPhoto(previewPhotoUrl, `photo_${Date.now()}.jpg`);
                    btn.textContent = '✅ Downloaded!';
                    btn.style.opacity = '1';
                    btn.style.pointerEvents = 'auto';
                    setTimeout(() => {
                        btn.textContent = originalText;
                    }, 2000);
                } catch (error) {
                    console.error('Download error:', error);
                    btn.textContent = '❌ Failed';
                    btn.style.opacity = '1';
                    btn.style.pointerEvents = 'auto';
                    setTimeout(() => {
                        btn.textContent = originalText;
                    }, 2000);
                }
            }
        };
        container.appendChild(downloadBtn);
        
        previewOverlay.appendChild(container);
        
        // Close only on background click (not on container)
        previewOverlay.onclick = (e) => {
            if (e.target === previewOverlay) {
                closePreviewOnly();
            }
        };
        
        // Close on Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && previewOverlay.style.display === 'flex') {
                closePreviewOnly();
            }
        });
        
        document.body.appendChild(previewOverlay);
        
        // Apply current theme to download button
        applyThemeToPreviewButton(currentTheme);
    }
    
    // Apply theme to preview download button
    function applyThemeToPreviewButton(themeId) {
        const downloadBtn = document.getElementById('preview-download-btn');
        if (!downloadBtn) return;
        
        const colors = colorSchemes[themeId];
        if (!colors) return;
        
        const gradient = `linear-gradient(135deg, ${colors.c1} 0%, ${colors.c2} 100%)`;
        downloadBtn.style.background = gradient;
    }
    
    // Close only the fullscreen preview, keep panel open
    function closePreviewOnly() {
        if (previewOverlay) {
            previewOverlay.style.display = 'none';
            document.body.style.overflow = '';
            previewPhotoUrl = null;
            isPreviewOpen = false;
            
            const img = previewOverlay.querySelector('.preview-image');
            if (img) {
                img.src = '';
                img.style.display = 'none';
            }
        }
    }
    
    // Close preview (kept for compatibility)
    function closePreview() {
        closePreviewOnly();
    }
    
    // Toggle photo selection
    function togglePhotoSelection(url) {
        if (selectedPhotos.has(url)) {
            selectedPhotos.delete(url);
        } else {
            selectedPhotos.add(url);
        }
        updateSelectionUI();
        updateDownloadButton();
    }
    
    // Update selection UI
    function updateSelectionUI() {
        document.querySelectorAll('.photo-checkbox').forEach(cb => {
            const url = cb.dataset.url;
            cb.checked = selectedPhotos.has(url);
        });
        
        updateDownloadButton();
    }
    
    // Update download button
    function updateDownloadButton() {
        const downloadBtn = document.getElementById('photo-download-btn');
        const downloadBtnBottom = document.getElementById('photo-download-btn-bottom');
        const count = selectedPhotos.size;
        
        const btns = [downloadBtn, downloadBtnBottom];
        btns.forEach(btn => {
            if (btn) {
                if (count > 0) {
                    btn.style.display = 'flex';
                    btn.innerHTML = `⬇️ Download (${count})`;
                } else {
                    btn.style.display = 'none';
                }
            }
        });
    }
    
    // Download selected photos
    async function downloadSelectedPhotos() {
        const urls = Array.from(selectedPhotos);
        if (urls.length === 0) return;
        
        const btns = ['photo-download-btn', 'photo-download-btn-bottom'];
        btns.forEach(id => {
            const btn = document.getElementById(id);
            if (btn) {
                btn.textContent = '⏳ Downloading...';
                btn.style.opacity = '0.7';
                btn.style.pointerEvents = 'none';
            }
        });
        
        try {
            // Prepare photos array for batch download
            const photos = urls.map((url, index) => ({
                url: url,
                filename: `photo_${index + 1}_${Date.now()}.jpg`
            }));
            
            const result = await downloadMultiplePhotos(photos);
            
            console.log(`✅ Downloaded ${result.successful} of ${result.total} photos`);
            
            if (result.successful === result.total) {
                selectedPhotos.clear();
                updateSelectionUI();
                updateDownloadButton();
            } else if (result.successful > 0) {
                // Some succeeded, clear all selection
                selectedPhotos.clear();
                updateSelectionUI();
                updateDownloadButton();
            }
            
        } catch (error) {
            console.error('Batch download error:', error);
        } finally {
            btns.forEach(id => {
                const btn = document.getElementById(id);
                if (btn) {
                    btn.textContent = '⬇️ Download';
                    btn.style.opacity = '1';
                    btn.style.pointerEvents = 'auto';
                    btn.style.display = 'none';
                }
            });
        }
    }
    
    // Update preview panel
    function updatePreviewPanel(previewPanel, thumbContainer) {
        const result = countPhotos();
        const count = result.count;
        const photos = result.urls;
        currentPhotos = photos;
        totalPhotoCount = count;
        
        const panelHeader = previewPanel.querySelector('.panel-header-text');
        if (panelHeader) {
            panelHeader.textContent = `📷 Device Photos (${count})`;
        }
        
        // Update main counter in navbar
        const countSpan = document.getElementById('nav-photo-count');
        if (countSpan) {
            countSpan.textContent = count;
        }
        
        updateDownloadButton();
        
        thumbContainer.innerHTML = '';
        
        if (count === 0 || photos.length === 0) {
            thumbContainer.innerHTML = '<div style="color:white; text-align:center; grid-column:span 3; padding:20px;">No photos</div>';
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
                `;
                
                const overlay = document.createElement('div');
                overlay.style.cssText = `
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    padding: 6px;
                    z-index: 2;
                    pointer-events: none;
                `;
                
                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.className = 'photo-checkbox';
                checkbox.dataset.url = photo;
                checkbox.checked = selectedPhotos.has(photo);
                checkbox.style.cssText = `
                    pointer-events: auto;
                    cursor: pointer;
                    width: 18px;
                    height: 18px;
                    accent-color: #4CAF50;
                    background: rgba(255,255,255,0.8);
                    border-radius: 4px;
                    border: 2px solid white;
                    z-index: 3;
                `;
                checkbox.onchange = (e) => {
                    e.stopPropagation();
                    togglePhotoSelection(photo);
                };
                
                // Fullscreen button with custom icon from uiAssets
                const viewBtn = document.createElement('img');
                viewBtn.src = chrome.runtime.getURL('uiAssets/full-size.png');
                viewBtn.style.cssText = `
                    pointer-events: auto;
                    cursor: pointer;
                    width: 28px;
                    height: 28px;
                    filter: brightness(0) invert(1);
                    z-index: 3;
                    background: rgba(0,0,0,0.6);
                    border-radius: 50%;
                    padding: 4px;
                    border: 2px solid rgba(255,255,255,0.3);
                    transition: all 0.2s;
                    object-fit: contain;
                `;
                viewBtn.title = 'Fullscreen view';
                
                // Fallback if icon fails to load
                viewBtn.onerror = function() {
                    this.style.display = 'none';
                    const fallback = document.createElement('span');
                    fallback.textContent = '⛶';
                    fallback.style.cssText = `
                        pointer-events: auto;
                        cursor: pointer;
                        color: white;
                        font-size: 18px;
                        font-weight: bold;
                        z-index: 3;
                        background: rgba(0,0,0,0.6);
                        border-radius: 50%;
                        width: 28px;
                        height: 28px;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        border: 2px solid rgba(255,255,255,0.3);
                        transition: all 0.2s;
                        user-select: none;
                    `;
                    this.parentNode.replaceChild(fallback, this);
                };
                
                viewBtn.onmouseenter = () => {
                    viewBtn.style.background = 'rgba(255,255,255,0.3)';
                    viewBtn.style.transform = 'scale(1.1)';
                };
                viewBtn.onmouseleave = () => {
                    viewBtn.style.background = 'rgba(0,0,0,0.6)';
                    viewBtn.style.transform = 'scale(1)';
                };
                viewBtn.onclick = (e) => {
                    e.stopPropagation();
                    openPhotoPreview(photo);
                };
                
                overlay.appendChild(checkbox);
                overlay.appendChild(viewBtn);
                thumbItem.appendChild(overlay);
                
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
                img.loading = 'lazy';
                img.onerror = () => {
                    img.style.display = 'none';
                    const placeholder = document.createElement('span');
                    placeholder.innerHTML = '📷';
                    placeholder.style.cssText = 'font-size: 24px; color: rgba(255,255,255,0.5);';
                    thumb.appendChild(placeholder);
                };
                
                thumb.onclick = () => openPhotoPreview(photo);
                thumb.style.cursor = 'pointer';
                
                thumb.appendChild(img);
                thumbItem.appendChild(thumb);
                thumbContainer.appendChild(thumbItem);
            });
        }
    }
    
    // Color schemes
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
    
    let currentPreviewPanel = null;
    let updateInterval = null;
    
    function applyThemeToPhotoPanel(themeId) {
        if (!currentPreviewPanel) return;
        const colors = colorSchemes[themeId];
        if (!colors) return;
        const gradient = `linear-gradient(135deg, ${colors.c1} 0%, ${colors.c2} 100%)`;
        currentPreviewPanel.style.background = gradient;
        currentTheme = themeId;
        
        applyThemeToPreviewButton(themeId);
    }
    
    function loadSavedThemeForPhotos() {
        const savedTheme = localStorage.getItem('widgetTheme');
        if (savedTheme && colorSchemes[savedTheme]) {
            applyThemeToPhotoPanel(savedTheme);
            currentTheme = savedTheme;
        }
    }
    
    // Function to inject indicator into navbar
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
        totalPhotoCount = count;
        
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
            min-width: 340px;
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
            gap: 6px;
        `;
        panelHeader.innerHTML = `
            <span class="panel-header-text">📷 Device Photos (${count})</span>
            <div style="display:flex; align-items:center; gap:8px;">
                <button id="photo-download-btn" style="
                    display: none;
                    align-items: center;
                    gap: 4px;
                    padding: 4px 10px;
                    background: rgba(255,255,255,0.2);
                    border: 1px solid rgba(255,255,255,0.3);
                    border-radius: 12px;
                    color: white;
                    font-size: 11px;
                    cursor: pointer;
                    transition: all 0.2s;
                ">⬇️ Download</button>
                <span id="close-photo-preview" style="cursor: pointer; font-size: 16px;">✕</span>
            </div>
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
        
        const downloadAllBtn = document.createElement('button');
        downloadAllBtn.id = 'photo-download-btn-bottom';
        downloadAllBtn.style.cssText = `
            display: none;
            width: 100%;
            margin-top: 10px;
            padding: 8px;
            background: rgba(255,255,255,0.2);
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 8px;
            color: white;
            font-size: 13px;
            cursor: pointer;
            transition: all 0.2s;
        `;
        downloadAllBtn.textContent = '⬇️ Download selected';
        downloadAllBtn.onclick = downloadSelectedPhotos;
        previewPanel.appendChild(downloadAllBtn);
        
        indicatorContainer.appendChild(indicatorBtn);
        indicatorContainer.appendChild(previewPanel);
        
        navbarUpper.insertBefore(indicatorContainer, navbarRight);
        
        loadSavedThemeForPhotos();
        
        const downloadBtn = document.getElementById('photo-download-btn');
        if (downloadBtn) {
            downloadBtn.onclick = downloadSelectedPhotos;
        }
        
        indicatorBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (isPanelOpen) {
                previewPanel.style.display = 'none';
                isPanelOpen = false;
                if (updateInterval) {
                    clearInterval(updateInterval);
                    updateInterval = null;
                }
            } else {
                updatePreviewPanel(previewPanel, thumbContainer);
                previewPanel.style.display = 'block';
                isPanelOpen = true;
                
                if (updateInterval) clearInterval(updateInterval);
                updateInterval = setInterval(() => {
                    if (isPanelOpen) {
                        updatePreviewPanel(previewPanel, thumbContainer);
                    }
                }, 3000);
            }
        };
        
        const closeBtn = document.getElementById('close-photo-preview');
        if (closeBtn) {
            closeBtn.onclick = () => {
                previewPanel.style.display = 'none';
                isPanelOpen = false;
                if (updateInterval) {
                    clearInterval(updateInterval);
                    updateInterval = null;
                }
            };
        }
        
        document.addEventListener('click', (e) => {
            if (isPanelOpen && !indicatorContainer.contains(e.target) && !previewOverlay?.contains(e.target)) {
                previewPanel.style.display = 'none';
                isPanelOpen = false;
                if (updateInterval) {
                    clearInterval(updateInterval);
                    updateInterval = null;
                }
            }
        });
        
        console.log('Device Photos: Indicator injected');
    }
    
    // Wait for content to load
    function waitForContent() {
        const checkInterval = setInterval(() => {
            const fileMenu = document.querySelector('.btn-group .dropdown-menu li a[href*=".jpg"]');
            if (fileMenu) {
                console.log('Device Photos: Content loaded');
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
                const current = parseInt(countSpan.textContent);
                if (current !== newCount) {
                    countSpan.textContent = newCount;
                    totalPhotoCount = newCount;
                    
                    if (currentPreviewPanel) {
                        const header = currentPreviewPanel.querySelector('.panel-header-text');
                        if (header) {
                            header.textContent = `📷 Device Photos (${newCount})`;
                        }
                    }
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
                currentTheme = request.theme;
                sendResponse({ success: true });
            }
            return true;
        });
    }
    
})();