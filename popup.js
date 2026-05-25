// Элементы управления
const slider = document.getElementById('opacity-slider');
const opacityValue = document.getElementById('opacity-value');
const resetBtn = document.getElementById('reset-btn');

// Проверка доступности Chrome API
function isChromeExtension() {
    return typeof chrome !== 'undefined' && chrome.storage && chrome.runtime && chrome.tabs;
}

// Функция загрузки сохраненной прозрачности
function loadOpacity() {
    if (!isChromeExtension()) {
        console.log('Расширение запущено не в Chrome');
        const defaultOpacity = 85;
        if (slider) slider.value = defaultOpacity;
        if (opacityValue) opacityValue.textContent = defaultOpacity + '%';
        return;
    }
    
    chrome.storage.sync.get(['widgetOpacity'], (result) => {
        const opacity = result.widgetOpacity || 85;
        if (slider) slider.value = opacity;
        if (opacityValue) opacityValue.textContent = opacity + '%';
        console.log('Загружена прозрачность:', opacity + '%');
        
        sendOpacityToContentScript(opacity);
    });
}

// Функция отправки прозрачности в content script
function sendOpacityToContentScript(opacity) {
    if (!isChromeExtension()) return;
    
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs.length > 0 && tabs[0] && tabs[0].id) {
            chrome.tabs.sendMessage(tabs[0].id, {
                type: 'UPDATE_OPACITY',
                opacity: opacity / 100
            }).catch(err => {
                console.log('Content script не готов:', err.message);
            });
        }
    });
}

// Функция сохранения прозрачности
function saveOpacity(opacity) {
    if (!isChromeExtension()) {
        console.log('Не могу сохранить - не в Chrome');
        return;
    }
    
    chrome.storage.sync.set({ widgetOpacity: opacity }, () => {
        console.log('Прозрачность сохранена:', opacity + '%');
        sendOpacityToContentScript(opacity);
    });
}

// Обработчик изменения ползунка
if (slider) {
    slider.addEventListener('input', (e) => {
        const opacity = parseInt(e.target.value);
        if (opacityValue) opacityValue.textContent = opacity + '%';
        saveOpacity(opacity);
    });
}

// Кнопка сброса
if (resetBtn) {
    resetBtn.addEventListener('click', () => {
        if (slider) slider.value = 85;
        if (opacityValue) opacityValue.textContent = '85%';
        saveOpacity(85);
    });
}

// Загружаем настройки при открытии popup
loadOpacity();