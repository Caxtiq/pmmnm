'use client';

import { useEffect } from 'react';

export default function PWAInstaller() {
  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
      return;
    }

    // Register service worker
    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log('[PWA] Service Worker registered:', registration);

        // Check for updates
        registration.addEventListener('updatefound', () => {
          const newWorker = registration.installing;
          if (newWorker) {
            newWorker.addEventListener('statechange', () => {
              if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                // New service worker available
                if (confirm('Có phiên bản mới! Tải lại để cập nhật?')) {
                  newWorker.postMessage({ type: 'SKIP_WAITING' });
                  window.location.reload();
                }
              }
            });
          }
        });

        // Check for updates every hour
        setInterval(() => {
          registration.update();
        }, 60 * 60 * 1000);
      })
      .catch((error) => {
        console.error('[PWA] Service Worker registration failed:', error);
      });

    // Handle controller change (new service worker activated)
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      window.location.reload();
    });

    // Listen for messages from service worker
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'CACHE_UPDATED') {
        console.log('[PWA] Cache updated');
      }
    });

    // Register background sync for offline reports
    if ('sync' in registration) {
      registration.sync.register('sync-reports').catch((error) => {
        console.error('[PWA] Background sync registration failed:', error);
      });
    }

    // Handle online/offline events
    const handleOnline = () => {
      console.log('[PWA] Back online');
      // Trigger background sync
      if ('serviceWorker' in navigator && 'sync' in navigator.serviceWorker) {
        navigator.serviceWorker.ready.then((registration) => {
          return registration.sync.register('sync-reports');
        });
      }
    };

    const handleOffline = () => {
      console.log('[PWA] Gone offline');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // PWA Install Prompt
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let deferredPrompt: any;

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e;

      // Show install button after a delay
      setTimeout(() => {
        if (deferredPrompt && !window.matchMedia('(display-mode: standalone)').matches) {
          showInstallPrompt(deferredPrompt);
        }
      }, 5000);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Detect if already installed
    window.addEventListener('appinstalled', () => {
      console.log('[PWA] App installed successfully');
      deferredPrompt = null;
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  return null;
}

function showInstallPrompt(deferredPrompt: any) {
  // Create install banner
  const banner = document.createElement('div');
  banner.id = 'pwa-install-banner';
  banner.style.cssText = `
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 16px;
    max-width: 90%;
    animation: slideUp 0.3s ease-out;
  `;

  banner.innerHTML = `
    <div style="flex: 1;">
      <div style="font-weight: 600; margin-bottom: 4px;">📱 Cài đặt ứng dụng</div>
      <div style="font-size: 14px; opacity: 0.9;">Sử dụng ngoại tuyến, nhận thông báo nhanh hơn</div>
    </div>
    <button id="pwa-install-btn" style="
      background: white;
      color: #667eea;
      border: none;
      padding: 10px 20px;
      border-radius: 8px;
      font-weight: 600;
      cursor: pointer;
      transition: transform 0.2s;
    ">
      Cài đặt
    </button>
    <button id="pwa-dismiss-btn" style="
      background: transparent;
      color: white;
      border: none;
      padding: 10px;
      cursor: pointer;
      font-size: 24px;
      line-height: 1;
    ">
      ×
    </button>
  `;

  // Add animation
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideUp {
      from {
        transform: translateX(-50%) translateY(100px);
        opacity: 0;
      }
      to {
        transform: translateX(-50%) translateY(0);
        opacity: 1;
      }
    }
    #pwa-install-btn:hover {
      transform: scale(1.05);
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(banner);

  // Install button click
  const installBtn = document.getElementById('pwa-install-btn');
  installBtn?.addEventListener('click', async () => {
    banner.remove();
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log('[PWA] User choice:', outcome);
    deferredPrompt = null;
  });

  // Dismiss button click
  const dismissBtn = document.getElementById('pwa-dismiss-btn');
  dismissBtn?.addEventListener('click', () => {
    banner.remove();
    // Remember dismissal for 7 days
    localStorage.setItem('pwa-install-dismissed', String(Date.now() + 7 * 24 * 60 * 60 * 1000));
  });

  // Auto-dismiss after 30 seconds
  setTimeout(() => {
    if (document.body.contains(banner)) {
      banner.remove();
    }
  }, 30000);
}
