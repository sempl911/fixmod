// stats.js - FixMod Statistics Page

let allOrders = [];
let rawAllOrders = [];
let filteredOrders = [];
let visibleOrders = [];
let currentPage = 1;
let currentLimit = 25;
let currentGroup = '';
let currentDateFrom = '';
let currentDateTo = '';
let currentDays = '';

let dailyChart = null;
let statusChart = null;
let chartJsAvailable = false;
let dailyChartType = 'line';

// Календарь
let customHolidays = new Set();
let currentCalMonth = new Date();

// 👤 Текущий пользователь
let currentUser = null;
let filterByUser = true;

// Проверяем Chart.js
try {
    if (typeof Chart !== 'undefined') {
        chartJsAvailable = true;
        console.log('✅ Chart.js loaded');
    }
} catch(e) {
    chartJsAvailable = false;
    console.warn('⚠️ Chart.js not available');
}

// ============================================================
// 0. ТЕКУЩИЙ ПОЛЬЗОВАТЕЛЬ
// ============================================================

async function loadCurrentUserFromStorage() {
    try {
        const result = await chrome.storage.local.get(['fixmod_current_user']);
        if (result.fixmod_current_user) {
            currentUser = result.fixmod_current_user;
            console.log('👤 Пользователь из storage:', currentUser);
        } else {
            console.warn('⚠️ Нет сохранённого пользователя — показываем ВСЕ заказы');
            filterByUser = false;
        }
    } catch (e) {
        console.warn('⚠️ Не удалось загрузить пользователя:', e);
        filterByUser = false;
    }
}

function applyUserFilter(orders) {
    if (!filterByUser || !currentUser) {
        return orders;
    }
    
    return orders.filter(order => {
        if (order.current_user === currentUser) return true;
        if (!order.current_user && order.technician === currentUser) return true;
        return false;
    });
}

// ============================================================
// 1. ГРУППИРОВКА СТАТУСОВ
// ============================================================
function getStatusGroup(statusCode, statusText) {
    if (statusText) {
        const text = statusText.toLowerCase();
        if (text.includes('handling') || text.includes('workshop') || text.includes('data recovery')) return 'handling';
        if (text.includes('repair')) return 'repair';
        if (text.includes('shipped') || text.includes('picked up') || text.includes('waiting for shipping')) return 'ready';
        if (text.includes('withdraw')) return 'cancelled';
        if (text.includes('customer')) return 'customer';
        if (text.includes('approval')) return 'customer';
        if (text.includes('replacement part')) return 'parts';
        if (text.includes('ready')) return 'ready';
        if (text.includes('cancelled')) return 'cancelled';
    }

    const groups = {
        'cancelled': 'cancelled',
        'withdraw': 'cancelled',
        'ready': 'ready',
        'shipped': 'ready',
        'picked_up': 'ready',
        'waiting_shipping': 'ready',
        'handling': 'handling',
        'repair_center': 'repair',
        'waiting': 'parts',
        'waiting_parts': 'parts',
        'waiting_customer': 'customer',
        'waiting_approval': 'customer',
        'workshop': 'handling',
        'data_recovery': 'handling'
    };
    return groups[statusCode] || 'unknown';
}

const STATUS_MAP = {
    'ready': 'Ready for pickup',
    'cancelled': 'No repair',
    'handling': 'In handling',
    'parts': 'Awaiting parts',
    'customer': 'Customer',
    'repair': 'Repair centre',
    'unknown': 'Unknown'
};

const STATUS_GROUP_MEMBERS = {
    'ready': ['Ready for pickup', 'Shipped', 'Picked up', 'Awaiting for shipping'],
    'cancelled': ['Cancelled', 'Withdrawn'],
    'handling': ['In handling', 'In workshop', 'In data recovery'],
    'parts': ['Awaiting replacement part'],
    'customer': ['Awaiting customer', 'Awaiting local approval'],
    'repair': ['In repair at Apple repair center'],
    'unknown': ['Unknown']
};

const STATUS_COLORS = {
    'ready': '#34c759',
    'cancelled': '#ff3b30',
    'handling': '#af52de',
    'parts': '#ff9500',
    'customer': '#007aff',
    'repair': '#ff6b35',
    'unknown': '#8e8e93'
};

const STATUS_ORDER = ['ready', 'cancelled', 'handling', 'parts', 'customer', 'repair', 'unknown'];

function getStatusLabel(group) {
    return STATUS_MAP[group] || group || 'Unknown';
}

function getStatusColor(group) {
    return STATUS_COLORS[group] || '#8e8e93';
}

function getGroupMembers(group) {
    return STATUS_GROUP_MEMBERS[group] || ['Unknown'];
}

// ============================================================
// 2. 👇 РАБОЧАЯ ДАТА ЗАКАЗА (КЛЮЧЕВАЯ ФУНКЦИЯ)
// ============================================================
//
// Приоритет:
// 1. Самая свежая резолюция (работа выполнена)
// 2. Самый свежий диагноз (работа в процессе)
// 3. Самое свежее изменение статуса
// 4. Самое свежее изменение техника
// 5. last_status_change
// 6. created_at (крайний случай)
//

// 👇 Вспомогательная функция: найти САМУЮ СВЕЖУЮ дату в массиве
function getLatestDate(items) {
    if (!items || items.length === 0) return null;
    
    let latestDate = null;
    let latestTimestamp = 0;
    
    items.forEach(item => {
        if (item && item.date) {
            const ts = new Date(item.date).getTime();
            // Сравниваем timestamp — берём максимум
            if (!isNaN(ts) && ts > latestTimestamp) {
                latestTimestamp = ts;
                latestDate = item.date;
            }
        }
    });
    
    return latestDate;
}

// 👇 Рабочая дата заказа — берём САМУЮ СВЕЖУЮ из всех доступных
function getOrderWorkDate(order) {
    if (!order) return null;
    
    // 1. Резолюция — самая свежая (приоритет: работа выполнена)
    const latestResolution = getLatestDate(order.resolutions);
    if (latestResolution) return latestResolution;
    
    // 2. Диагноз — самый свежий (работа в процессе)
    const latestDiagnosis = getLatestDate(order.diagnoses);
    if (latestDiagnosis) return latestDiagnosis;
    
    // 3. Изменение статуса — самое свежее
    const latestStatusChange = getLatestDate(order.status_changes);
    if (latestStatusChange) return latestStatusChange;
    
    // 4. Изменение техника — самое свежее
    const latestHandlerChange = getLatestDate(order.handler_changes);
    if (latestHandlerChange) return latestHandlerChange;
    
    // 5. last_status_change
    if (order.last_status_change) return order.last_status_change;
    
    // 6. Крайний случай — created_at
    return order.created_at || null;
}

// Алиас для совместимости со старым кодом
function getOrderDateForFilter(order) {
    return getOrderWorkDate(order);
}

// ============================================================
// 3. ВЫХОДНЫЕ
// ============================================================

async function loadHolidays() {
    try {
        const result = await chrome.storage.local.get(['fixmod_holidays']);
        if (result.fixmod_holidays && Array.isArray(result.fixmod_holidays)) {
            customHolidays = new Set(result.fixmod_holidays);
        }
    } catch (e) {
        console.warn('⚠️ Не удалось загрузить выходные:', e);
    }
}

async function saveHolidays() {
    try {
        await chrome.storage.local.set({
            fixmod_holidays: Array.from(customHolidays)
        });
    } catch (e) {
        console.warn('⚠️ Не удалось сохранить выходные:', e);
    }
}

function isDayOff(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = date.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const isCustom = customHolidays.has(dateStr);
    return isWeekend || isCustom;
}

async function toggleHoliday(dateStr) {
    const date = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = date.getDay();
    
    if (dayOfWeek === 0 || dayOfWeek === 6) return;
    
    if (customHolidays.has(dateStr)) {
        customHolidays.delete(dateStr);
    } else {
        customHolidays.add(dateStr);
    }
    
    await saveHolidays();
    renderCalendar();
    
    updateDailyChart();
    updateStatsCards();
}

// ============================================================
// 4. КАЛЕНДАРЬ
// ============================================================

function renderCalendar() {
    const grid = document.getElementById('cal-grid');
    const label = document.getElementById('cal-month-label');
    if (!grid || !label) return;
    
    const year = currentCalMonth.getFullYear();
    const month = currentCalMonth.getMonth();
    
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                        'July', 'August', 'September', 'October', 'November', 'December'];
    label.textContent = `${monthNames[month]} ${year}`;
    
    const firstDay = new Date(year, month, 1);
    const jsDay = firstDay.getDay();
    const startOffset = jsDay === 0 ? 6 : jsDay - 1;
    
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    let html = '';
    
    const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    weekdays.forEach(day => {
        html += `<div class="calendar-weekday">${day}</div>`;
    });
    
    for (let i = 0; i < startOffset; i++) {
        const prevDay = daysInPrevMonth - startOffset + i + 1;
        html += `<div class="calendar-day other-month">${prevDay}</div>`;
    }
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const date = new Date(dateStr + 'T00:00:00');
        const dayOfWeek = date.getDay();
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
        const isHoliday = customHolidays.has(dateStr);
        const isToday = dateStr === todayStr;
        
        let classes = 'calendar-day';
        if (isHoliday) classes += ' holiday';
        else if (isWeekend) classes += ' weekend';
        if (isToday) classes += ' today';
        
        html += `<div class="${classes}" data-date="${dateStr}">${day}</div>`;
    }
    
    const totalCells = startOffset + daysInMonth;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let i = 1; i <= remainingCells; i++) {
        html += `<div class="calendar-day other-month">${i}</div>`;
    }
    
    grid.innerHTML = html;
    
    grid.querySelectorAll('.calendar-day:not(.other-month)').forEach(el => {
        el.addEventListener('click', () => {
            const dateStr = el.dataset.date;
            if (dateStr) toggleHoliday(dateStr);
        });
    });
}

function prevCalMonth() {
    currentCalMonth.setMonth(currentCalMonth.getMonth() - 1);
    renderCalendar();
}

function nextCalMonth() {
    currentCalMonth.setMonth(currentCalMonth.getMonth() + 1);
    renderCalendar();
}

async function initCalendar() {
    await loadHolidays();
    currentCalMonth = new Date();
    renderCalendar();
    
    const prevBtn = document.getElementById('cal-prev');
    const nextBtn = document.getElementById('cal-next');
    if (prevBtn) prevBtn.addEventListener('click', prevCalMonth);
    if (nextBtn) nextBtn.addEventListener('click', nextCalMonth);
}

// ============================================================
// 5. ФОРМАТИРОВАНИЕ ДАТ
// ============================================================

function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            day: '2-digit', month: '2-digit', year: 'numeric'
        });
    } catch (e) {
        return dateString;
    }
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleString('en-US', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch (e) {
        return dateString;
    }
}

// ============================================================
// 6. ПРЕСЕТЫ ДАТ
// ============================================================

function getPresetDates(preset) {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayStr = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
    
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    const sevenDaysStr = `${sevenDaysAgo.getFullYear()}-${String(sevenDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(sevenDaysAgo.getDate()).padStart(2, '0')}`;
    
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 29);
    const thirtyDaysStr = `${thirtyDaysAgo.getFullYear()}-${String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0')}-${String(thirtyDaysAgo.getDate()).padStart(2, '0')}`;
    
    switch(preset) {
        case 'today': return { from: todayStr, to: todayStr };
        case 'yesterday': return { from: yesterdayStr, to: yesterdayStr };
        case '7d': return { from: sevenDaysStr, to: todayStr };
        case '30d': return { from: thirtyDaysStr, to: todayStr };
        case 'all':
        default: return { from: '2000-01-01', to: todayStr };
    }
}

// ============================================================
// 7. ФИЛЬТРАЦИЯ ПО ДАТЕ
// ============================================================

function applyDateFilter(orders) {
    if (!orders) return [];
    if (!currentDateFrom && !currentDateTo && !currentDays) return orders;

    let filtered = [...orders];

    if (currentDays) {
        const now = new Date();
        const threshold = new Date(now);
        threshold.setDate(threshold.getDate() - parseInt(currentDays));
        threshold.setHours(0, 0, 0, 0);
        
        filtered = filtered.filter(order => {
            const orderDate = getOrderWorkDate(order);
            if (!orderDate) return false;
            return new Date(orderDate) >= threshold;
        });
    }

    if (currentDateFrom) {
        const from = new Date(currentDateFrom);
        from.setHours(0, 0, 0, 0);
        filtered = filtered.filter(order => {
            const orderDate = getOrderWorkDate(order);
            if (!orderDate) return false;
            return new Date(orderDate) >= from;
        });
    }

    if (currentDateTo) {
        const to = new Date(currentDateTo);
        to.setHours(23, 59, 59, 999);
        filtered = filtered.filter(order => {
            const orderDate = getOrderWorkDate(order);
            if (!orderDate) return false;
            return new Date(orderDate) <= to;
        });
    }

    return filtered;
}

// ============================================================
// 8. ОСНОВНАЯ ФИЛЬТРАЦИЯ
// ============================================================

function filterOrders() {
    const search = document.getElementById('search-input')?.value.toLowerCase().trim() || '';
    const statusFilter = document.getElementById('status-filter')?.value || '';
    
    let filtered = [...allOrders];
    filtered = applyDateFilter(filtered);
    
    const activeGroup = currentGroup || statusFilter;
    if (activeGroup) {
        filtered = filtered.filter(order => {
            const group = getStatusGroup(order.status_code, order.status);
            return group === activeGroup;
        });
    }
    
    if (search) {
        filtered = filtered.filter(order => {
            const searchable = [
                order.order_number,
                order.device_model,
                order.imei,
                order.resolution
            ].join(' ').toLowerCase();
            return searchable.includes(search);
        });
    }
    
    filteredOrders = filtered;
    visibleOrders = filtered;
    currentPage = 1;
    
    renderTable();
    updateStatusList();
    updateStatusChart();
    updateDailyChart();
    updateStatsCards();
}

// ============================================================
// 9. КАРТОЧКИ СТАТИСТИКИ
// ============================================================

function updateStatsCards() {
    const allStatsSourceLength = allOrders.length;
    const dateFiltered = applyDateFilter(allOrders);
    const groupedStats = {};

    dateFiltered.forEach(order => {
        const group = getStatusGroup(order.status_code, order.status);
        if (!groupedStats[group]) {
            groupedStats[group] = { code: group, label: STATUS_MAP[group] || group, count: 0 };
        }
        groupedStats[group].count++;
    });

    let html = '';
    const isAllActive = currentGroup === '';
    html += `
        <div class="stat-card main-card ${isAllActive ? 'active' : ''}" data-group="" style="cursor:pointer;">
            <div class="number">${allStatsSourceLength || 0}</div>
            <div class="label">All Orders</div>
            <div class="sub-label">My orders</div>
        </div>
    `;

    const orderList = ['ready', 'cancelled', 'handling', 'parts', 'customer', 'repair', 'unknown'];

    orderList.forEach(group => {
        const g = groupedStats[group];
        const count = g ? g.count : 0;
        const label = STATUS_MAP[group] || group;
        const color = STATUS_COLORS[group] || '#8e8e93';
        const members = getGroupMembers(group);
        const isActive = currentGroup === group;
        const membersText = members.join(', ');

        html += `
            <div class="stat-card ${isActive ? 'active' : ''}" data-group="${group}" style="cursor:pointer; ${isActive ? 'border:2px solid ' + color + ';' : ''}">
                <div class="number" style="color:${color};">${count}</div>
                <div class="label">${label}</div>
                <div class="sub-label" title="${membersText}">${membersText}</div>
            </div>
        `;
    });

    document.getElementById('stats-grid').innerHTML = html;

    document.querySelectorAll('.stat-card').forEach(card => {
        card.addEventListener('click', function() {
            const group = this.dataset.group || '';
            filterByGroup(group);
        });
    });
}

// ============================================================
// 10. СПИСОК СТАТУСОВ
// ============================================================

function updateStatusList() {
    const colors = STATUS_COLORS;
    const labels = STATUS_MAP;
    const orderList = STATUS_ORDER;
    const stats = {};

    const dateFiltered = applyDateFilter(allOrders);
    
    dateFiltered.forEach(order => {
        const group = getStatusGroup(order.status_code, order.status);
        if (!stats[group]) stats[group] = 0;
        stats[group]++;
    });

    orderList.forEach(g => { if (!stats[g]) stats[g] = 0; });

    const total = dateFiltered.length;

    let listHtml = '';
    let hasData = false;

    orderList.forEach(group => {
        const count = stats[group] || 0;
        const label = labels[group] || group;
        const color = colors[group] || '#8e8e93';

        if (count > 0) {
            hasData = true;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            listHtml += `
            <div class="stats-list-item" data-group="${group}" style="cursor:pointer;">
                <span class="label"><span class="dot" style="background:${color};"></span> ${label}</span>
                <span class="count">${count} <span class="pct-small">${pct}%</span></span>
            </div>
            `;
        }
    });

    if (!hasData) {
        listHtml = '<div style="text-align:center;padding:30px;color:var(--text-secondary);font-size:13px;">No orders found</div>';
    }

    document.getElementById('statsListContainer').innerHTML = listHtml;
    
    document.querySelectorAll('.stats-list-item').forEach(item => {
        item.addEventListener('click', function() {
            const group = this.dataset.group || '';
            filterByGroup(group);
        });
    });
    
    const listContainer = document.getElementById('statsListContainer');
    const oldFooter = listContainer.parentElement.querySelector('.stats-list-footer');
    if (oldFooter) oldFooter.remove();
    
    const footer = document.createElement('div');
    footer.className = 'stats-list-footer';
    footer.innerHTML = `
        <span class="total-label">Total orders</span>
        <span class="total-number">${total}</span>
    `;
    listContainer.parentElement.appendChild(footer);
}

// ============================================================
// 11. КРУГОВАЯ ДИАГРАММА
// ============================================================

function updateStatusChart() {
    if (!chartJsAvailable) {
        document.getElementById('statusChart').style.display = 'none';
        document.getElementById('statusFallback').style.display = 'flex';
        return;
    }
    
    const dateFiltered = applyDateFilter(allOrders);
    const allStats = {};
    dateFiltered.forEach(order => {
        const group = getStatusGroup(order.status_code, order.status);
        if (!allStats[group]) allStats[group] = 0;
        allStats[group]++;
    });
    
    const orderList = STATUS_ORDER;
    const chartData = [];
    const chartColors = [];
    const chartLabels = [];
    
    orderList.forEach(group => {
        const count = allStats[group] || 0;
        if (count > 0) {
            chartData.push(count);
            chartColors.push(STATUS_COLORS[group] || '#8e8e93');
            chartLabels.push(STATUS_MAP[group] || group);
        }
    });
    
    if (chartData.length === 0) {
        chartData.push(1);
        chartColors.push('#e5e5ea');
        chartLabels.push('No data');
    }
    
    const ctx = document.getElementById('statusChart').getContext('2d');
    if (statusChart) statusChart.destroy();
    
    const totalAll = dateFiltered.length || 0;
    document.getElementById('chartTotal').textContent = totalAll;
    
    const isDark = document.body.classList.contains('dark');
    
    statusChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: chartLabels,
            datasets: [{
                data: chartData,
                backgroundColor: chartColors,
                borderWidth: 2,
                borderColor: isDark ? '#131924' : '#ffffff',
                hoverOffset: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const totalAllOrders = dateFiltered.length || 1;
                            const percentage = Math.round((context.parsed / totalAllOrders) * 100);
                            return context.label + ': ' + context.parsed + ' (' + percentage + '%)';
                        }
                    }
                }
            },
            animation: { animateRotate: true, duration: 800 }
        }
    });
    
    let legendHtml = '';
    const totalAllOrders = dateFiltered.length || 1;
    chartLabels.forEach((label, index) => {
        const pct = Math.round((chartData[index] / totalAllOrders) * 100);
        legendHtml += `
            <span class="chart-legend-item">
                <span class="dot" style="background:${chartColors[index]};"></span>
                ${label}
                <span class="pct">${pct}%</span>
            </span>
        `;
    });
    document.getElementById('chartLegend').innerHTML = legendHtml;
}

// ============================================================
// 12. AVERAGE REPAIRS BY DAY
// ============================================================

function updateDailyChart() {
    if (!chartJsAvailable) {
        document.getElementById('dailyChart').style.display = 'none';
        document.getElementById('dailyFallback').style.display = 'flex';
        return;
    }
    
    const dateFiltered = applyDateFilter(allOrders);
    const dailyData = {};
    
    dateFiltered.forEach(order => {
        const date = getOrderWorkDate(order);
        if (date) {
            const day = date.slice(0, 10);
            
            if (!dailyData[day]) {
                dailyData[day] = { total: 0, ready: 0, no_repair: 0 };
            }
            dailyData[day].total++;
            
            const group = getStatusGroup(order.status_code, order.status);
            if (group === 'ready') {
                dailyData[day].ready++;
            } else if (group === 'cancelled') {
                dailyData[day].no_repair++;
            }
        }
    });
    
    const sortedDays = Object.keys(dailyData)
        .filter(day => !isDayOff(day))
        .sort();
    
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    // AVERAGE за месяц
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    let workingDaysMonth = 0;
    const tempDate = new Date(monthStart);
    while (tempDate <= todayEnd) {
        const dayStr = `${tempDate.getFullYear()}-${String(tempDate.getMonth() + 1).padStart(2, '0')}-${String(tempDate.getDate()).padStart(2, '0')}`;
        if (!isDayOff(dayStr)) {
            workingDaysMonth++;
        }
        tempDate.setDate(tempDate.getDate() + 1);
    }
    
    let totalOrdersMonth = 0;
    dateFiltered.forEach(order => {
        const date = getOrderWorkDate(order);
        if (date) {
            const orderDate = new Date(date);
            if (orderDate >= monthStart && orderDate <= now) {
                totalOrdersMonth++;
            }
        }
    });
    
    if (workingDaysMonth === 0) workingDaysMonth = 1;
    const avgMonth = totalOrdersMonth / workingDaysMonth;
    
    // AVERAGE за неделю
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 6);
    weekAgo.setHours(0, 0, 0, 0);
    
    let workingDaysWeek = 0;
    const weekDate = new Date(weekAgo);
    while (weekDate <= todayEnd) {
        const dayStr = `${weekDate.getFullYear()}-${String(weekDate.getMonth() + 1).padStart(2, '0')}-${String(weekDate.getDate()).padStart(2, '0')}`;
        if (!isDayOff(dayStr)) {
            workingDaysWeek++;
        }
        weekDate.setDate(weekDate.getDate() + 1);
    }
    
    let totalOrdersWeek = 0;
    dateFiltered.forEach(order => {
        const date = getOrderWorkDate(order);
        if (date) {
            const orderDate = new Date(date);
            if (orderDate >= weekAgo && orderDate <= now) {
                totalOrdersWeek++;
            }
        }
    });
    
    if (workingDaysWeek === 0) workingDaysWeek = 1;
    const avgWeek = totalOrdersWeek / workingDaysWeek;
    
    // TODAY
    let totalToday = 0;
    dateFiltered.forEach(order => {
        const date = getOrderWorkDate(order);
        if (date && date.slice(0, 10) === todayStr) {
            totalToday++;
        }
    });
    
    const avgMonthEl = document.getElementById('avg-month');
    const avgWeekEl = document.getElementById('avg-week');
    const avgTodayEl = document.getElementById('avg-today');
    
    if (avgMonthEl) avgMonthEl.textContent = avgMonth.toFixed(1);
    if (avgWeekEl) avgWeekEl.textContent = avgWeek.toFixed(1);
    if (avgTodayEl) avgTodayEl.textContent = totalToday;
    
    console.log('📊 Статистика для', currentUser || 'всех:', {
        'Моих заказов в месяце': totalOrdersMonth,
        'Рабочих дней в месяце': workingDaysMonth,
        'Avg / месяц': avgMonth.toFixed(1),
        'Avg / неделя': avgWeek.toFixed(1),
        'Сегодня': totalToday
    });
    
    if (sortedDays.length === 0) {
        const ctx = document.getElementById('dailyChart').getContext('2d');
        if (dailyChart) dailyChart.destroy();
        
        const isDark = document.body.classList.contains('dark');
        const textColor = isDark ? '#e5e7eb' : '#1a1a2e';
        
        dailyChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ['No data'],
                datasets: [{
                    label: 'Orders',
                    data: [0],
                    borderColor: '#8e8e93',
                    backgroundColor: 'transparent',
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: true, position: 'bottom' } },
                scales: {
                    x: { grid: { display: false }, ticks: { color: textColor } },
                    y: { grid: { display: false }, beginAtZero: true, ticks: { stepSize: 1, color: textColor } }
                }
            }
        });
        return;
    }
    
    const labels = sortedDays.map(d => {
        const date = new Date(d + 'T00:00:00');
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    });
    
    const totalData = sortedDays.map(d => dailyData[d].total);
    const readyData = sortedDays.map(d => dailyData[d].ready);
    const noRepairData = sortedDays.map(d => dailyData[d].no_repair);
    
    const ctx = document.getElementById('dailyChart').getContext('2d');
    if (dailyChart) dailyChart.destroy();
    
    const isDark = document.body.classList.contains('dark');
    const textColor = isDark ? '#e5e7eb' : '#1a1a2e';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    
    const maxValue = Math.max(...totalData, 1);
    const stepSize = maxValue <= 10 ? 1 : maxValue <= 20 ? 2 : maxValue <= 50 ? 5 : 10;
    
    let chartType = 'line';
    let datasets = [];
    
    if (dailyChartType === 'bar') {
        chartType = 'bar';
        datasets = [
            {
                label: 'Total',
                data: totalData,
                backgroundColor: 'rgba(0, 122, 255, 0.7)',
                borderColor: '#007aff',
                borderWidth: 1,
                borderRadius: 4,
                order: 1
            },
            {
                label: 'Ready for pickup',
                data: readyData,
                backgroundColor: 'rgba(52, 199, 89, 0.7)',
                borderColor: '#34c759',
                borderWidth: 1,
                borderRadius: 4,
                order: 2
            },
            {
                label: 'No Repair',
                data: noRepairData,
                backgroundColor: 'rgba(255, 59, 48, 0.7)',
                borderColor: '#ff3b30',
                borderWidth: 1,
                borderRadius: 4,
                order: 3
            }
        ];
    } else if (dailyChartType === 'mixed') {
        chartType = 'line';
        datasets = [
            {
                label: 'Total',
                data: totalData,
                borderColor: '#007aff',
                backgroundColor: 'rgba(0, 122, 255, 0.1)',
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#007aff',
                pointBorderWidth: 3,
                pointRadius: 6,
                pointHoverRadius: 9,
                tension: 0.35,
                fill: true,
                borderWidth: 3,
                order: 1
            },
            {
                label: 'Ready for pickup',
                data: readyData,
                borderColor: '#34c759',
                backgroundColor: 'transparent',
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#34c759',
                pointBorderWidth: 3,
                pointRadius: 5,
                pointHoverRadius: 8,
                tension: 0.35,
                fill: false,
                borderWidth: 2.5,
                borderDash: [8, 5],
                order: 2
            },
            {
                label: 'No Repair',
                data: noRepairData,
                borderColor: '#ff3b30',
                backgroundColor: 'transparent',
                pointBackgroundColor: '#ffffff',
                pointBorderColor: '#ff3b30',
                pointBorderWidth: 3,
                pointRadius: 5,
                pointHoverRadius: 8,
                tension: 0.35,
                fill: false,
                borderWidth: 2.5,
                borderDash: [5, 5],
                order: 3
            }
        ];
    } else {
        chartType = 'line';
        datasets = [
            {
                label: 'Total',
                data: totalData,
                borderColor: '#007aff',
                backgroundColor: 'rgba(0, 122, 255, 0.1)',
                pointBackgroundColor: '#007aff',
                pointBorderColor: '#007aff',
                pointRadius: 3,
                pointHoverRadius: 6,
                tension: 0.3,
                fill: true,
                borderWidth: 2.5,
                order: 1
            },
            {
                label: 'Ready for pickup',
                data: readyData,
                borderColor: '#34c759',
                backgroundColor: 'transparent',
                pointBackgroundColor: '#34c759',
                pointBorderColor: '#34c759',
                pointRadius: 3,
                pointHoverRadius: 6,
                tension: 0.3,
                fill: false,
                borderWidth: 2,
                borderDash: [6, 4],
                order: 2
            },
            {
                label: 'No Repair',
                data: noRepairData,
                borderColor: '#ff3b30',
                backgroundColor: 'transparent',
                pointBackgroundColor: '#ff3b30',
                pointBorderColor: '#ff3b30',
                pointRadius: 3,
                pointHoverRadius: 6,
                tension: 0.3,
                fill: false,
                borderWidth: 2,
                borderDash: [4, 4],
                order: 3
            }
        ];
    }
    
    dailyChart = new Chart(ctx, {
        type: chartType,
        data: {
            labels: labels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        color: textColor,
                        font: { size: 10 },
                        padding: 8,
                        boxWidth: 14,
                        usePointStyle: true,
                        pointStyle: 'circle'
                    }
                },
                tooltip: {
                    callbacks: {
                        title: function(items) {
                            const index = items[0].dataIndex;
                            const day = sortedDays[index];
                            if (day) {
                                const date = new Date(day + 'T00:00:00');
                                return date.toLocaleDateString('en-US', {
                                    day: '2-digit',
                                    month: '2-digit',
                                    year: 'numeric',
                                    weekday: 'long'
                                });
                            }
                            return '';
                        },
                        footer: function(items) {
                            const index = items[0].dataIndex;
                            const day = sortedDays[index];
                            if (day && dailyData[day]) {
                                const d = dailyData[day];
                                return 'Total: ' + d.total + ' | Ready: ' + d.ready + ' | No Repair: ' + d.no_repair;
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: textColor, font: { size: 9 }, maxTicksLimit: 20 }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: {
                        color: textColor,
                        font: { size: 9 },
                        stepSize: stepSize,
                        callback: function(value) { return Math.round(value); }
                    },
                    beginAtZero: true
                }
            },
            elements: { line: { tension: 0.3 } }
        }
    });
}

function setDailyChartType(type) {
    dailyChartType = type;
    
    document.querySelectorAll('[data-chart-type]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.chartType === type);
    });
    
    updateDailyChart();
}

// ============================================================
// 13. ТАБЛИЦА
// ============================================================

function renderTable() {
    const tbody = document.getElementById('orders-table');
    
    if (!visibleOrders || visibleOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="text-align:center; padding:30px; color:var(--text-secondary);">
                    <div class="empty-state">
                        <div class="icon">📭</div>
                        <div>No orders found</div>
                        <div style="font-size:12px; margin-top:4px;">Try changing filters</div>
                    </div>
                </td>
            </tr>
        `;
        updatePagination();
        return;
    }

    const start = (currentPage - 1) * currentLimit;
    const end = Math.min(start + currentLimit, visibleOrders.length);
    const pageOrders = visibleOrders.slice(start, end);

    const statusLabels = {
        'ready': '✅ Ready for pickup',
        'cancelled': '❌ No repair',
        'handling': '🔧 In handling',
        'parts': '⏳ Awaiting parts',
        'customer': '👤 Customer',
        'repair': '🔬 Repair centre',
        'unknown': '❓ Unknown'
    };

    tbody.innerHTML = pageOrders.map(order => {
        const group = getStatusGroup(order.status_code, order.status);
        const label = statusLabels[group] || order.status || 'Unknown';
        const color = STATUS_COLORS[group] || '#8e8e93';
        const workDate = getOrderWorkDate(order);
        
        return `
            <tr>
                <td>
                    <a href="${order.raw_data?.url || '#'}" target="_blank" class="order-link">
                        #${order.order_number}
                    </a>
                </td>
                <td>${order.device_model || '—'}</td>
                <td>
                    <span class="status-badge" style="background:${color}20; color:${color}; padding:2px 10px; border-radius:12px; font-size:11px; font-weight:500; display:inline-block;">
                        ${label}
                    </span>
                </td>
                <td style="max-width:200px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${order.resolution || ''}">
                    ${order.resolution || '—'}
                </td>
                <td style="font-size:12px;">${formatDateTime(workDate)}</td>
            </tr>
        `;
    }).join('');

    updatePagination();
}

function updatePagination() {
    const total = visibleOrders ? visibleOrders.length : 0;
    const totalPages = Math.ceil(total / currentLimit) || 1;
    
    document.getElementById('orders-count').textContent = `Total: ${total}`;
    document.getElementById('page-info').textContent = `Page ${currentPage} of ${totalPages}`;
    document.getElementById('prev-page').disabled = currentPage <= 1;
    document.getElementById('next-page').disabled = currentPage >= totalPages;
}

function prevPage() {
    if (currentPage > 1) {
        currentPage--;
        renderTable();
    }
}

function nextPage() {
    const total = visibleOrders ? visibleOrders.length : 0;
    const totalPages = Math.ceil(total / currentLimit) || 1;
    if (currentPage < totalPages) {
        currentPage++;
        renderTable();
    }
}

function changeLimit() {
    currentLimit = parseInt(document.getElementById('page-size').value);
    currentPage = 1;
    renderTable();
}

// ============================================================
// 14. ФИЛЬТР ПО ГРУППЕ
// ============================================================

function filterByGroup(group) {
    const statusFilter = document.getElementById('status-filter');
    
    if (group === '') {
        statusFilter.value = '';
        currentGroup = '';
        currentDateFrom = '';
        currentDateTo = '';
        currentDays = '';
        document.getElementById('date-from').value = '';
        document.getElementById('date-to').value = '';
        document.querySelectorAll('[data-preset]').forEach(b => b.classList.remove('active'));
    } else if (statusFilter.value === group || currentGroup === group) {
        statusFilter.value = '';
        currentGroup = '';
    } else {
        statusFilter.value = group;
        currentGroup = group;
    }
    
    filterOrders();
}

// ============================================================
// 15. ЗАГРУЗКА
// ============================================================

async function loadOrders() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_ALL_ORDERS' }, (response) => {
            if (response && response.success) {
                rawAllOrders = response.data || [];
                
                const userFiltered = applyUserFilter(rawAllOrders);
                
                allOrders = userFiltered;
                allOrders.sort((a, b) => {
                    const dateA = getOrderWorkDate(a);
                    const dateB = getOrderWorkDate(b);
                    return new Date(dateB) - new Date(dateA);
                });
                
                filteredOrders = [...allOrders];
                visibleOrders = [...allOrders];
                
                console.log(`👤 Загружено заказов: всего ${rawAllOrders.length}, моих ${allOrders.length}`);
                
                updateStatsCards();
                updateStatusList();
                updateStatusChart();
                updateDailyChart();
                renderTable();
                
                document.getElementById('orders-count').textContent = `Total: ${allOrders.length}`;
            }
            resolve();
        });
    });
}

async function refreshStats() {
    await loadOrders();
}

function resetFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('status-filter').value = '';
    document.getElementById('date-from').value = '';
    document.getElementById('date-to').value = '';
    document.querySelectorAll('[data-preset]').forEach(b => b.classList.remove('active'));
    
    currentDateFrom = '';
    currentDateTo = '';
    currentDays = '';
    currentGroup = '';
    currentPage = 1;
    
    filterOrders();
}

// ============================================================
// 16. ТЕМНАЯ ТЕМА
// ============================================================

async function loadDarkMode() {
    try {
        const result = await chrome.storage.local.get(['darkMode']);
        const isDark = result.darkMode === true;
        document.body.classList.toggle('dark', isDark);
    } catch (error) {
        console.warn('Could not load dark mode:', error);
    }
}

function updateChartsTheme(isDark) {
    if (!chartJsAvailable) return;
    
    const textColor = isDark ? '#e5e7eb' : '#1a1a2e';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    
    if (dailyChart) {
        dailyChart.options.scales.y.ticks.color = textColor;
        dailyChart.options.scales.x.ticks.color = textColor;
        dailyChart.options.scales.y.grid.color = gridColor;
        dailyChart.options.plugins.legend.labels.color = textColor;
        dailyChart.update();
    }
    
    if (statusChart) {
        statusChart.options.plugins.legend.labels.color = textColor;
        statusChart.update();
    }
}

// ============================================================
// 17. ИНИЦИАЛИЗАЦИЯ
// ============================================================

document.addEventListener('DOMContentLoaded', async () => {
    await loadCurrentUserFromStorage();
    await loadDarkMode();
    await initCalendar();
    await refreshStats();
    
    const today = new Date().toISOString().slice(0,10);
    document.getElementById('date-from').value = today;
    document.getElementById('date-to').value = today;
    
    document.getElementById('refresh-btn').addEventListener('click', refreshStats);
    document.getElementById('reset-filters-btn').addEventListener('click', resetFilters);
    document.getElementById('status-filter').addEventListener('change', filterOrders);
    document.getElementById('search-input').addEventListener('input', filterOrders);
    document.getElementById('date-from').addEventListener('change', filterOrders);
    document.getElementById('date-to').addEventListener('change', filterOrders);
    
    document.getElementById('prev-page').addEventListener('click', prevPage);
    document.getElementById('next-page').addEventListener('click', nextPage);
    document.getElementById('page-size').addEventListener('change', changeLimit);
    
    document.querySelectorAll('[data-chart-type]').forEach(btn => {
        btn.addEventListener('click', function() {
            setDailyChartType(this.dataset.chartType);
        });
    });
    
    document.querySelectorAll('[data-preset]').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('[data-preset]').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            
            const dates = getPresetDates(this.dataset.preset);
            document.getElementById('date-from').value = dates.from;
            document.getElementById('date-to').value = dates.to;
            
            currentDateFrom = dates.from;
            currentDateTo = dates.to;
            currentDays = '';
            
            filterOrders();
        });
    });
    
    document.getElementById('apply-date-btn').addEventListener('click', function() {
        const from = document.getElementById('date-from').value;
        const to = document.getElementById('date-to').value;
        currentDateFrom = from;
        currentDateTo = to;
        currentDays = '';
        document.querySelectorAll('[data-preset]').forEach(b => b.classList.remove('active'));
        filterOrders();
    });
    
    document.getElementById('clear-date-btn').addEventListener('click', function() {
        document.getElementById('date-from').value = '';
        document.getElementById('date-to').value = '';
        document.querySelectorAll('[data-preset]').forEach(b => b.classList.remove('active'));
        currentDateFrom = '';
        currentDateTo = '';
        currentDays = '';
        filterOrders();
    });
    
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.fixmod_current_user) {
            const newUser = changes.fixmod_current_user.newValue;
            if (newUser && newUser !== currentUser) {
                console.log('👤 Пользователь изменился:', currentUser, '→', newUser);
                currentUser = newUser;
                filterByUser = true;
                refreshStats();
            }
        }
    });
    
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.type === 'UPDATE_DARK_MODE') {
            document.body.classList.toggle('dark', request.enabled);
            updateChartsTheme(request.enabled);
            sendResponse({ success: true });
        }
        return true;
    });
});

// ============================================================
// 18. АВТООБНОВЛЕНИЕ
// ============================================================

setInterval(refreshStats, 60000);