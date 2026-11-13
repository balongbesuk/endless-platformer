// Inisialisasi Game & Service Worker & PWA Install Prompt & Orientation
    function initApp() {
      if (window.game) return;
      window.game = new Game();

      // 1. PWA Install & Landscape Handler
      let deferredPrompt = null;
      const installBtn = document.getElementById('btn-install-pwa');
      const banner = document.getElementById('pwa-install-banner');
      const btnBannerInstall = document.getElementById('btn-banner-install');
      const btnBannerClose = document.getElementById('btn-banner-close');
      const modalIos = document.getElementById('modal-ios-install');
      const btnIosClose = document.getElementById('btn-ios-close');
      const btnForceLandscape = document.getElementById('btn-force-landscape');

      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
      const isMobile = /android|iphone|ipad|ipod|mobile/i.test(navigator.userAgent.toLowerCase()) || (navigator.maxTouchPoints > 0 && window.innerWidth <= 960);
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent.toLowerCase());
      const bannerDismissed = sessionStorage.getItem('pwa_banner_dismissed') === '1';

      // Tombol Kunci Otomatis ke Landscape
      if (btnForceLandscape) {
        btnForceLandscape.addEventListener('click', async () => {
          try {
            if (document.documentElement.requestFullscreen) {
              await document.documentElement.requestFullscreen();
            } else if (document.documentElement.webkitRequestFullscreen) {
              await document.documentElement.webkitRequestFullscreen();
            }
            if (screen.orientation && screen.orientation.lock) {
              await screen.orientation.lock('landscape');
            }
          } catch (_) {}
        });
      }

      // Tampilkan tombol & banner rekomendasi PWA jika belum terpasang
      const showInstallOption = () => {
        if (isStandalone) return;
        if (installBtn) {
          installBtn.classList.remove('hidden');
          installBtn.classList.add('btn-pwa-highlight');
        }
        if (banner && !bannerDismissed && isMobile) {
          banner.classList.remove('hidden');
        }
      };

      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        showInstallOption();
      });

      // Di iOS Safari sebelum prompt tidak didukung, tampilkan panduan khusus iOS
      if (isIOS && !isStandalone) {
        showInstallOption();
      }

      const triggerInstall = async () => {
        if (deferredPrompt) {
          deferredPrompt.prompt();
          const { outcome } = await deferredPrompt.userChoice;
          if (outcome === 'accepted') {
            if (installBtn) installBtn.classList.add('hidden');
            if (banner) banner.classList.add('hidden');
          }
          deferredPrompt = null;
        } else if (isIOS && modalIos) {
          modalIos.classList.remove('hidden');
        }
      };

      if (installBtn) installBtn.addEventListener('click', triggerInstall);
      if (btnBannerInstall) btnBannerInstall.addEventListener('click', triggerInstall);
      if (btnBannerClose && banner) {
        btnBannerClose.addEventListener('click', () => {
          banner.classList.add('hidden');
          sessionStorage.setItem('pwa_banner_dismissed', '1');
        });
      }
      if (btnIosClose && modalIos) {
        btnIosClose.addEventListener('click', () => {
          modalIos.classList.add('hidden');
        });
      }

      window.addEventListener('appinstalled', () => {
        if (installBtn) installBtn.classList.add('hidden');
        if (banner) banner.classList.add('hidden');
        const swStatusEl = document.getElementById('sw-status');
        if (swStatusEl) swStatusEl.textContent = 'Terpasang di Perangkat';
      });

      const swStatusEl = document.getElementById('sw-status');
      if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
        navigator.serviceWorker.register('./sw.js')
          .then(() => {
            if (swStatusEl) swStatusEl.textContent = 'Offline Cache Aktif';
          })
          .catch(() => {
            if (swStatusEl) swStatusEl.textContent = 'Mode Lokal (Tanpa SW)';
          });
      } else if (swStatusEl) {
        swStatusEl.textContent = 'Mode Standar';
      }
    }

    if (document.readyState === 'loading') {
      window.addEventListener('DOMContentLoaded', initApp);
    } else {
      initApp();
    }

// Global window assignments for direct file:// compatibility
window.initApp = initApp;
