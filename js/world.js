/**
     * ============================================================================
     * 9. PROCEDURAL WORLD GENERATOR & SEGMENT MANAGER
     * (js/world-generator.js & js/world-manager.js)
     * Seeded PRNG deterministik, Physics Fairness Validator, dan Segment Lifecycle.
     * ============================================================================
     */
    class SeededRNG {
      constructor(seed) {
        this.state = seed >>> 0;
      }
      next() {
        let t = (this.state += 0x6D2B79F5);
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      }
      range(min, max) {
        return min + this.next() * (max - min);
      }
      int(min, max) {
        return Math.floor(this.range(min, max + 1));
      }
    }

    class WorldManager {
      constructor(sessionSeed = 1337) {
        this.sessionSeed = sessionSeed;
        this.segments = new Map(); // index -> Segment Object
        this.lastExitY = CONFIG.WORLD.GROUND_Y;
        this.lastPattern = -1;
        this._activePlatforms = [];
        this._activeSegments = [];
      }

      reset(newSeed) {
        this.sessionSeed = newSeed;
        this.segments.clear();
        this.lastExitY = CONFIG.WORLD.GROUND_Y;
        this.lastPattern = -1;
        this._activePlatforms.length = 0;
        this._activeSegments.length = 0;
      }

      /**
       * Menghitung jarak lompatan maksimum aktual berdasarkan rumus kinematika Physics karakter
       * untuk menjamin semua jurang dan platform selalu dapat dilewati (Fairness Validation).
       */
      computeMaxReachableGap(deltaY) {
        const P = CONFIG.PHYSICS;
        const v0 = Math.abs(P.JUMP_VELOCITY);
        const g = P.GRAVITY;
        // v0^2 - 2*g*deltaY >= 0 (deltaY positif berarti target lebih tinggi)
        const discriminant = v0 * v0 - 2 * g * deltaY;
        if (discriminant <= 0) return 60;
        const totalAirTime = (v0 + Math.sqrt(discriminant)) / g;
        const maxHoriz = P.MAX_RUN_SPEED * totalAirTime;
        return Math.floor(maxHoriz * CONFIG.WORLD.SAFE_JUMP_MARGIN);
      }

      getOrCreateSegment(index) {
        if (this.segments.has(index)) {
          const seg = this.segments.get(index);
          seg.state = 'ACTIVE';
          return seg;
        }
        const seg = this._generateSegment(index);
        this.segments.set(index, seg);
        return seg;
      }

      getSurfaceYAt(x, w = 0, defaultY = 380) {
        const segIdx = Math.floor(x / CONFIG.WORLD.SEGMENT_WIDTH);
        let foundY = null;
        for (let sIdx = segIdx - 1; sIdx <= segIdx + 1; sIdx++) {
          const seg = this.getOrCreateSegment(sIdx);
          if (!seg) continue;
          for (let i = 0; i < seg.platforms.length; i++) {
            const p = seg.platforms[i];
            if ((x + w >= p.x) && (x <= p.x + p.w)) {
              if (foundY === null || p.y < foundY) foundY = p.y;
            }
          }
        }
        return foundY !== null ? foundY : defaultY;
      }

      _generateSegment(index) {
        const W = CONFIG.WORLD.SEGMENT_WIDTH;
        const startX = index * W;
        const endX = startX + W;
        const rng = new SeededRNG(this.sessionSeed + index * 7919);

        const seg = {
          id: `seg_${index}`,
          index,
          startX,
          endX,
          state: 'ACTIVE',
          platforms: [],
          coins: [],
          enemies: [],
          powerups: [],
          scenery: []
        };

        // Segmen 0 dan -1 adalah zona aman awal
        if (index <= 0) {
          seg.platforms.push({
            x: startX, y: CONFIG.WORLD.GROUND_Y, w: W, h: 120, type: 'ground'
          });
          if (index === 0) {
            // Platform pengenalan & koin awal
            seg.platforms.push({ x: startX + 240, y: 295, w: 130, h: 18, type: 'brick', oneWay: true });
            for (let i = 0; i < 4; i++) {
              seg.coins.push({
                id: `c_${index}_${i}`, x: startX + 255 + i * 28, y: 262, w: 16, h: 16,
                special: false, collected: false
              });
            }
          }
          this._populateScenery(seg, rng);
          return seg;
        }

        // Kesulitan bertahap & Scaling Berbasis Musim (Tiap 500 Meter Berganti Season)
        // 1 segment = 640px / 32px per meter = 20 meter
        const segmentDistMeters = index * 20;
        const seasonTier = Math.floor(segmentDistMeters / 500); // 0: Semi (0-500m), 1: Panas (500-1000m), 2: Gugur (1000-1500m), 3+: Dingin (1500m+)

        // Difficulty dasar (0.05 .. 1.0) bertambah seiring jarak dan pergantian musim
        const difficulty = Math.min(1.0, Math.max(0.05, (index / 25) + seasonTier * 0.10));

        // Kapasitas musuh per segmen & jarak aman minimum antar-musuh meningkat teratur tiap musim
        let maxEnemiesPerSeg = 1;
        let minEnemyDist = 200; // Lega tapi gameplay tetap aktif & seru
        if (seasonTier === 1) {
          maxEnemiesPerSeg = 2;
          minEnemyDist = 180; // Musim 1 (Panas 500-1000m)
        } else if (seasonTier === 2) {
          maxEnemiesPerSeg = 2;
          minEnemyDist = 170; // Musim 2 (Gugur 1000-1500m)
        } else if (seasonTier >= 3) {
          maxEnemiesPerSeg = 3;
          minEnemyDist = 155; // Musim 3+ (Dingin 1500m+)
        }

        const enemySpeedMult = 1.0 + Math.min(0.50, seasonTier * 0.12);

        // Proteksi anti-numpuk lintas segmen
        const isTooCloseToAnyEnemy = (spawnX, minDistance = minEnemyDist) => {
          if (seg.enemies.some(e => Math.abs(e.x - spawnX) < minDistance)) return true;
          const prevSeg = this.segments.get(index - 1);
          if (prevSeg && prevSeg.enemies.some(e => Math.abs(e.x - spawnX) < minDistance)) return true;
          return false;
        };

        // Pilih tipe pola segmen tanpa pengulangan langsung
        let pattern = rng.int(0, 4);
        if (pattern === this.lastPattern) pattern = (pattern + 1) % 5;
        this.lastPattern = pattern;

        let cursorX = startX;
        let currentY = this.lastExitY;

        while (cursorX < endX - 110) {
          const remaining = endX - cursorX;
          const hasGap = cursorX > startX + 40 && rng.next() < (0.28 + difficulty * 0.25);

          // Pola Jurang dengan Jembatan Platform Kayu Bergerak di tengahnya
          const isMovingChasm = hasGap && remaining > 320 && rng.next() < (0.24 + difficulty * 0.28);
          if (isMovingChasm) {
            if (cursorX > startX + 30) {
              seg.scenery.push({ x: cursorX - 24, y: currentY, kind: 'sign_warning' });
            }

            // Jurang kiri, platform bergerak terisolasi di tengah, dan jurang kanan yang menantang
            const gapLeft = rng.int(65, 82);
            const mPlatW = rng.int(4, 5) * 18; // 72px atau 90px (kompak & pas)
            const gapRight = rng.int(68, 88); // Jurang kanan nyata ke tanah berikutnya!

            const nextStepUp = 55;
            const nextY = Math.max(260, Math.min(CONFIG.WORLD.GROUND_Y, currentY + rng.int(-nextStepUp, 40)));
            const platX = cursorX + gapLeft;
            const platY = Math.max(260, Math.min(340, Math.floor((currentY + nextY) * 0.5)));

            const moveAxis = rng.next() < 0.5 ? 'x' : 'y';
            const moveRange = moveAxis === 'x' ? rng.int(20, 28) : rng.int(35, 50);
            const moveSpeed = rng.range(1.4, 2.0);

            // Platform bergerak modular kayu
            seg.platforms.push({
              x: platX,
              y: platY,
              w: mPlatW,
              h: 20,
              type: 'moving',
              oneWay: true,
              baseX: platX,
              baseY: platY,
              moveRange,
              moveSpeed,
              moveAxis,
              phase: rng.range(0, Math.PI * 2),
              dx: 0,
              dy: 0
            });

            // Koin hadiah di atas platform bergerak
            const mCoins = mPlatW >= 90 ? 3 : 2;
            for (let c = 0; c < mCoins; c++) {
              seg.coins.push({
                id: `c_mov_${index}_${platX}_${c}`,
                x: platX + 16 + c * 26,
                y: platY - 26,
                w: 16, h: 16,
                special: c === 1 && rng.next() < 0.35,
                collected: false
              });
            }

            // Musuh di jurang bergerak: maksimal 1 musuh saja (antara flyer di jurang ATAU walker di tanah seberang - Mutual Exclusion)
            let chasmHasEnemy = false;
            if (seg.enemies.length < maxEnemiesPerSeg && seasonTier >= 1 && rng.next() < (0.22 + difficulty * 0.15)) {
              const flyY = platY - rng.int(70, 90);
              const mSpawnX = platX + Math.floor(mPlatW / 2) - 12;
              if (!isTooCloseToAnyEnemy(mSpawnX, minEnemyDist)) {
                chasmHasEnemy = true;
                seg.enemies.push({
                  id: `en_mov_${index}_${platX}`,
                  type: rng.next() < 0.5 ? 'flyer' : 'bee',
                  x: mSpawnX,
                  y: flyY,
                  baseY: flyY,
                  w: 24, h: 24,
                  hp: 1, maxHp: 1,
                  hitTimer: 0,
                  vx: (rng.next() < 0.5 ? -1 : 1) * (42 + difficulty * 25) * enemySpeedMult,
                  vy: 0,
                  minX: platX - 8,
                  maxX: platX + mPlatW - 16,
                  jumpTimer: 1.5,
                  phase: rng.range(0, Math.PI * 2),
                  defeated: false
                });
              }
            }

            // Geser cursorX melintasi jurang kiri + platform + jurang kanan ke tanah berikutnya
            cursorX = platX + mPlatW + gapRight;
            const nextPlatWidth = Math.min(endX - cursorX, rng.int(160, 270));
            if (nextPlatWidth < 90) {
              currentY = nextY;
              break;
            }

            // Tanah solid berikutnya di seberang jurang kanan
            seg.platforms.push({
              x: cursorX,
              y: nextY,
              w: nextPlatWidth,
              h: 500 - nextY,
              type: 'ground',
              oneWay: false,
              baseX: cursorX,
              baseY: nextY,
              moveRange: 0,
              moveSpeed: 0,
              moveAxis: null,
              phase: 0,
              dx: 0,
              dy: 0
            });

            // Musuh di tanah seberang (hanya jika di area jurang bergerak tadi belum ada musuh - Mutual Exclusion)
            if (!chasmHasEnemy && seg.enemies.length < maxEnemiesPerSeg && nextPlatWidth >= 165 && rng.next() < (0.25 + difficulty * 0.18)) {
              const eType = rng.next() < 0.5 ? 'walker' : 'jumper';
              const spawnX = cursorX + Math.floor(nextPlatWidth * 0.6);
              const spawnY = nextY - 24;
              if (!isTooCloseToAnyEnemy(spawnX, minEnemyDist)) {
                seg.enemies.push({
                  id: `en_${index}_${cursorX}`,
                  type: eType,
                  x: spawnX,
                  y: spawnY,
                  baseY: spawnY,
                  w: 24, h: 24,
                  hp: 1, maxHp: 1,
                  hitTimer: 0,
                  vx: (rng.next() < 0.5 ? -1 : 1) * (55 + difficulty * 35) * enemySpeedMult,
                  vy: 0,
                  minX: cursorX + 12,
                  maxX: cursorX + nextPlatWidth - 36,
                  jumpTimer: rng.range(0.8, 1.8),
                  phase: rng.range(0, Math.PI * 2),
                  defeated: false
                });
              }
            }

            currentY = nextY;
            cursorX += nextPlatWidth;
            continue;
          }

          let gapWidth = 0;
          let nextY = currentY;

          if (hasGap && remaining > 220) {
            const maxStepUp = 75;
            nextY = Math.max(250, Math.min(CONFIG.WORLD.GROUND_Y, currentY + rng.int(-maxStepUp, 55)));
            const deltaY = currentY - nextY; // positif jika naik
            const maxSafeGap = this.computeMaxReachableGap(deltaY);
            const minGap = 56;
            const targetMaxGap = Math.min(maxSafeGap, Math.floor(85 + difficulty * 65));
            gapWidth = rng.int(minGap, Math.max(minGap + 10, targetMaxGap));
            // Rambu bahaya jurang lebar (warning sign 24px sebelum tebing)
            if (gapWidth >= 75 && cursorX > startX + 30) {
              seg.scenery.push({ x: cursorX - 24, y: currentY, kind: 'sign_warning' });
            }
          } else {
            // Kontur tanah berundak (hills & stepped terraces) tanpa jurang
            if (rng.next() < (0.45 + difficulty * 0.35)) {
              // Jika sudah di plateau puncak bukit (<= 280), arahkan turun kembali ke lembah
              const stepDelta = (currentY <= 280) ? rng.int(35, 48) : (rng.int(0, 1) === 0 ? -rng.int(35, 48) : rng.int(35, 48));
              nextY = Math.max(260, Math.min(CONFIG.WORLD.GROUND_Y, currentY + stepDelta));
            } else {
              // Kadang pertahankan ketinggian saat ini (plateau) atau kembali ke dasar tanah
              nextY = rng.next() < 0.35 ? CONFIG.WORLD.GROUND_Y : currentY;
            }
          }

          cursorX += gapWidth;
          const platWidth = Math.min(endX - cursorX, rng.int(150, 290));
          if (platWidth < 90) break;

          // Buat platform tanah utama
          const plat = {
            x: cursorX,
            y: nextY,
            w: platWidth,
            h: 500 - nextY,
            type: 'ground',
            oneWay: false,
            baseX: cursorX,
            baseY: nextY,
            moveRange: 0,
            moveSpeed: 0,
            moveAxis: null,
            phase: 0,
            dx: 0,
            dy: 0
          };
          seg.platforms.push(plat);

          // Tambah platform kayu bertingkat (elevated wooden platform)
          let hasElevPlat = false;
          let elevX = 0, elevW = 0, elevY = 0;
          let hasElevatedEnemy = false;
          // Frekuensi kemunculan platform kayu dibuat wajar & bervariasi (~35-50%, tidak selalu ada di tiap platform tanah)
          if (platWidth >= 160 && rng.next() < (0.35 + difficulty * 0.15)) {
            hasElevPlat = true;
            elevW = rng.int(90, 140);
            elevX = cursorX + rng.int(16, platWidth - elevW - 16);
            elevY = nextY - rng.int(75, 95);
            seg.platforms.push({
              x: elevX, y: elevY, w: elevW, h: 18, type: 'brick', oneWay: true
            });

            // Musuh di platform kayu: kadang-kadang saja (~22-40%), HANYA musuh darat jika belum ada musuh berdekatan
            // ATURAN SATU MUSUH PER KOLOM VERTIKAL (MUTUAL EXCLUSION):
            // Jika platform kayu ini memiliki musuh, maka kolom tanah di bawahnya 100% DIKOSONGKAN dari musuh!
            let peSpawnX = null;
            const elevSpawnChance = 0.22 + Math.min(0.18, seasonTier * 0.06);
            const canSpawnElevEnemy = seg.enemies.length < maxEnemiesPerSeg && rng.next() < elevSpawnChance;
            if (canSpawnElevEnemy) {
              const testSpawnX = elevX + Math.floor(elevW * 0.5);
              if (!isTooCloseToAnyEnemy(testSpawnX, minEnemyDist)) {
                hasElevatedEnemy = true;
                peSpawnX = testSpawnX;
                const peType = (seasonTier >= 1 && rng.next() < 0.42) ? 'jumper' : 'walker';
                const peSpawnY = elevY - 24;

                seg.enemies.push({
                  id: `en_elev_${index}_${cursorX}`,
                  type: peType,
                  x: peSpawnX,
                  y: peSpawnY,
                  baseY: peSpawnY,
                  w: 24, h: 24,
                  hp: 1, maxHp: 1,
                  hitTimer: 0,
                  vx: (rng.next() < 0.5 ? -1 : 1) * (45 + difficulty * 25) * enemySpeedMult,
                  vy: 0,
                  minX: elevX + 6,
                  maxX: elevX + elevW - 30,
                  jumpTimer: rng.range(0.9, 1.7),
                  phase: rng.range(0, Math.PI * 2),
                  defeated: false
                });
              }
            }

            // Koin di atas platform bertingkat
            const coinCount = Math.floor(elevW / 28);
            for (let c = 0; c < coinCount; c++) {
              const coinX = elevX + 14 + c * 26;
              // Hindari tumpang tindih koin tepat di titik spawn musuh darat di platform kayu
              if (peSpawnX !== null && Math.abs(coinX - peSpawnX) < 22) continue;

              seg.coins.push({
                id: `c_hi_${index}_${cursorX}_${c}`,
                x: coinX,
                y: elevY - 28,
                w: 16, h: 16,
                special: c === Math.floor(coinCount / 2) && rng.next() < 0.35,
                collected: false
              });
            }

            // Kemungkinan Power-Up di platform tinggi
            if (rng.next() < 0.20) {
              const pRoll = rng.next();
              const pType = pRoll < 0.38 ? 'mushroom' : (pRoll < 0.65 ? 'shield' : (pRoll < 0.88 ? 'magnet' : 'life'));
              seg.powerups.push({
                id: `pu_${index}_${cursorX}`,
                x: elevX + elevW / 2 - 10,
                y: elevY - 52,
                w: 20, h: 20,
                type: pType,
                collected: false
              });
            }
          }

          // Koin jalur bawah atau lengkungan di atas jurang
          if (gapWidth > 0 && rng.next() < 0.7) {
            const arcMidX = cursorX - gapWidth * 0.5;
            const arcTopY = Math.min(currentY, nextY) - 65;
            for (let a = -1; a <= 1; a++) {
              seg.coins.push({
                id: `c_arc_${index}_${cursorX}_${a}`,
                x: arcMidX + a * 26 - 8,
                y: arcTopY + Math.abs(a) * 14,
                w: 16, h: 16,
                special: a === 0 && rng.next() < 0.25,
                collected: false
              });
            }
          } else if (rng.next() < 0.55) {
            const count = rng.int(2, 4);
            for (let c = 0; c < count; c++) {
              seg.coins.push({
                id: `c_lo_${index}_${cursorX}_${c}`,
                x: cursorX + 30 + c * 28,
                y: nextY - 30,
                w: 16, h: 16,
                special: false,
                collected: false
              });
            }
          }

          // Spawn Musuh Tanah:
          // ATURAN SATU MUSUH PER KOLOM VERTIKAL (MUTUAL EXCLUSION):
          // 1. Jika platform kayu bertingkat di atasnya sudah memiliki musuh (hasElevatedEnemy = true),
          //    maka area tanah di bawahnya 100% DILARANG memiliki musuh (Mutual Exclusion)!
          // 2. Jika platform bertingkat belum memiliki musuh, musuh tanah bebas muncul di tanah padat.
          const groundSpawnChance = 0.35 + Math.min(0.25, seasonTier * 0.08);
          if (!hasElevatedEnemy && platWidth >= 165 && seg.enemies.length < maxEnemiesPerSeg && rng.next() < groundSpawnChance) {
            const enemyRoll = rng.next();
            let eType = 'walker';

            // Musuh terbang HANYA boleh muncul jika TIDAK ADA platform kayu bertingkat di platform ini
            // (Mutual Exclusion vertikal: udara bebas tanpa rintangan bertingkat)
            if (!hasElevPlat && seasonTier >= 1 && enemyRoll > 0.70) {
              eType = rng.next() < 0.5 ? 'flyer' : 'bee';
            } else if (enemyRoll > 0.50) {
              eType = 'jumper';
            } else if (seasonTier >= 1 && enemyRoll < 0.24 && platWidth >= 190) {
              eType = 'tank';
            }

            const isFlying = eType === 'flyer' || eType === 'bee';
            let spawnX = cursorX + Math.floor(platWidth * 0.55);

            if (spawnX !== null && !isTooCloseToAnyEnemy(spawnX, minEnemyDist)) {
              // Musuh terbang melayang tinggi di angkasa (165..190px di atas tanah)
              const spawnY = isFlying ? nextY - rng.int(165, 190) : (eType === 'tank' ? nextY - 32 : nextY - 26);
              const eW = eType === 'tank' ? 32 : 24;
              const eH = eType === 'tank' ? 32 : 24;
              const baseSpd = eType === 'tank' ? 38 : (eType === 'bee' ? 68 : 55);

              seg.enemies.push({
                id: `en_${index}_${cursorX}`,
                type: eType,
                x: spawnX,
                y: spawnY,
                baseY: spawnY,
                w: eW,
                h: eH,
                hp: eType === 'tank' ? (seasonTier >= 2 ? 3 : 2) : 1,
                maxHp: eType === 'tank' ? (seasonTier >= 2 ? 3 : 2) : 1,
                hitTimer: 0,
                vx: (rng.next() < 0.5 ? -1 : 1) * (baseSpd + difficulty * 32) * enemySpeedMult,
                vy: 0,
                minX: cursorX + 12,
                maxX: cursorX + platWidth - (eW + 12),
                jumpTimer: rng.range(0.8, 1.8),
                phase: rng.range(0, Math.PI * 2),
                defeated: false
              });

              // Hindari koin darat bertumpuk tepat di titik spawn musuh
              if (!isFlying) {
                seg.coins = seg.coins.filter(c => Math.abs((c.x + 8) - (spawnX + eW / 2)) >= 32);
              }
            }
          }

          currentY = nextY;
          cursorX += platWidth;
        }

        // Pastikan ujung segmen memiliki pijakan penyambung agar transisi antar-segmen mulus
        if (cursorX < endX) {
          seg.platforms.push({
            x: cursorX,
            y: CONFIG.WORLD.GROUND_Y,
            w: endX - cursorX,
            h: 120,
            type: 'ground',
            oneWay: false
          });
          currentY = CONFIG.WORLD.GROUND_Y;
        }

        this.lastExitY = currentY;
        this._populateScenery(seg, rng);
        return seg;
      }

      _populateScenery(seg, rng) {
        for (const p of seg.platforms) {
          if (p.type !== 'ground' || p.w < 100) continue;

          // Jumlah dekorasi proporsional dengan lebar platform
          const maxAllowed = p.w >= 260 ? rng.int(2, 3) : (p.w >= 160 ? rng.int(1, 2) : 1);
          const placedX = [];

          for (let i = 0; i < maxAllowed; i++) {
            let bestSx = null;
            const minX = p.x + 24;
            const maxX = p.x + p.w - 24;
            if (maxX <= minX) continue;

            // Cari koordinat yang bersih tanpa bertabrakan dengan aset lain
            for (let attempt = 0; attempt < 10; attempt++) {
              const candX = rng.int(minX, maxX);

              // 1. Cek jarak terhadap dekorasi yang sudah ditempatkan di platform ini
              let overlap = false;
              for (let j = 0; j < placedX.length; j++) {
                if (Math.abs(candX - placedX[j]) < 58) {
                  overlap = true;
                  break;
                }
              }
              if (overlap) continue;

              // 2. Cek jarak terhadap scenery yang sudah ada di segmen (misal sign_warning)
              for (let j = 0; j < seg.scenery.length; j++) {
                const sc = seg.scenery[j];
                if (Math.abs(sc.y - p.y) < 25 && Math.abs(candX - sc.x) < 54) {
                  overlap = true;
                  break;
                }
              }
              if (overlap) continue;

              // 3. Cek jarak terhadap titik spawn musuh darat
              for (let j = 0; j < seg.enemies.length; j++) {
                const en = seg.enemies[j];
                if (en.type !== 'flyer' && en.type !== 'bee') {
                  if (Math.abs(candX - (en.x + en.w / 2)) < 36) {
                    overlap = true;
                    break;
                  }
                }
              }
              if (overlap) continue;

              // 4. Cek jarak terhadap koin darat
              for (let j = 0; j < seg.coins.length; j++) {
                const c = seg.coins[j];
                if (Math.abs(c.y - (p.y - 30)) < 20 && Math.abs(candX - (c.x + 8)) < 26) {
                  overlap = true;
                  break;
                }
              }
              if (overlap) continue;

              bestSx = candX;
              break;
            }

            if (bestSx !== null) {
              placedX.push(bestSx);

              // Cek apakah ada platform melayang (kayu bertingkat atau moving) di atas bestSx
              // Pohon memiliki tinggi ~88-94px sehingga jika ada platform di atasnya, kanopi pohon akan menembus platform
              const hasOverheadPlatform = seg.platforms.some(pl => pl.type !== 'ground' && bestSx >= (pl.x - 32) && bestSx <= (pl.x + pl.w + 32));

              const roll = rng.next();
              if (hasOverheadPlatform) {
                // Jangan spawn pohon di bawah platform; gunakan tanaman rendah (semak, bunga, jamur, batu)
                let kind = 'bush';
                if (roll < 0.40) kind = 'bush';
                else if (roll < 0.65) kind = 'flower';
                else if (roll < 0.85) kind = 'mushroom';
                else kind = 'rock';
                seg.scenery.push({ x: bestSx, y: p.y, kind });
              } else {
                if (roll < 0.28) {
                  const variant = rng.next() < 0.60 ? 'large' : 'small';
                  seg.scenery.push({ x: bestSx, y: p.y, kind: 'tree', variant });
                } else if (roll < 0.36 && p.w >= 220) {
                  const rRoll = rng.next();
                  const kind = rRoll < 0.45 ? 'stone_arch' : (rRoll < 0.75 ? 'stone_pillar' : 'stone_ruins');
                  seg.scenery.push({ x: bestSx, y: p.y, kind });
                } else if (roll < 0.54) {
                  seg.scenery.push({ x: bestSx, y: p.y, kind: 'bush' });
                } else if (roll < 0.70) {
                  seg.scenery.push({ x: bestSx, y: p.y, kind: 'rock' });
                } else if (roll < 0.84) {
                  seg.scenery.push({ x: bestSx, y: p.y, kind: 'flower' });
                } else if (roll < 0.94) {
                  seg.scenery.push({ x: bestSx, y: p.y, kind: 'mushroom' });
                } else {
                  seg.scenery.push({ x: bestSx, y: p.y, kind: 'crystal' });
                }
              }
            }
          }
        }
      }

      /**
       * Mengelola Segment Lifecycle:
       * 1. Generate / Activate segmen di sekitar pemain
       * 2. Deactivate segmen di luar jangkauan aktif
       * 3. Dispose segmen yang sangat jauh agar memori tetap terkontrol
       */
      updateActiveSegments(playerX, dt, player, audio, particles, scoring) {
        const currentSegIdx = Math.floor(playerX / CONFIG.WORLD.SEGMENT_WIDTH);
        const minActive = Math.max(-1, currentSegIdx - CONFIG.WORLD.ACTIVE_RADIUS_SEGMENTS);
        const maxActive = currentSegIdx + CONFIG.WORLD.ACTIVE_RADIUS_SEGMENTS;

        // Deactivate atau Dispose segmen lama
        for (const [idx, seg] of this.segments.entries()) {
          const dist = Math.abs(idx - currentSegIdx);
          if (dist > CONFIG.WORLD.CACHE_RETENTION_SEGMENTS) {
            seg.state = 'DISPOSED';
            this.segments.delete(idx);
          } else if (idx < minActive || idx > maxActive) {
            seg.state = 'INACTIVE';
          }
        }

        // Reuse pool array untuk eliminasi GC allocation pada game loop 60 FPS
        const activePlatforms = this._activePlatforms;
        const activeSegments = this._activeSegments;
        activePlatforms.length = 0;
        activeSegments.length = 0;

        for (let idx = minActive; idx <= maxActive; idx++) {
          const seg = this.getOrCreateSegment(idx);
          activeSegments.push(seg);

          // Update Moving Platforms
          for (let i = 0; i < seg.platforms.length; i++) {
            const p = seg.platforms[i];
            if (p.type === 'moving') {
              p.phase += p.moveSpeed * dt;
              const prevX = p.x;
              const prevY = p.y;
              if (p.moveAxis === 'x') {
                p.x = p.baseX + Math.sin(p.phase) * p.moveRange;
              } else {
                p.y = p.baseY + Math.sin(p.phase) * p.moveRange;
              }
              p.dx = p.x - prevX;
              p.dy = p.y - prevY;
            }
            activePlatforms.push(p);
          }
        }

        return { activeSegments, activePlatforms };
      }
    }

// Global window assignments for direct file:// compatibility
window.WorldManager = WorldManager;
