// quick-input.js - Модуль быстрого ввода для Diagnosis и Resolution

console.log('🔍 Quick Input: Initializing...');

class QuickInputHelper {
    constructor() {
        this.buttonsContainer = null;
        this.activeField = null;
        this.currentType = null;
        this.phrases = { diagnosis: [], resolution: [] };
        this.isLoading = false;
        this.isVisible = false;
        this.isClosing = false;
        
        // Для перетаскивания
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.containerStartX = 0;
        this.containerStartY = 0;
        
        this.STORAGE_KEY = 'quick_input_panel_position';
        
        // Загружаем подсказки
        this.loadSuggestions();
        this.setupThemeListener();
        this.setupGlobalListeners();
    }
    
    setupThemeListener() {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.type === 'UPDATE_THEME') {
                    const theme = request.colors;
                    if (theme && this.buttonsContainer) {
                        const gradient = `linear-gradient(135deg, ${theme.c1} 0%, ${theme.c2} 100%)`;
                        this.buttonsContainer.style.background = gradient;
                    }
                    sendResponse({ success: true });
                }
                return true;
            });
        }
    }
    
    async loadSuggestions() {
        this.isLoading = true;
        try {
            const url = chrome.runtime.getURL('suggestions.json');
            console.log('📥 Quick Input: Loading suggestions from:', url);
            
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            this.phrases = data;
            console.log('✅ Quick Input: Suggestions loaded');
        } catch (error) {
            console.error('❌ Quick Input: Error loading suggestions:', error);
            this.phrases = {
                diagnosis: [
                    { text: "🔋 Battery issue", value: "Battery issue" },
                    { text: "📱 Display issue", value: "Display issue" },
                    { text: "📸 Camera issue", value: "Camera issue" },
                    { text: "🎤 Microphone issue", value: "Microphone issue" },
                    { text: "🔊 Speaker issue", value: "Speaker issue" },
                    { text: "⚡ Charging port", value: "Charging port issue" },
                    { text: "📶 WiFi/Bluetooth", value: "WiFi/Bluetooth issue" },
                    { text: "💧 Water damage", value: "Water damage" },
                    { text: "🔄 Software issue", value: "Software issue" },
                    { text: "📱 Motherboard issue", value: "Motherboard issue" },
                    { text: "🔌 Not charging", value: "Not charging" },
                    { text: "🔒 Locked device", value: "Locked device" },
                    { text: "📱 No power", value: "No power" },
                    { text: "🔋 Battery swollen", value: "Battery swollen" }
                ],
                resolution: [
                    { text: "✅ Battery replaced", value: "Battery replaced." },
                    { text: "✅ Display replaced", value: "Display replaced." },
                    { text: "✅ Rear cameras replaced", value: "Rear cameras replaced." },
                    { text: "✅ SUB board replaced", value: "SUB board replaced." },
                    { text: "✅ Software restored", value: "Software restored." },
                    { text: "✅ Water damage cleaned", value: "Water damage cleaned." },
                    { text: "✅ Housing replaced", value: "Housing replaced." },
                    { text: "🔧 No defects found", value: "No defects found." },
                    { text: "✅ Tapes replaced", value: "Tapes replaced." },
                    { text: "✅ Front camera replaced", value: "Front camera replaced." },
                    { text: "🔋 Battery calibrated", value: "Battery calibrated." },
                    { text: "📱 Screen calibrated", value: "Screen calibrated." },
                    { text: "✅ Microphone replaced", value: "Microphone replaced." },
                    { text: "✅ Speaker replaced", value: "Speaker replaced." },
                    { text: "🔓 Device unlocked", value: "Device unlocked." },
                    { text: "🔄 Factory reset", value: "Factory reset performed." }
                ]
            };
            console.log('ℹ️ Quick Input: Using fallback suggestions');
        }
        this.isLoading = false;
        
        if (this.buttonsContainer && this.currentType) {
            this.updateButtons(this.currentType);
        }
    }
    
    savePosition() {
        if (!this.buttonsContainer || this.buttonsContainer.style.display !== 'block') return;
        try {
            const left = this.buttonsContainer.style.left;
            const top = this.buttonsContainer.style.top;
            if (left && top) {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify({ left, top }));
            }
        } catch(e) {}
    }
    
    loadSavedPosition() {
        try {
            const saved = localStorage.getItem(this.STORAGE_KEY);
            if (saved && this.buttonsContainer) {
                const pos = JSON.parse(saved);
                this.buttonsContainer.style.left = pos.left;
                this.buttonsContainer.style.top = pos.top;
                this.buttonsContainer.setAttribute('data-user-moved', 'true');
            }
        } catch(e) {}
    }
    
    loadSavedTheme() {
        try {
            const savedTheme = localStorage.getItem('widgetTheme');
            if (savedTheme && this.buttonsContainer) {
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
                    const theme = colorSchemes[savedTheme];
                    const gradient = `linear-gradient(135deg, ${theme.c1} 0%, ${theme.c2} 100%)`;
                    this.buttonsContainer.style.background = gradient;
                }
            }
        } catch(e) {}
    }
    
    createButtonsPanel() {
        if (this.buttonsContainer) return this.buttonsContainer;
        
        this.buttonsContainer = document.createElement('div');
        this.buttonsContainer.id = 'quick-input-buttons';
        this.buttonsContainer.style.cssText = `
            display: none;
            position: fixed;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.25);
            padding: 12px;
            z-index: 100000;
            max-width: 420px;
            min-width: 280px;
            cursor: default;
            user-select: none;
            opacity: 0;
            transition: opacity 0.15s ease;
        `;
        
        const title = document.createElement('div');
        title.id = 'quick-input-header';
        title.style.cssText = `
            color: white;
            font-size: 13px;
            margin-bottom: 10px;
            font-weight: bold;
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding-bottom: 8px;
            border-bottom: 1px solid rgba(255,255,255,0.3);
            cursor: move;
            user-select: none;
        `;
        title.innerHTML = `
            <span style="display: flex; align-items: center; gap: 8px; cursor: move;">
                <span style="font-size: 14px;">⋮⋮</span>
                <span>⚡ Быстрый ввод для <span id="quick-input-type-label">Diagnosis</span></span>
            </span>
            <span id="close-quick-panel" style="cursor: pointer; font-size: 16px; opacity: 0.7; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(255,255,255,0.1);">✕</span>
        `;
        this.buttonsContainer.appendChild(title);
        
        this.setupDragging(title);
        
        this.buttonsGrid = document.createElement('div');
        this.buttonsGrid.style.cssText = `
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            max-height: 320px;
            overflow-y: auto;
            padding: 4px 2px;
        `;
        this.buttonsContainer.appendChild(this.buttonsGrid);
        
        const dragHint = document.createElement('div');
        dragHint.style.cssText = `
            color: rgba(255,255,255,0.5);
            font-size: 10px;
            margin-top: 8px;
            padding-top: 6px;
            border-top: 1px solid rgba(255,255,255,0.2);
            text-align: center;
            cursor: default;
        `;
        dragHint.innerHTML = '💡 Перетащите за ⋮⋮ чтобы переместить окно';
        this.buttonsContainer.appendChild(dragHint);
        
        document.body.appendChild(this.buttonsContainer);
        
        const closeBtn = document.getElementById('close-quick-panel');
        if (closeBtn) {
            closeBtn.onclick = (e) => {
                e.stopPropagation();
                this.hide();
            };
        }
        
        this.loadSavedPosition();
        this.loadSavedTheme();
        
        return this.buttonsContainer;
    }
    
    setupDragging(headerElement) {
        if (!headerElement) return;
        
        headerElement.addEventListener('mousedown', (e) => {
            if (e.target.id === 'close-quick-panel') return;
            if (e.target.closest('#close-quick-panel')) return;
            
            this.isDragging = true;
            this.dragStartX = e.clientX;
            this.dragStartY = e.clientY;
            
            const rect = this.buttonsContainer.getBoundingClientRect();
            this.containerStartX = rect.left;
            this.containerStartY = rect.top;
            
            this.buttonsContainer.style.transition = 'none';
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            
            const deltaX = e.clientX - this.dragStartX;
            const deltaY = e.clientY - this.dragStartY;
            
            let newLeft = this.containerStartX + deltaX;
            let newTop = this.containerStartY + deltaY;
            
            const maxX = window.innerWidth - this.buttonsContainer.offsetWidth - 10;
            const maxY = window.innerHeight - this.buttonsContainer.offsetHeight - 10;
            
            newLeft = Math.max(10, Math.min(newLeft, maxX));
            newTop = Math.max(10, Math.min(newTop, maxY));
            
            this.buttonsContainer.style.left = newLeft + 'px';
            this.buttonsContainer.style.top = newTop + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.buttonsContainer.style.transition = '';
                this.savePosition();
            }
        });
    }
    
    setupGlobalListeners() {
        // Закрытие по клику вне панели
        document.addEventListener('click', (e) => {
            if (!this.isVisible) return;
            if (this.isClosing) return;
            
            const target = e.target;
            
            // Проверяем клик по кнопке закрытия
            if (target.id === 'close-quick-panel' || target.closest('#close-quick-panel')) {
                return;
            }
            
            // Клик внутри панели
            if (this.buttonsContainer && this.buttonsContainer.contains(target)) {
                return;
            }
            
            // Клик по активному полю
            if (this.activeField && (this.activeField === target || this.activeField.contains(target))) {
                return;
            }
            
            // Клик по селекту типа заметки
            const noteTypeSelect = document.getElementById('note-type');
            if (noteTypeSelect && noteTypeSelect.contains(target)) {
                return;
            }
            
            this.hide();
        });
        
        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isVisible) {
                this.hide();
            }
        });
    }
    
    updateButtons(type) {
        if (!this.buttonsGrid) this.createButtonsPanel();
        if (this.isLoading) {
            this.buttonsGrid.innerHTML = '<div style="color:white; text-align:center; grid-column:span 2;">⏳ Загрузка подсказок...</div>';
            return;
        }
        
        this.currentType = type;
        this.buttonsGrid.innerHTML = '';
        
        const phrasesList = this.phrases[type] || this.phrases.diagnosis || [];
        
        if (!phrasesList || phrasesList.length === 0) {
            this.buttonsGrid.innerHTML = '<div style="color:white; text-align:center; grid-column:span 2;">📭 Нет подсказок</div>';
            return;
        }
        
        phrasesList.forEach((phrase, index) => {
            const btn = document.createElement('button');
            btn.textContent = phrase.text;
            btn.dataset.value = phrase.value;
            btn.dataset.index = index;
            btn.style.cssText = `
                background: rgba(255,255,255,0.95);
                border: none;
                border-radius: 8px;
                padding: 8px 10px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
                text-align: left;
                color: #333;
                font-weight: 500;
                font-family: inherit;
            `;
            btn.onmouseenter = () => {
                btn.style.background = 'white';
                btn.style.transform = 'scale(1.02)';
                btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
            };
            btn.onmouseleave = () => {
                btn.style.background = 'rgba(255,255,255,0.95)';
                btn.style.transform = 'scale(1)';
                btn.style.boxShadow = 'none';
            };
            btn.onclick = (e) => {
                e.stopPropagation();
                const value = btn.dataset.value;
                if (value) {
                    this.insertText(value);
                }
            };
            this.buttonsGrid.appendChild(btn);
        });
        
        const labelSpan = document.getElementById('quick-input-type-label');
        if (labelSpan) {
            labelSpan.textContent = type === 'diagnosis' ? 'Diagnosis' : 'Resolution';
        }
    }
    
    insertText(text) {
        console.log('📝 Quick Input: Inserting text:', text);
        
        // Проверяем активное поле
        let field = this.activeField;
        
        // Если поле потеряно, пытаемся найти его заново
        if (!field || !document.contains(field)) {
            console.log('🔍 Quick Input: Active field lost, searching...');
            
            // Проверяем поле диагностики
            const diagField = document.getElementById('diagnosticText');
            if (diagField && document.contains(diagField)) {
                field = diagField;
                console.log('✅ Quick Input: Found diagnosticText');
            }
            
            // Проверяем поле заметок
            const noteField = document.getElementById('note-field');
            if (!field && noteField && document.contains(noteField)) {
                field = noteField;
                console.log('✅ Quick Input: Found note-field');
            }
            
            if (field) {
                this.activeField = field;
            }
        }
        
        if (!field) {
            console.warn('⚠️ Quick Input: No active field found');
            this.hide();
            return;
        }
        
        try {
            const currentValue = field.value || '';
            const cursorPos = field.selectionStart || currentValue.length;
            
            const prefix = (currentValue && cursorPos > 0 && currentValue[cursorPos - 1] !== ' ') ? ' ' : '';
            const suffix = (cursorPos < currentValue.length && currentValue[cursorPos] !== ' ') ? ' ' : '';
            
            const newValue = currentValue.substring(0, cursorPos) + 
                            prefix + 
                            text + 
                            suffix + 
                            currentValue.substring(cursorPos);
            
            field.value = newValue;
            
            // Триггерим события
            field.dispatchEvent(new Event('input', { bubbles: true }));
            field.dispatchEvent(new Event('change', { bubbles: true }));
            
            // Фокусируем и ставим курсор в конец
            field.focus();
            field.setSelectionRange(newValue.length, newValue.length);
            
            console.log('✅ Quick Input: Text inserted successfully');
            
            // Скрываем панель после вставки
            setTimeout(() => this.hide(), 300);
            
        } catch (error) {
            console.error('❌ Quick Input: Error inserting text:', error);
        }
    }
    
    show(field, type) {
        // Если панель уже видна и это тот же тип, обновляем
        if (this.isVisible && this.currentType === type && this.activeField === field) {
            return;
        }
        
        this.isClosing = false;
        this.createButtonsPanel();
        
        this.activeField = field;
        this.updateButtons(type);
        this.isVisible = true;
        
        if (!this.buttonsContainer.hasAttribute('data-user-moved')) {
            const rect = field.getBoundingClientRect();
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            
            let top = rect.bottom + scrollTop + 8;
            let left = rect.left + window.scrollX;
            
            const panelWidth = this.buttonsContainer.offsetWidth || 300;
            const panelHeight = this.buttonsContainer.offsetHeight || 200;
            
            if (left + panelWidth > window.innerWidth - 10) {
                left = window.innerWidth - panelWidth - 10;
            }
            if (top + panelHeight > window.innerHeight + scrollTop - 50) {
                top = rect.top + scrollTop - panelHeight - 8;
            }
            
            left = Math.max(10, left);
            top = Math.max(10, top);
            
            this.buttonsContainer.style.top = top + 'px';
            this.buttonsContainer.style.left = left + 'px';
        }
        
        this.buttonsContainer.style.display = 'block';
        requestAnimationFrame(() => {
            this.buttonsContainer.style.opacity = '1';
        });
    }
    
    hide() {
        if (this.isClosing) return;
        this.isClosing = true;
        
        if (this.buttonsContainer) {
            this.buttonsContainer.style.opacity = '0';
            setTimeout(() => {
                if (this.buttonsContainer) {
                    this.buttonsContainer.style.display = 'none';
                    this.isVisible = false;
                }
                this.isClosing = false;
            }, 150);
        } else {
            this.isVisible = false;
            this.isClosing = false;
        }
        
        this.activeField = null;
    }
    
    isPanelVisible() {
        return this.isVisible && this.buttonsContainer && this.buttonsContainer.style.display === 'block';
    }
}

// ============================================================
// === ИНИЦИАЛИЗАЦИЯ ===
// ============================================================

const quickInput = new QuickInputHelper();

// Отслеживание выбора типа заметки
function setupNoteTypeWatcher() {
    const noteTypeSelect = document.getElementById('note-type');
    const noteField = document.getElementById('note-field');
    
    if (!noteTypeSelect || !noteField) {
        setTimeout(setupNoteTypeWatcher, 1000);
        return;
    }
    
    const checkAndShowSuggestions = () => {
        const selectedValue = noteTypeSelect.value;
        if (selectedValue === '2') {
            quickInput.show(noteField, 'diagnosis');
        } else if (selectedValue === '3') {
            quickInput.show(noteField, 'resolution');
        } else {
            quickInput.hide();
        }
    };
    
    noteTypeSelect.addEventListener('change', checkAndShowSuggestions);
    
    noteField.addEventListener('focus', () => {
        const selectedValue = noteTypeSelect.value;
        if (selectedValue === '2' || selectedValue === '3') {
            quickInput.show(noteField, selectedValue === '2' ? 'diagnosis' : 'resolution');
        }
    });
}

// Поддержка модального окна
function setupDiagnosticModalWatcher() {
    const diagnosticTextarea = document.getElementById('diagnosticText');
    if (!diagnosticTextarea) {
        setTimeout(setupDiagnosticModalWatcher, 1000);
        return;
    }
    
    diagnosticTextarea.addEventListener('focus', () => {
        quickInput.show(diagnosticTextarea, 'diagnosis');
    });
}

// Запуск
function initQuickInput() {
    console.log('🔍 Quick Input: Initializing...');
    setupNoteTypeWatcher();
    setupDiagnosticModalWatcher();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initQuickInput);
} else {
    initQuickInput();
}

// Наблюдатель за изменениями
const observer = new MutationObserver(() => {
    if (document.getElementById('note-type') && document.getElementById('note-field')) {
        setupNoteTypeWatcher();
    }
    if (document.getElementById('diagnosticText')) {
        setupDiagnosticModalWatcher();
    }
});
observer.observe(document.body, { childList: true, subtree: true });

console.log('✅ Quick Input: Module loaded');