// Модуль быстрого ввода для полей Diagnosis и Resolution
class QuickInputHelper {
    constructor() {
        this.buttonsContainer = null;
        this.activeField = null;
        this.currentType = null;
        this.phrases = { diagnosis: [], resolution: [] };
        this.isLoading = false;
        this.isVisible = false;
        
        // Для перетаскивания
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.containerStartX = 0;
        this.containerStartY = 0;
        
        // Ключи для сохранения позиции
        this.STORAGE_KEY = 'quick_input_panel_position';
        
        // Загружаем подсказки
        this.loadSuggestions();
        
        // Слушаем изменения темы
        this.setupThemeListener();
    }
    
    // Слушатель изменения темы
    setupThemeListener() {
        if (typeof chrome !== 'undefined' && chrome.runtime) {
            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.type === 'UPDATE_THEME') {
                    const theme = request.colors;
                    const gradient = `linear-gradient(135deg, ${theme.c1} 0%, ${theme.c2} 100%)`;
                    
                    if (this.buttonsContainer) {
                        this.buttonsContainer.style.background = gradient;
                    }
                    sendResponse({ success: true });
                }
                return true;
            });
        }
    }
    
    // Загрузка подсказок из JSON файла
    async loadSuggestions() {
        this.isLoading = true;
        try {
            const url = chrome.runtime.getURL('suggestions.json');
            const response = await fetch(url);
            const data = await response.json();
            this.phrases = data;
            console.log('Quick Input: Подсказки загружены', this.phrases);
        } catch (error) {
            console.error('Quick Input: Ошибка загрузки подсказок', error);
            this.phrases = {
                diagnosis: [
                    { text: "🔋 Battery issue", value: "Battery issue" },
                    { text: "📱 Display issue", value: "Display issue" }
                ],
                resolution: [
                    { text: "✅ Battery replaced", value: "Battery replaced" },
                    { text: "✅ Display replaced", value: "Display replaced" }
                ]
            };
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
    
    // Загрузка сохраненной темы
    loadSavedTheme() {
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
        
        document.getElementById('close-quick-panel').onclick = (e) => {
            e.stopPropagation();
            this.hide();
        };
        
        this.loadSavedPosition();
        this.loadSavedTheme();
        
        return this.buttonsContainer;
    }
    
    setupDragging(headerElement) {
        if (!headerElement) return;
        
        headerElement.addEventListener('mousedown', (e) => {
            if (e.target.id === 'close-quick-panel') return;
            
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
    
    updateButtons(type) {
        if (!this.buttonsGrid) this.createButtonsPanel();
        if (this.isLoading) {
            this.buttonsGrid.innerHTML = '<div style="color:white; text-align:center; grid-column:span 2;">Загрузка подсказок...</div>';
            return;
        }
        
        this.currentType = type;
        this.buttonsGrid.innerHTML = '';
        
        const phrasesList = this.phrases[type] || this.phrases.diagnosis;
        
        if (!phrasesList || phrasesList.length === 0) {
            this.buttonsGrid.innerHTML = '<div style="color:white; text-align:center; grid-column:span 2;">Нет подсказок</div>';
            return;
        }
        
        phrasesList.forEach(phrase => {
            const btn = document.createElement('button');
            btn.textContent = phrase.text;
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
                this.insertText(phrase.value);
            };
            this.buttonsGrid.appendChild(btn);
        });
        
        const labelSpan = document.getElementById('quick-input-type-label');
        if (labelSpan) {
            labelSpan.textContent = type === 'diagnosis' ? 'Diagnosis' : 'Resolution';
        }
    }
    
    insertText(text) {
        if (!this.activeField) return;
        
        const currentValue = this.activeField.value;
        const cursorPos = this.activeField.selectionStart;
        
        const newValue = currentValue.substring(0, cursorPos) + 
                        (currentValue && cursorPos > 0 ? ' ' : '') + 
                        text + 
                        (cursorPos < currentValue.length ? ' ' : '') + 
                        currentValue.substring(cursorPos);
        
        this.activeField.value = newValue;
        this.activeField.dispatchEvent(new Event('input', { bubbles: true }));
        this.activeField.dispatchEvent(new Event('change', { bubbles: true }));
        this.activeField.focus();
        this.activeField.setSelectionRange(newValue.length, newValue.length);
    }
    
    show(field, type) {
        this.createButtonsPanel();
        
        this.activeField = field;
        this.updateButtons(type);
        this.isVisible = true;
        
        if (!this.buttonsContainer.hasAttribute('data-user-moved')) {
            const rect = field.getBoundingClientRect();
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            
            let top = rect.bottom + scrollTop + 8;
            let left = rect.left + window.scrollX;
            
            if (left + this.buttonsContainer.offsetWidth > window.innerWidth - 10) {
                left = window.innerWidth - this.buttonsContainer.offsetWidth - 10;
            }
            if (top + this.buttonsContainer.offsetHeight > window.innerHeight + scrollTop - 50) {
                top = rect.top + scrollTop - this.buttonsContainer.offsetHeight - 8;
            }
            
            this.buttonsContainer.style.top = top + 'px';
            this.buttonsContainer.style.left = left + 'px';
        }
        
        this.buttonsContainer.style.display = 'block';
        this.buttonsContainer.style.opacity = '0';
        requestAnimationFrame(() => {
            this.buttonsContainer.style.opacity = '1';
            this.buttonsContainer.style.transition = 'opacity 0.15s ease';
        });
    }
    
    hide() {
        if (this.buttonsContainer && this.buttonsContainer.style.display === 'block') {
            this.buttonsContainer.style.opacity = '0';
            setTimeout(() => {
                if (this.buttonsContainer && this.buttonsContainer.style.opacity === '0') {
                    this.buttonsContainer.style.display = 'none';
                    this.isVisible = false;
                }
            }, 150);
            this.activeField = null;
        }
    }
    
    isPanelVisible() {
        return this.isVisible && this.buttonsContainer && this.buttonsContainer.style.display === 'block';
    }
}

// Создаем экземпляр
const quickInput = new QuickInputHelper();

// Глобальный обработчик кликов для закрытия панели
document.addEventListener('click', (e) => {
    if (!quickInput.isPanelVisible()) return;
    
    if (e.target.id === 'close-quick-panel') return;
    
    if (quickInput.buttonsContainer && quickInput.buttonsContainer.contains(e.target)) return;
    
    if (quickInput.activeField && (quickInput.activeField === e.target || quickInput.activeField.contains(e.target))) return;
    
    const noteTypeSelect = document.getElementById('note-type');
    if (noteTypeSelect && noteTypeSelect.contains(e.target)) return;
    
    quickInput.hide();
});

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
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupNoteTypeWatcher();
        setupDiagnosticModalWatcher();
    });
} else {
    setupNoteTypeWatcher();
    setupDiagnosticModalWatcher();
}

// Наблюдатель
const observer = new MutationObserver(() => {
    if (document.getElementById('note-type') && document.getElementById('note-field')) {
        setupNoteTypeWatcher();
    }
    if (document.getElementById('diagnosticText')) {
        setupDiagnosticModalWatcher();
    }
});
observer.observe(document.body, { childList: true, subtree: true });

console.log('Quick Input: Модуль загружен! Панель меняет цвет вместе с темой');