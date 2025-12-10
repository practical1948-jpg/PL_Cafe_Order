// Firebase 설정 import
import { db, collection, onSnapshot, query, orderBy, doc, updateDoc, deleteDoc } from './firebase-config.js';

// DOM 요소
const ordersListContainer = document.getElementById('ordersList');
const pendingCountElement = document.getElementById('pendingCount');
const preparingCountElement = document.getElementById('preparingCount');
const completedCountElement = document.getElementById('completedCount');
const filterButtons = document.querySelectorAll('.filter-btn');

let currentFilter = 'all';
let allOrders = []; // 모든 주문 데이터 저장
let previousOrderCount = 0; // 이전 주문 개수
let audioContext = null; // 소리 재생용

// 페이지 로드 시
initializeNotification();
registerServiceWorker();
subscribeToOrders();

// 필터 버튼 이벤트
filterButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        filterButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderOrders();
    });
});

// Service Worker 등록
async function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        try {
            const registration = await navigator.serviceWorker.register('/service-worker.js');
            console.log('Service Worker 등록 성공:', registration);
        } catch (error) {
            console.log('Service Worker 등록 실패:', error);
        }
    }
}

// 알림 초기화 (자동 활성화)
async function initializeNotification() {
    // 알림 권한 자동 요청
    if ('Notification' in window && Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            console.log('✅ 알림이 활성화되었습니다!');
            showWelcomeNotification();
        }
    } else if (Notification.permission === 'granted') {
        console.log('✅ 알림이 이미 활성화되어 있습니다.');
    }
}

// 환영 알림
function showWelcomeNotification() {
    new Notification('🎉 PL Cafe 직원 화면', {
        body: '알림이 활성화되었습니다!\n새 주문이 들어오면 알려드릴게요.',
        icon: '☕',
        tag: 'welcome'
    });
}

// Firebase 실시간 주문 구독
function subscribeToOrders() {
    const ordersCollection = collection(db, 'orders');
    const ordersQuery = query(ordersCollection, orderBy('timestamp', 'desc'));
    
    // 실시간 업데이트 구독
    onSnapshot(ordersQuery, (snapshot) => {
        const newOrders = [];
        snapshot.forEach((doc) => {
            newOrders.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        // 새 주문 감지 (pending 상태)
        if (previousOrderCount > 0) {
            const newPendingOrders = newOrders.filter(order => 
                order.status === 'pending' && 
                !allOrders.find(o => o.id === order.id)
            );
            
            if (newPendingOrders.length > 0) {
                newPendingOrders.forEach(order => {
                    showNotification(order);
                    playNotificationSound();
                });
            }
        }
        
        previousOrderCount = newOrders.filter(o => o.status === 'pending').length;
        allOrders = newOrders;
        renderOrders();
    }, (error) => {
        console.error('주문 목록 불러오기 실패:', error);
    });
}

// 브라우저 알림 표시
function showNotification(order) {
    if ('Notification' in window && Notification.permission === 'granted') {
        const itemsList = order.items.map(item => `${item.icon} ${item.name} x${item.quantity}`).join(', ');
        
        const notification = new Notification('🔔 새 주문이 들어왔습니다!', {
            body: `${order.userName}님 (${order.userType})\n${itemsList}`,
            icon: '☕',
            badge: '☕',
            tag: order.id,
            requireInteraction: true // 클릭할 때까지 유지
        });
        
        notification.onclick = function() {
            window.focus();
            notification.close();
        };
    }
}

// 알림 소리 재생
function playNotificationSound() {
    // Web Audio API로 소리 생성
    try {
        if (!audioContext) {
            audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        // 띵동~ 소리 생성
        const oscillator1 = audioContext.createOscillator();
        const oscillator2 = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator1.connect(gainNode);
        oscillator2.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        // 첫 번째 음 (높은 음)
        oscillator1.frequency.value = 800;
        oscillator1.type = 'sine';
        oscillator1.start(audioContext.currentTime);
        oscillator1.stop(audioContext.currentTime + 0.15);
        
        // 두 번째 음 (낮은 음)
        oscillator2.frequency.value = 600;
        oscillator2.type = 'sine';
        oscillator2.start(audioContext.currentTime + 0.15);
        oscillator2.stop(audioContext.currentTime + 0.4);
        
        // 볼륨 조절
        gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.4);
        
    } catch (error) {
        console.error('소리 재생 실패:', error);
    }
}

// 알림 토글
function toggleNotification() {
    notificationEnabled = !notificationEnabled;
    localStorage.setItem('notificationEnabled', notificationEnabled);
    
    if (notificationEnabled && Notification.permission !== 'granted') {
        Notification.requestPermission().then(permission => {
            if (permission === 'granted') {
                alert('알림이 활성화되었습니다! 🔔\n새 주문이 들어오면 알림을 받으실 수 있어요!');
            } else {
                notificationEnabled = false;
                localStorage.setItem('notificationEnabled', false);
                alert('알림 권한이 거부되었습니다.');
            }
            updateNotificationButton();
        });
    } else {
        updateNotificationButton();
        alert(notificationEnabled ? '알림이 활성화되었습니다! 🔔' : '알림이 비활성화되었습니다. 🔕');
    }
}

// 알림 버튼 상태 업데이트
function updateNotificationButton() {
    const btn = document.getElementById('btnNotification');
    if (btn) {
        btn.textContent = notificationEnabled ? '🔔 알림 켜짐' : '🔕 알림 꺼짐';
        btn.classList.toggle('active', notificationEnabled);
    }
}

// 오늘 날짜 체크
function isToday(dateString) {
    const orderDate = new Date(dateString);
    const today = new Date();
    return orderDate.getDate() === today.getDate() &&
           orderDate.getMonth() === today.getMonth() &&
           orderDate.getFullYear() === today.getFullYear();
}

// 주문 목록 렌더링 (오늘 것만)
function renderOrders() {
    // 오늘 주문만 필터링
    const todayOrders = allOrders.filter(order => isToday(order.timestamp));
    
    // 통계 업데이트
    updateStats(todayOrders);
    
    // 상태별 필터링
    let filteredOrders = todayOrders;
    if (currentFilter !== 'all') {
        filteredOrders = todayOrders.filter(order => order.status === currentFilter);
    }
    
    // 화면 렌더링
    if (filteredOrders.length === 0) {
        ordersListContainer.innerHTML = '<p class="empty-orders">오늘 주문이 없습니다</p>';
        return;
    }
    
    let html = '';
    filteredOrders.forEach(order => {
        html += createOrderCard(order);
    });
    
    ordersListContainer.innerHTML = html;
}

// 주문 카드 생성
function createOrderCard(order) {
    const statusText = {
        'pending': '대기중',
        'preparing': '준비중',
        'completed': '완료'
    };
    
    const time = new Date(order.timestamp);
    const timeString = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}`;
    
    // 주문 번호 (ID의 앞 8자리)
    const orderNumber = order.id.substring(0, 8).toUpperCase();
    
    let itemsHtml = '';
    order.items.forEach(item => {
        itemsHtml += `
            <div class="order-item">
                <span class="item-name">${item.icon} ${item.name} x${item.quantity}</span>
            </div>
        `;
    });
    
    let actionsHtml = '';
    if (order.status === 'pending') {
        actionsHtml = `
            <button class="btn-action btn-preparing" onclick="updateOrderStatus('${order.id}', 'preparing')">
                준비 시작
            </button>
            <button class="btn-action btn-cancel" onclick="cancelOrder('${order.id}')">
                취소
            </button>
        `;
    } else if (order.status === 'preparing') {
        actionsHtml = `
            <button class="btn-action btn-complete" onclick="updateOrderStatus('${order.id}', 'completed')">
                완료
            </button>
        `;
    }
    
    // 피드백 표시
    let feedbackHtml = '';
    if (order.feedback) {
        const stars = '⭐'.repeat(order.feedback.rating);
        feedbackHtml = `
            <div class="order-feedback">
                <div class="feedback-header">💬 고객 피드백</div>
                <div class="feedback-rating">${stars} (${order.feedback.rating}점)</div>
                ${order.feedback.comment ? `<div class="feedback-comment">"${order.feedback.comment}"</div>` : ''}
            </div>
        `;
    }
    
    return `
        <div class="order-card">
            <div class="order-number-badge">주문번호: ${orderNumber}</div>
            <div class="order-header">
                <div class="order-info">
                    <h3>${order.userName}</h3>
                    <div class="order-meta">
                        <span class="order-type">${order.userType}</span>
                        <span class="order-time">${timeString}</span>
                    </div>
                </div>
                <span class="order-status status-${order.status}">
                    ${statusText[order.status]}
                </span>
            </div>
            
            <div class="order-items">
                ${itemsHtml}
            </div>
            
            ${feedbackHtml}
            
            <div class="order-actions">
                ${actionsHtml}
            </div>
        </div>
    `;
}

// 주문 상태 업데이트 (Firebase)
async function updateOrderStatus(orderId, newStatus) {
    try {
        const orderRef = doc(db, 'orders', orderId);
        await updateDoc(orderRef, {
            status: newStatus
        });
        console.log('주문 상태가 업데이트되었습니다!');
    } catch (error) {
        console.error('주문 상태 업데이트 실패:', error);
        alert('주문 상태 업데이트에 실패했습니다.');
    }
}

// 주문 취소 (Firebase)
async function cancelOrder(orderId) {
    if (!confirm('정말 이 주문을 취소하시겠습니까?')) {
        return;
    }
    
    try {
        const orderRef = doc(db, 'orders', orderId);
        await deleteDoc(orderRef);
        console.log('주문이 취소되었습니다!');
    } catch (error) {
        console.error('주문 취소 실패:', error);
        alert('주문 취소에 실패했습니다.');
    }
}

// 통계 업데이트
function updateStats(orders) {
    const pending = orders.filter(o => o.status === 'pending').length;
    const preparing = orders.filter(o => o.status === 'preparing').length;
    const completed = orders.filter(o => o.status === 'completed').length;
    
    pendingCountElement.textContent = pending;
    preparingCountElement.textContent = preparing;
    completedCountElement.textContent = completed;
}

// 통계 보기 (전체 기록)
function showStatistics() {
    const stats = calculateStatistics(allOrders); // 전체 주문 기록
    displayStatisticsModal(stats);
}

// 통계 계산
function calculateStatistics(orders) {
    const stats = {
        byMenu: {},
        byDate: {},
        byPerson: {},
        byType: {},
        total: orders.length
    };
    
    orders.forEach(order => {
        // 메뉴별 통계
        order.items.forEach(item => {
            if (!stats.byMenu[item.name]) {
                stats.byMenu[item.name] = { count: 0, icon: item.icon };
            }
            stats.byMenu[item.name].count += item.quantity;
        });
        
        // 날짜별 통계
        const date = new Date(order.timestamp).toLocaleDateString('ko-KR');
        stats.byDate[date] = (stats.byDate[date] || 0) + 1;
        
        // 사람별 통계
        if (!stats.byPerson[order.userName]) {
            stats.byPerson[order.userName] = { count: 0, type: order.userType };
        }
        stats.byPerson[order.userName].count++;
        
        // 구분별 통계
        stats.byType[order.userType] = (stats.byType[order.userType] || 0) + 1;
    });
    
    return stats;
}

// 통계 모달 표시
function displayStatisticsModal(stats) {
    // 메뉴별 정렬 (인기순)
    const menuStats = Object.entries(stats.byMenu)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([name, data]) => `<div class="stat-item">${data.icon} ${name}: <strong>${data.count}개</strong></div>`)
        .join('');
    
    // 사람별 정렬
    const personStats = Object.entries(stats.byPerson)
        .sort((a, b) => b[1].count - a[1].count)
        .map(([name, data]) => `<div class="stat-item">${name} (${data.type}): <strong>${data.count}회</strong></div>`)
        .join('');
    
    // 날짜별 정렬
    const dateStats = Object.entries(stats.byDate)
        .sort((a, b) => new Date(b[0]) - new Date(a[0]))
        .slice(0, 7) // 최근 7일
        .map(([date, count]) => `<div class="stat-item">${date}: <strong>${count}건</strong></div>`)
        .join('');
    
    // 구분별
    const typeStats = Object.entries(stats.byType)
        .map(([type, count]) => `<div class="stat-item">${type}: <strong>${count}명</strong></div>`)
        .join('');
    
    const modalHtml = `
        <div class="stats-modal" onclick="closeStatsModal(event)">
            <div class="stats-content" onclick="event.stopPropagation()">
                <div class="stats-header">
                    <h2>📊 주문 통계</h2>
                    <button class="btn-close" onclick="closeStatsModal()">✕</button>
                </div>
                
                <div class="stats-body">
                    <div class="stats-section">
                        <h3>🍽️ 인기 메뉴 TOP</h3>
                        ${menuStats || '<p>데이터 없음</p>'}
                    </div>
                    
                    <div class="stats-section">
                        <h3>👥 주문자별 통계</h3>
                        ${personStats || '<p>데이터 없음</p>'}
                    </div>
                    
                    <div class="stats-section">
                        <h3>📅 날짜별 주문 (최근 7일)</h3>
                        ${dateStats || '<p>데이터 없음</p>'}
                    </div>
                    
                    <div class="stats-section">
                        <h3>📋 구분별 통계</h3>
                        ${typeStats || '<p>데이터 없음</p>'}
                    </div>
                    
                    <div class="stats-summary">
                        <strong>총 주문 수: ${stats.total}건</strong>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

// 통계 모달 닫기
function closeStatsModal(event) {
    const modal = document.querySelector('.stats-modal');
    if (modal) {
        modal.remove();
    }
}

// 전역 함수로 등록 (HTML onclick에서 사용)
window.updateOrderStatus = updateOrderStatus;
window.cancelOrder = cancelOrder;
window.showStatistics = showStatistics;
window.closeStatsModal = closeStatsModal;

