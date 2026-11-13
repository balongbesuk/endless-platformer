/**
     * ============================================================================
     * 6. OBJECT POOL & PARTICLES (js/entities.js - Part 1)
     * Menghindari alokasi memori berulang setiap frame.
     * ============================================================================
     */
    class ParticlePool {
      constructor(maxSize = 120) {
        this.pool = Array.from({ length: maxSize }, () => ({
          active: false, x: 0, y: 0, vx: 0, vy: 0, size: 3, color: '#fff', life: 0, maxLife: 0.4, isDust: false
        }));
        this.pops = Array.from({ length: 16 }, () => ({
          active: false, x: 0, y: 0, timer: 0
        }));
      }

      spawn(x, y, count, color, speed = 120, isDust = false) {
        let spawned = 0;
        for (let i = 0; i < this.pool.length && spawned < count; i++) {
          const p = this.pool[i];
          if (!p.active) {
            const angle = Math.random() * Math.PI * 2;
            const spd = (0.3 + Math.random() * 0.7) * speed;
            p.active = true;
            p.isDust = isDust;
            p.x = x;
            p.y = y;
            p.vx = Math.cos(angle) * (isDust ? spd * 0.5 : spd);
            p.vy = Math.sin(angle) * spd - (isDust ? 15 : 40);
            p.size = isDust ? 16 : 2 + Math.floor(Math.random() * 3);
            p.color = color;
            p.life = 0;
            p.maxLife = isDust ? 0.3 : 0.25 + Math.random() * 0.25;
            spawned++;
          }
        }
      }

      spawnPop(x, y) {
        for (let i = 0; i < this.pops.length; i++) {
          const pop = this.pops[i];
          if (!pop.active) {
            pop.active = true;
            pop.x = x;
            pop.y = y;
            pop.timer = 0;
            break;
          }
        }
      }

      update(dt) {
        for (let i = 0; i < this.pool.length; i++) {
          const p = this.pool[i];
          if (!p.active) continue;
          p.life += dt;
          if (p.life >= p.maxLife) {
            p.active = false;
            continue;
          }
          p.vy += (p.isDust ? 80 : 450) * dt;
          p.x += p.vx * dt;
          p.y += p.vy * dt;
        }

        for (let i = 0; i < this.pops.length; i++) {
          const pop = this.pops[i];
          if (!pop.active) continue;
          pop.timer += dt * 20; // 6 frame @ ~0.3s
          if (pop.timer >= 6) pop.active = false;
        }
      }

      render(ctx, camera) {
        const dustImg = EFFECTS.dust;
        const hasDust = dustImg && dustImg.complete && dustImg.naturalWidth;

        for (let i = 0; i < this.pool.length; i++) {
          const p = this.pool[i];
          if (!p.active) continue;
          const sx = Math.floor(p.x - camera.x);
          const sy = Math.floor(p.y - camera.y);
          if (sx < -20 || sx > CONFIG.CANVAS_WIDTH + 20) continue;

          if (p.isDust && hasDust) {
            const alpha = Math.max(0, 1 - (p.life / p.maxLife));
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.drawImage(dustImg, sx - 8, sy - 8, 16, 16);
            ctx.restore();
          } else {
            ctx.fillStyle = p.color;
            ctx.fillRect(sx, sy, p.size, p.size);
          }
        }

        // Render efek pop bintang (Collected.png: 6 frame @ 32x32)
        const popImg = EFFECTS.collected;
        if (popImg && popImg.complete && popImg.naturalWidth) {
          for (let i = 0; i < this.pops.length; i++) {
            const pop = this.pops[i];
            if (!pop.active) continue;
            const sx = Math.floor(pop.x - camera.x - 16);
            const sy = Math.floor(pop.y - camera.y - 16);
            const frame = Math.floor(pop.timer);
            ctx.drawImage(popImg, frame * 32, 0, 32, 32, sx, sy, 32, 32);
          }
        }
      }

      clear() {
        for (let i = 0; i < this.pool.length; i++) this.pool[i].active = false;
        for (let i = 0; i < this.pops.length; i++) this.pops[i].active = false;
      }
    }

    /**
     * ============================================================================
     * 6B. FLOATING TEXT POOL (js/floating-text.js)
     * Pool teks melayang ultra-ringan, zero-GC, mencegah lag saat koin beruntun.
     * ============================================================================
     */
    class FloatingTextPool {
      constructor(maxCount = 5) {
        this.maxCount = maxCount;
        this.pool = Array.from({ length: maxCount }, () => ({
          active: false,
          x: 0,
          y: 0,
          text: '',
          color: '#facc15',
          life: 0,
          maxLife: 0.55,
          type: ''
        }));
      }

      spawn(x, y, text, color = '#facc15', type = '', duration = 0.55) {
        // Jika koin diambil beruntun dengan cepat, perbarui popup koin yang sudah ada
        // agar tidak terjadi spam teks bertumpuk yang membebani GPU/CPU
        if (type === 'coin') {
          for (let i = 0; i < this.maxCount; i++) {
            const item = this.pool[i];
            if (item.active && item.type === 'coin' && item.life > 0.08) {
              item.x = x;
              item.y = y;
              item.text = text;
              item.color = color;
              item.life = duration;
              item.maxLife = duration;
              return;
            }
          }
        }

        // Cari slot tidak aktif
        let target = null;
        for (let i = 0; i < this.maxCount; i++) {
          if (!this.pool[i].active) {
            target = this.pool[i];
            break;
          }
        }

        // Jika penuh, timpa slot dengan sisa durasi paling sedikit
        if (!target) {
          target = this.pool[0];
          for (let i = 1; i < this.maxCount; i++) {
            if (this.pool[i].life < target.life) {
              target = this.pool[i];
            }
          }
        }

        target.active = true;
        target.x = x;
        target.y = y;
        target.text = text;
        target.color = color;
        target.life = duration;
        target.maxLife = duration;
        target.type = type;
      }

      update(dt) {
        for (let i = 0; i < this.maxCount; i++) {
          const item = this.pool[i];
          if (!item.active) continue;
          item.life -= dt;
          item.y -= 26 * dt;
          if (item.life <= 0) {
            item.active = false;
          }
        }
      }

      render(ctx, camera) {
        let hasActive = false;
        for (let i = 0; i < this.maxCount; i++) {
          if (this.pool[i].active) {
            hasActive = true;
            break;
          }
        }
        if (!hasActive) return;

        const camX = Math.round(camera.x + (camera.shakeOffsetX || 0));
        const camY = Math.round(camera.y + (camera.shakeOffsetY || 0));

        ctx.save();
        ctx.font = 'bold 12px "Courier New", monospace';
        ctx.textAlign = 'center';

        for (let i = 0; i < this.maxCount; i++) {
          const ft = this.pool[i];
          if (!ft.active) continue;

          const sx = Math.floor(ft.x - camX);
          const sy = Math.floor(ft.y - camY);

          // Culling teks di luar viewport
          if (sx < -60 || sx > CONFIG.CANVAS_WIDTH + 60) continue;

          const alpha = Math.max(0, Math.min(1, ft.life / ft.maxLife));
          ctx.globalAlpha = alpha;

          // 1 shadow offset ringan (bukan 4x fillText) untuk performa 60FPS mulus
          ctx.fillStyle = '#000000';
          ctx.fillText(ft.text, sx + 1, sy + 1);

          ctx.fillStyle = ft.color;
          ctx.fillText(ft.text, sx, sy);
        }

        ctx.restore();
      }

      clear() {
        for (let i = 0; i < this.maxCount; i++) {
          this.pool[i].active = false;
        }
      }
    }

    /**
     * ============================================================================
     * 7. PLAYER ENTITY (js/entities.js - Part 2)
     * Free-movement penuh, coyote time, jump buffer, variable jump, knockback.
     * ============================================================================
     */
    class Player {
      constructor(x, y) {
        this.reset(x, y);
      }

      reset(x, y) {
        this.x = x;
        this.y = y;
        this.isBig = false; // Mario mechanic: mulai sebagai Mini Hero
        this.growTimer = 0;
        this.w = 20;
        this.h = 26;
        this.vx = 0;
        this.vy = 0;
        this.facing = 1;
        this.onGround = false;
        this.wasOnGround = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.invulnTimer = 0;
        this.shieldTimer = 0;
        this.magnetTimer = 0;
        this.animTimer = 0;
        this.activeEmote = null;
        this.state = 'idle'; // idle, walk, run, jump, fall, hurt
        this.skin = this.skin || 'scout';
        this.safeCheckpoint = { x, y };
      }

      update(dt, input, platforms, audio, particles) {
        const P = CONFIG.PHYSICS;

        if (this.invulnTimer > 0) this.invulnTimer = Math.max(0, this.invulnTimer - dt);
        if (this.shieldTimer > 0) this.shieldTimer = Math.max(0, this.shieldTimer - dt);
        if (this.magnetTimer > 0) this.magnetTimer = Math.max(0, this.magnetTimer - dt);
        if (this.growTimer > 0) this.growTimer = Math.max(0, this.growTimer - dt);
        if (this.activeEmote) {
          this.activeEmote.timer -= dt;
          if (this.activeEmote.timer <= 0) this.activeEmote = null;
        }

        // Coyote Time & Jump Buffering
        if (this.onGround) {
          this.coyoteTimer = P.COYOTE_TIME;
        } else {
          this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
        }

        if (input.jumpPressed) {
          this.jumpBufferTimer = P.JUMP_BUFFER_TIME;
        } else {
          this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
        }

        // Horizontal Movement (Free Control - tidak ada auto-run)
        const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
        const maxSpeed = input.run ? P.MAX_RUN_SPEED : P.MAX_WALK_SPEED;
        const accel = this.onGround ? P.ACCEL_GROUND : P.ACCEL_AIR;
        const friction = this.onGround ? P.FRICTION_GROUND : P.FRICTION_AIR;

        if (dir !== 0) {
          this.vx += dir * accel * dt;
          this.facing = dir;
          if (Math.abs(this.vx) > maxSpeed) {
            this.vx = dir * maxSpeed;
          }
        } else {
          // Berhenti sepenuhnya saat di atas permukaan stabil tanpa input
          if (Math.abs(this.vx) <= friction * dt) {
            this.vx = 0;
          } else {
            this.vx -= Math.sign(this.vx) * friction * dt;
          }
        }

        // Eksekusi Lompatan
        if (this.jumpBufferTimer > 0 && this.coyoteTimer > 0) {
          this.vy = P.JUMP_VELOCITY;
          this.onGround = false;
          this.coyoteTimer = 0;
          this.jumpBufferTimer = 0;
          audio.jump();
          particles.spawn(this.x + this.w / 2, this.y + this.h, 4, '#e2e8f0', 70, true);
        }

        // Variable Jump Height (lepas tombol = potong kecepatan naik)
        if (input.jumpReleased && this.vy < 0) {
          this.vy *= P.JUMP_CUT_MULTIPLIER;
        }

        // Gravitasi
        this.vy = Math.min(P.MAX_FALL_SPEED, this.vy + P.GRAVITY * dt);

        this.wasOnGround = this.onGround;
        CollisionSystem.moveAndCollide(this, dt, platforms);

        // Efek mendarat & simpan titik aman terakhir
        if (!this.wasOnGround && this.onGround) {
          audio.land();
          particles.spawn(this.x + this.w / 2, this.y + this.h, 4, '#cbd5e1', 60, true);
        }
        // Debu halus saat lari di tanah
        if (this.onGround && Math.abs(this.vx) > 180 && Math.random() < 0.22) {
          particles.spawn(this.x + (this.facing > 0 ? 2 : this.w - 2), this.y + this.h - 2, 1, '#cbd5e1', 25, true);
        }
        // Safe Checkpoint: HANYA dicatat jika berpijak di tanah padat (ground) yang statis (bukan platform bergerak/melayang di atas jurang)
        if (this.onGround && this.groundPlatform) {
          const gp = this.groundPlatform;
          const isStaticSolidGround = gp.type === 'ground' && !gp.moveAxis && !gp.oneWay && gp.h >= 60;
          if (isStaticSolidGround) {
            // Posisi aman minimal 36px dari ujung kiri platform agar tidak di tepi jurang
            const safeX = gp.x + Math.max(36, Math.min(gp.w - 36, this.x - gp.x));
            this.safeCheckpoint.x = safeX;
            this.safeCheckpoint.y = gp.y - this.h - 2;
          }
        }

        // Batas kiri dunia awal
        if (this.x < CONFIG.WORLD.MIN_BOUND_X) {
          this.x = CONFIG.WORLD.MIN_BOUND_X;
          if (this.vx < 0) this.vx = 0;
        }

        // Update state animasi
        this.animTimer += dt * (Math.abs(this.vx) > 220 ? 14 : 9);
        if (this.invulnTimer > P.INVULNERABLE_TIME - 0.25) {
          this.state = 'hurt';
        } else if (!this.onGround) {
          this.state = this.vy < 0 ? 'jump' : 'fall';
        } else if (Math.abs(this.vx) > 230) {
          this.state = 'run';
        } else if (Math.abs(this.vx) > 10) {
          this.state = 'walk';
        } else {
          this.state = 'idle';
        }
      }

      triggerEmote(icon) {
        this.activeEmote = { icon, timer: 2.2, maxTimer: 2.2 };
      }
    }

// Global window assignments for direct file:// compatibility
window.ParticlePool = ParticlePool;
window.FloatingTextPool = FloatingTextPool;
window.Player = Player;
