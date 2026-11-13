/**
     * ============================================================================
     * 11. RENDERER & PROCEDURAL PIXEL ART (js/ui.js & Pixel Renderer)
     * Menggambar Parallax Background, Tiles, Karakter, dan Musuh bergaya Pixel Art.
     * ============================================================================
     */
    class PixelRenderer {
      constructor(canvas) {
        this.canvas = canvas;
        // desynchronized: true memangkas antrean buffer compositor untuk latensi input terendah
        this.ctx = canvas.getContext('2d', { alpha: false, desynchronized: true }) || canvas.getContext('2d', { alpha: false });
        this.ctx.imageSmoothingEnabled = false;
      }

      render(camera, player, activeSegments, particles, time, floatingTexts = [], boss = null, bossAlertTimer = 0, bossProjectiles = [], startSeason = 0, peers = null) {
        const ctx = this.ctx;
        const W = CONFIG.CANVAS_WIDTH;
        const H = CONFIG.CANVAS_HEIGHT;

        // Bersihkan canvas agar tidak ada artifak frame sebelumnya
        ctx.clearRect(0, 0, W, H);

        const shakeX = Math.round(camera.shakeOffsetX || 0);
        const shakeY = Math.round(camera.shakeOffsetY || 0);
        const camX = camera.x + shakeX;
        const camY = camera.y + shakeY;

        // Tema Area 4 Musim Berbasis Jarak Geografis (Tiap 500 Meter Berganti Musim)
        // Musim awal diacak setiap sesi baru: (startSeason + floor(jarak / 500)) % 4
        const curMeters = Math.max(0, player.x / CONFIG.WORLD.PIXELS_PER_METER);
        const seasonIndex = (startSeason + Math.floor(curMeters / 500)) % 4;
        const progressInSeason = curMeters % 500;

        // Transisi halus cross-fade di 40 meter terakhir sebelum pergantian musim (460m - 500m)
        let nextSeasonIndex = seasonIndex;
        let fadeBlend = 0;
        if (progressInSeason >= 460) {
          nextSeasonIndex = (seasonIndex + 1) % 4;
          fadeBlend = (progressInSeason - 460) / 40;
        }

        // Pemetaan panel Kenney bg.png yang akurat sesuai palet warna:
        // Panel 2 (x=144..192): Perbukitan hijau segar -> 0: Semi & 1: Panas
        // Panel 1 (x=96..144): Senja oranye keemasan -> 2: Gugur
        // Panel 0 (x=0..96): Pegunungan es salju biru-putih -> 3: Dingin
        const bgPanelMap = [2, 2, 1, 0];
        const curBgPanel = bgPanelMap[seasonIndex];
        const nxtBgPanel = bgPanelMap[nextSeasonIndex];

        const bgOk = KENNEY.bg.complete && KENNEY.bg.naturalWidth;
        if (bgOk) {
          if (fadeBlend > 0 && curBgPanel !== nxtBgPanel) {
            ctx.save();
            ctx.globalAlpha = 1 - fadeBlend;
            this._drawKenneyBackground(ctx, curBgPanel, camX, W, H);
            ctx.globalAlpha = fadeBlend;
            this._drawKenneyBackground(ctx, nxtBgPanel, camX, W, H);
            ctx.restore();
          } else {
            this._drawKenneyBackground(ctx, curBgPanel, camX, W, H);
          }

          // Efek Pancaran Mentari Emas di Musim Panas
          if (seasonIndex === 1 || (nextSeasonIndex === 1 && fadeBlend > 0)) {
            const sunAlpha = seasonIndex === 1 ? (nextSeasonIndex !== 1 ? 1 - fadeBlend : 1) : fadeBlend;
            ctx.save();
            ctx.globalAlpha = sunAlpha * 0.16;
            const sunGrad = ctx.createRadialGradient(W * 0.82, 50, 10, W * 0.82, 50, 240);
            sunGrad.addColorStop(0, '#fef08a');
            sunGrad.addColorStop(0.45, '#f59e0b');
            sunGrad.addColorStop(1, 'transparent');
            ctx.fillStyle = sunGrad;
            ctx.fillRect(0, 0, W, H * 0.75);
            ctx.restore();
          }
        } else {
          // Fallback Gradasi Warna Langit 4 Musim jika aset Kenney belum termuat
          const skyThemes = [
            ['#0284c7', '#38bdf8', '#bae6fd', '#0369a1', '#15803d'], // Musim Semi
            ['#0369a1', '#0ea5e9', '#fef08a', '#1e40af', '#166534'], // Musim Panas
            ['#451a03', '#9a3412', '#ea580c', '#7c2d12', '#c2410c'], // Musim Gugur
            ['#0f172a', '#1e293b', '#64748b', '#334155', '#475569']  // Musim Dingin
          ];
          const [sky1, sky2, sky3, mountainColor, hillColor] = skyThemes[seasonIndex];
          ctx.fillStyle = sky1;
          ctx.fillRect(0, 0, W, H * 0.45);
          ctx.fillStyle = sky2;
          ctx.fillRect(0, H * 0.45, W, H * 0.3);
          ctx.fillStyle = sky3;
          ctx.fillRect(0, H * 0.75, W, H * 0.25);

          this._drawParallaxClouds(ctx, camX * 0.12);
          this._drawParallaxMountains(ctx, camX * 0.25, 290 + shakeY * 0.3, mountainColor, 140);
          this._drawParallaxHills(ctx, camX * 0.45, 340 + shakeY * 0.5, hillColor);
        }

        // Efek Cuaca Dinamis 4 Musim (Sakura Petals, Sunbeams/Fireflies, Maple Leaves, Snowfall)
        this._drawWeather(ctx, camX, time, seasonIndex);

        // 5. Render Segmen yang berada di dalam Viewport (Culling)
        const viewLeft = camX - 60;
        const viewRight = camX + W + 60;

        // Kumpulkan semua ground aktif untuk deteksi pinggir jurang (chasm borders)
        const allGround = this._activeGround = this._activeGround || [];
        allGround.length = 0;
        for (let s = 0; s < activeSegments.length; s++) {
          const plats = activeSegments[s].platforms;
          for (let i = 0; i < plats.length; i++) {
            if (plats[i].type === 'ground') allGround.push(plats[i]);
          }
        }

        for (let s = 0; s < activeSegments.length; s++) {
          const seg = activeSegments[s];
          if (seg.endX < viewLeft || seg.startX > viewRight) continue;

          // Scenery (Pohon Tematik 4 Musim, Semak, Bunga, dsb)
          for (let i = 0; i < seg.scenery.length; i++) {
            const sc = seg.scenery[i];
            if (sc.x < viewLeft || sc.x > viewRight) continue;
            // Musim ditentukan berdasarkan koordinat dunia absolut objek tersebut
            const scSeason = (startSeason + Math.floor(Math.max(0, sc.x / CONFIG.WORLD.PIXELS_PER_METER) / 500)) % 4;
            this._drawScenery(ctx, Math.floor(sc.x - camX), Math.floor(sc.y - camY), sc.kind, scSeason, sc.variant);
          }

          // Platforms (Dengan variasi salju/rumput musiman di permukaannya)
          for (let i = 0; i < seg.platforms.length; i++) {
            const p = seg.platforms[i];
            if (p.x + p.w < viewLeft || p.x > viewRight) continue;
            let isLeftCliff = false;
            let isRightCliff = false;
            if (p.type === 'ground') {
              if (p._leftCliff === undefined) {
                p._leftCliff = p.x > 0 && !allGround.some(o => o !== p && Math.abs(o.x + o.w - p.x) <= 4 && Math.abs(o.y - p.y) < 10);
                p._rightCliff = !allGround.some(o => o !== p && Math.abs(o.x - (p.x + p.w)) <= 4 && Math.abs(o.y - p.y) < 10);
              }
              isLeftCliff = p._leftCliff;
              isRightCliff = p._rightCliff;
            }
            const platSeason = (startSeason + Math.floor(Math.max(0, p.x / CONFIG.WORLD.PIXELS_PER_METER) / 500)) % 4;
            this._drawPlatform(ctx, Math.floor(p.x - camX), Math.floor(p.y - camY), p.w, p.h, p.type, isLeftCliff, isRightCliff, platSeason);
          }

          // Koin
          for (let i = 0; i < seg.coins.length; i++) {
            const c = seg.coins[i];
            if (c.collected || c.x < viewLeft || c.x > viewRight) continue;
            this._drawCoin(ctx, Math.floor(c.x - camX), Math.floor(c.y - camY), c.special, time);
          }

          // Power-Ups
          for (let i = 0; i < seg.powerups.length; i++) {
            const pu = seg.powerups[i];
            if (pu.collected || pu.x < viewLeft || pu.x > viewRight) continue;
            this._drawPowerup(ctx, Math.floor(pu.x - camX), Math.floor(pu.y - camY), pu.type, time);
          }

          // Musuh
          for (let i = 0; i < seg.enemies.length; i++) {
            const en = seg.enemies[i];
            if (en.defeated || en.x < viewLeft || en.x > viewRight) continue;
            this._drawEnemy(ctx, Math.floor(en.x - camX), Math.floor(en.y - camY), en, time);
          }
        }

        // Render Proyektil & Gelombang Kejut Bos
        if (bossProjectiles && bossProjectiles.length > 0) {
          this._drawBossProjectiles(ctx, bossProjectiles, camX, camY, time);
        }

        // Render Titan Drone Mini-Boss jika ada
        if (boss && !boss.defeated) {
          this._drawBoss(ctx, Math.floor(boss.x - camX), Math.floor(boss.y - camY), boss, time, camX, camY);
        }

        // 6. Render Karakter Utama
        this._drawPlayer(ctx, Math.floor(player.x - camX), Math.floor(player.y - camY), player, time);

        // 6b. Render Bayangan Pemain Online Lain (Agar.io Style)
        if (peers && peers.size > 0) {
          for (const peer of peers.values()) {
            this._drawPeer(ctx, Math.floor(peer.x - camX), Math.floor(peer.y - camY), peer, time);
          }
        }

        // 7. Render Partikel
        particles.render(ctx, camera);

        // 8. Render Floating Pop-up Text (Ultra-fast pooled render)
        if (floatingTexts && floatingTexts.render) {
          floatingTexts.render(ctx, camera);
        }

        // 9. Render Boss HP Bar & Milestone Alert Banner
        if (boss && !boss.defeated) {
          this._drawBossHP(ctx, boss);
        }
        if (bossAlertTimer > 0) {
          this._drawBossAlert(ctx, bossAlertTimer, time);
        }
      }

      _drawTwinklingStars(ctx, offset, time) {
        for (let i = 0; i < 35; i++) {
          const starX = Math.floor((i * 67 + 31 - offset) % (CONFIG.CANVAS_WIDTH + 100));
          const starY = (i * 29 + 17) % 200;
          const blink = Math.sin(time * 2.5 + i * 1.7);
          if (blink > -0.3) {
            const a = Math.max(0.15, (blink + 1) * 0.42);
            ctx.globalAlpha = a;
            const big = blink > 0.65;
            // Cross-shaped stars for the bright ones
            if (big) {
              ctx.fillStyle = '#fef9c3';
              ctx.fillRect(starX, starY - 1, 1, 5);
              ctx.fillRect(starX - 1, starY, 5, 1);
              ctx.fillRect(starX, starY + 1, 1, 1);
            } else {
              ctx.fillStyle = (i % 3 === 0) ? '#c4b5fd' : '#fef08a';
              ctx.fillRect(starX, starY, 2, 2);
            }
          }
        }
        ctx.globalAlpha = 1.0;
      }

      _drawParallaxClouds(ctx, offset) {
        const spacing = 240;
        const start = Math.floor(offset / spacing) * spacing;
        for (let x = start - spacing; x < start + CONFIG.CANVAS_WIDTH + spacing * 2; x += spacing) {
          const sx = Math.floor(x - offset);
          const sy = 38 + (Math.abs(Math.floor(x / spacing)) % 4) * 22;
          const variant = Math.abs(Math.floor(x / spacing)) % 3;
          // Multi-layer fluffy clouds
          ctx.fillStyle = 'rgba(226, 232, 240, 0.12)';
          ctx.fillRect(sx - 6, sy + 4, 72, 12);
          ctx.fillStyle = 'rgba(226, 232, 240, 0.18)';
          if (variant === 0) {
            ctx.fillRect(sx + 8, sy - 6, 44, 10);
            ctx.fillRect(sx, sy, 60, 14);
            ctx.fillRect(sx + 4, sy + 10, 50, 6);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.09)';
            ctx.fillRect(sx + 12, sy - 2, 30, 4);
          } else if (variant === 1) {
            ctx.fillRect(sx + 14, sy - 8, 28, 8);
            ctx.fillRect(sx + 4, sy - 2, 50, 12);
            ctx.fillRect(sx, sy + 6, 56, 8);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.fillRect(sx + 18, sy - 4, 18, 4);
          } else {
            ctx.fillRect(sx + 6, sy - 4, 36, 8);
            ctx.fillRect(sx, sy, 46, 10);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.fillRect(sx + 10, sy, 24, 4);
          }
        }
      }

      _drawParallaxMountains(ctx, offset, baseY, color, height) {
        const step = 200;
        const start = Math.floor(offset / step) * step;
        for (let x = start - step; x < start + CONFIG.CANVAS_WIDTH + step * 2; x += step) {
          const sx = Math.floor(x - offset);
          const idx = Math.abs(Math.floor(x / step));
          const peakH = height - (idx % 3) * 25;
          // Mountain body with stepped shape
          for (let row = 0; row < peakH; row += 4) {
            const progress = row / peakH;
            const halfW = Math.floor(progress * (step * 0.55));
            ctx.fillStyle = color;
            ctx.fillRect(sx + step / 2 - halfW, baseY - peakH + row, halfW * 2, 6);
          }
          // Snow cap highlight on peaks
          if (peakH > 100) {
            ctx.fillStyle = 'rgba(200, 210, 230, 0.18)';
            for (let row = 0; row < peakH * 0.2; row += 4) {
              const halfW = Math.floor((row / peakH) * (step * 0.35));
              ctx.fillRect(sx + step / 2 - halfW, baseY - peakH + row, halfW * 2, 5);
            }
          }
          // Side shadow
          ctx.fillStyle = 'rgba(0, 0, 0, 0.12)';
          for (let row = peakH * 0.3; row < peakH; row += 4) {
            const halfW = Math.floor((row / peakH) * (step * 0.55));
            ctx.fillRect(sx + step / 2, baseY - peakH + row, halfW, 5);
          }
        }
      }

      _drawParallaxHills(ctx, offset, baseY, color) {
        const step = 155;
        const start = Math.floor(offset / step) * step;
        for (let x = start - step; x < start + CONFIG.CANVAS_WIDTH + step * 2; x += step) {
          const sx = Math.floor(x - offset);
          const idx = Math.abs(Math.floor(x / step));
          const h = 50 + (idx % 3) * 18;
          // Hill body with rounded top shape
          ctx.fillStyle = color;
          ctx.fillRect(sx + 6, baseY - h + 12, step - 12, h + 120);
          ctx.fillRect(sx + 16, baseY - h + 4, step - 32, 10);
          ctx.fillRect(sx + 28, baseY - h, step - 56, 6);
          // Top highlight
          ctx.fillStyle = 'rgba(255,255,255,0.06)';
          ctx.fillRect(sx + 20, baseY - h + 4, step - 48, 4);
          // Foliage texture dots
          ctx.fillStyle = 'rgba(0,0,0,0.08)';
          for (let dx = 18; dx < step - 24; dx += 14) {
            ctx.fillRect(sx + dx, baseY - h + 10 + (dx % 3) * 4, 4, 4);
          }
        }
      }

      _drawSeasonalTree(ctx, x, y, season, variant = 'large') {
        // Prioritaskan aset file PNG pixel art asli 4 musim yang bergaris kontur presisi
        const tObj = TREE_ASSETS[season];
        const img = tObj ? (tObj[variant] || tObj.large || tObj) : null;
        if (img && img.complete && img.naturalWidth) {
          const w = img.naturalWidth;
          const h = img.naturalHeight;
          ctx.drawImage(img, Math.floor(x - w / 2), Math.floor(y - h), w, h);
          return;
        }

        // Fallback prosedural jika file gambar belum termuat
        if (season === 0) {
          // 🌸 MUSIM SEMI: Pohon Sakura Jepang (Cherry Blossom)
          // Batang meliuk anggun khas sakura
          ctx.fillStyle = '#451a03';
          ctx.fillRect(x + 4, y - 48, 8, 48);
          ctx.fillRect(x - 2, y - 6, 20, 6);
          ctx.fillStyle = '#78350f';
          ctx.fillRect(x + 6, y - 48, 4, 46);
          // Cabang kiri & kanan
          ctx.fillStyle = '#451a03';
          ctx.fillRect(x - 6, y - 40, 10, 4);
          ctx.fillRect(x + 10, y - 44, 12, 4);

          // Rumpun Mahkota Bunga Sakura (Soft Pink & Magenta Cloud)
          // Lapisan Bayangan Bunga (Magenta Tua)
          ctx.fillStyle = '#9d174d';
          ctx.fillRect(x - 22, y - 68, 52, 26);
          ctx.fillRect(x - 14, y - 82, 36, 18);
          ctx.fillRect(x - 26, y - 56, 14, 16);
          ctx.fillRect(x + 20, y - 60, 14, 16);

          // Lapisan Bunga Sakura Utama (Pink Cerah)
          ctx.fillStyle = '#ec4899';
          ctx.fillRect(x - 20, y - 72, 48, 26);
          ctx.fillRect(x - 12, y - 84, 32, 18);
          ctx.fillRect(x - 24, y - 58, 12, 14);
          ctx.fillRect(x + 18, y - 62, 14, 14);

          // Lapisan Kelopak Lembut (Pastel Sakura)
          ctx.fillStyle = '#fbcfe8';
          ctx.fillRect(x - 16, y - 76, 40, 18);
          ctx.fillRect(x - 8, y - 86, 24, 12);
          ctx.fillRect(x - 6, y - 66, 22, 12);

          // Kilauan & Detail Kelopak Putih Bersih
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x - 4, y - 84, 8, 4);
          ctx.fillRect(x - 14, y - 72, 6, 3);
          ctx.fillRect(x + 10, y - 74, 6, 3);
          ctx.fillRect(x + 4, y - 62, 5, 3);

          // Kelopak Bunga Gugur Melayang di sekitar pohon
          ctx.fillStyle = '#f472b6';
          ctx.fillRect(x - 18, y - 32, 3, 3);
          ctx.fillRect(x + 18, y - 26, 3, 2);
          ctx.fillRect(x - 8, y - 16, 2, 2);
          ctx.fillRect(x + 12, y - 10, 3, 2);

        } else if (season === 1) {
          // ☀️ MUSIM PANAS: Pohon Pinus Rimba Hijau Subur (Summer Emerald Pine)
          // Batang kokoh cokelat kayu alami
          ctx.fillStyle = '#3f1d0b';
          ctx.fillRect(x + 6, y - 44, 10, 44);
          ctx.fillRect(x + 2, y - 6, 18, 6);
          ctx.fillStyle = '#78350f';
          ctx.fillRect(x + 9, y - 44, 4, 42);

          // 4 Tingkat Kanopi Pinus Rimbun Berwarna Zamrud Segar
          // Tingkat 1 (Bawah - Lebar)
          ctx.fillStyle = '#14532d';
          ctx.fillRect(x - 18, y - 48, 48, 14);
          ctx.fillStyle = '#16a34a';
          ctx.fillRect(x - 14, y - 52, 40, 10);
          ctx.fillStyle = '#4ade80';
          ctx.fillRect(x - 8, y - 52, 28, 4);

          // Tingkat 2 (Tengah)
          ctx.fillStyle = '#14532d';
          ctx.fillRect(x - 14, y - 62, 40, 12);
          ctx.fillStyle = '#16a34a';
          ctx.fillRect(x - 10, y - 66, 32, 8);
          ctx.fillStyle = '#4ade80';
          ctx.fillRect(x - 6, y - 66, 24, 4);

          // Tingkat 3 (Atas)
          ctx.fillStyle = '#14532d';
          ctx.fillRect(x - 10, y - 74, 32, 10);
          ctx.fillStyle = '#16a34a';
          ctx.fillRect(x - 6, y - 78, 24, 8);
          ctx.fillStyle = '#4ade80';
          ctx.fillRect(x - 2, y - 78, 16, 4);

          // Pucuk Pinus (Tip)
          ctx.fillStyle = '#16a34a';
          ctx.fillRect(x - 2, y - 86, 16, 10);
          ctx.fillStyle = '#86efac';
          ctx.fillRect(x + 2, y - 88, 8, 4);

          // Highlight Sinar Matahari Musim Panas
          ctx.fillStyle = '#fef08a';
          ctx.fillRect(x + 4, y - 84, 4, 3);
          ctx.fillRect(x + 2, y - 72, 5, 2);
          ctx.fillRect(x - 2, y - 58, 6, 2);

        } else if (season === 2) {
          // 🍂 MUSIM GUGUR: Pohon Maple Emas Merah Membara (Autumn Maple)
          // Batang pohon tua warna kayu gelap
          ctx.fillStyle = '#291307';
          ctx.fillRect(x + 5, y - 46, 9, 46);
          ctx.fillRect(x, y - 6, 19, 6);
          ctx.fillStyle = '#5c2d12';
          ctx.fillRect(x + 7, y - 46, 4, 44);

          // Dedaunan Musim Gugur Multi-Tingkat (Merah Crimson, Oranye Amber, Emas Kuning)
          // Lapisan Bawah - Merah Russet Dalam
          ctx.fillStyle = '#991b1b';
          ctx.fillRect(x - 20, y - 66, 49, 22);
          ctx.fillRect(x - 12, y - 78, 33, 14);

          // Lapisan Tengah - Oranye Amber Cerah
          ctx.fillStyle = '#ea580c';
          ctx.fillRect(x - 18, y - 70, 45, 18);
          ctx.fillRect(x - 10, y - 82, 29, 14);
          ctx.fillRect(x - 24, y - 56, 12, 12);
          ctx.fillRect(x + 18, y - 58, 12, 12);

          // Lapisan Atas - Daun Emas Keemasan
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(x - 14, y - 74, 37, 12);
          ctx.fillRect(x - 6, y - 86, 21, 10);
          ctx.fillStyle = '#fde047';
          ctx.fillRect(x - 2, y - 88, 13, 6);
          ctx.fillRect(x - 8, y - 78, 8, 3);
          ctx.fillRect(x + 8, y - 76, 8, 3);

          // Daun Maple Berguguran di Sekitar Batang
          ctx.fillStyle = '#ea580c';
          ctx.fillRect(x - 14, y - 28, 3, 3);
          ctx.fillRect(x + 16, y - 22, 3, 2);
          ctx.fillStyle = '#f59e0b';
          ctx.fillRect(x - 6, y - 14, 3, 2);
          ctx.fillRect(x + 12, y - 8, 3, 3);

        } else {
          // ❄️ MUSIM DINGIN: Pohon Pinus Bersalju Tebal & Butiran Es (Snowy Winter Pine)
          // Batang warna abu-abu beku
          ctx.fillStyle = '#1e293b';
          ctx.fillRect(x + 6, y - 44, 9, 44);
          ctx.fillRect(x + 2, y - 6, 17, 6);
          ctx.fillStyle = '#334155';
          ctx.fillRect(x + 9, y - 44, 3, 42);

          // Lapisan Duri Cemara Hijau Gelap Kebiruan di Balik Tumpukan Salju
          // Tingkat 1 (Bawah)
          ctx.fillStyle = '#0f2e28';
          ctx.fillRect(x - 18, y - 46, 47, 14);
          // Tumpukan Salju Tebal Tingkat 1 (Bayangan es + Putih Murni)
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(x - 20, y - 50, 51, 6);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x - 19, y - 53, 49, 5);
          // Gantungan Es (Icicles) di Ujung Cabang Bawah
          ctx.fillStyle = '#93c5fd';
          ctx.fillRect(x - 18, y - 44, 2, 4);
          ctx.fillRect(x - 6, y - 44, 2, 5);
          ctx.fillRect(x + 10, y - 44, 2, 5);
          ctx.fillRect(x + 24, y - 44, 2, 4);

          // Tingkat 2 (Tengah)
          ctx.fillStyle = '#0f2e28';
          ctx.fillRect(x - 14, y - 60, 39, 12);
          // Tumpukan Salju Tingkat 2
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(x - 16, y - 64, 43, 6);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x - 15, y - 67, 41, 5);
          // Gantungan Es Tingkat 2
          ctx.fillStyle = '#93c5fd';
          ctx.fillRect(x - 12, y - 58, 2, 4);
          ctx.fillRect(x + 16, y - 58, 2, 4);

          // Tingkat 3 (Atas)
          ctx.fillStyle = '#0f2e28';
          ctx.fillRect(x - 10, y - 72, 31, 10);
          // Tumpukan Salju Tingkat 3
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(x - 12, y - 76, 35, 6);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x - 11, y - 79, 33, 5);

          // Puncak Salju (Snow Peak)
          ctx.fillStyle = '#0f2e28';
          ctx.fillRect(x - 2, y - 84, 15, 7);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x - 4, y - 89, 19, 7);
          ctx.fillRect(x - 1, y - 92, 13, 5);
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(x + 2, y - 94, 7, 3);
        }
      }

      _drawScenery(ctx, x, y, kind, season = 0, variant = 'large') {
        if (kind === 'sign_warning') {
          // Rambu peringatan bahaya jurang (tiang kayu + diamond kuning dengan tanda seru !)
          ctx.fillStyle = '#6b4423';
          ctx.fillRect(x - 2, y - 24, 4, 24);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(x - 9, y - 33, 18, 18);
          ctx.fillStyle = '#facc15';
          ctx.fillRect(x - 8, y - 32, 16, 16);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(x - 2, y - 30, 4, 7);
          ctx.fillRect(x - 2, y - 21, 4, 3);
          return;
        }

        // Pohon selalu digambar dengan aset 4 musim yang kontras & khas!
        if (kind === 'tree') {
          this._drawSeasonalTree(ctx, x, y, season, variant);
          return;
        }

        // Semak tematik 4 musim asli
        if (kind === 'bush') {
          const bImg = BUSH_ASSETS[season];
          if (bImg && bImg.complete && bImg.naturalWidth) {
            const bw = bImg.naturalWidth;
            const bh = bImg.naturalHeight;
            ctx.drawImage(bImg, Math.floor(x - bw / 2), Math.floor(y - bh), bw, bh);
            return;
          }
        }


        const T = KENNEY.tiles;
        if (T.complete && T.naturalWidth) {
          // Semak, batu, bunga, jamur 36x36
          const n = { bush: 124, rock: 127, flower: 125, mushroom: 128, crystal: 125 }[kind] || 124;
          ctx.drawImage(T, (n % 20) * 18, ((n / 20) | 0) * 18, 18, 18, x - 18, y - 36, 36, 36);

          // Detail tematik di atas sprite kenney sesuai musim
          if (season === 3) {
            // Salju menumpuk di atas semak & batu saat musim dingin
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x - 12, y - 38, 24, 4);
            ctx.fillRect(x - 6, y - 40, 12, 3);
          } else if (season === 2) {
            // Nuansa rona daun gugur di semak
            ctx.fillStyle = 'rgba(234, 88, 12, 0.4)';
            ctx.fillRect(x - 14, y - 32, 28, 14);
          } else if (season === 0) {
            // Bunga sakura kecil di semak semi
            ctx.fillStyle = '#f472b6';
            ctx.fillRect(x - 6, y - 28, 3, 3);
            ctx.fillRect(x + 4, y - 24, 3, 3);
          }
          return;
        }

        // Fallback procedural scenery jika tilesheet Kenney belum termuat
        if (kind === 'bush') {
          ctx.fillStyle = 'rgba(0,0,0,0.1)';
          ctx.fillRect(x - 2, y - 2, 32, 4);
          const bColors = [
            ['#1a5c32', '#27764a', '#3da864', '#f472b6'], // Semi
            ['#14532d', '#15803d', '#22c55e', '#ef4444'], // Panas
            ['#7c2d12', '#c2410c', '#f97316', '#fbbf24'], // Gugur
            ['#1e293b', '#334155', '#64748b', '#ffffff']  // Dingin
          ][season] || ['#1a5c32', '#27764a', '#3da864', '#f87171'];

          ctx.fillStyle = bColors[0];
          ctx.fillRect(x, y - 14, 28, 14);
          ctx.fillStyle = bColors[1];
          ctx.fillRect(x + 2, y - 18, 24, 8);
          ctx.fillStyle = bColors[2];
          ctx.fillRect(x + 6, y - 22, 16, 6);
          ctx.fillStyle = bColors[3];
          ctx.fillRect(x + 6, y - 10, 3, 3);
          ctx.fillRect(x + 18, y - 12, 3, 3);

        } else if (kind === 'rock') {
          ctx.fillStyle = '#475569';
          ctx.fillRect(x + 2, y - 14, 18, 14);
          ctx.fillRect(x + 4, y - 18, 14, 6);
          ctx.fillStyle = '#64748b';
          ctx.fillRect(x + 4, y - 16, 10, 10);
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(x + 6, y - 16, 6, 4);
          ctx.fillStyle = '#334155';
          ctx.fillRect(x + 14, y - 14, 4, 10);
          if (season === 3) {
            // Tumpukan salju di atas batu
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x + 4, y - 20, 14, 3);
          } else if (season === 2) {
            // Lumut oranye musim gugur
            ctx.fillStyle = '#d97706';
            ctx.fillRect(x + 4, y - 18, 4, 2);
          } else {
            // Lumut hijau segar
            ctx.fillStyle = '#22c55e';
            ctx.fillRect(x + 4, y - 18, 4, 2);
          }

        } else if (kind === 'flower') {
          ctx.fillStyle = '#2d6a4f';
          ctx.fillRect(x + 4, y - 10, 2, 10);
          ctx.fillRect(x + 12, y - 14, 2, 14);
          const fCol = season === 0 ? '#f472b6' : (season === 2 ? '#ea580c' : (season === 3 ? '#93c5fd' : '#f59e0b'));
          ctx.fillStyle = fCol;
          ctx.fillRect(x + 2, y - 13, 6, 4);
          ctx.fillRect(x + 10, y - 17, 6, 4);

        } else if (kind === 'mushroom') {
          ctx.fillStyle = '#e2e8f0';
          ctx.fillRect(x + 6, y - 8, 6, 8);
          ctx.fillStyle = season === 2 ? '#b45309' : (season === 3 ? '#38bdf8' : '#dc2626');
          ctx.fillRect(x + 2, y - 16, 14, 8);
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x + 5, y - 16, 2, 2);
          ctx.fillRect(x + 11, y - 15, 2, 2);

        } else if (kind === 'crystal') {
          ctx.fillStyle = '#312e81';
          ctx.fillRect(x + 3, y - 2, 12, 2);
          ctx.fillStyle = season === 3 ? '#38bdf8' : '#7c3aed';
          ctx.fillRect(x + 5, y - 18, 6, 18);
          ctx.fillStyle = season === 3 ? '#e0f2fe' : '#ede9fe';
          ctx.fillRect(x + 6, y - 16, 2, 6);
        }
      }

      _drawPlatform(ctx, x, y, w, h, type, isLeftCliff = false, isRightCliff = false, season = 0) {

        const T = KENNEY.tiles;
        if (T.complete && T.naturalWidth) {
          const tile = (n, dx, dy, tw = 18, th = 18) => ctx.drawImage(T, (n % 20) * 18, ((n / 20) | 0) * 18, tw, th, dx, dy, tw, th);
          if (type === 'ground') {
            if (!this._dirtPat) {
              const cv = document.createElement('canvas');
              cv.width = 32; cv.height = 36;
              const c2 = cv.getContext('2d');
              for (let r = 0; r < 2; r++) for (let c = 0; c < 2; c++) {
                const n = (r + c) % 2 ? 24 : 25;
                c2.drawImage(T, (n % 20) * 18, ((n / 20) | 0) * 18, 16, 18, c * 16, r * 18, 16, 18);
              }
              this._dirtPat = ctx.createPattern(cv, 'repeat');
            }
            ctx.save();
            ctx.translate(x, y);
            ctx.fillStyle = this._dirtPat;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();

            // Lapisan rumput permukaan atas (tidak akan terulang di dalam tanah)
            for (let bx = 0; bx < w; bx += 16) {
              const tw = Math.min(16, w - bx);
              ctx.drawImage(T, (22 % 20) * 18, ((22 / 20) | 0) * 18, tw, 18, x + bx, y, tw, 18);
            }

            // Overlay border jurang (cliff edges)
            if (isLeftCliff) {
              tile(21, x, y, 18, Math.min(18, h));
              for (let by = 18; by < h; by += 18) {
                tile(121, x, y + by, 18, Math.min(18, h - by));
              }
            }
            if (isRightCliff) {
              const rx = x + w - 18;
              tile(23, rx, y, 18, Math.min(18, h));
              for (let by = 18; by < h; by += 18) {
                tile(123, rx, y + by, 18, Math.min(18, h - by));
              }
            }

            // Overlay Karpet Permukaan 4 Musim di atas Ground Kenney
            if (season === 3) {
              // ❄️ Musim Dingin: Selimut salju putih murni di atas tanah & pinggir tebing
              ctx.fillStyle = '#f8fafc';
              ctx.fillRect(x, y, w, 4);
              ctx.fillStyle = '#cbd5e1';
              ctx.fillRect(x, y + 4, w, 1);
              if (isLeftCliff) {
                ctx.fillStyle = '#f8fafc';
                ctx.fillRect(x - 1, y, 3, 5);
              }
              if (isRightCliff) {
                ctx.fillStyle = '#f8fafc';
                ctx.fillRect(x + w - 2, y, 3, 5);
              }
            } else if (season === 2) {
              // 🍂 Musim Gugur: Rona rumput kering keemasan
              ctx.fillStyle = 'rgba(217, 119, 6, 0.32)';
              ctx.fillRect(x, y, w, 5);
              ctx.fillStyle = 'rgba(180, 83, 9, 0.38)';
              ctx.fillRect(x, y + 4, w, 2);
            } else if (season === 0) {
              // 🌸 Musim Semi: Kilauan rumput segar dengan taburan kelopak sakura
              ctx.fillStyle = 'rgba(244, 114, 182, 0.18)';
              ctx.fillRect(x, y, w, 4);
              ctx.fillStyle = '#f472b6';
              for (let sx = x + 8; sx < x + w - 8; sx += 32) {
                ctx.fillRect(sx, y + 1, 3, 2);
              }
            }
          } else if (type === 'moving') {
            for (let bx = 0; bx < w; bx += 18) {
              const tw = Math.min(18, w - bx);
              tile(29, x + bx, y, tw);
            }
          } else {
            // Elevated wooden platform (tile 48 = left cap, 49 = middle, 50 = right cap)
            tile(48, x, y, 18);
            const midEnd = Math.max(18, w - 18);
            for (let bx = 18; bx < midEnd; bx += 18) {
              const tw = Math.min(18, midEnd - bx);
              tile(49, x + bx, y, tw);
            }
            if (w >= 18) {
              tile(50, x + w - 18, y, 18);
            }
            // Detail musiman di atas platform kayu
            if (season === 3) {
              ctx.fillStyle = 'rgba(248, 250, 252, 0.85)';
              ctx.fillRect(x, y, w, 2);
            } else if (season === 2) {
              ctx.fillStyle = '#ea580c';
              for (let lx = x + 10; lx < x + w - 8; lx += 28) {
                ctx.fillRect(lx, y + 1, 3, 2);
              }
            }
          }
          return;
        }
        if (type === 'ground') {
          // Underground dirt layers
          ctx.fillStyle = '#6b3e26';
          ctx.fillRect(x, y + 12, w, h - 12);
          ctx.fillStyle = '#5c3420';
          ctx.fillRect(x, y + 24, w, h - 24);
          // Rock speckle texture
          ctx.fillStyle = '#4a2c1a';
          for (let px = x + 6; px < x + w - 8; px += 24) {
            ctx.fillRect(px, y + 18, 8, 5);
            ctx.fillRect(px + 10, y + 32, 6, 4);
            ctx.fillRect(px + 4, y + 44, 10, 4);
          }
          // Small embedded stones
          ctx.fillStyle = '#78603d';
          for (let px = x + 14; px < x + w - 14; px += 36) {
            ctx.fillRect(px, y + 26, 5, 4);
            ctx.fillRect(px + 16, y + 38, 4, 3);
          }
          // Grass top layer
          if (season === 3) {
            // Salju musim dingin
            ctx.fillStyle = '#cbd5e1';
            ctx.fillRect(x, y + 2, w, 8);
            ctx.fillStyle = '#f8fafc';
            ctx.fillRect(x, y, w, 5);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(x, y - 2, w, 3);
          } else if (season === 2) {
            // Rumput kering musim gugur
            ctx.fillStyle = '#9a3412';
            ctx.fillRect(x, y + 3, w, 9);
            ctx.fillStyle = '#ea580c';
            ctx.fillRect(x, y, w, 5);
            ctx.fillStyle = '#f59e0b';
            ctx.fillRect(x, y, w, 2);
          } else {
            // Musim semi / panas
            ctx.fillStyle = '#2d8c3e';
            ctx.fillRect(x, y + 3, w, 9);
            ctx.fillStyle = '#38b000';
            ctx.fillRect(x, y, w, 5);
            ctx.fillStyle = season === 0 ? '#86efac' : '#70e000';
            ctx.fillRect(x, y, w, 2);
          }
          // Grass blades sticking up
          if (season !== 3) {
            ctx.fillStyle = season === 2 ? '#f59e0b' : '#52d982';
            for (let gx = x + 3; gx < x + w - 4; gx += 12) {
              ctx.fillRect(gx, y - 3, 2, 4);
              ctx.fillRect(gx + 5, y - 2, 2, 3);
            }
          }
          // Grass edge shadow
          ctx.fillStyle = 'rgba(0,0,0,0.08)';
          ctx.fillRect(x, y + 10, w, 3);

          // Cliff borders bordering chasms (procedural fallback)
          if (isLeftCliff) {
            ctx.fillStyle = '#3c2214';
            ctx.fillRect(x, y, 3, h);
            ctx.fillStyle = '#2d8c3e';
            ctx.fillRect(x - 1, y, 3, 5);
          }
          if (isRightCliff) {
            ctx.fillStyle = '#3c2214';
            ctx.fillRect(x + w - 3, y, 3, h);
            ctx.fillStyle = '#2d8c3e';
            ctx.fillRect(x + w - 2, y, 3, 5);
          }

        } else if (type === 'brick') {
          // Brick platform body
          ctx.fillStyle = '#a0571a';
          ctx.fillRect(x, y, w, h);
          // Top edge highlight
          ctx.fillStyle = '#d4882e';
          ctx.fillRect(x, y, w, 3);
          ctx.fillStyle = '#e6a844';
          ctx.fillRect(x + 1, y, w - 2, 1);
          // Bottom edge shadow
          ctx.fillStyle = '#6b3a10';
          ctx.fillRect(x, y + h - 2, w, 2);
          // Brick pattern with mortar lines
          ctx.fillStyle = '#7a4412';
          const brickW = 18;
          const brickH = Math.max(6, Math.floor(h / 2) - 1);
          for (let by = y + 3; by < y + h - 2; by += brickH + 2) {
            const rowOff = (Math.floor((by - y) / (brickH + 2)) % 2) * (brickW / 2);
            for (let bx = x + rowOff; bx < x + w; bx += brickW + 2) {
              const bw = Math.min(brickW, x + w - bx);
              if (bw < 4) continue;
              ctx.fillRect(bx, by, bw, brickH);
            }
          }
          // Mortar color
          ctx.fillStyle = '#c4883c';
          for (let by = y + 3 + brickH; by < y + h - 2; by += brickH + 2) {
            ctx.fillRect(x, by, w, 2);
          }

        } else if (type === 'moving') {
          // Moving platform body
          ctx.fillStyle = '#2563eb';
          ctx.fillRect(x, y, w, h);
          // Metallic top
          ctx.fillStyle = '#60a5fa';
          ctx.fillRect(x, y, w, 3);
          ctx.fillStyle = '#93c5fd';
          ctx.fillRect(x + 1, y, w - 2, 1);
          // Rivets / bolts
          ctx.fillStyle = '#1e40af';
          ctx.fillRect(x + 3, y + h - 3, 3, 2);
          ctx.fillRect(x + w - 6, y + h - 3, 3, 2);
          // Center arrow indicator
          ctx.fillStyle = '#bfdbfe';
          const cx = x + Math.floor(w / 2);
          ctx.fillRect(cx - 4, y + Math.floor(h / 2) - 1, 8, 2);
          ctx.fillRect(cx + 2, y + Math.floor(h / 2) - 3, 2, 2);
          ctx.fillRect(cx + 2, y + Math.floor(h / 2) + 1, 2, 2);
          // Bottom shadow
          ctx.fillStyle = '#1d4ed8';
          ctx.fillRect(x, y + h - 2, w, 2);
        }
      }

      _drawCoin(ctx, x, y, special, time) {
        const T = KENNEY.tiles;
        if (T.complete && T.naturalWidth) {
          // Kenney: koin (151 depan, 152 samping), koin spesial = permata biru (67)
          const n = special ? 67 : [151, 152, 152, 151][Math.floor(time * 8) % 4];
          // diperbesar 1.5x (27px), dipusatkan pada hitbox 16x16
          ctx.drawImage(T, (n % 20) * 18, ((n / 20) | 0) * 18, 18, 18, x - 5, y - 5, 27, 27);
          return;
        }
        const frame = Math.floor(time * 8) % 4;
        const widths = [12, 8, 4, 8];
        const w = widths[frame];
        const offsetX = Math.floor((16 - w) / 2);
        const cx = x + offsetX;

        if (special) {
          // Special coin (diamond-like)
          ctx.fillStyle = '#be185d';
          ctx.fillRect(cx, y + 2, w, 12);
          ctx.fillStyle = '#f472b6';
          ctx.fillRect(cx, y, w, 4);
          ctx.fillStyle = '#fda4af';
          if (w > 4) ctx.fillRect(cx + 1, y + 1, Math.max(1, w - 4), 2);
          // Sparkle
          ctx.fillStyle = '#fff';
          if (frame === 0) ctx.fillRect(cx + 1, y + 3, 2, 2);
          // Glow
          ctx.fillStyle = 'rgba(244, 114, 182, 0.2)';
          ctx.fillRect(x - 2, y - 2, 20, 20);
        } else {
          // Normal coin
          ctx.fillStyle = '#c98a1a';
          ctx.fillRect(cx, y + 1, w, 14);
          ctx.fillStyle = '#eab308';
          ctx.fillRect(cx, y, w, 13);
          ctx.fillStyle = '#facc15';
          if (w > 6) {
            ctx.fillRect(cx + 1, y + 1, w - 3, 5);
          }
          // Inner circle/mark
          ctx.fillStyle = '#a16207';
          if (w > 6) {
            ctx.fillRect(cx + Math.floor(w / 2) - 1, y + 5, 2, 5);
            ctx.fillRect(cx + Math.floor(w / 2) - 2, y + 6, 4, 1);
            ctx.fillRect(cx + Math.floor(w / 2) - 2, y + 8, 4, 1);
          }
          // Highlight shine
          ctx.fillStyle = '#fef08a';
          if (w > 4) ctx.fillRect(cx + 1, y + 1, 2, 2);
        }
      }

      _drawPowerup(ctx, x, y, type, time) {
        const bob = Math.floor(Math.sin(time * 4) * 3);
        const py = y + bob;

        const imgKey = type === 'mushroom' ? 'mushroom_super' : (type === 'shield' ? 'shield_melon' : (type === 'magnet' ? 'magnet_pineapple' : 'life_apple'));
        const img = ITEMS[imgKey];
        if (img && img.complete && img.naturalWidth) {
          const fr = Math.floor(time * 16) % 17;
          const auraColor = type === 'mushroom' ? 'rgba(239, 68, 68, 0.28)' : (type === 'shield' ? 'rgba(56, 189, 248, 0.22)' : (type === 'magnet' ? 'rgba(168, 85, 247, 0.22)' : 'rgba(34, 197, 94, 0.22)'));
          ctx.fillStyle = auraColor;
          ctx.beginPath();
          ctx.arc(x + 10, py + 10, 16, 0, Math.PI * 2);
          ctx.fill();

          ctx.drawImage(img, fr * 32, 0, 32, 32, x - 6, py - 6, 32, 32);
          return;
        }

        const T = KENNEY.tiles;
        if (T.complete && T.naturalWidth) {
          // Kenney: mushroom = jamur merah (107), shield = kotak bulat (11), magnet = kotak "!" (10), life = hati (44)
          const n = { mushroom: 107, shield: 11, magnet: 10, life: 44 }[type];
          ctx.drawImage(T, (n % 20) * 18, ((n / 20) | 0) * 18, 18, 18, x - 4, py - 4, 27, 27);
          return;
        }
        // Shared glowing aura
        const auraPulse = Math.sin(time * 6) * 0.08 + 0.12;

        if (type === 'mushroom') {
          ctx.fillStyle = `rgba(239, 68, 68, ${auraPulse})`;
          ctx.fillRect(x - 3, py - 3, 26, 26);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(x + 3, py + 4, 14, 10);
          ctx.fillStyle = '#fef3c7';
          ctx.fillRect(x + 6, py + 14, 8, 6);
          return;
        } else if (type === 'shield') {
          ctx.fillStyle = `rgba(56, 189, 248, ${auraPulse})`;
          ctx.fillRect(x - 3, py - 3, 26, 26);
          // Box body
          ctx.fillStyle = '#0369a1';
          ctx.fillRect(x, py, 20, 20);
          ctx.fillStyle = '#0284c7';
          ctx.fillRect(x + 1, py + 1, 18, 18);
          ctx.fillStyle = '#0ea5e9';
          ctx.fillRect(x + 2, py + 2, 16, 8);
          // Shield icon
          ctx.fillStyle = '#f0f9ff';
          ctx.fillRect(x + 6, py + 4, 8, 12);
          ctx.fillRect(x + 4, py + 4, 12, 6);
          ctx.fillRect(x + 7, py + 14, 6, 2);
          ctx.fillRect(x + 8, py + 16, 4, 1);
          // Highlight
          ctx.fillStyle = '#7dd3fc';
          ctx.fillRect(x + 2, py + 1, 6, 1);

        } else if (type === 'magnet') {
          ctx.fillStyle = `rgba(168, 85, 247, ${auraPulse})`;
          ctx.fillRect(x - 3, py - 3, 26, 26);
          // Box body
          ctx.fillStyle = '#7e22ce';
          ctx.fillRect(x, py, 20, 20);
          ctx.fillStyle = '#9333ea';
          ctx.fillRect(x + 1, py + 1, 18, 18);
          ctx.fillStyle = '#a855f7';
          ctx.fillRect(x + 2, py + 2, 16, 8);
          // U-magnet icon
          ctx.fillStyle = '#f0f9ff';
          ctx.fillRect(x + 4, py + 5, 4, 11);
          ctx.fillRect(x + 12, py + 5, 4, 11);
          ctx.fillRect(x + 4, py + 13, 12, 3);
          // Red/blue poles
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(x + 4, py + 5, 4, 3);
          ctx.fillStyle = '#3b82f6';
          ctx.fillRect(x + 12, py + 5, 4, 3);
          // Highlight
          ctx.fillStyle = '#c084fc';
          ctx.fillRect(x + 2, py + 1, 6, 1);

        } else {
          // Extra Life
          ctx.fillStyle = `rgba(248, 113, 113, ${auraPulse})`;
          ctx.fillRect(x - 3, py - 3, 26, 26);
          // Box body
          ctx.fillStyle = '#b91c1c';
          ctx.fillRect(x, py, 20, 20);
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(x + 1, py + 1, 18, 18);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(x + 2, py + 2, 16, 8);
          // Heart icon
          ctx.fillStyle = '#fecdd3';
          ctx.fillRect(x + 5, py + 6, 4, 4);
          ctx.fillRect(x + 11, py + 6, 4, 4);
          ctx.fillRect(x + 4, py + 8, 12, 4);
          ctx.fillRect(x + 5, py + 12, 10, 2);
          ctx.fillRect(x + 7, py + 14, 6, 2);
          ctx.fillRect(x + 8, py + 16, 4, 1);
          // Highlight
          ctx.fillStyle = '#fca5a5';
          ctx.fillRect(x + 2, py + 1, 6, 1);
        }
      }

      _drawEnemy(ctx, x, y, en, time) {
        const C = KENNEY.chars;
        if (C.complete && C.naturalWidth) {
          // Kenney: walker (18/19), jumper (15/16), flyer (24-26), bee (13/14), tank (21-23)
          const t = Math.floor(time * 6);
          let n = 18 + (t & 1);
          if (en.type === 'jumper') {
            n = en.vy < -50 ? 16 : 15;
          } else if (en.type === 'flyer') {
            n = [24, 25, 26, 25][t & 3];
          } else if (en.type === 'bee') {
            n = 13 + (Math.floor(time * 12) & 1);
          } else if (en.type === 'tank') {
            n = 21 + (Math.floor(time * 4) % 3);
          }

          ctx.save();
          // Karakter Kenney bawaan menghadap ke kiri.
          // Jika en.vx > 0 (bergerak ke kanan), lakukan horizontal flip agar menghadap arah jalan!
          const isFlipped = en.vx > 0;
          if (isFlipped) {
            ctx.translate(x + en.w, 0);
            ctx.scale(-1, 1);
          }

          // Efek hit flash (kedip terang saat terkena injakan)
          if (en.hitTimer > 0 && (Math.floor(time * 28) & 1)) {
            ctx.filter = 'brightness(2.2)';
          }

          if (en.type === 'tank') {
            const sprX = isFlipped ? -12 : x - 12;
            ctx.drawImage(C, (n % 9) * 24, ((n / 9) | 0) * 24, 24, 24, sprX, y - 24, 56, 56);
          } else if (en.type === 'bee') {
            const sprX = isFlipped ? -10 : x - 10;
            ctx.drawImage(C, (n % 9) * 24, ((n / 9) | 0) * 24, 24, 24, sprX, y - 10, 44, 44);
          } else {
            const sprX = isFlipped ? -12 : x - 12;
            ctx.drawImage(C, (n % 9) * 24, ((n / 9) | 0) * 24, 24, 24, sprX, y - 24, 48, 48);
          }
          ctx.restore();

          // HP Bar Mini untuk Tank Robot saat HP tersisa < 3
          if (en.type === 'tank' && en.maxHp > 1 && en.hp < en.maxHp && !en.defeated) {
            const barW = 32, barH = 4;
            const barX = x + Math.round((en.w - barW) / 2);
            const barY = y - 16;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
            ctx.fillRect(barX - 1, barY - 1, barW + 2, barH + 2);
            const ratio = Math.max(0, en.hp / en.maxHp);
            ctx.fillStyle = ratio > 0.5 ? '#22c55e' : (ratio > 0.25 ? '#f59e0b' : '#ef4444');
            ctx.fillRect(barX, barY, Math.round(barW * ratio), barH);
          }
          return;
        }
        if (en.type === 'walker') {
          // Angry slime creature
          const squash = Math.sin(time * 8) * 1.5;
          const bh = 16 + Math.floor(squash);
          const bw = 22 - Math.floor(squash);
          const ox = Math.floor((24 - bw) / 2);
          const oy = 24 - bh;

          // Body shadow
          ctx.fillStyle = 'rgba(0,0,0,0.12)';
          ctx.fillRect(x + ox + 2, y + 22, bw - 2, 4);

          // Main body
          ctx.fillStyle = '#b91c1c';
          ctx.fillRect(x + ox, y + oy, bw, bh);
          // Rounded top
          ctx.fillStyle = '#dc2626';
          ctx.fillRect(x + ox + 2, y + oy - 2, bw - 4, 4);
          ctx.fillRect(x + ox, y + oy + 2, bw, bh - 6);
          // Highlight
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(x + ox + 2, y + oy, bw - 6, Math.floor(bh * 0.4));
          // Belly
          ctx.fillStyle = '#fca5a5';
          ctx.fillRect(x + ox + 4, y + oy + Math.floor(bh * 0.55), bw - 8, Math.floor(bh * 0.25));

          // Angry eyes
          const eyeY = y + oy + 4;
          ctx.fillStyle = '#fff';
          ctx.fillRect(x + ox + 3, eyeY, 6, 5);
          ctx.fillRect(x + ox + bw - 9, eyeY, 6, 5);
          // Pupils
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(x + ox + 5, eyeY + 2, 3, 3);
          ctx.fillRect(x + ox + bw - 7, eyeY + 2, 3, 3);
          // Angry brow
          ctx.fillStyle = '#7f1d1d';
          ctx.fillRect(x + ox + 2, eyeY - 2, 6, 2);
          ctx.fillRect(x + ox + bw - 8, eyeY - 2, 6, 2);
          // Mouth
          ctx.fillStyle = '#7f1d1d';
          ctx.fillRect(x + ox + 5, y + oy + bh - 6, bw - 10, 2);

          // Walking feet
          const step = Math.floor(time * 10) % 2;
          ctx.fillStyle = '#991b1b';
          ctx.fillRect(x + ox + 2, y + 22, 5, 3 - step);
          ctx.fillRect(x + ox + bw - 7, y + 22, 5, 2 + step);

        } else if (en.type === 'jumper') {
          // Mechanical frog/spring bot
          const stretch = en.vy < -50 ? 4 : 0;

          // Spring base
          ctx.fillStyle = '#94a3b8';
          ctx.fillRect(x + 6, y + 16 + stretch, 12, 8 - stretch);
          ctx.fillStyle = '#cbd5e1';
          for (let sy = y + 17 + stretch; sy < y + 24; sy += 3) {
            ctx.fillRect(x + 7, sy, 10, 1);
          }

          // Body
          ctx.fillStyle = '#6d28d9';
          ctx.fillRect(x + 2, y - stretch, 20, 18);
          ctx.fillStyle = '#7c3aed';
          ctx.fillRect(x + 3, y + 1 - stretch, 18, 14);
          ctx.fillStyle = '#8b5cf6';
          ctx.fillRect(x + 4, y + 2 - stretch, 14, 6);
          // Head dome
          ctx.fillStyle = '#a78bfa';
          ctx.fillRect(x + 6, y - 2 - stretch, 12, 4);

          // Eyes (visor)
          ctx.fillStyle = '#00f5d4';
          ctx.fillRect(x + 5, y + 5 - stretch, 5, 4);
          ctx.fillRect(x + 14, y + 5 - stretch, 5, 4);
          // Pupil dots
          ctx.fillStyle = '#0d9488';
          ctx.fillRect(x + 7, y + 6 - stretch, 2, 2);
          ctx.fillRect(x + 16, y + 6 - stretch, 2, 2);

          // Antenna
          ctx.fillStyle = '#c4b5fd';
          ctx.fillRect(x + 11, y - 6 - stretch, 2, 5);
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(x + 10, y - 8 - stretch, 4, 3);

        } else if (en.type === 'flyer') {
          // Flying drone
          const wingAngle = Math.sin(time * 20);
          const wingOffset = Math.floor(wingAngle * 5);
          const tilt = Math.floor(Math.sin(time * 3) * 1);

          // Shadow below
          ctx.fillStyle = 'rgba(0,0,0,0.1)';
          ctx.fillRect(x + 4, y + 22, 16, 3);

          // Wings / rotors
          ctx.fillStyle = 'rgba(255,255,255,0.6)';
          ctx.fillRect(x - 4, y + 4 + wingOffset + tilt, 8, 3);
          ctx.fillRect(x + 20, y + 4 - wingOffset + tilt, 8, 3);
          ctx.fillStyle = 'rgba(255,255,255,0.3)';
          ctx.fillRect(x - 6, y + 5 + wingOffset + tilt, 12, 1);
          ctx.fillRect(x + 18, y + 5 - wingOffset + tilt, 12, 1);

          // Body
          ctx.fillStyle = '#c2410c';
          ctx.fillRect(x + 4, y + 4, 16, 14);
          ctx.fillStyle = '#ea580c';
          ctx.fillRect(x + 5, y + 5, 14, 12);
          ctx.fillStyle = '#f97316';
          ctx.fillRect(x + 6, y + 5, 10, 5);

          // Red eye/sensor
          ctx.fillStyle = '#fef2f2';
          ctx.fillRect(x + 8, y + 8, 8, 5);
          ctx.fillStyle = '#ef4444';
          ctx.fillRect(x + 9, y + 9, 6, 3);
          const blink = Math.sin(time * 5) > 0.7;
          if (blink) {
            ctx.fillStyle = '#fca5a5';
            ctx.fillRect(x + 10, y + 10, 4, 1);
          }

          // Bottom thruster
          ctx.fillStyle = '#78350f';
          ctx.fillRect(x + 8, y + 17, 8, 3);
          // Exhaust flame
          const flicker = Math.floor(time * 20) % 2;
          ctx.fillStyle = '#fbbf24';
          ctx.fillRect(x + 9, y + 20, 6, 2 + flicker);
          ctx.fillStyle = '#f97316';
          ctx.fillRect(x + 10, y + 22 + flicker, 4, 1);
        } else if (en.type === 'tank') {
          // Fallback robot tank
          ctx.fillStyle = '#1e3a8a';
          ctx.fillRect(x + 2, y + 4, 28, 26);
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(x + 6, y + 8, 10, 8);
          ctx.fillStyle = '#0f172a';
          ctx.fillRect(x + 4, y + 26, 24, 6);
        } else if (en.type === 'bee') {
          // Fallback lebah
          ctx.fillStyle = '#eab308';
          ctx.fillRect(x + 4, y + 4, 16, 16);
          ctx.fillStyle = '#000';
          ctx.fillRect(x + 8, y + 4, 4, 16);
          ctx.fillStyle = '#bae6fd';
          ctx.fillRect(x + 6, y - 2, 10, 4);
        }
      }

      _drawKenneyBackground(ctx, themeIdx, camX, W, H) {
        // Latar Kenney: 3 bioma di bg.png (x, lebar) = biru 96px, oranye 48px, hijau 48px; tinggi 72, diperbesar 6x
        const [sx, sw] = [[0, 96], [96, 48], [144, 48]][themeIdx] || [0, 96];
        const bw = sw * 6, by = H - 432;
        ctx.drawImage(KENNEY.bg, sx, 0, sw, 1, 0, 0, W, by + 1);
        const shift = ((camX * 0.25) % bw + bw) % bw;
        for (let bx = -Math.floor(shift); bx < W; bx += bw) {
          ctx.drawImage(KENNEY.bg, sx, 0, sw, 72, bx, by, bw, 432);
        }
      }

      _drawWeather(ctx, camX, time, seasonIndex) {
        const W = CONFIG.CANVAS_WIDTH;
        const H = CONFIG.CANVAS_HEIGHT;

        if (seasonIndex === 0) {
          // 🌸 MUSIM SEMI: Kelopak Bunga Sakura Berguguran (Cherry Blossom Petals Drift)
          ctx.save();
          for (let i = 0; i < 28; i++) {
            const speedX = 40 + (i % 4) * 12;
            const speedY = 30 + (i % 3) * 15;
            const px = ((i * 47 + time * speedX - camX * 0.35) % (W + 60) + W + 60) % (W + 60) - 30;
            const py = ((i * 31 + time * speedY + Math.sin(time * 2.8 + i) * 18) % (H + 40) + H + 40) % (H + 40) - 20;
            const rot = time * 2.2 + i * 1.5;

            ctx.save();
            ctx.translate(px, py);
            ctx.rotate(rot);
            // Kelopak sakura berbentuk oval/titik bunga
            ctx.fillStyle = (i % 3 === 0) ? '#fbcfe8' : ((i % 3 === 1) ? '#f472b6' : '#ec4899');
            ctx.globalAlpha = 0.75 + Math.sin(time * 3 + i) * 0.2;
            ctx.fillRect(-2, -3, 4, 6);
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, -1, 2, 2);
            ctx.restore();
          }
          // Dandelion seed / serbuk sari berkilau
          ctx.fillStyle = 'rgba(254, 240, 138, 0.7)';
          for (let i = 0; i < 12; i++) {
            const dx = ((i * 73 + time * 25 - camX * 0.2) % (W + 40) + W + 40) % (W + 40) - 20;
            const dy = 80 + Math.floor(Math.sin(time * 1.8 + i) * 25) + (i * 22) % 200;
            ctx.fillRect(dx, dy, 2, 2);
          }
          ctx.restore();

        } else if (seasonIndex === 1) {
          // ☀️ MUSIM PANAS: Kunang-Kunang Emas (Fireflies) & Gerimis Rintik Segar
          ctx.save();
          // Kunang-kunang hangat musim panas
          ctx.fillStyle = '#fbbf24';
          for (let i = 0; i < 22; i++) {
            const ex = Math.floor((i * 47 + 23 - camX * 0.25) % (W + 60));
            const ey = 380 - Math.floor((time * 22 + i * 29) % 260);
            const flicker = Math.sin(time * 4.5 + i * 2.1);
            if (flicker > -0.2) {
              ctx.globalAlpha = Math.max(0.18, (flicker + 1) * 0.42);
              ctx.fillRect(ex, ey, 2, 2);
              if (i % 3 === 0) {
                ctx.fillStyle = '#f97316';
                ctx.fillRect(ex - 1, ey + 1, 3, 2);
                ctx.fillStyle = '#fbbf24';
              }
            }
          }
          // Sinar matahari kemilau (sunbeam motes)
          ctx.fillStyle = 'rgba(254, 243, 199, 0.55)';
          for (let i = 0; i < 14; i++) {
            const mx = ((i * 61 + time * 18 - camX * 0.2) % (W + 40) + W + 40) % (W + 40) - 20;
            const my = 40 + (i * 27) % 220 + Math.sin(time * 1.5 + i) * 15;
            ctx.fillRect(mx, my, 2, 3);
          }
          ctx.restore();

        } else if (seasonIndex === 2) {
          // 🍂 MUSIM GUGUR: Daun Maple Berguguran Tertiup Angin (Falling Maple Leaves)
          ctx.save();
          const leafColors = ['#ea580c', '#f59e0b', '#dc2626', '#b45309', '#f97316'];
          for (let i = 0; i < 26; i++) {
            const speedX = 35 + (i % 3) * 16;
            const speedY = 40 + (i % 4) * 12;
            const sway = Math.sin(time * 2.6 + i * 1.8) * 24;
            const lx = ((i * 51 + time * speedX + sway - camX * 0.35) % (W + 80) + W + 80) % (W + 80) - 40;
            const ly = ((i * 33 + time * speedY) % (H + 40) + H + 40) % (H + 40) - 20;
            const angle = Math.sin(time * 3 + i) * 0.6;

            ctx.save();
            ctx.translate(lx, ly);
            ctx.rotate(angle);
            ctx.fillStyle = leafColors[i % leafColors.length];
            ctx.globalAlpha = 0.82;
            // Bentuk daun maple pixel
            ctx.fillRect(-3, -2, 6, 4);
            ctx.fillRect(-1, -4, 2, 8);
            ctx.fillRect(-4, -1, 8, 2);
            ctx.fillStyle = '#fef08a';
            ctx.fillRect(0, 0, 1, 1);
            ctx.restore();
          }
          ctx.restore();

        } else {
          // ❄️ MUSIM DINGIN: Hujan Salju Lembut & Kristal Es (Gentle Snowfall & Frost Mist)
          ctx.save();
          // Butiran salju putih halus melayang turun tertiup angin
          for (let i = 0; i < 42; i++) {
            const speedX = 18 + (i % 3) * 10;
            const speedY = 32 + (i % 4) * 14;
            const sway = Math.sin(time * 2.0 + i * 1.4) * 14;
            const sx = ((i * 41 + time * speedX + sway - camX * 0.3) % (W + 60) + W + 60) % (W + 60) - 30;
            const sy = ((i * 27 + time * speedY) % (H + 40) + H + 40) % (H + 40) - 20;

            const size = (i % 4 === 0) ? 3 : ((i % 4 === 1) ? 2 : 1);
            ctx.fillStyle = (i % 5 === 0) ? '#e0f2fe' : '#ffffff';
            ctx.globalAlpha = 0.65 + (i % 4) * 0.1;

            if (size === 3) {
              // Kristal salju plus-shape
              ctx.fillRect(sx, sy - 1, 1, 3);
              ctx.fillRect(sx - 1, sy, 3, 1);
            } else {
              ctx.fillRect(sx, sy, size, size);
            }
          }

          // Kabut beku dingin di dekat permukaan tanah
          ctx.fillStyle = 'rgba(226, 232, 240, 0.08)';
          ctx.fillRect(0, H - 70, W, 70);
          ctx.restore();
        }
      }

      _drawBoss(ctx, x, y, boss, time, camX = 0, camY = 0) {
        ctx.save();
        const isEnraged = boss.hp <= 1;

        // 1. Render Garis Laser Bidikan & Reticle Bahaya di Tanah saat TELEGRAPH
        if (boss.state === 'TELEGRAPH') {
          const targetScreenX = Math.floor(boss.targetX + boss.w / 2 - camX);
          const groundScreenY = Math.floor((boss.targetGroundY || 380) - camY);

          // Garis laser putus-putus berkedip
          ctx.strokeStyle = (Math.floor(time * 24) & 1) ? '#ef4444' : 'rgba(239, 68, 68, 0.35)';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 4]);
          ctx.beginPath();
          ctx.moveTo(x + boss.w / 2, y + boss.h);
          ctx.lineTo(targetScreenX, groundScreenY);
          ctx.stroke();
          ctx.setLineDash([]);

          // Lingkaran reticle bahaya merah di tanah
          ctx.fillStyle = 'rgba(239, 68, 68, 0.45)';
          ctx.beginPath();
          ctx.ellipse(targetScreenX, groundScreenY, 22, 6, 0, 0, Math.PI * 2);
          ctx.fill();
          ctx.strokeStyle = '#facc15';
          ctx.lineWidth = 1.5;
          ctx.stroke();
        }

        // 2. Efek Getar saat Charging Telegraph
        let drawX = x;
        let drawY = y;
        if (boss.state === 'TELEGRAPH') {
          drawX += (Math.random() - 0.5) * 6;
          drawY += (Math.random() - 0.5) * 3;
        }

        // 3. Efek Enraged & Hurt Flash
        if (boss.state === 'HURT') {
          // Efek berkedip terang saat terkena injakan
          if (Math.floor(time * 28) & 1) {
            ctx.filter = 'brightness(2.6)';
          }
          drawX += (Math.random() - 0.5) * 4;
        } else if (isEnraged) {
          ctx.filter = (Math.floor(time * 16) & 1) ? 'drop-shadow(0 0 10px #ef4444) hue-rotate(320deg)' : 'drop-shadow(0 0 6px #f97316)';
        }

        const C = KENNEY.chars;
        if (C.complete && C.naturalWidth) {
          // Kenney: kotak marah (tile 12) 24px diperbesar 2x -> 48x48
          ctx.drawImage(C, 3 * 24, 24, 24, 24, drawX, drawY - 6, 48, 48);
        } else {
          // Fallback box
          ctx.fillStyle = isEnraged ? '#ef4444' : '#eab308';
          ctx.fillRect(drawX, drawY, boss.w, boss.h);
        }

        // 4. Efek STUNNED (Bintang Pusing & Petunjuk Injak)
        if (boss.state === 'STUNNED') {
          const starAngle = time * 7;
          ctx.fillStyle = '#facc15';
          for (let s = 0; s < 3; s++) {
            const a = starAngle + (s * Math.PI * 2) / 3;
            const sx = drawX + boss.w / 2 + Math.cos(a) * 20;
            const sy = drawY - 8 + Math.sin(a) * 6;
            ctx.fillRect(sx - 2, sy - 2, 5, 5);
          }
          if (Math.floor(time * 8) & 1) {
            ctx.fillStyle = '#facc15';
            ctx.font = 'bold 10px monospace';
            ctx.textAlign = 'center';
            ctx.fillText('INJAK SEKARANG!', drawX + boss.w / 2, drawY - 16);
          }
        }
        ctx.restore();
      }

      _drawBossProjectiles(ctx, projectiles, camX, camY, time) {
        for (let i = 0; i < projectiles.length; i++) {
          const p = projectiles[i];
          const px = Math.floor(p.x - camX);
          const py = Math.floor(p.y - camY);

          if (p.type === 'bomb') {
            // Plasma Bomb bercahaya kuning/oranye
            ctx.fillStyle = 'rgba(249, 115, 22, 0.35)';
            ctx.beginPath();
            ctx.arc(px + 6, py + 6, 11, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = (Math.floor(time * 20) & 1) ? '#facc15' : '#ef4444';
            ctx.beginPath();
            ctx.arc(px + 6, py + 6, 6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(px + 4, py + 4, 3, 3);
          } else if (p.type === 'shockwave') {
            // Gelombang kejut listrik di atas tanah
            ctx.fillStyle = (Math.floor(time * 24) & 1) ? '#38bdf8' : '#0284c7';
            ctx.beginPath();
            ctx.moveTo(px, py + p.h);
            ctx.lineTo(px + p.w / 2, py);
            ctx.lineTo(px + p.w, py + p.h);
            ctx.closePath();
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(px + p.w / 2 - 2, py + 2, 4, 4);
          }
        }
      }

      _drawBossHP(ctx, boss) {
        const W = CONFIG.CANVAS_WIDTH;
        const barW = 160;
        const barH = 14;
        const bx = Math.floor((W - barW) / 2);
        const by = 48;

        // Background card
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
        ctx.fillRect(bx - 12, by - 6, barW + 24, barH + 18);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1;
        ctx.strokeRect(bx - 12, by - 6, barW + 24, barH + 18);

        ctx.fillStyle = '#f87171';
        ctx.font = 'bold 9px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(boss.tier ? `⚠️ TITAN DRONE MK-${boss.tier} (BOSS) ⚠️` : '⚠️ TITAN DRONE (BOSS) ⚠️', W / 2, by + 1);

        // HP fill
        ctx.fillStyle = '#334155';
        ctx.fillRect(bx, by + 4, barW, barH - 4);

        const hpRatio = Math.max(0, boss.hp / boss.maxHp);
        ctx.fillStyle = '#ef4444';
        ctx.fillRect(bx, by + 4, Math.floor(barW * hpRatio), barH - 4);
        ctx.fillStyle = '#f87171';
        ctx.fillRect(bx, by + 4, Math.floor(barW * hpRatio), 2);
      }

      _drawBossAlert(ctx, timer, time) {
        if (Math.floor(time * 6) % 2 === 0) {
          ctx.fillStyle = 'rgba(239, 68, 68, 0.12)';
          ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
        }
        ctx.save();
        ctx.fillStyle = '#facc15';
        ctx.font = 'bold 16px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000';
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
        ctx.fillText('⚠️ PERINGATAN: CYBER-TITAN MENDEKAT! ⚠️', CONFIG.CANVAS_WIDTH / 2, 80);
        ctx.restore();
      }

      _drawPlayer(ctx, x, y, player, time) {
        // Blink when invulnerable
        if (player.invulnTimer > 0 && Math.floor(time * 16) % 2 === 0) return;

        const f = player.facing;
        const skin = player.skin || 'scout';

        // Drop shadow
        if (player.onGround) {
          ctx.fillStyle = 'rgba(0,0,0,0.18)';
          ctx.fillRect(x + 2, y + player.h - 2, player.w - 4, 3);
        }

        // Sprite Pixel Adventure per skin (Mini Hero 32x32 px vs Super Hero 48x48 px)
        {
          const key = { hurt: 'Hit', jump: 'Jump', fall: 'Fall', run: 'Run', walk: 'Run' }[player.state] || 'Idle';
          const img = PLAYER_SPRITES[skin][key];
          if (img.complete && img.naturalWidth) {
            let isRenderBig = !!player.isBig;
            if (player.growTimer > 0) {
              // Animasi klasik transformasi membesar / mengecil bergantian
              if ((Math.floor(time * 24) & 1) === 0) isRenderBig = !isRenderBig;
            }
            const sprW = isRenderBig ? 48 : 32;
            const sprH = isRenderBig ? 48 : 32;
            const ox = Math.round((player.w - sprW) / 2);
            const oy = player.h - sprH;
            const fr = Math.floor(player.animTimer) % (img.naturalWidth >> 5);
            ctx.save();
            if (f < 0) {
              ctx.translate(x + player.w, 0);
              ctx.scale(-1, 1);
              ctx.drawImage(img, fr * 32, 0, 32, 32, ox, y + oy, sprW, sprH);
            } else {
              ctx.drawImage(img, fr * 32, 0, 32, 32, x + ox, y + oy, sprW, sprH);
            }
            ctx.restore();
          } else {
            // Fallback siluet minimalis jika sprite belum selesai termuat
            ctx.fillStyle = SKINS_CATALOG.find(s => s.id === skin)?.color || '#38bdf8';
            ctx.fillRect(x, y, player.w, player.h);
          }
        }

        if (player.shieldTimer > 0) {
          this._drawShieldBubble(ctx, x, y, player, time);
        }
        if (player.activeEmote) {
          this._drawPlayerEmote(ctx, x, y, player);
        }
      }

      _drawPlayerEmote(ctx, x, y, player) {
        if (!player.activeEmote || player.activeEmote.timer <= 0) return;
        const em = player.activeEmote;
        const progress = em.timer / em.maxTimer;
        const alpha = Math.min(1, progress * 3.5);

        const age = em.maxTimer - em.timer;
        const scale = age < 0.15 ? (age / 0.15) * 1.15 : (age < 0.25 ? 1.15 - ((age - 0.15) / 0.1) * 0.15 : 1.0);

        ctx.save();
        ctx.globalAlpha = alpha;

        const bx = Math.round(x + (player.w || 24) / 2);
        const by = Math.round(y - 28);

        ctx.translate(bx, by);
        ctx.scale(scale, scale);

        // Balon ucapan
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.roundRect(-16, -16, 32, 28, 8);
        ctx.fill();
        ctx.stroke();

        // Ekor balon
        ctx.beginPath();
        ctx.moveTo(-4, 12);
        ctx.lineTo(0, 18);
        ctx.lineTo(4, 12);
        ctx.closePath();
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(-4, 12);
        ctx.lineTo(0, 18);
        ctx.lineTo(4, 12);
        ctx.stroke();

        // Ikon Emoji
        ctx.font = '16px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(em.icon, 0, -2);

        ctx.restore();
      }

      _drawPeer(ctx, x, y, peer, time) {
        if (x < -80 || x > CONFIG.CANVAS_WIDTH + 80) return;
        const skin = peer.skin || 'scout';
        const sprMap = PLAYER_SPRITES[skin] || PLAYER_SPRITES['scout'];
        const isMoving = Math.abs(peer.vx || 0) > 10;
        const img = isMoving ? (sprMap['Run'] || sprMap['Idle']) : sprMap['Idle'];
        const f = peer.facing || 1;

        ctx.save();
        ctx.globalAlpha = 0.88;

        if (img && img.complete && img.naturalWidth) {
          const fr = Math.floor(time * 10) % (img.naturalWidth >> 5);
          ctx.save();
          if (f < 0) {
            ctx.translate(x + 24, 0);
            ctx.scale(-1, 1);
            ctx.drawImage(img, fr * 32, 0, 32, 32, -4, y - 8, 32, 32);
          } else {
            ctx.drawImage(img, fr * 32, 0, 32, 32, x - 4, y - 8, 32, 32);
          }
          ctx.restore();
        } else {
          ctx.fillStyle = '#38bdf8';
          ctx.fillRect(x, y, 24, 24);
        }

        // Tag Nama Pemain di atas kepala
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        const tagText = peer.name || 'HERO';
        const tagW = ctx.measureText(tagText).width + 8;
        ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
        ctx.fillRect(Math.round(x + 12 - tagW / 2), y - 18, tagW, 11);
        ctx.fillStyle = '#38bdf8';
        ctx.fillText(tagText, x + 12, y - 9);

        // Emote bubble jika peer memicu emote
        if (peer.activeEmote) {
          this._drawPlayerEmote(ctx, x, y, peer);
        }

        ctx.restore();
      }

      _drawShieldBubble(ctx, x, y, player, time) {
        if (player.shieldTimer <= 0) return;
        // Efek kedip peringatan saat perisai hampir habis (< 2.5 detik)
        if (player.shieldTimer < 2.5 && (Math.floor(time * 8) & 1) === 0) return;

        const sImg = EFFECTS.shield_bubble;
        const cx = x + player.w * 0.5;
        const cy = y + player.h * 0.5;
        const bx = Math.round(cx - 32);
        const by = Math.round(cy - 32);

        if (sImg && sImg.complete && sImg.naturalWidth) {
          const fr = Math.floor(time * 10) % 6;
          ctx.drawImage(sImg, fr * 64, 0, 64, 64, bx, by, 64, 64);
        } else {
          // Circular glow fallback jika aset gambar belum siap
          const pulse = Math.sin(time * 8) * 2;
          ctx.beginPath();
          ctx.arc(cx, cy, 26 + pulse, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(56, 189, 248, 0.25)';
          ctx.fill();
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

// Global window assignments for direct file:// compatibility
window.PixelRenderer = PixelRenderer;
