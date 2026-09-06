// stats.js - FixMod Statistics Page

let allOrders = [];
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
// 2. ПОЛУЧЕНИЕ ДАТЫ ДЛЯ ФИЛЬТРАЦИИ
// ============================================================
function getOrderDateForFilter(order) {
    if (!order) return null;
    
    if (order.resolutions && order.resolutions.length > 0) {
        const resolution = order.resolutions[0];
        if (resolution && resolution.date) {
            return resolution.date;
        }
    }
    
    if (order.last_status_change) {
        return order.last_status_change;
    }
    
    if (order.updated_at) {
        return order.updated_at;
    }
    
    if (order.created_at) {
        return order.created_at;
    }
    
    return null;
}

// ============================================================
// 3. ФОРМАТИРОВАНИЕ ДАТЫ
// ============================================================
function formatDate(dateString) {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
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
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateString;
    }
}

// ============================================================
// 4. ПРЕСЕТЫ ДАТ (С ЛОКАЛЬНЫМ ВРЕМЕНЕМ)
// ============================================================
function getPresetDates(preset) {
    const today = new Date();
    
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;
    
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yYear = yesterday.getFullYear();
    const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0');
    const yDay = String(yesterday.getDate()).padStart(2, '0');
    const yesterdayStr = `${yYear}-${yMonth}-${yDay}`;
    
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);
    const sYear = sevenDaysAgo.getFullYear();
    const sMonth = String(sevenDaysAgo.getMonth() + 1).padStart(2, '0');
    const sDay = String(sevenDaysAgo.getDate()).padStart(2, '0');
    const sevenDaysStr = `${sYear}-${sMonth}-${sDay}`;
    
    const thirtyDaysAgo = new Date(today);
    thirtyDaysAgo.setDate(today.getDate() - 29);
    const tYear = thirtyDaysAgo.getFullYear();
    const tMonth = String(thirtyDaysAgo.getMonth() + 1).padStart(2, '0');
    const tDay = String(thirtyDaysAgo.getDate()).padStart(2, '0');
    const thirtyDaysStr = `${tYear}-${tMonth}-${tDay}`;
    
    switch(preset) {
        case 'today':
            return {
                from: todayStr,
                to: todayStr
            };
        case 'yesterday':
            return {
                from: yesterdayStr,
                to: yesterdayStr
            };
        case '7d':
            return {
                from: sevenDaysStr,
                to: todayStr
            };
        case '30d':
            return {
                from: thirtyDaysStr,
                to: todayStr
            };
        case 'all':
        default:
            return {
                from: '2000-01-01',
                to: todayStr
            };
    }
}

// ============================================================
// 5. ФИЛЬТРАЦИЯ ПО ДАТЕ
// ============================================================
function applyDateFilter(orders) {
    if (!orders) return [];
    
    if (!currentDateFrom && !currentDateTo && !currentDays) {
        return orders;
    }

    let filtered = [...orders];

    if (currentDays) {
        const now = new Date();
        const threshold = new Date(now);
        threshold.setDate(threshold.getDate() - parseInt(currentDays));
        threshold.setHours(0, 0, 0, 0);
        
        filtered = filtered.filter(order => {
            const orderDate = getOrderDateForFilter(order);
            if (!orderDate) return false;
            const changeDate = new Date(orderDate);
            return changeDate >= threshold;
        });
    }

    if (currentDateFrom) {
        const from = new Date(currentDateFrom);
        from.setHours(0, 0, 0, 0);
        
        filtered = filtered.filter(order => {
            const orderDate = getOrderDateForFilter(order);
            if (!orderDate) return false;
            const changeDate = new Date(orderDate);
            return changeDate >= from;
        });
    }

    if (currentDateTo) {
        const to = new Date(currentDateTo);
        to.setHours(23, 59, 59, 999);
        
        filtered = filtered.filter(order => {
            const orderDate = getOrderDateForFilter(order);
            if (!orderDate) return false;
            const changeDate = new Date(orderDate);
            return changeDate <= to;
        });
    }

    return filtered;
}

// ============================================================
// 6. ОСНОВНАЯ ФУНКЦИЯ ФИЛЬТРАЦИИ
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
// 7. КАРТОЧКИ СТАТИСТИКИ (All Orders - всегда все заказы, остальные - по дата-фильтру)
// ============================================================
function updateStatsCards() {
    // 1. All Orders - всегда показывает ВСЕ заказы (allOrders)
    const allStatsSource = allOrders;
    const allStatsSourceLength = allStatsSource.length;
    
    // 2. Остальные карточки - по дата-фильтру
    const dateFiltered = applyDateFilter(allOrders);
    const statsSource = dateFiltered;
    const groupedStats = {};

    statsSource.forEach(order => {
        const group = getStatusGroup(order.status_code, order.status);
        if (!groupedStats[group]) {
            groupedStats[group] = {
                code: group,
                label: STATUS_MAP[group] || group,
                count: 0
            };
        }
        groupedStats[group].count++;
    });

    let html = '';

    // All Orders - всегда показывает общее количество
    const isAllActive = currentGroup === '';
    html += `
        <div class="stat-card main-card ${isAllActive ? 'active' : ''}" data-group="" style="cursor:pointer;">
            <div class="number">${allStatsSourceLength || 0}</div>
            <div class="label">All Orders</div>
            <div class="sub-label">Total</div>
        </div>
    `;

    // Остальные карточки - по дата-фильтру
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
// 8. СТАТУС ЛИСТ (ПО ДАТА-ФИЛЬТРУ)
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
    
    const footer = document.querySelector('.stats-list-footer') || document.createElement('div');
    footer.className = 'stats-list-footer';
    footer.innerHTML = `
        <span class="total-label">Total orders</span>
        <span class="total-number">${total}</span>
    `;
    
    const listContainer = document.getElementById('statsListContainer');
    const oldFooter = listContainer.parentElement.querySelector('.stats-list-footer');
    if (oldFooter) oldFooter.remove();
    listContainer.parentElement.appendChild(footer);
}

// ============================================================
// 9. КРУГОВАЯ ДИАГРАММА (ПО ДАТА-ФИЛЬТРУ)
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
    
    if (statusChart) {
        statusChart.destroy();
    }
    
    const totalAll = dateFiltered.length || 0;
    document.getElementById('chartTotal').textContent = totalAll;
    
    const isDark = document.body.classList.contains('dark');
    const textColor = isDark ? '#e5e7eb' : '#1a1a2e';
    
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
            animation: {
                animateRotate: true,
                duration: 800
            }
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
// 10. ГРАФИК AVERAGE REPAIRS BY DAY (ПО ДАТА-ФИЛЬТРУ)
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
        const date = getOrderDateForFilter(order);
        if (date) {
            const day = date.slice(0,10);
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
    
    const sortedDays = Object.keys(dailyData).sort();
    
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
                    pointBackgroundColor: '#8e8e93',
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
    
    const totalSum = totalData.reduce((a, b) => a + b, 0);
    const avgValue = totalData.length > 0 ? (totalSum / totalData.length) : 0;
    const avgDisplay = avgValue.toFixed(1);
    
    const avgEl = document.getElementById('dailyAvg');
    if (avgEl) avgEl.textContent = avgDisplay;
    
    const ctx = document.getElementById('dailyChart').getContext('2d');
    
    if (dailyChart) {
        dailyChart.destroy();
    }
    
    const isDark = document.body.classList.contains('dark');
    const textColor = isDark ? '#e5e7eb' : '#1a1a2e';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
    
    const maxValue = Math.max(...totalData, 1);
    const stepSize = maxValue <= 10 ? 1 : maxValue <= 20 ? 2 : maxValue <= 50 ? 5 : 10;
    
    dailyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
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
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
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
                                    year: 'numeric'
                                });
                            }
                            return '';
                        },
                        footer: function(items) {
                            const index = items[0].dataIndex;
                            const day = sortedDays[index];
                            if (day && dailyData[day]) {
                                const d = dailyData[day];
                                return 'Total: ' + d.total + ' orders | Ready: ' + d.ready + ' | No Repair: ' + d.no_repair;
                            }
                            return '';
                        }
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: {
                        color: textColor,
                        font: { size: 9 },
                        maxTicksLimit: 20
                    }
                },
                y: {
                    grid: { color: gridColor },
                    ticks: {
                        color: textColor,
                        font: { size: 9 },
                        stepSize: stepSize,
                        callback: function(value) {
                            return Math.round(value);
                        }
                    },
                    beginAtZero: true
                }
            },
            elements: {
                line: {
                    tension: 0.3
                }
            }
        }
    });
}

// ============================================================
// 11. ТАБЛИЦА С ПАГИНАЦИЕЙ
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
                <td style="font-size:12px;">${formatDateTime(order.created_at)}</td>
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
// 12. ФИЛЬТР ПО ГРУППЕ (ОБНОВЛЕННЫЙ)
// ============================================================
function filterByGroup(group) {
    const statusFilter = document.getElementById('status-filter');
    
    if (group === '') {
        // All Orders - сбрасываем ВСЕ фильтры: и статус, и дату
        statusFilter.value = '';
        currentGroup = '';
        
        // Сбрасываем дата-фильтр
        currentDateFrom = '';
        currentDateTo = '';
        currentDays = '';
        document.getElementById('date-from').value = '';
        document.getElementById('date-to').value = '';
        document.querySelectorAll('[data-preset]').forEach(b => b.classList.remove('active'));
        
    } else if (statusFilter.value === group || currentGroup === group) {
        // Если уже выбран этот статус — снимаем фильтр (но дату НЕ сбрасываем)
        statusFilter.value = '';
        currentGroup = '';
    } else {
        // Выбираем группу (дату НЕ сбрасываем)
        statusFilter.value = group;
        currentGroup = group;
    }
    
    filterOrders();
}

// ============================================================
// 13. ЗАГРУЗКА ДАННЫХ
// ============================================================
async function loadOrders() {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({ type: 'GET_ALL_ORDERS' }, (response) => {
            if (response && response.success) {
                allOrders = response.data || [];
                allOrders.sort((a, b) => {
                    return new Date(b.created_at) - new Date(a.created_at);
                });
                filteredOrders = [...allOrders];
                visibleOrders = [...allOrders];
                
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

// ============================================================
// 14. ОБНОВЛЕНИЕ
// ============================================================
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
// 15. ТЕМНАЯ ТЕМА
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
        dailyChart.options.scales.x.grid.color = gridColor;
        dailyChart.options.plugins.legend.labels.color = textColor;
        dailyChart.update();
    }
    
    if (statusChart) {
        statusChart.options.plugins.legend.labels.color = textColor;
        statusChart.update();
    }
}

// ============================================================
// 16. ИНИЦИАЛИЗАЦИЯ
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadDarkMode();
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
// 17. АВТООБНОВЛЕНИЕ
// ============================================================
setInterval(refreshStats, 60000);