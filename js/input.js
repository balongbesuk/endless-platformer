/**
     * ============================================================================
     * 4. INPUT MODULE (js/input.js)
     * Menangani Keyboard & Pointer Events (Mobile Touch) serta anti-stuck saat blur.
     * ============================================================================
     */
    class InputManager {
      constructor() {
        this.left = false;
        this.right = false;
        this.run = false;
        this.jumpHeld = false;
        this.jumpPressed = false;
        this.jumpReleased = false;

        this.dirPointerId = null;
        this.activePointers = new Map();
        this.onPauseToggle = null;
        this.onMuteToggle = null;
        this.onEmoteTrigger = null;
        this.onAnyInteraction = null;

        this._bindKeyboard();
        this._bindTouchButtons();
        this._bindWindowEvents();
      }

      resetState() {
        this.left = false;
        this.right = false;
        this.run = false;
        this.jumpHeld = false;
        this.jumpPressed = false;
        this.jumpReleased = false;
        this.dirPointerId = null;
        this.activePointers.clear();
        if (this.actionTouches) this.actionTouches.clear();
        document.querySelectorAll('.touch-btn').forEach(btn => btn.classList.remove('active'));
      }

      consumeFrameFlags() {
        this.jumpPressed = false;
        this.jumpReleased = false;
      }

      _triggerInteraction() {
        if (this.onAnyInteraction) this.onAnyInteraction();
      }

      _bindKeyboard() {
        window.addEventListener('keydown', (e) => {
          this._triggerInteraction();
          const code = e.code;

          if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Space'].includes(code)) {
            e.preventDefault();
          }

          if (code === 'ArrowLeft' || code === 'KeyA') this.left = true;
          if (code === 'ArrowRight' || code === 'KeyD') this.right = true;
          if (code === 'ShiftLeft' || code === 'ShiftRight') this.run = true;

          if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') {
            if (!this.jumpHeld) {
              this.jumpPressed = true;
            }
            this.jumpHeld = true;
          }

          if (code === 'Escape' && !e.repeat && this.onPauseToggle) {
            this.onPauseToggle();
          }
          if (code === 'KeyM' && !e.repeat && this.onMuteToggle) {
            this.onMuteToggle();
          }
          if (code.startsWith('Digit') && !e.repeat && this.onEmoteTrigger) {
            const digit = parseInt(code.replace('Digit', ''), 10);
            if (digit >= 1 && digit <= 6) {
              this.onEmoteTrigger(digit - 1);
            }
          }
        });

        window.addEventListener('keyup', (e) => {
          const code = e.code;
          if (code === 'ArrowLeft' || code === 'KeyA') this.left = false;
          if (code === 'ArrowRight' || code === 'KeyD') this.right = false;
          if (code === 'ShiftLeft' || code === 'ShiftRight') this.run = false;

          if (code === 'Space' || code === 'ArrowUp' || code === 'KeyW') {
            if (this.jumpHeld) {
              this.jumpReleased = true;
            }
            this.jumpHeld = false;
          }
        });
      }

      _bindTouchButtons() {
        // 1. Kluster Arah Gerak Kiri / Kanan (Mendukung Geser / Slide Touchscreen Mulus Tanpa Perlu Angkat Jari)
        const tLeft = document.getElementById('t-left');
        const tRight = document.getElementById('t-right');
        const dirCluster = tLeft ? tLeft.parentElement : null;

        if (dirCluster && tLeft && tRight) {
          const updateDirection = (e) => {
            const lRect = tLeft.getBoundingClientRect();
            const rRect = tRight.getBoundingClientRect();
            const midX = (lRect.right + rRect.left) / 2;
            const minY = Math.min(lRect.top, rRect.top) - 50;
            const maxY = Math.max(lRect.bottom, rRect.bottom) + 50;
            const minX = lRect.left - 50;
            const maxX = rRect.right + 50;

            const inside = e.clientX >= minX && e.clientX <= maxX && e.clientY >= minY && e.clientY <= maxY;
            const isLeft = inside && e.clientX < midX;
            const isRight = inside && e.clientX >= midX;

            this.left = isLeft;
            this.right = isRight;
            tLeft.classList.toggle('active', isLeft);
            tRight.classList.toggle('active', isRight);
          };

          const releaseDirection = (e) => {
            if (e.pointerId === this.dirPointerId) {
              this.dirPointerId = null;
              this.left = false;
              this.right = false;
              tLeft.classList.remove('active');
              tRight.classList.remove('active');
            }
          };

          dirCluster.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this._triggerInteraction();
            this.dirPointerId = e.pointerId;
            try { dirCluster.setPointerCapture(e.pointerId); } catch (_) {}
            updateDirection(e);
          });

          window.addEventListener('pointermove', (e) => {
            if (e.pointerId === this.dirPointerId) {
              updateDirection(e);
            }
          });

          window.addEventListener('pointerup', releaseDirection);
          window.addEventListener('pointercancel', releaseDirection);
          dirCluster.addEventListener('lostpointercapture', releaseDirection);
        }

        // 2. Kluster Tombol Aksi (Lari & Lompat) - Mendukung Geser / Slide Touchscreen Mulus Tanpa Angkat Jari
        const tRun = document.getElementById('t-run');
        const tJump = document.getElementById('t-jump');
        const actionCluster = tRun ? tRun.parentElement : null;

        if (actionCluster && tRun && tJump) {
          this.actionTouches = new Map();

          const updateActionStates = () => {
            const rRect = tRun.getBoundingClientRect();
            const jRect = tJump.getBoundingClientRect();
            const rCx = rRect.left + rRect.width / 2;
            const rCy = rRect.top + rRect.height / 2;
            const rRad = rRect.width / 2 + 22;

            const jCx = jRect.left + jRect.width / 2;
            const jCy = jRect.top + jRect.height / 2;
            const jRad = jRect.width / 2 + 22;

            let isRunActive = false;
            let isJumpActive = false;

            for (const pt of this.actionTouches.values()) {
              const dRun = Math.hypot(pt.clientX - rCx, pt.clientY - rCy);
              const dJump = Math.hypot(pt.clientX - jCx, pt.clientY - jCy);

              if (dRun <= rRad) isRunActive = true;
              if (dJump <= jRad) isJumpActive = true;
            }

            // Update Lari (B)
            this.run = isRunActive;
            tRun.classList.toggle('active', isRunActive);

            // Update Lompat (A)
            if (isJumpActive && !this.jumpHeld) {
              this.jumpPressed = true;
            }
            if (!isJumpActive && this.jumpHeld) {
              this.jumpReleased = true;
            }
            this.jumpHeld = isJumpActive;
            tJump.classList.toggle('active', isJumpActive);
          };

          const releaseActionPointer = (e) => {
            if (this.actionTouches.has(e.pointerId)) {
              this.actionTouches.delete(e.pointerId);
              updateActionStates();
            }
          };

          actionCluster.addEventListener('pointerdown', (e) => {
            e.preventDefault();
            this._triggerInteraction();
            try { actionCluster.setPointerCapture(e.pointerId); } catch (_) {}
            this.actionTouches.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
            updateActionStates();
          });

          window.addEventListener('pointermove', (e) => {
            if (this.actionTouches.has(e.pointerId)) {
              this.actionTouches.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
              updateActionStates();
            }
          });

          window.addEventListener('pointerup', releaseActionPointer);
          window.addEventListener('pointercancel', releaseActionPointer);
          actionCluster.addEventListener('lostpointercapture', releaseActionPointer);
        }
      }

      _bindWindowEvents() {
        window.addEventListener('blur', () => this.resetState());
        document.addEventListener('visibilitychange', () => {
          if (document.hidden) this.resetState();
        });
      }
    }

// Global window assignments for direct file:// compatibility
window.InputManager = InputManager;
