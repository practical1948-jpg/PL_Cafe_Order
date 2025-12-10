// Service Worker - 백그라운드에서 알림 받기 위해 필요
const CACHE_NAME = 'pl-cafe-v1';

self.addEventListener('install', (event) => {
    console.log('Service Worker 설치됨');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker 활성화됨');
    event.waitUntil(clients.claim());
});

// 푸시 알림 처리
self.addEventListener('push', (event) => {
    if (event.data) {
        const data = event.data.json();
        const options = {
            body: data.body,
            icon: '☕',
            badge: '☕',
            vibrate: [200, 100, 200],
            data: data.data || {}
        };
        
        event.waitUntil(
            self.registration.showNotification(data.title, options)
        );
    }
});

// 알림 클릭 처리
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow('/staff.html')
    );
});
