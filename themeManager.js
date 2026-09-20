// themeManager.js - Управление темами виджета

console.log('🎨 ThemeManager loading...');

// ============================================================
// === ЦВЕТОВЫЕ СХЕМЫ ===
// ============================================================

const COLOR_SCHEMES = {
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
// === СОСТОЯНИЕ ===
// ============================================================

let currentThemeId = 'default';
let widgetElement = null;
let currentOpacity = 0.85;

// ============================================================
// === УТИЛИТЫ ===
// ============================================================

// Преобразование HEX в RGB
function hexToRgb(hex) {
    // Убираем # если есть
    hex = hex.replace('#', '');
    
    // Поддержка короткого формата (#fff → #ffffff)
    if (hex.length === 3) {
        hex = hex.split('').map(c => c + c).join('');
    }
    
    const result = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : { r: 102, g: 126, b: 234 };
}

// Создание градиента с прозрачностью
function createGradientWithOpacity(color1, color2, opacity) {
    const rgb1 = hexToRgb(color1);
    const rgb2 = hexToRgb(color2);
    
    return `linear-gradient(135deg, 
        rgba(${rgb1.r}, ${rgb1.g}, ${rgb1.b}, ${opacity}) 0%, 
        rgba(${rgb2.r}, ${rgb2.g}, ${rgb2.b}, ${opacity}) 100%)`;
}

// ============================================================
// === УПРАВЛЕНИЕ ВИДЖЕТОМ ===
// ============================================================

// Устанавливаем ссылку на виджет
function setWidgetElement(element) {
    widgetElement = element;
    console.log('🎨 ThemeManager: widget element set');
}

// Установка прозрачности
function setOpacity(opacity) {
    currentOpacity = opacity;
    console.log('🎨 ThemeManager: opacity set to', opacity);
    
    // Переприменяем текущую тему с новой прозрачностью
    if (currentThemeId) {
        applyTheme(currentThemeId);
    }
}

// ============================================================
// === ПРИМЕНЕНИЕ ТЕМЫ ===
// ============================================================

function applyTheme(themeId) {
    const colors = COLOR_SCHEMES[themeId];
    if (!colors) {
        console.warn('⚠️ Тема не найдена:', themeId);
        return;
    }
    
    currentThemeId = themeId;
    
    // 👇 Создаем градиент с прозрачностью
    const gradient = createGradientWithOpacity(colors.c1, colors.c2, currentOpacity);
    
    // Ищем шапку ВНУТРИ виджета
    let header = null;
    
    if (widgetElement) {
        header = widgetElement.querySelector('.window-header');
    }
    
    // Fallback: ищем по всему документу
    if (!header) {
        header = document.querySelector('#my-draggable-window .window-header');
    }
    
    if (header) {
        header.style.background = gradient;
        // 👇 Убираем фоновый цвет под градиентом
        header.style.backgroundColor = 'transparent';
        console.log('🎨 Градиент с прозрачностью применен:', themeId, '| opacity:', currentOpacity);
    } else {
        console.warn('⚠️ .window-header не найден для применения темы');
    }
    
    // Иконки
    const infoIcons = widgetElement 
        ? widgetElement.querySelectorAll('.info-icon')
        : document.querySelectorAll('.info-icon');
    
    const isDarkTheme = ['dark', 'gray2', 'gray4'].includes(themeId);
    infoIcons.forEach(icon => {
        if (isDarkTheme) {
            icon.style.filter = 'brightness(0) invert(1)';
            icon.style.opacity = '0.8';
        } else {
            icon.style.filter = 'none';
            icon.style.opacity = '0.6';
        }
    });
    
    // Лейблы
    const infoLabels = widgetElement
        ? widgetElement.querySelectorAll('.info-label')
        : document.querySelectorAll('.info-label');
    
    infoLabels.forEach(el => {
        el.style.color = isDarkTheme ? '#cccccc' : '#555555';
    });
    
    // Сохраняем тему
    localStorage.setItem('widgetTheme', themeId);
    console.log('💾 Тема сохранена:', themeId);
}

// ============================================================
// === ЗАГРУЗКА СОХРАНЕННОЙ ТЕМЫ ===
// ============================================================

function loadSavedTheme() {
    const savedTheme = localStorage.getItem('widgetTheme');
    if (savedTheme && COLOR_SCHEMES[savedTheme]) {
        applyTheme(savedTheme);
        currentThemeId = savedTheme;
    } else {
        applyTheme('default');
    }
    return currentThemeId;
}

// ============================================================
// === ГЕТТЕРЫ ===
// ============================================================

function getCurrentTheme() {
    return currentThemeId;
}

function getAvailableThemes() {
    return Object.keys(COLOR_SCHEMES);
}

function getCurrentOpacity() {
    return currentOpacity;
}

function getColorSchemes() {
    return COLOR_SCHEMES;
}

// ============================================================
// === ГЛОБАЛЬНЫЙ ОБЪЕКТ ===
// ============================================================

window.ThemeManager = {
    // Основные методы
    applyTheme: applyTheme,
    loadSavedTheme: loadSavedTheme,
    setWidgetElement: setWidgetElement,
    setOpacity: setOpacity,
    
    // Геттеры
    getCurrentTheme: getCurrentTheme,
    getAvailableThemes: getAvailableThemes,
    getCurrentOpacity: getCurrentOpacity,
    getColorSchemes: getColorSchemes,
    
    // Утилиты
    hexToRgb: hexToRgb,
    createGradientWithOpacity: createGradientWithOpacity
};

console.log('🎨 ThemeManager loaded');