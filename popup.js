// Элементы управления
const slider = document.getElementById('opacity-slider');
const opacityValue = document.getElementById('opacity-value');
const resetBtn = document.getElementById('reset-btn');
const themeSelect = document.getElementById('theme-select');

let saveTimeout = null;
let lastSavedOpacity = null;
let pendingOpacity = null;

// Цветовые схемы
const colorSchemes = {
    default: { c1: '#667eea', c2: '#764ba2', name: 'Фиолетовый' },
    dark: { c1: '#1a1a2e', c2: '#16213e', name: 'Тёмно-синий' },
    green: { c1: '#11998e', c2: '#38ef7d', name: 'Зелёный' },
    orange: { c1: '#f12711', c2: '#f5af19', name: 'Оранжевый' },
    blue: { c1: '#1e3c72', c2: '#2a5298', name: 'Классический синий' },
    red: { c1: '#cb2d3e', c2: '#ef473a', name: 'Красный' },
    teal: { c1: '#00b4db', c2: '#0083b0', name: 'Бирюзовый' },
    gray1: { c1: '#ece9e6', c2: '#ffffff', name: 'Светло-серый' },
    gray2: { c1: '#4b4b4b', c2: '#2c2c2c', name: 'Тёмно-серый' },
    gray3: { c1: '#616161', c2: '#9e9e9e', name: 'Мокрый асфальт' },
    gray4: { c1: '#3a3a3a', c2: '#1a1a1a', name: 'Графитовый' }
};

function isChromeExtension() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.runtime && chrome.tabs;
}

// Отправка прозрачности в content script (мгновенно для реального времени)
function sendOpacityToContentScript(opacity) {
    if (!isChromeExtension()) return;
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0 && tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: 'UPDATE_OPACITY',
                opacity: opacity / 100
            }).catch(err => console.log('Content script не готов:', err.message));
        }
    });
}

// Сохранение прозрачности (только когда пользователь остановился)
function saveOpacityDebounced(opacity) {
    if (!isChromeExtension()) return;
    if (lastSavedOpacity === opacity) return;
    
    lastSavedOpacity = opacity;
    chrome.storage.sync.set({ widgetOpacity: opacity }, () => {
        if (chrome.runtime.lastError) {
            console.log('Ошибка сохранения:', chrome.runtime.lastError.message);
        } else {
            console.log('Прозрачность сохранена:', opacity + '%');
        }
    });
}

// Загрузка прозрачности
function loadOpacity() {
    if (!isChromeExtension()) {
        const defaultOpacity = 85;
        if (slider) slider.value = defaultOpacity;
        if (opacityValue) opacityValue.textContent = defaultOpacity + '%';
        return;
    }
    
    chrome.storage.sync.get(['widgetOpacity'], (result) => {
        const opacity = result.widgetOpacity || 85;
        if (slider) slider.value = opacity;
        if (opacityValue) opacityValue.textContent = opacity + '%';
        lastSavedOpacity = opacity;
        sendOpacityToContentScript(opacity);
    });
}

// Функция применения темы к popup
function applyThemeToPopup(themeId) {
    const theme = colorSchemes[themeId];
    if (!theme) return;
    const gradient = `linear-gradient(135deg, ${theme.c1} 0%, ${theme.c2} 100%)`;
    document.body.style.background = gradient;
}

function sendThemeToContentScript(themeId) {
    if (!isChromeExtension()) return;
    
    const theme = colorSchemes[themeId];
    if (!theme) return;
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0 && tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: 'UPDATE_THEME',
                theme: themeId,
                colors: theme
            }).catch(err => console.log('Content script не готов:', err.message));
        }
    });
}

function loadTheme() {
    const savedTheme = localStorage.getItem('widgetTheme') || 'default';
    themeSelect.value = savedTheme;
    applyThemeToPopup(savedTheme);
    sendThemeToContentScript(savedTheme);
}

function saveTheme(themeId) {
    localStorage.setItem('widgetTheme', themeId);
    applyThemeToPopup(themeId);
    sendThemeToContentScript(themeId);
}

// Обработчик ползунка: реальное время + debounce для сохранения
if (slider) {
    slider.addEventListener('input', (e) => {
        const opacity = parseInt(e.target.value);
        
        // Обновляем отображение
        if (opacityValue) opacityValue.textContent = opacity + '%';
        
        // ОТПРАВЛЯЕМ МГНОВЕННО в content script (реальное время)
        sendOpacityToContentScript(opacity);
        
        // Отменяем предыдущий таймаут сохранения
        if (saveTimeout) clearTimeout(saveTimeout);
        
        // Сохраняем в storage только через 300ms после последнего движения
        saveTimeout = setTimeout(() => {
            saveOpacityDebounced(opacity);
        }, 300);
    });
}

if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        if (slider) slider.value = 85;
        if (opacityValue) opacityValue.textContent = '85%';
        sendOpacityToContentScript(85);
        saveOpacityDebounced(85);
    });
}

if (themeSelect) {
    themeSelect.addEventListener('change', (e) => {
        saveTheme(e.target.value);
    });
}

loadOpacity();
loadTheme();

const versionSpan = document.getElementById('version-info');
if (versionSpan && isChromeExtension()) {
    const version = chrome.runtime.getManifest().version;
    versionSpan.textContent = `v${version}`;
}