// Модуль быстрого ввода для полей Diagnosis и Resolution (с конструктором предложений)
class QuickInputHelper {
    constructor() {
        this.buttonsContainer = null;
        this.activeField = null;
        this.currentType = null;
        this.isLoading = false;
        this.isVisible = false;
        
        // Для конструктора предложений
        this.selectedAction = null;
        this.selectedComponents = [];
        this.availableActions = [];
        this.availableComponents = [];
        this.actionButtons = [];
        this.componentButtons = [];
        this.previewElement = null;
        this.clearButton = null;
        
        // Для перетаскивания
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.containerStartX = 0;
        this.containerStartY = 0;
        
        this.STORAGE_KEY = 'quick_input_panel_position';
        this.THEME_STORAGE_KEY = 'widgetTheme';
        
        this.loadSuggestions();
        this.setupThemeListener();
    }
    
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
            // Дефолтные данные для конструктора
            this.phrases = {
                diagnosis: {
                    actions: [
                        { id: 'replacement', label: '🔧 Replacement', template: 'Replacement' },
                        { id: 'repair', label: '🔨 Repair', template: 'Repair' },
                        { id: 'cleaning', label: '🧹 Cleaning', template: 'Cleaning' },
                        { id: 'check', label: '🔍 Check', template: 'Check' },
                        { id: 'testing', label: '🧪 Testing', template: 'Testing' }
                    ],
                    components: [
                        { id: 'battery', label: '🔋 Battery' },
                        { id: 'display', label: '📱 Display' },
                        { id: 'tape', label: '📐 Tape' },
                        { id: 'adhesive', label: '🧪 Adhesive' },
                        { id: 'camera', label: '📷 Camera' },
                        { id: 'speaker', label: '🔊 Speaker' },
                        { id: 'microphone', label: '🎤 Microphone' },
                        { id: 'button', label: '🔘 Button' },
                        { id: 'connector', label: '🔌 Connector' },
                        { id: 'flex', label: '📎 Flex cable' },
                        { id: 'glass', label: '🪟 Glass' },
                        { id: 'housing', label: '🏠 Housing' }
                    ]
                },
                resolution: {
                    actions: [
                        { id: 'replacement', label: '✅ Replacement', template: 'Replacement' },
                        { id: 'repair', label: '✅ Repair', template: 'Repair' },
                        { id: 'cleaning', label: '✅ Cleaning', template: 'Cleaning' },
                        { id: 'check', label: '✅ Check', template: 'Check' },
                        { id: 'testing', label: '✅ Testing', template: 'Testing' }
                    ],
                    components: [
                        { id: 'battery', label: '🔋 Battery' },
                        { id: 'display', label: '📱 Display' },
                        { id: 'tape', label: '📐 Tape' },
                        { id: 'adhesive', label: '🧪 Adhesive' },
                        { id: 'camera', label: '📷 Camera' },
                        { id: 'speaker', label: '🔊 Speaker' },
                        { id: 'microphone', label: '🎤 Microphone' },
                        { id: 'button', label: '🔘 Button' },
                        { id: 'connector', label: '🔌 Connector' },
                        { id: 'flex', label: '📎 Flex cable' },
                        { id: 'glass', label: '🪟 Glass' },
                        { id: 'housing', label: '🏠 Housing' }
                    ]
                }
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
    
    loadSavedTheme() {
        const savedTheme = localStorage.getItem(this.THEME_STORAGE_KEY);
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
            max-width: 480px;
            min-width: 320px;
            cursor: default;
            user-select: none;
            max-height: 90vh;
            overflow-y: auto;
        `;
        
        // Заголовок
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
                <span>⚡ Constructor for <span id="quick-input-type-label">Diagnosis</span></span>
            </span>
            <span id="close-quick-panel" style="cursor: pointer; font-size: 16px; opacity: 0.7; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: rgba(255,255,255,0.1);">✕</span>
        `;
        this.buttonsContainer.appendChild(title);
        
        this.setupDragging(title);
        
        // Блок превью
        const previewContainer = document.createElement('div');
        previewContainer.style.cssText = `
            background: rgba(255,255,255,0.15);
            border-radius: 8px;
            padding: 8px 12px;
            margin-bottom: 12px;
            min-height: 36px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
        `;
        
        this.previewElement = document.createElement('span');
        this.previewElement.style.cssText = `
            color: white;
            font-size: 14px;
            font-weight: 500;
            flex: 1;
            word-break: break-word;
        `;
        this.previewElement.textContent = 'Select action →';
        
        this.clearButton = document.createElement('button');
        this.clearButton.textContent = '✕';
        this.clearButton.style.cssText = `
            background: rgba(255,255,255,0.2);
            border: none;
            border-radius: 50%;
            color: white;
            width: 28px;
            height: 28px;
            cursor: pointer;
            font-size: 14px;
            display: none;
            flex-shrink: 0;
            transition: background 0.2s;
        `;
        this.clearButton.onmouseenter = () => {
            this.clearButton.style.background = 'rgba(255,255,255,0.4)';
        };
        this.clearButton.onmouseleave = () => {
            this.clearButton.style.background = 'rgba(255,255,255,0.2)';
        };
        this.clearButton.onclick = (e) => {
            e.stopPropagation();
            this.clearSelection();
        };
        
        previewContainer.appendChild(this.previewElement);
        previewContainer.appendChild(this.clearButton);
        this.buttonsContainer.appendChild(previewContainer);
        
        // Блок действий
        const actionLabel = document.createElement('div');
        actionLabel.style.cssText = `
            color: rgba(255,255,255,0.8);
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
        `;
        actionLabel.textContent = 'Action';
        this.buttonsContainer.appendChild(actionLabel);
        
        this.actionContainer = document.createElement('div');
        this.actionContainer.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            margin-bottom: 12px;
        `;
        this.buttonsContainer.appendChild(this.actionContainer);
        
        // Блок компонентов
        const compLabel = document.createElement('div');
        compLabel.style.cssText = `
            color: rgba(255,255,255,0.8);
            font-size: 11px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 6px;
        `;
        compLabel.textContent = 'Components (tap to add/remove)';
        this.buttonsContainer.appendChild(compLabel);
        
        this.componentContainer = document.createElement('div');
        this.componentContainer.style.cssText = `
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        `;
        this.buttonsContainer.appendChild(this.componentContainer);
        
        // Кнопка вставки
        const insertContainer = document.createElement('div');
        insertContainer.style.cssText = `
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px solid rgba(255,255,255,0.2);
            display: flex;
            gap: 8px;
        `;
        
        const insertBtn = document.createElement('button');
        insertBtn.textContent = '📋 Insert';
        insertBtn.style.cssText = `
            flex: 1;
            background: rgba(255,255,255,0.95);
            border: none;
            border-radius: 8px;
            padding: 10px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            color: #333;
            transition: all 0.2s;
        `;
        insertBtn.onmouseenter = () => {
            insertBtn.style.background = 'white';
            insertBtn.style.transform = 'scale(1.02)';
        };
        insertBtn.onmouseleave = () => {
            insertBtn.style.background = 'rgba(255,255,255,0.95)';
            insertBtn.style.transform = 'scale(1)';
        };
        insertBtn.onclick = (e) => {
            e.stopPropagation();
            this.insertConstructedText();
        };
        insertContainer.appendChild(insertBtn);
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Сancel';
        cancelBtn.style.cssText = `
            background: rgba(255,255,255,0.15);
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 8px;
            padding: 10px 16px;
            font-size: 13px;
            cursor: pointer;
            color: white;
            transition: background 0.2s;
        `;
        cancelBtn.onmouseenter = () => {
            cancelBtn.style.background = 'rgba(255,255,255,0.3)';
        };
        cancelBtn.onmouseleave = () => {
            cancelBtn.style.background = 'rgba(255,255,255,0.15)';
        };
        cancelBtn.onclick = (e) => {
            e.stopPropagation();
            this.hide();
        };
        insertContainer.appendChild(cancelBtn);
        
        this.buttonsContainer.appendChild(insertContainer);
        
        // Подсказка для перетаскивания
        const dragHint = document.createElement('div');
        dragHint.style.cssText = `
            color: rgba(255,255,255,0.4);
            font-size: 10px;
            margin-top: 8px;
            padding-top: 6px;
            border-top: 1px solid rgba(255,255,255,0.1);
            text-align: center;
        `;
        dragHint.textContent = '💡 Drag ⋮⋮ to move window';
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
        if (!this.actionContainer || !this.componentContainer) {
            this.createButtonsPanel();
        }
        if (this.isLoading) {
            this.actionContainer.innerHTML = '<span style="color:white;">Загрузка...</span>';
            this.componentContainer.innerHTML = '';
            return;
        }
        
        this.currentType = type;
        this.clearSelection();
        
        const data = this.phrases[type] || this.phrases.diagnosis;
        this.availableActions = data.actions || [];
        this.availableComponents = data.components || [];
        
        // Обновляем заголовок
        const labelSpan = document.getElementById('quick-input-type-label');
        if (labelSpan) {
            labelSpan.textContent = type === 'diagnosis' ? 'Diagnosis' : 'Resolution';
        }
        
        // Создаем кнопки действий
        this.actionContainer.innerHTML = '';
        this.availableActions.forEach(action => {
            const btn = this.createActionButton(action);
            this.actionContainer.appendChild(btn);
        });
        
        // Создаем кнопки компонентов
        this.componentContainer.innerHTML = '';
        this.availableComponents.forEach(component => {
            const btn = this.createComponentButton(component);
            this.componentContainer.appendChild(btn);
        });
        
        this.updatePreview();
    }
    
    createActionButton(action) {
        const btn = document.createElement('button');
        btn.textContent = action.label;
        btn.dataset.actionId = action.id;
        btn.style.cssText = `
            background: rgba(255,255,255,0.15);
            border: 2px solid transparent;
            border-radius: 8px;
            padding: 6px 14px;
            font-size: 12px;
            cursor: pointer;
            color: white;
            font-weight: 500;
            transition: all 0.2s;
            font-family: inherit;
        `;
        btn.onmouseenter = () => {
            if (!btn.classList.contains('selected')) {
                btn.style.background = 'rgba(255,255,255,0.3)';
            }
        };
        btn.onmouseleave = () => {
            if (!btn.classList.contains('selected')) {
                btn.style.background = 'rgba(255,255,255,0.15)';
            }
        };
        btn.onclick = (e) => {
            e.stopPropagation();
            this.selectAction(action.id);
        };
        return btn;
    }
    
    createComponentButton(component) {
        const btn = document.createElement('button');
        btn.textContent = component.label;
        btn.dataset.componentId = component.id;
        btn.style.cssText = `
            background: rgba(255,255,255,0.1);
            border: 2px solid rgba(255,255,255,0.2);
            border-radius: 8px;
            padding: 6px 12px;
            font-size: 12px;
            cursor: pointer;
            color: white;
            transition: all 0.2s;
            font-family: inherit;
            opacity: 0.8;
        `;
        btn.onmouseenter = () => {
            if (!btn.classList.contains('selected')) {
                btn.style.background = 'rgba(255,255,255,0.25)';
                btn.style.transform = 'scale(1.05)';
            }
        };
        btn.onmouseleave = () => {
            if (!btn.classList.contains('selected')) {
                btn.style.background = 'rgba(255,255,255,0.1)';
                btn.style.transform = 'scale(1)';
            }
        };
        btn.onclick = (e) => {
            e.stopPropagation();
            this.toggleComponent(component.id);
        };
        return btn;
    }
    
    selectAction(actionId) {
        // Снимаем выделение со всех действий
        const allActionBtns = this.actionContainer.querySelectorAll('button');
        allActionBtns.forEach(btn => {
            btn.classList.remove('selected');
            btn.style.background = 'rgba(255,255,255,0.15)';
            btn.style.borderColor = 'transparent';
            btn.style.transform = 'scale(1)';
        });
        
        // Выделяем выбранное действие
        const selectedBtn = this.actionContainer.querySelector(`button[data-action-id="${actionId}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('selected');
            selectedBtn.style.background = 'rgba(255,255,255,0.35)';
            selectedBtn.style.borderColor = 'white';
            selectedBtn.style.transform = 'scale(1.05)';
        }
        
        const action = this.availableActions.find(a => a.id === actionId);
        if (action) {
            this.selectedAction = action;
        }
        
        this.updatePreview();
    }
    
    toggleComponent(componentId) {
        const index = this.selectedComponents.indexOf(componentId);
        if (index > -1) {
            this.selectedComponents.splice(index, 1);
        } else {
            this.selectedComponents.push(componentId);
        }
        
        // Обновляем визуальное состояние кнопок
        const allCompBtns = this.componentContainer.querySelectorAll('button');
        allCompBtns.forEach(btn => {
            const id = btn.dataset.componentId;
            if (this.selectedComponents.includes(id)) {
                btn.classList.add('selected');
                btn.style.background = 'rgba(255,255,255,0.35)';
                btn.style.borderColor = 'white';
                btn.style.transform = 'scale(1.05)';
                btn.style.opacity = '1';
            } else {
                btn.classList.remove('selected');
                btn.style.background = 'rgba(255,255,255,0.1)';
                btn.style.borderColor = 'rgba(255,255,255,0.2)';
                btn.style.transform = 'scale(1)';
                btn.style.opacity = '0.8';
            }
        });
        
        this.updatePreview();
    }
    
    clearSelection() {
        this.selectedAction = null;
        this.selectedComponents = [];
        
        // Снимаем выделение со всех кнопок
        if (this.actionContainer) {
            const actionBtns = this.actionContainer.querySelectorAll('button');
            actionBtns.forEach(btn => {
                btn.classList.remove('selected');
                btn.style.background = 'rgba(255,255,255,0.15)';
                btn.style.borderColor = 'transparent';
                btn.style.transform = 'scale(1)';
            });
        }
        
        if (this.componentContainer) {
            const compBtns = this.componentContainer.querySelectorAll('button');
            compBtns.forEach(btn => {
                btn.classList.remove('selected');
                btn.style.background = 'rgba(255,255,255,0.1)';
                btn.style.borderColor = 'rgba(255,255,255,0.2)';
                btn.style.transform = 'scale(1)';
                btn.style.opacity = '0.8';
            });
        }
        
        this.updatePreview();
    }
    
    updatePreview() {
        if (!this.previewElement) return;
        
        let parts = [];
        
        if (this.selectedAction) {
            parts.push(this.selectedAction.template);
        }
        
        if (this.selectedComponents.length > 0) {
            const componentLabels = this.selectedComponents.map(id => {
                const comp = this.availableComponents.find(c => c.id === id);
                return comp ? comp.label.replace(/^[^\s]+\s/, '') : id; // Убираем эмодзи
            });
            parts.push(componentLabels.join(', '));
        }
        
        if (parts.length === 0) {
            this.previewElement.textContent = 'Select action →';
            this.clearButton.style.display = 'none';
        } else {
            this.previewElement.textContent = parts.join(' ');
            this.clearButton.style.display = 'block';
        }
    }
    
    getConstructedText() {
        let parts = [];
        
        if (this.selectedAction) {
            parts.push(this.selectedAction.template);
        }
        
        if (this.selectedComponents.length > 0) {
            const componentLabels = this.selectedComponents.map(id => {
                const comp = this.availableComponents.find(c => c.id === id);
                return comp ? comp.label.replace(/^[^\s]+\s/, '') : id;
            });
            parts.push(componentLabels.join(', '));
        }
        
        return parts.join(' ');
    }
    
    insertConstructedText() {
        if (!this.activeField) return;
        
        const text = this.getConstructedText();
        if (!text || text === 'Выберите действие →') {
            // Показываем предупреждение
            const oldText = this.previewElement.textContent;
            this.previewElement.textContent = '⚠️ Выберите действие!';
            this.previewElement.style.color = '#ffcc00';
            setTimeout(() => {
                this.previewElement.textContent = oldText;
                this.previewElement.style.color = 'white';
            }, 1500);
            return;
        }
        
        const currentValue = this.activeField.value;
        const cursorPos = this.activeField.selectionStart;
        
        // Добавляем точку в конце, если её нет
        let finalText = text;
        if (!finalText.endsWith('.') && !finalText.endsWith('!') && !finalText.endsWith('?')) {
            finalText += '.';
        }
        
        const newValue = currentValue.substring(0, cursorPos) + 
                        (currentValue && cursorPos > 0 ? ' ' : '') + 
                        finalText + 
                        (cursorPos < currentValue.length ? ' ' : '') + 
                        currentValue.substring(cursorPos);
        
        this.activeField.value = newValue;
        this.activeField.dispatchEvent(new Event('input', { bubbles: true }));
        this.activeField.dispatchEvent(new Event('change', { bubbles: true }));
        this.activeField.focus();
        this.activeField.setSelectionRange(newValue.length, newValue.length);
        
        // Очищаем выбор после вставки
        this.clearSelection();
        
        // Закрываем панель через 1.5 секунды
        setTimeout(() => {
            if (this.isPanelVisible()) {
                this.hide();
            }
        }, 1500);
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

console.log('Quick Input: Конструктор предложений загружен!');