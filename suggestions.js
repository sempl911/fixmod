// suggestions.js - Быстрый ввод подсказок для Diagnosis и Resolution

console.log('💡 Suggestions module loading...');

// ============================================================
// === ЗАГРУЗКА ПОДСКАЗОК ===
// ============================================================

let SUGGESTIONS = { diagnosis: [], resolution: [] };
let USAGE_STATS = { diagnosis: {}, resolution: {} };

async function loadSuggestionsFromJSON() {
    try {
        const edited = await chrome.storage.local.get(['fixmod_suggestions_edited']);
        
        if (edited.fixmod_suggestions_edited) {
            const data = edited.fixmod_suggestions_edited;
            
            if (data.diagnosis && data.resolution && 
                (data.diagnosis.length > 0 || data.resolution.length > 0)) {
                
                SUGGESTIONS = {
                    diagnosis: data.diagnosis,
                    resolution: data.resolution
                };
                console.log('✅ Подсказки из редактора:', {
                    diagnosis: SUGGESTIONS.diagnosis.length,
                    resolution: SUGGESTIONS.resolution.length
                });
                return true;
            }
        }
    } catch (e) {
        console.warn('⚠️ Не удалось загрузить отредактированные:', e);
    }
    
    try {
        const response = await fetch(chrome.runtime.getURL('suggestions.json'));
        if (response.ok) {
            const data = await response.json();
            if (data.diagnosis && data.resolution) {
                SUGGESTIONS = {
                    diagnosis: data.diagnosis,
                    resolution: data.resolution
                };
                console.log('📚 Подсказки из JSON');
                return true;
            }
        }
        throw new Error('Invalid JSON');
    } catch (error) {
        console.warn('⚠️ Fallback на встроенные:', error);
        SUGGESTIONS = {
            diagnosis: [
                { text: '🔋 Battery issue', value: 'Battery issue' },
                { text: '📱 Display issue', value: 'Display issue' }
            ],
            resolution: [
                { text: '✅ Battery replaced', value: 'Battery replaced.' },
                { text: '✅ Display replaced', value: 'Display replaced.' }
            ]
        };
        return false;
    }
}

async function loadUsageStats() {
    try {
        const result = await chrome.storage.local.get(['fixmod_usage_stats']);
        if (result.fixmod_usage_stats) {
            USAGE_STATS = result.fixmod_usage_stats;
            console.log('📊 Статистика загружена');
        }
    } catch (e) {
        console.warn('⚠️ Не удалось загрузить статистику:', e);
    }
}

async function incrementUsage(fieldType, value) {
    if (!fieldType || !value) return;
    
    if (!USAGE_STATS[fieldType]) USAGE_STATS[fieldType] = {};
    
    const key = value.trim();
    USAGE_STATS[fieldType][key] = (USAGE_STATS[fieldType][key] || 0) + 1;
    
    try {
        await chrome.storage.local.set({ fixmod_usage_stats: USAGE_STATS });
        console.log(`📊 +1: "${key}" = ${USAGE_STATS[fieldType][key]}`);
    } catch (e) {}
}

async function saveCustomPhrase(fieldType, text) {
    if (!fieldType || !text) return;
    if (text.trim().length < 3) return;
    
    const trimmed = text.trim();
    
    const existsInBase = SUGGESTIONS[fieldType].some(item => {
        const itemValue = typeof item === 'string' ? item : (item.value || item.text);
        return itemValue.trim().toLowerCase() === trimmed.toLowerCase();
    });
    
    if (existsInBase) return;
    
    try {
        const result = await chrome.storage.local.get(['fixmod_suggestions_edited']);
        let edited = result.fixmod_suggestions_edited || {
            diagnosis: [],
            resolution: []
        };
        
        const existsInEdited = edited[fieldType].some(item =>
            (item.value || item.text).trim().toLowerCase() === trimmed.toLowerCase()
        );
        
        if (existsInEdited) return;
        
        edited[fieldType].unshift({
            text: trimmed,
            value: trimmed,
            custom: true,
            added_at: new Date().toISOString()
        });
        
        await chrome.storage.local.set({ fixmod_suggestions_edited: edited });
        SUGGESTIONS[fieldType] = edited[fieldType];
        
        console.log(`💾 Автосохранено: "${trimmed}"`);
    } catch (e) {}
}

function getSortedSuggestions(fieldType) {
    const items = SUGGESTIONS[fieldType] || [];
    const stats = USAGE_STATS[fieldType] || {};
    
    const withMeta = items.map((item, originalIndex) => {
        const text = typeof item === 'string' ? item : (item.text || item.value);
        const value = typeof item === 'string' ? item : (item.value || item.text);
        const usage = stats[value] || stats[text] || 0;
        
        return {
            text,
            value,
            usage,
            originalIndex,
            isCustom: item.custom === true
        };
    });
    
    withMeta.sort((a, b) => {
        if (a.isCustom !== b.isCustom) {
            return b.isCustom ? 1 : -1;
        }
        if (b.usage !== a.usage) {
            return b.usage - a.usage;
        }
        return a.originalIndex - b.originalIndex;
    });
    
    return withMeta;
}

// ============================================================
// === СОСТОЯНИЕ ===
// ============================================================

let suggestionsActive = true;
let activeSuggestionInput = null;
let lastActiveInput = null;
let suggestionContainer = null;
let currentSuggestions = [];
let selectedSuggestionIndex = -1;
let currentNoteType = null;
let scrollHandler = null;
let resizeHandler = null;
let outsideClickHandler = null;
let globalClickHandler = null;
let isInsertingSuggestion = false;

// ============================================================
// === ЦВЕТОВЫЕ СХЕМЫ ===
// ============================================================

const SUGGESTION_COLOR_SCHEMES = {
    default: { c1: '#667eea', c2: '#764ba2', isDark: false },
    dark:    { c1: '#1a1a2e', c2: '#16213e', isDark: true  },
    green:   { c1: '#11998e', c2: '#38ef7d', isDark: false },
    orange:  { c1: '#f12711', c2: '#f5af19', isDark: false },
    blue:    { c1: '#1e3c72', c2: '#2a5298', isDark: false },
    red:     { c1: '#cb2d3e', c2: '#ef473a', isDark: false },
    teal:    { c1: '#00b4db', c2: '#0083b0', isDark: false },
    gray1:   { c1: '#ece9e6', c2: '#ffffff', isDark: false },
    gray2:   { c1: '#4b4b4b', c2: '#2c2c2c', isDark: true  },
    gray3:   { c1: '#616161', c2: '#9e9e9e', isDark: false },
    gray4:   { c1: '#3a3a3a', c2: '#1a1a1a', isDark: true  }
};

let cachedTheme = SUGGESTION_COLOR_SCHEMES.default;
let cachedThemeId = 'default';

async function refreshTheme() {
    try {
        const result = await chrome.storage.local.get(['widgetTheme', 'globalThemeId']);
        
        // 👇 ПРИОРИТЕТ: widgetTheme
        const newThemeId = result.widgetTheme || result.globalThemeId || 'default';
        
        cachedThemeId = newThemeId;
        cachedTheme = SUGGESTION_COLOR_SCHEMES[newThemeId] || SUGGESTION_COLOR_SCHEMES.default;
        
        console.log('🎨 Тема загружена:', cachedThemeId);
    } catch (e) {
        console.warn('⚠️ Ошибка refreshTheme:', e);
    }
}

function getCurrentTheme() {
    return { id: cachedThemeId, ...cachedTheme };
}

function hexToRgba(hex, alpha = 1) {
    hex = hex.replace('#', '');
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return `rgba(102, 126, 234, ${alpha})`;
    
    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ============================================================
// === ПРИМЕНЕНИЕ ТЕМЫ С ЦВЕТНОЙ ПОДЛОЖКОЙ ===
// ============================================================

function applyThemeToContainer() {
    if (!suggestionContainer) return;
    
    const theme = getCurrentTheme();
    const isDark = theme.isDark;
    
    console.log('🎨 Применяем тему:', theme.id, '| c1:', theme.c1);
    
    // Убираем старые стили
    suggestionContainer.style.removeProperty('background');
    suggestionContainer.style.removeProperty('background-color');
    suggestionContainer.style.removeProperty('background-image');
    
    let bgSolid, bgGradient, textColor, shadowColor;
    
    if (isDark) {
        bgSolid = '#131924';
        bgGradient = `linear-gradient(135deg, #131924 0%, ${hexToRgba(theme.c1, 0.3)} 100%)`;
        textColor = '#e5e7eb';
        shadowColor = hexToRgba(theme.c1, 0.4);
    } else {
        bgSolid = '#ffffff';
        bgGradient = `linear-gradient(135deg, #ffffff 0%, ${hexToRgba(theme.c1, 0.25)} 100%)`;
        textColor = '#1a1a2e';
        shadowColor = hexToRgba(theme.c1, 0.3);
    }
    
    suggestionContainer.style.setProperty('background-color', bgSolid, 'important');
    suggestionContainer.style.setProperty('background-image', bgGradient, 'important');
    suggestionContainer.style.setProperty('color', textColor, 'important');
    suggestionContainer.style.setProperty('border', `1px solid ${theme.c1}`, 'important');
    suggestionContainer.style.setProperty('border-top', `4px solid ${theme.c1}`, 'important');
    suggestionContainer.style.setProperty('box-shadow', `0 6px 24px ${shadowColor}`, 'important');
    suggestionContainer.style.setProperty('backdrop-filter', 'blur(12px)', 'important');
    
    suggestionContainer.querySelectorAll('.fixmod-suggestion-item').forEach((item, index) => {
        const isSelected = index === selectedSuggestionIndex;
        
        if (isDark) {
            item.style.setProperty('color', '#e5e7eb', 'important');
            item.style.setProperty('background', isSelected ? hexToRgba(theme.c1, 0.4) : 'transparent', 'important');
            item.style.setProperty('border-bottom-color', hexToRgba(theme.c1, 0.2), 'important');
        } else {
            item.style.setProperty('color', '#1a1a2e', 'important');
            item.style.setProperty('background', isSelected ? hexToRgba(theme.c1, 0.3) : 'transparent', 'important');
            item.style.setProperty('border-bottom-color', hexToRgba(theme.c1, 0.15), 'important');
        }
    });
}

// ============================================================
// === СОЗДАНИЕ КОНТЕЙНЕРА ===
// ============================================================

function createSuggestionContainer() {
    if (document.getElementById('fixmod-suggestions')) {
        suggestionContainer = document.getElementById('fixmod-suggestions');
        return;
    }
    
    const container = document.createElement('div');
    container.id = 'fixmod-suggestions';
    container.style.cssText = `
        position: fixed;
        background-color: #ffffff;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.12);
        max-height: 200px;
        overflow-y: auto;
        z-index: 2147483647;
        display: none;
        min-width: 200px;
        max-width: 400px;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 13px;
        pointer-events: auto;
        transition: background 0.2s, border-color 0.2s;
    `;
    document.body.appendChild(container);
    suggestionContainer = container;
}

// ============================================================
// === ОПРЕДЕЛЕНИЕ ТИПА ===
// ============================================================

function getNoteTypeFromSelect() {
    const select = document.getElementById('note-type');
    if (!select) return null;
    
    const value = select.value;
    if (value === '2') return 'diagnosis';
    if (value === '3') return 'resolution';
    return null;
}

function detectFieldType(element) {
    if (!element) return null;
    
    const id = (element.id || '').toLowerCase();
    
    if (id === 'note-field') return getNoteTypeFromSelect();
    if (id === 'diagnostictext' || id === 'diagnostics') return 'diagnosis';
    if (id === 'resolutiontext' || id === 'resolution') return 'resolution';
    
    return null;
}

function getItemTextAndValue(item) {
    if (typeof item === 'string') return { text: item, value: item };
    return {
        text: item.text || item.value || String(item),
        value: item.value || item.text || String(item)
    };
}

// ============================================================
// === ПОКАЗ ПОДСКАЗОК ===
// ============================================================

function showSuggestions(fieldType, value) {
    if (!suggestionsActive || !fieldType) return;
    
    let allItems = getSortedSuggestions(fieldType);
    if (allItems.length === 0) return;
    
    let filtered = allItems;
    
    if (!isInsertingSuggestion && value && value.trim()) {
        const search = value.toLowerCase().trim();
        filtered = allItems.filter(item => {
            return item.text.toLowerCase().includes(search) || 
                   item.value.toLowerCase().includes(search);
        });
        
        if (filtered.length < 3) filtered = allItems;
    }
    
    if (filtered.length === 0) filtered = allItems;
    
    currentSuggestions = filtered;
    selectedSuggestionIndex = -1;
    
    renderSuggestions(filtered);
    
    document.body.appendChild(suggestionContainer);
    suggestionContainer.style.setProperty('display', 'block', 'important');
    
    applyThemeToContainer();
    positionSuggestionContainer();
    setupPositionTracking();
    setupOutsideClick();
}

// ============================================================
// === РЕНДЕР ===
// ============================================================

function renderSuggestions(suggestions) {
    if (!suggestionContainer) return;
    
    const theme = getCurrentTheme();
    const isDark = theme.isDark;
    
    let html = '';
    suggestions.forEach((item, index) => {
        const isSelected = index === selectedSuggestionIndex;
        const { text } = getItemTextAndValue(item);
        const usage = item.usage || 0;
        const custom = item.isCustom;
        
        const usageBadge = usage > 0 
            ? `<span style="
                margin-left: auto;
                padding: 1px 6px;
                border-radius: 10px;
                font-size: 10px;
                background: ${hexToRgba(theme.c1, isDark ? 0.4 : 0.2)};
                color: ${isDark ? '#e5e7eb' : theme.c1};
                font-weight: 700;
                flex-shrink: 0;
                min-width: 20px;
                text-align: center;
              ">${usage}</span>`
            : '';
        
        const star = custom ? `<span style="color: #f59e0b; font-size: 12px; flex-shrink: 0;">★</span>` : '';
        
        const itemBg = isSelected 
            ? hexToRgba(theme.c1, isDark ? 0.4 : 0.3)
            : 'transparent';
        
        const itemBorderColor = hexToRgba(theme.c1, isDark ? 0.2 : 0.15);
        
        html += `
            <div class="fixmod-suggestion-item" data-index="${index}" style="
                padding: 8px 12px;
                cursor: pointer;
                background: ${itemBg};
                border-bottom: 1px solid ${itemBorderColor};
                font-size: 13px;
                color: ${isDark ? '#e5e7eb' : '#1a1a2e'};
                white-space: nowrap;
                overflow: hidden;
                display: flex;
                align-items: center;
                gap: 6px;
                user-select: none;
                -webkit-user-select: none;
                pointer-events: auto;
                transition: background 0.15s;
            ">
                ${star}
                <span style="flex: 1; overflow: hidden; text-overflow: ellipsis;">${text}</span>
                ${usageBadge}
            </div>
        `;
    });
    
    suggestionContainer.innerHTML = html;
    
    suggestionContainer.querySelectorAll('.fixmod-suggestion-item').forEach((el) => {
        el.addEventListener('mouseenter', () => {
            const index = parseInt(el.dataset.index);
            selectedSuggestionIndex = index;
            renderSuggestions(currentSuggestions);
        });
    });
    
    applyThemeToContainer();
}

// ============================================================
// === ГЛОБАЛЬНЫЙ ПЕРЕХВАТЧИК ===
// ============================================================

function setupGlobalClickHandler() {
    if (globalClickHandler) {
        window.removeEventListener('mousedown', globalClickHandler, true);
        document.removeEventListener('mousedown', globalClickHandler, true);
    }
    
    globalClickHandler = (e) => {
        const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY);
        
        const suggestionItem = elementsAtPoint.find(el => 
            el.classList?.contains('fixmod-suggestion-item')
        );
        
        if (!suggestionItem) return;
        
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        const index = parseInt(suggestionItem.dataset.index);
        const suggestion = currentSuggestions[index];
        
        if (!suggestion) return;
        
        const { value } = getItemTextAndValue(suggestion);
        insertSuggestion(value);
    };
    
    window.addEventListener('mousedown', globalClickHandler, true);
    document.addEventListener('mousedown', globalClickHandler, true);
}

// ============================================================
// === ПОЗИЦИОНИРОВАНИЕ ===
// ============================================================

function positionSuggestionContainer() {
    const input = activeSuggestionInput || lastActiveInput;
    if (!input || !suggestionContainer) return;
    
    const rect = input.getBoundingClientRect();
    const containerHeight = Math.min(suggestionContainer.scrollHeight, 200);
    
    let top = rect.bottom + 4;
    let left = rect.left;
    let width = Math.max(rect.width, 200);
    
    if (top + containerHeight > window.innerHeight - 10) {
        top = rect.top - containerHeight - 4;
    }
    if (left + width > window.innerWidth - 10) {
        left = window.innerWidth - width - 10;
    }
    if (left < 10) left = 10;
    if (top < 10) top = 10;
    
    suggestionContainer.style.setProperty('position', 'fixed', 'important');
    suggestionContainer.style.setProperty('top', top + 'px', 'important');
    suggestionContainer.style.setProperty('left', left + 'px', 'important');
    suggestionContainer.style.setProperty('width', width + 'px', 'important');
    suggestionContainer.style.setProperty('display', 'block', 'important');
    suggestionContainer.style.setProperty('z-index', '2147483647', 'important');
    suggestionContainer.style.setProperty('pointer-events', 'auto', 'important');
}

function setupPositionTracking() {
    removePositionTracking();
    
    scrollHandler = () => {
        if (suggestionContainer?.style.display === 'block') {
            positionSuggestionContainer();
        }
    };
    resizeHandler = () => {
        if (suggestionContainer?.style.display === 'block') {
            positionSuggestionContainer();
        }
    };
    
    window.addEventListener('scroll', scrollHandler, true);
    document.addEventListener('scroll', scrollHandler, true);
    window.addEventListener('resize', resizeHandler);
}

function removePositionTracking() {
    if (scrollHandler) {
        window.removeEventListener('scroll', scrollHandler, true);
        document.removeEventListener('scroll', scrollHandler, true);
        scrollHandler = null;
    }
    if (resizeHandler) {
        window.removeEventListener('resize', resizeHandler);
        resizeHandler = null;
    }
}

// ============================================================
// === ЗАКРЫТИЕ ПРИ КЛИКЕ ВНЕ ===
// ============================================================

function setupOutsideClick() {
    if (outsideClickHandler) {
        document.removeEventListener('mousedown', outsideClickHandler, false);
    }
    
    outsideClickHandler = (e) => {
        if (!suggestionContainer || suggestionContainer.style.display === 'none') return;
        if (isInsertingSuggestion) return;
        
        const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY);
        const isOverSuggestions = elementsAtPoint.some(el => 
            el === suggestionContainer || 
            suggestionContainer.contains(el) ||
            el.classList?.contains('fixmod-suggestion-item')
        );
        
        if (isOverSuggestions) return;
        
        const isNoteField = e.target.id === 'note-field';
        const isNoteTypeSelect = e.target.id === 'note-type';
        const isInsideSelect = e.target.closest('select');
        
        if (!isNoteField && !isNoteTypeSelect && !isInsideSelect) {
            hideSuggestions();
        }
    };
    
    document.addEventListener('mousedown', outsideClickHandler, false);
}

// ============================================================
// === ВСТАВКА ТЕКСТА ===
// ============================================================

function insertSuggestion(text) {
    const input = activeSuggestionInput || lastActiveInput || document.getElementById('note-field');
    
    if (!input) return;
    
    isInsertingSuggestion = true;
    
    const currentValue = input.value || '';
    let newValue;
    
    if (currentValue.trim() === '') {
        newValue = text;
    } else if (currentValue.includes(text)) {
        isInsertingSuggestion = false;
        return;
    } else {
        newValue = currentValue.trim() + ', ' + text;
    }
    
    input.value = newValue;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    
    if (window.jQuery) {
        try {
            window.jQuery(input).trigger('input').trigger('change');
        } catch (e) {}
    }
    
    if (input.setSelectionRange) {
        try {
            input.setSelectionRange(newValue.length, newValue.length);
        } catch (e) {}
    }
    
    input.focus();
    
    if (currentNoteType) {
        incrementUsage(currentNoteType, text);
    }
    
    if (suggestionContainer) {
        suggestionContainer.scrollTop = 0;
    }
    
    setTimeout(() => {
        isInsertingSuggestion = false;
    }, 200);
    
    console.log('✅ Вставлено:', input.value);
}

function hideSuggestions() {
    if (suggestionContainer) {
        suggestionContainer.style.setProperty('display', 'none', 'important');
    }
    selectedSuggestionIndex = -1;
    removePositionTracking();
}

// ============================================================
// === СЛУШАТЕЛИ ===
// ============================================================

function setupSuggestionsListeners() {
    setupGlobalClickHandler();
    
    // Смена типа в select
    document.addEventListener('change', (e) => {
        if (e.target?.id === 'note-type') {
            const newType = getNoteTypeFromSelect();
            const input = activeSuggestionInput || lastActiveInput;
            if (input?.id === 'note-field') {
                if (newType) {
                    showSuggestions(newType, input.value);
                } else {
                    hideSuggestions();
                }
            }
        }
    });
    
    // Фокус
    document.addEventListener('focusin', (e) => {
        const target = e.target;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') return;
        
        const fieldType = detectFieldType(target);
        
        if (fieldType) {
            activeSuggestionInput = target;
            lastActiveInput = target;
            showSuggestions(fieldType, target.value);
        } else if (target.id === 'note-field') {
            activeSuggestionInput = target;
            lastActiveInput = target;
            
            setTimeout(() => {
                const newType = detectFieldType(target);
                if (newType) showSuggestions(newType, target.value);
            }, 500);
        }
    });
    
    // Ввод
    document.addEventListener('input', (e) => {
        if (isInsertingSuggestion) return;
        
        if (e.target === activeSuggestionInput || e.target.id === 'note-field') {
            const fieldType = detectFieldType(e.target);
            if (fieldType) showSuggestions(fieldType, e.target.value);
        }
    });
    
    // Автосохранение
    document.addEventListener('click', async (e) => {
        const addBtn = e.target.closest('#timeline-submit-internal-note, #timeline-submit-public-note, #timeline-submit-note');
        if (!addBtn) return;
        
        const input = document.getElementById('note-field');
        if (!input) return;
        
        const text = input.value.trim();
        if (!text) return;
        
        const fieldType = getNoteTypeFromSelect();
        if (!fieldType) return;
        
        await saveCustomPhrase(fieldType, text);
        await incrementUsage(fieldType, text);
    }, true);
    
    // Клавиатура
    document.addEventListener('keydown', (e) => {
        if (!activeSuggestionInput || suggestionContainer?.style.display === 'none') return;
        
        switch(e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (currentSuggestions.length > 0) {
                    selectedSuggestionIndex = (selectedSuggestionIndex + 1) % currentSuggestions.length;
                    renderSuggestions(currentSuggestions);
                    scrollToSelected();
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (currentSuggestions.length > 0) {
                    selectedSuggestionIndex = selectedSuggestionIndex <= 0 ? currentSuggestions.length - 1 : selectedSuggestionIndex - 1;
                    renderSuggestions(currentSuggestions);
                    scrollToSelected();
                }
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < currentSuggestions.length) {
                    const item = currentSuggestions[selectedSuggestionIndex];
                    const { value } = getItemTextAndValue(item);
                    insertSuggestion(value);
                }
                break;
            case 'Escape':
                e.preventDefault();
                hideSuggestions();
                break;
        }
    });
    
    // 👇 ГЛАВНОЕ: слушаем изменения chrome.storage
    if (typeof chrome !== 'undefined' && chrome.storage?.onChanged) {
        chrome.storage.onChanged.addListener((changes, area) => {
            if (area !== 'local') return;
            
            // Тема изменилась
            if (changes.widgetTheme) {
                const newThemeId = changes.widgetTheme.newValue || 'default';
                console.log('🎨 [Storage] Тема изменилась:', newThemeId);
                
                cachedThemeId = newThemeId;
                cachedTheme = SUGGESTION_COLOR_SCHEMES[newThemeId] || SUGGESTION_COLOR_SCHEMES.default;
                
                applyThemeToContainer();
                
                if (suggestionContainer?.style.display === 'block') {
                    renderSuggestions(currentSuggestions);
                }
            }
            
            // Подсказки изменились
            if (changes.fixmod_suggestions_edited) {
                const newData = changes.fixmod_suggestions_edited.newValue;
                if (newData?.diagnosis && newData?.resolution) {
                    SUGGESTIONS = {
                        diagnosis: newData.diagnosis,
                        resolution: newData.resolution
                    };
                }
            }
            
            // Статистика изменилась
            if (changes.fixmod_usage_stats) {
                USAGE_STATS = changes.fixmod_usage_stats.newValue || USAGE_STATS;
            }
        });
        
        console.log('✅ Слушатель chrome.storage установлен');
    }
}

function scrollToSelected() {
    if (!suggestionContainer) return;
    const items = suggestionContainer.querySelectorAll('.fixmod-suggestion-item');
    if (selectedSuggestionIndex >= 0 && selectedSuggestionIndex < items.length) {
        items[selectedSuggestionIndex].scrollIntoView({ block: 'nearest' });
    }
}

// ============================================================
// === ИНИЦИАЛИЗАЦИЯ ===
// ============================================================

async function initSuggestions() {
    console.log('💡 Initializing suggestions...');
    
    await loadSuggestionsFromJSON();
    await loadUsageStats();
    await refreshTheme();
    
    createSuggestionContainer();
    applyThemeToContainer();
    setupSuggestionsListeners();
    
    console.log('💡 Suggestions ready | Тема:', cachedThemeId);
}

// ============================================================
// === ГЛОБАЛЬНЫЙ ОБЪЕКТ ===
// ============================================================

window.SuggestionsManager = {
    init: function() {
        initSuggestions().catch(e => {
            console.warn('⚠️ Error:', e);
        });
    },
    setEnabled: function(enabled) {
        suggestionsActive = enabled;
        if (!enabled) hideSuggestions();
    },
    isActive: () => suggestionsActive,
    reload: () => loadSuggestionsFromJSON(),
    applyTheme: applyThemeToContainer,
    getTheme: getCurrentTheme
};

console.log('💡 SuggestionsManager loaded');