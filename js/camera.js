/**
     * ============================================================================
     * 8. CAMERA MODULE (js/camera.js)
     * Memisahkan World Coordinates dan Screen Coordinates dengan deadzone nyaman.
     * ============================================================================
     */
    class Camera {
      constructor() {
        this.x = 0;
        this.y = 0;
        this.deadzoneWidth = 140;
        this.shakeTimer = 0;
        this.shakeIntensity = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
      }

      reset(targetX) {
        this.x = Math.max(0, targetX - CONFIG.CANVAS_WIDTH * 0.35);
        this.y = 0;
        this.shakeTimer = 0;
        this.shakeOffsetX = 0;
        this.shakeOffsetY = 0;
      }

      shake(duration = 0.25, intensity = 6) {
        this.shakeTimer = duration;
        this.shakeIntensity = intensity;
      }

      update(dt, player) {
        const centerScreenX = this.x + CONFIG.CANVAS_WIDTH * 0.42;
        const playerCenterX = player.x + player.w * 0.5;
        const diff = playerCenterX - centerScreenX;

        let desiredX = this.x;
        if (Math.abs(diff) > this.deadzoneWidth * 0.5) {
          if (diff > 0) {
            desiredX = playerCenterX - CONFIG.CANVAS_WIDTH * 0.42 - this.deadzoneWidth * 0.5;
          } else {
            desiredX = playerCenterX - CONFIG.CANVAS_WIDTH * 0.42 + this.deadzoneWidth * 0.5;
          }
        }

        desiredX = Math.max(0, desiredX);
        // Smooth interpolation
        this.x += (desiredX - this.x) * Math.min(1, dt * 8.5);

        // Shake interpolation
        if (this.shakeTimer > 0) {
          this.shakeTimer -= dt;
          const factor = Math.max(0, this.shakeTimer * 4);
          this.shakeOffsetX = (Math.random() * 2 - 1) * this.shakeIntensity * factor;
          this.shakeOffsetY = (Math.random() * 2 - 1) * this.shakeIntensity * factor;
        } else {
          this.shakeOffsetX = 0;
          this.shakeOffsetY = 0;
        }
      }
    }

// Global window assignments for direct file:// compatibility
window.Camera = Camera;
