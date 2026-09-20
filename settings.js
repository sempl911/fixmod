// settings.js - FixMod Settings Page

document.addEventListener('DOMContentLoaded', async () => {
    const iconUrl = chrome.runtime.getURL('fixIco/fixModIco_32.png');
    document.getElementById('settings-icon').src = iconUrl;
    
    const manifest = chrome.runtime.getManifest();
    document.getElementById('version-info').textContent = 'FixMod v' + manifest.version;
    
    await loadAllSettings();
    await loadStats();
    await loadDarkMode();
    await loadSavedTheme();
    
    document.getElementById('back-btn').addEventListener('click', () => {
        chrome.tabs.getCurrent((tab) => {
            chrome.tabs.remove(tab.id);
        });
    });
    
    // === DARK MODE ===
    document.getElementById('dark-mode-toggle').addEventListener('change', function() {
        const enabled = this.checked;
        document.body.classList.toggle('dark', enabled);
        chrome.storage.local.set({ darkMode: enabled });
        saveSetting('darkMode', enabled);
        sendToWidget({ type: 'UPDATE_DARK_MODE', enabled: enabled });
        showToast(enabled ? '🌙 Dark mode enabled' : '☀️ Light mode enabled');
    });
    
    // === OPACITY ===
    document.getElementById('opacity-slider').addEventListener('input', function() {
        const value = this.value;
        document.getElementById('opacity-value').textContent = value + '%';
        const opacity = value / 100;
        chrome.storage.sync.set({ widgetOpacity: parseInt(value) });
        saveSetting('widgetOpacity', parseInt(value));
        sendToWidget({ type: 'UPDATE_OPACITY', opacity: opacity });
    });
    
    // === FONT SIZE ===
    document.getElementById('font-size-slider').addEventListener('input', function() {
        const value = this.value;
        document.getElementById('font-size-value').textContent = value + 'px';
        chrome.storage.sync.set({ widgetFontSize: parseInt(value) });
        saveSetting('widgetFontSize', parseInt(value));
        sendToWidget({ type: 'UPDATE_FONT_SIZE', fontSize: parseInt(value) });
    });
    
    // === QR CODE ===
    document.getElementById('qr-toggle').addEventListener('change', function() {
        const enabled = this.checked;
        chrome.storage.sync.set({ qrEnabled: enabled });
        saveSetting('qrEnabled', enabled);
        sendToWidget({ type: 'UPDATE_QR_ENABLED', enabled: enabled });
    });
    
    // === SUGGESTIONS ===
    document.getElementById('suggestions-toggle').addEventListener('change', function() {
        const enabled = this.checked;
        chrome.storage.sync.set({ suggestionsEnabled: enabled });
        saveSetting('suggestionsEnabled', enabled);
        sendToWidget({ type: 'UPDATE_SUGGESTIONS', enabled: enabled });
        showToast(enabled ? '💡 Suggestions enabled' : '💡 Suggestions disabled');
    });
    
    // === WIDGET ENABLED ===
    document.getElementById('widget-toggle').addEventListener('change', function() {
        const enabled = this.checked;
        chrome.storage.sync.set({ widgetEnabled: enabled });
        saveSetting('widgetEnabled', enabled);
        sendToWidget({ type: 'UPDATE_WIDGET', enabled: enabled });
        showToast(enabled ? '📊 Widget enabled' : '📊 Widget disabled');
    });
    
    // === ЦВЕТОВЫЕ СХЕМЫ ===
    document.querySelectorAll('.color-scheme').forEach(scheme => {
        scheme.addEventListener('click', function() {
            const themeId = this.dataset.theme;
            document.querySelectorAll('.color-scheme').forEach(s => s.classList.remove('active'));
            this.classList.add('active');
            chrome.storage.local.set({ widgetTheme: themeId });
            sendToWidget({ type: 'UPDATE_THEME', theme: themeId });
            showToast('🎨 Тема: ' + themeId);
        });
    });
    
    // === ПУТЬ ФОТО ===
    const downloadPathInput = document.getElementById('download-path');
    const currentPathValue = document.getElementById('current-path-value');
    
    function saveDownloadPath() {
        const path = downloadPathInput.value.trim();
        chrome.storage.sync.set({ downloadPath: path });
        saveSetting('downloadPath', path);
        currentPathValue.textContent = path || 'Downloads/FixModPhotos/';
        showToast(path ? '📁 Path saved: ' + path : '📁 Reset to default');
    }
    
    downloadPathInput.addEventListener('change', saveDownloadPath);
    downloadPathInput.addEventListener('blur', saveDownloadPath);
    downloadPathInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            this.blur();
        }
    });
    
    document.getElementById('reset-download-path').addEventListener('click', function() {
        downloadPathInput.value = '';
        chrome.storage.sync.set({ downloadPath: '' });
        saveSetting('downloadPath', '');
        currentPathValue.textContent = 'Downloads/FixModPhotos/';
        showToast('↩️ Reset to default');
    });
    
    chrome.storage.sync.get(['downloadPath'], (result) => {
        const path = result.downloadPath || '';
        downloadPathInput.value = path;
        currentPathValue.textContent = path || 'Downloads/FixModPhotos/';
    });
    
    // === DATA BUTTONS ===
    document.getElementById('export-btn').addEventListener('click', exportData);
    document.getElementById('import-btn').addEventListener('click', () => {
        document.getElementById('import-file-input').click();
    });
    document.getElementById('import-file-input').addEventListener('change', importData);
    document.getElementById('restore-btn').addEventListener('click', restoreFromBackup);
    document.getElementById('refresh-stats-btn').addEventListener('click', async () => {
        await loadStats();
        showToast('✅ Stats refreshed');
    });
    document.getElementById('clear-data-btn').addEventListener('click', clearAllData);
    
    // === ЗАПУСК РЕДАКТОРА ПОДСКАЗОК ===
    await SuggestionsEditor.init();
});

// ============================================================
// === РЕДАКТОР ПОДСКАЗОК ===
// ============================================================

const SuggestionsEditor = {
    currentType: 'diagnosis',
    data: { diagnosis: [], resolution: [] },
    originalData: { diagnosis: [], resolution: [] },
    usageStats: { diagnosis: {}, resolution: {} },
    draggedIndex: null,
    
    async init() {
        await this.load();
        this.setupTabs();
        this.setupActions();
        this.render();
        console.log('📝 Suggestions Editor initialized');
    },
    
    async load() {
        // 1. Оригинальные из JSON
        try {
            const response = await fetch(chrome.runtime.getURL('suggestions.json'));
            const jsonData = await response.json();
            
            this.originalData.diagnosis = (jsonData.diagnosis || []).map(item => ({
                text: typeof item === 'string' ? item : item.text,
                value: typeof item === 'string' ? item : (item.value || item.text)
            }));
            
            this.originalData.resolution = (jsonData.resolution || []).map(item => ({
                text: typeof item === 'string' ? item : item.text,
                value: typeof item === 'string' ? item : (item.value || item.text)
            }));
        } catch (e) {
            console.warn('⚠️ Ошибка загрузки JSON:', e);
            this.originalData = { diagnosis: [], resolution: [] };
        }
        
        // 2. Отредактированные + статистика
        try {
            const result = await chrome.storage.local.get([
                'fixmod_suggestions_edited',
                'fixmod_usage_stats'
            ]);
            
            if (result.fixmod_suggestions_edited) {
                this.data.diagnosis = result.fixmod_suggestions_edited.diagnosis || [];
                this.data.resolution = result.fixmod_suggestions_edited.resolution || [];
            } else {
                this.data.diagnosis = [...this.originalData.diagnosis];
                this.data.resolution = [...this.originalData.resolution];
            }
            
            if (result.fixmod_usage_stats) {
                this.usageStats = result.fixmod_usage_stats;
            }
        } catch (e) {
            this.data.diagnosis = [...this.originalData.diagnosis];
            this.data.resolution = [...this.originalData.resolution];
        }
    },
    
    async save() {
        try {
            const dataToSave = {
                diagnosis: this.data.diagnosis,
                resolution: this.data.resolution,
                saved_at: new Date().toISOString()
            };
            
            await chrome.storage.local.set({
                fixmod_suggestions_edited: dataToSave
            });
            return true;
        } catch (e) {
            console.error('❌ Ошибка сохранения:', e);
            return false;
        }
    },
    
    getUsage(fieldType, item) {
        const stats = this.usageStats[fieldType] || {};
        const key = item.value || item.text || '';
        return stats[key] || 0;
    },
    
    isCustom(item) {
        const value = (item.value || item.text || '').toLowerCase();
        return !this.originalData[this.currentType].some(orig =>
            (orig.value || orig.text).toLowerCase() === value
        );
    },
    
    setupTabs() {
        document.querySelectorAll('.suggestion-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('.suggestion-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                this.currentType = tab.dataset.type;
                this.render();
            });
        });
    },
    
    setupActions() {
        document.getElementById('add-suggestion-btn').addEventListener('click', () => {
            const textInput = document.getElementById('new-suggestion-text');
            const valueInput = document.getElementById('new-suggestion-value');
            
            const text = textInput.value.trim();
            const value = valueInput.value.trim() || text;
            
            if (!text) {
                showToast('⚠️ Enter text');
                return;
            }
            
            const exists = this.data[this.currentType].some(item =>
                (item.value || item.text).toLowerCase() === value.toLowerCase()
            );
            
            if (exists) {
                showToast('⚠️ Already exists');
                return;
            }
            
            // Новые добавляем В НАЧАЛО
            this.data[this.currentType].unshift({ text, value, custom: true });
            
            textInput.value = '';
            valueInput.value = '';
            
            this.save().then(() => {
                this.render();
                showToast('✅ Added');
            });
        });
        
        ['new-suggestion-text', 'new-suggestion-value'].forEach(id => {
            document.getElementById(id).addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    document.getElementById('add-suggestion-btn').click();
                }
            });
        });
        
        document.getElementById('save-suggestions-btn').addEventListener('click', async () => {
            const btn = document.getElementById('save-suggestions-btn');
            btn.textContent = '⏳ Saving...';
            btn.disabled = true;
            
            const success = await this.save();
            
            btn.textContent = success ? '✅ Saved!' : '❌ Error';
            showToast(success ? '💾 Saved' : '❌ Save error');
            
            setTimeout(() => {
                btn.textContent = '💾 Save';
                btn.disabled = false;
            }, 2000);
        });
        
        document.getElementById('reset-suggestions-btn').addEventListener('click', async () => {
            if (!confirm('⚠️ Reset all suggestions to defaults?\nYour custom changes will be lost.')) return;
            
            await chrome.storage.local.remove(['fixmod_suggestions_edited']);
            
            this.data.diagnosis = [...this.originalData.diagnosis];
            this.data.resolution = [...this.originalData.resolution];
            
            this.render();
            showToast('🔄 Reset to defaults');
        });
        
        document.getElementById('export-suggestions-btn').addEventListener('click', () => {
            const exportData = {
                version: 1,
                export_date: new Date().toISOString(),
                diagnosis: this.data.diagnosis,
                resolution: this.data.resolution,
                usage_stats: this.usageStats
            };
            
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fixmod_suggestions_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            showToast('📤 Exported');
        });
        
        document.getElementById('import-suggestions-btn').addEventListener('click', () => {
            document.getElementById('import-suggestions-file').click();
        });
        
        document.getElementById('import-suggestions-file').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                const text = await file.text();
                const imported = JSON.parse(text);
                
                if (!imported.diagnosis || !imported.resolution) {
                    showToast('❌ Invalid format');
                    return;
                }
                
                if (!confirm('⚠️ Replace all suggestions?')) return;
                
                this.data.diagnosis = imported.diagnosis;
                this.data.resolution = imported.resolution;
                
                if (imported.usage_stats) {
                    this.usageStats = imported.usage_stats;
                    await chrome.storage.local.set({ fixmod_usage_stats: this.usageStats });
                }
                
                await this.save();
                this.render();
                showToast(`✅ Imported ${imported.diagnosis.length + imported.resolution.length}`);
            } catch (err) {
                console.error('❌ Import error:', err);
                showToast('❌ Import error');
            }
            
            e.target.value = '';
        });
    },
    
    render() {
        const list = document.getElementById('suggestions-list');
        const counter = document.getElementById('suggestions-counter');
        const items = this.data[this.currentType] || [];
        
        counter.textContent = `${items.length} suggestions`;
        
        if (items.length === 0) {
            list.innerHTML = `
                <div style="text-align: center; padding: 30px; color: #9ca3af; font-size: 13px;">
                    No suggestions. Add one below ⬇️
                </div>
            `;
            return;
        }
        
        list.innerHTML = items.map((item, index) => {
            const text = item.text || '';
            const value = item.value || item.text || '';
            const usage = this.getUsage(this.currentType, item);
            const custom = this.isCustom(item);
            
            return `
                <div class="suggestion-row" 
                     draggable="true"
                     data-index="${index}">
                    <span class="drag-handle" title="Drag to reorder">☰</span>
                    <input type="text" 
                           class="suggestion-text-input" 
                           value="${this.escapeHtml(text)}" 
                           placeholder="Text..."
                           data-index="${index}"
                           data-field="text">
                    <input type="text" 
                           class="suggestion-value-input" 
                           value="${this.escapeHtml(value)}" 
                           placeholder="Value..."
                           data-index="${index}"
                           data-field="value">
                    ${custom ? '<span class="custom-star" title="Custom phrase">★</span>' : ''}
                    <span class="usage-badge ${usage > 0 ? 'used' : ''}" title="Times used">${usage}</span>
                    <button class="suggestion-remove" data-index="${index}" title="Delete">✕</button>
                </div>
            `;
        }).join('');
        
        list.querySelectorAll('.suggestion-row input').forEach(input => {
            input.addEventListener('change', () => {
                const index = parseInt(input.dataset.index);
                const field = input.dataset.field;
                const value = input.value.trim();
                
                if (!value) {
                    input.value = this.data[this.currentType][index][field] || '';
                    return;
                }
                
                this.data[this.currentType][index][field] = value;
                this.save();
            });
        });
        
        list.querySelectorAll('.suggestion-remove').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const index = parseInt(btn.dataset.index);
                const item = this.data[this.currentType][index];
                const itemText = item?.text || item?.value || '';
                
                if (!confirm(`Delete "${itemText}"?`)) return;
                
                this.data[this.currentType].splice(index, 1);
                
                await this.save();
                this.render();
                showToast('🗑️ Deleted');
            });
        });
        
        this.setupDragAndDrop(list);
    },
    
    setupDragAndDrop(list) {
        const rows = list.querySelectorAll('.suggestion-row');
        
        rows.forEach(row => {
            row.addEventListener('dragstart', (e) => {
                const index = parseInt(row.dataset.index);
                this.draggedIndex = index;
                row.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
                e.dataTransfer.setData('text/plain', index);
            });
            
            row.addEventListener('dragend', () => {
                row.classList.remove('dragging');
                list.querySelectorAll('.suggestion-row').forEach(r => {
                    r.classList.remove('drag-over');
                });
                this.draggedIndex = null;
            });
            
            row.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                
                if (this.draggedIndex === null) return;
                if (parseInt(row.dataset.index) === this.draggedIndex) return;
                
                row.classList.add('drag-over');
            });
            
            row.addEventListener('dragleave', () => {
                row.classList.remove('drag-over');
            });
            
            row.addEventListener('drop', async (e) => {
                e.preventDefault();
                row.classList.remove('drag-over');
                
                const dropIndex = parseInt(row.dataset.index);
                const dragIndex = this.draggedIndex;
                
                if (dragIndex === null || dragIndex === dropIndex) return;
                
                const items = this.data[this.currentType];
                const [movedItem] = items.splice(dragIndex, 1);
                items.splice(dropIndex, 0, movedItem);
                
                await this.save();
                this.render();
                
                showToast('↕️ Reordered');
            });
        });
    },
    
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML.replace(/"/g, '&quot;');
    }
};

// ============================================================
// ЗАГРУЗКА СОХРАНЕННОЙ ТЕМЫ
// ============================================================

async function loadSavedTheme() {
    try {
        const result = await chrome.storage.local.get(['widgetTheme']);
        const themeId = result.widgetTheme || 'default';
        
        document.querySelectorAll('.color-scheme').forEach(s => s.classList.remove('active'));
        const activeScheme = document.querySelector(`.color-scheme[data-theme="${themeId}"]`);
        if (activeScheme) {
            activeScheme.classList.add('active');
        }
    } catch (error) {
        console.warn('Could not load theme:', error);
    }
}

// ============================================================
// ЗАГРУЗКА ТЕМНОЙ ТЕМЫ
// ============================================================

async function loadDarkMode() {
    try {
        const result = await chrome.storage.local.get(['darkMode']);
        const isDark = result.darkMode === true;
        document.getElementById('dark-mode-toggle').checked = isDark;
        document.body.classList.toggle('dark', isDark);
    } catch (error) {
        console.warn('Could not load dark mode:', error);
    }
}

// ============================================================
// ЗАГРУЗКА НАСТРОЕК
// ============================================================

async function loadAllSettings() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (result) => {
            if (result) {
                const opacity = result.widgetOpacity || 85;
                document.getElementById('opacity-slider').value = opacity;
                document.getElementById('opacity-value').textContent = opacity + '%';
                
                const fontSize = result.widgetFontSize || 10;
                document.getElementById('font-size-slider').value = fontSize;
                document.getElementById('font-size-value').textContent = fontSize + 'px';
                
                const qrEnabled = result.qrEnabled !== undefined ? result.qrEnabled : true;
                document.getElementById('qr-toggle').checked = qrEnabled;
                
                const suggestionsEnabled = result.suggestionsEnabled !== undefined ? result.suggestionsEnabled : true;
                document.getElementById('suggestions-toggle').checked = suggestionsEnabled;
                
                const widgetEnabled = result.widgetEnabled !== undefined ? result.widgetEnabled : true;
                document.getElementById('widget-toggle').checked = widgetEnabled;
            }
            resolve();
        });
    });
}

// ============================================================
// ЗАГРУЗКА СТАТИСТИКИ
// ============================================================

async function loadStats() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_STATS' }, (response) => {
            if (response && response.success) {
                const stats = response.data;
                document.getElementById('total-orders-db').textContent = stats.total_orders || 0;
                document.getElementById('repaired-count-db').textContent = stats.repaired_count || 0;
                document.getElementById('today-count-db').textContent = stats.today_count || 0;
            }
            resolve();
        });
    });
}

// ============================================================
// СОХРАНЕНИЕ НАСТРОЕК
// ============================================================

function saveSetting(key, value) {
    chrome.runtime.sendMessage({ 
        type: 'SAVE_SETTINGS', 
        data: { [key]: value } 
    });
}

// ============================================================
// ОТПРАВКА В ВИДЖЕТ
// ============================================================

function sendToWidget(message) {
    chrome.tabs.query({}, (tabs) => {
        const fixablyTabs = tabs.filter(tab => 
            tab.url && tab.url.includes('fixably.com')
        );
        
        if (fixablyTabs.length === 0) {
            // 👇 Тихий режим — без warn
            console.log('ℹ️ Нет открытых вкладок Fixably — настройка сохранена, применится при следующем открытии');
            return;
        }
        
        fixablyTabs.forEach(tab => {
            chrome.tabs.sendMessage(tab.id, message, () => {
                // Игнорируем ошибку
                if (chrome.runtime.lastError) {
                    // Просто игнорируем — вкладка могла быть закрыта
                }
            });
        });
    });
}
// ============================================================
// ЭКСПОРТ / ИМПОРТ / ВОССТАНОВЛЕНИЕ
// ============================================================

async function exportData() {
    const btn = document.getElementById('export-btn');
    btn.textContent = '⏳ Exporting...';
    btn.disabled = true;
    
    try {
        const response = await chrome.runtime.sendMessage({ type: 'EXPORT_DATA' });
        
        if (response && response.success) {
            const data = response.data;
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `fixmod_export_${new Date().toISOString().slice(0,10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            btn.textContent = '✅ Exported!';
            showToast('✅ Data exported');
        } else {
            btn.textContent = '❌ Error';
            showToast('❌ Export error');
        }
        
        setTimeout(() => {
            btn.textContent = '📤 Export';
            btn.disabled = false;
        }, 2000);
        
    } catch (error) {
        btn.textContent = '❌ Error';
        showToast('❌ Export error');
        setTimeout(() => {
            btn.textContent = '📤 Export';
            btn.disabled = false;
        }, 2000);
    }
}

async function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    try {
        const text = await file.text();
        const data = JSON.parse(text);
        
        if (!data.orders || !Array.isArray(data.orders)) {
            showToast('❌ Invalid file format');
            return;
        }
        
        if (!confirm('⚠️ Import will replace all current data. Continue?')) {
            return;
        }
        
        const btn = document.getElementById('import-btn');
        btn.textContent = '⏳ Importing...';
        btn.disabled = true;
        
        const response = await chrome.runtime.sendMessage({ 
            type: 'IMPORT_DATA', 
            data: data 
        });
        
        if (response && response.success) {
            await loadStats();
            btn.textContent = '✅ Imported!';
            showToast(`✅ Imported ${data.orders.length} orders`);
        } else {
            btn.textContent = '❌ Error';
            showToast('❌ Import error');
        }
        
        setTimeout(() => {
            btn.textContent = '📥 Import';
            btn.disabled = false;
        }, 2000);
        
    } catch (error) {
        showToast('❌ Error: ' + error.message);
        document.getElementById('import-btn').textContent = '📥 Import';
        document.getElementById('import-btn').disabled = false;
    }
    
    event.target.value = '';
}

async function restoreFromBackup() {
    const btn = document.getElementById('restore-btn');
    btn.textContent = '⏳ Restoring...';
    btn.disabled = true;
    
    try {
        const response = await chrome.runtime.sendMessage({ type: 'FORCE_RESTORE' });
        
        if (response && response.success) {
            await loadStats();
            btn.textContent = '✅ Restored!';
            showToast('✅ Data restored from backup');
        } else {
            btn.textContent = '❌ No backup found';
            showToast('❌ No backup found');
        }
        
        setTimeout(() => {
            btn.textContent = '🔄 Restore backup';
            btn.disabled = false;
        }, 3000);
        
    } catch (error) {
        btn.textContent = '❌ Error';
        showToast('❌ Restore error');
        setTimeout(() => {
            btn.textContent = '🔄 Restore backup';
            btn.disabled = false;
        }, 3000);
    }
}

async function clearAllData() {
    if (!confirm('⚠️ Delete all data? This cannot be undone!')) return;
    if (!confirm('Are you sure? All orders will be permanently deleted.')) return;
    
    const btn = document.getElementById('clear-data-btn');
    btn.textContent = '⏳ Deleting...';
    btn.disabled = true;
    
    try {
        await chrome.runtime.sendMessage({ type: 'CLEAR_ALL_DATA' });
        await loadStats();
        btn.textContent = '✅ Deleted!';
        showToast('✅ All data deleted');
        
        setTimeout(() => {
            btn.textContent = '🗑️ Delete all data';
            btn.disabled = false;
        }, 2000);
        
    } catch (error) {
        btn.textContent = '❌ Error';
        showToast('❌ Delete error');
        setTimeout(() => {
            btn.textContent = '🗑️ Delete all data';
            btn.disabled = false;
        }, 2000);
    }
}

// ============================================================
// TOAST
// ============================================================

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('show');
    
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => {
        toast.classList.remove('show');
    }, 2500);
}

// ============================================================
// АВТООБНОВЛЕНИЕ
// ============================================================

setInterval(() => {
    loadStats();
}, 30000);