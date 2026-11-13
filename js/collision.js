/**
     * ============================================================================
     * 5. COLLISION & PHYSICS MODULE (js/collision.js & js/physics.js)
     * Pemisahan AABB Horizontal & Vertikal, serta One-Way / Moving Platforms.
     * ============================================================================
     */
    class CollisionSystem {
      static overlaps(a, b) {
        return (
          a.x < b.x + b.w &&
          a.x + a.w > b.x &&
          a.y < b.y + b.h &&
          a.y + a.h > b.y
        );
      }

      static moveAndCollide(entity, dt, platforms) {
        entity.onGround = false;
        entity.groundPlatform = null;

        // 1. Integrasi Horizontal
        entity.x += entity.vx * dt;
        for (let i = 0; i < platforms.length; i++) {
          const p = platforms[i];
          if (p.oneWay) continue;
          if (this.overlaps(entity, p)) {
            if (entity.vx > 0) {
              entity.x = p.x - entity.w;
              entity.vx = 0;
              entity.hitWallRight = true;
            } else if (entity.vx < 0) {
              entity.x = p.x + p.w;
              entity.vx = 0;
              entity.hitWallLeft = true;
            }
          }
        }

        // 2. Integrasi Vertikal
        const prevBottom = entity.y + entity.h;
        entity.y += entity.vy * dt;

        for (let i = 0; i < platforms.length; i++) {
          const p = platforms[i];
          if (!this.overlaps(entity, p)) continue;

          if (p.oneWay) {
            // One-way platform hanya menahan saat jatuh dari atas (dengan toleransi pergerakan vertikal)
            const tolerance = (p.dy && p.dy < 0) ? 16 : 10;
            if (entity.vy >= -50 && prevBottom <= p.y + tolerance) {
              entity.y = p.y - entity.h;
              entity.vy = 0;
              entity.onGround = true;
              entity.groundPlatform = p;
            }
          } else {
            if (entity.vy > 0 && prevBottom <= p.y + 14) {
              entity.y = p.y - entity.h;
              entity.vy = 0;
              entity.onGround = true;
              entity.groundPlatform = p;
            } else if (entity.vy < 0 && entity.y - entity.vy * dt >= p.y + p.h - 14) {
              entity.y = p.y + p.h;
              entity.vy = 0;
            }
          }
        }

        // Ikuti pergerakan platform bergerak (horizontal & vertikal)
        if (entity.onGround && entity.groundPlatform) {
          if (entity.groundPlatform.dx) entity.x += entity.groundPlatform.dx;
          if (entity.groundPlatform.dy) entity.y += entity.groundPlatform.dy;
        }
      }
    }

// Global window assignments for direct file:// compatibility
window.CollisionSystem = CollisionSystem;
