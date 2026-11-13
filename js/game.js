/**
     * ============================================================================
     * 12. GAME CONTROLLER & FIXED TIMESTEP LOOP (js/game.js & js/main.js)
     * Mengintegrasikan seluruh subsistem tanpa membuat loop ganda saat restart.
     * ============================================================================
     */
    class Game {
      constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.storage = new StorageManager();
        this.audio = new SoundEngine(this.storage);
        this.input = new InputManager();
        this.scoring = new ScoringSystem(this.storage);
        this.camera = new Camera();
        this.particles = new ParticlePool(120);
        this.world = new WorldManager();
        this.player = new Player(100, 300);
        this.player.skin = this.storage.getSelectedSkin();
        this.renderer = new PixelRenderer(this.canvas);

        this.state = 'START'; // START, PLAYING, PAUSED, GAMEOVER
        this.lastTimestamp = 0;
        this.accumulator = 0;
        this.globalTime = 0;
        this.loopRunning = false;

        this.floatingTexts = new FloatingTextPool(5);
        this.comboCount = 0;
        this.lastCoinTime = 0;

        // Milestone Boss State (Muncul di 400-500m & setiap kelipatan pergantian musim 500m)
        this.boss = null;
        this.lastBossMilestone = 0;
        this.bossAlertTimer = 0;
        this.bossProjectiles = [];

        this.activeLbTab = 'local';
        this.mp = new MultiplayerManager(this);

        this._bindUI();
        this._updateHUD();
        this._startMainLoop();
      }

      _bindUI() {
        this.input.onAnyInteraction = () => this.audio.init();
        this.input.onPauseToggle = () => {
          if (this.state === 'PLAYING') this.pauseGame();
          else if (this.state === 'PAUSED') this.resumeGame();
        };
        this.input.onMuteToggle = () => this._toggleMuteUI();

        // Audio feedback klik tombol UI
        document.querySelectorAll('button').forEach(btn => {
          btn.addEventListener('click', () => {
            this.audio.init();
            this.audio.uiClick();
          });
        });

        // Input Nama Pemain Online (Agar.io Style)
        const nameInput = document.getElementById('input-online-name');
        if (nameInput) {
          nameInput.value = this.storage.getPlayerName();
          nameInput.addEventListener('input', (e) => {
            const clean = this.storage.setPlayerName(e.target.value);
            e.target.value = clean;
            e.target.classList.remove('input-error');
          });
          nameInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              document.getElementById('btn-start').click();
            }
          });
        }

        document.getElementById('btn-start').addEventListener('click', () => {
          this.audio.init();
          const nameVal = nameInput ? nameInput.value.trim() : '';
          if (!nameVal) {
            if (nameInput) {
              nameInput.classList.add('input-error');
              nameInput.focus();
            }
            return;
          }
          this.storage.setPlayerName(nameVal);
          this.mp.connect();
          this.startNewGame();
        });
        document.getElementById('btn-resume').addEventListener('click', () => this.resumeGame());
        document.getElementById('btn-pause-home').addEventListener('click', () => this.goToHome());
        document.getElementById('btn-retry').addEventListener('click', () => this.startNewGame());
        document.getElementById('btn-go-home').addEventListener('click', () => this.goToHome());
        document.getElementById('btn-pause').addEventListener('click', () => {
          if (this.state === 'PLAYING') this.pauseGame();
          else if (this.state === 'PAUSED') this.resumeGame();
        });
        document.getElementById('btn-mute').addEventListener('click', () => this._toggleMuteUI());

        // Lemari Kostum & Leaderboard Modals
        document.getElementById('btn-open-skins').addEventListener('click', () => {
          this.audio.init();
          this._openSkinsModal();
        });
        document.getElementById('btn-skins-close').addEventListener('click', () => {
          document.getElementById('screen-skins').classList.add('hidden');
        });

        document.getElementById('btn-open-leaderboard').addEventListener('click', () => {
          this.audio.init();
          this._openLeaderboardModal();
        });
        document.getElementById('btn-leaderboard-close').addEventListener('click', () => {
          document.getElementById('screen-leaderboard').classList.add('hidden');
        });

        // Bantuan / Panduan Kontrol Modal
        const btnOpenHelp = document.getElementById('btn-open-help');
        if (btnOpenHelp) {
          btnOpenHelp.addEventListener('click', () => {
            this.audio.init();
            document.getElementById('screen-help').classList.remove('hidden');
          });
        }
        const btnCloseHelp = document.getElementById('btn-help-close');
        if (btnCloseHelp) {
          btnCloseHelp.addEventListener('click', () => {
            document.getElementById('screen-help').classList.add('hidden');
          });
        }

        // Hero Pedestal Click -> Langsung ke Lemari Kostum
        const heroTrigger = document.getElementById('start-hero-trigger');
        if (heroTrigger) {
          heroTrigger.addEventListener('click', () => {
            this.audio.init();
            this._openSkinsModal();
          });
        }

        // Tab Papan Rekor (Lokal vs Global)
        const tabLbLocal = document.getElementById('tab-lb-local');
        const tabLbGlobal = document.getElementById('tab-lb-global');
        if (tabLbLocal && tabLbGlobal) {
          tabLbLocal.addEventListener('click', () => {
            this.activeLbTab = 'local';
            tabLbLocal.classList.add('active');
            tabLbGlobal.classList.remove('active');
            this.audio.coin();
            this._renderLeaderboardUI();
          });
          tabLbGlobal.addEventListener('click', () => {
            this.activeLbTab = 'global';
            tabLbGlobal.classList.add('active');
            tabLbLocal.classList.remove('active');
            this.audio.coin();
            if (this.mp && !this.mp.connected) this.mp.connect();
            this._renderLeaderboardUI();
          });
        }

        const resetLbBtn = document.getElementById('btn-leaderboard-reset');
        if (resetLbBtn) {
          resetLbBtn.addEventListener('click', () => {
            if (confirm('Atur ulang seluruh papan rekor lokal ke pengaturan awal?')) {
              this.storage.resetLeaderboard();
              this.scoring.highScore = 0;
              document.getElementById('start-high').textContent = '0';
              document.getElementById('go-high').textContent = '0';
              const highHud = document.getElementById('high-score');
              if (highHud) highHud.textContent = '0';
              this.lastSavedRecordId = null;
              this._renderLeaderboardUI();
              this.audio.damage();
            }
          });
        }

        // Simpan Rekor Top 10
        const saveRecordBtn = document.getElementById('btn-save-record');
        const inputInitials = document.getElementById('input-initials');

        const doSaveRecord = () => {
          if (!inputInitials) return;
          const initials = (inputInitials.value || 'YOU').trim().substring(0, 12).toUpperCase().replace(/[^A-Z0-9_]/g, '') || 'YOU';
          const score = this.scoring.score;
          if (score <= 0) {
            const msgEl = document.getElementById('go-record-msg');
            if (msgEl) {
              msgEl.textContent = 'Capai skor > 0 untuk mencatat rekor!';
              msgEl.style.color = '#f59e0b';
              msgEl.classList.remove('hidden');
            }
            return;
          }
          
          const result = this.storage.addLeaderboardEntry(initials, score, this.lastSavedRecordId);
          this.lastSavedRecordId = result.entryId;
          this.storage.addGlobalLeaderboardEntry({ id: result.entryId, name: result.cleanName, score: result.cleanScore, timestamp: Date.now() });
          if (this.mp) {
            this.mp.broadcastRecord(result.cleanName, result.cleanScore);
          }
          this.audio.coin(true);

          const formEl = document.getElementById('go-record-form');
          const msgEl = document.getElementById('go-record-msg');
          const titleEl = document.getElementById('go-record-title');
          if (formEl) formEl.classList.add('hidden');
          if (titleEl) titleEl.textContent = '🏆 REKOR TERSIMPAN!';
          if (msgEl) {
            msgEl.style.color = '#22c55e';
            const rankText = result.rank ? `(Peringkat #${result.rank} Top 10)` : '(Tercatat di Riwayat)';
            msgEl.textContent = `✓ Sukses disimpan ke Papan Rekor! [${result.cleanName} : ${result.cleanScore.toLocaleString()} PTS] ${rankText}`;
            msgEl.classList.remove('hidden');
          }
          // Refresh high score displays
          document.getElementById('go-high').textContent = this.storage.getHighScore();
          document.getElementById('start-high').textContent = this.storage.getHighScore();
        };

        if (saveRecordBtn) {
          saveRecordBtn.addEventListener('click', doSaveRecord);
        }
        if (inputInitials) {
          inputInitials.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              doSaveRecord();
            }
          });
        }

        // Tombol Lihat Papan Rekor langsung dari Game Over
        const goLeaderboardBtn = document.getElementById('btn-go-leaderboard');
        if (goLeaderboardBtn) {
          goLeaderboardBtn.addEventListener('click', () => {
            this.audio.init();
            this._openLeaderboardModal();
          });
        }

        document.addEventListener('visibilitychange', () => {
          if (document.hidden && this.state === 'PLAYING') {
            this.pauseGame();
          }
        });

        // Tab Toko: Kostum vs Reaksi/Emote
        const tabSkins = document.getElementById('tab-shop-skins');
        const tabEmotes = document.getElementById('tab-shop-emotes');
        const skinsContainer = document.getElementById('skins-container');
        const emotesContainer = document.getElementById('emotes-container');
        const shopSubtitle = document.getElementById('shop-subtitle');

        if (tabSkins && tabEmotes) {
          tabSkins.addEventListener('click', () => {
            tabSkins.classList.add('active');
            tabEmotes.classList.remove('active');
            if (skinsContainer) skinsContainer.classList.remove('hidden');
            if (emotesContainer) emotesContainer.classList.add('hidden');
            if (shopSubtitle) shopSubtitle.textContent = 'Kumpulkan koin saat menjelajah dan pilih gaya karakter favoritmu!';
            this._renderSkinsUI();
          });
          tabEmotes.addEventListener('click', () => {
            tabEmotes.classList.add('active');
            tabSkins.classList.remove('active');
            if (skinsContainer) skinsContainer.classList.add('hidden');
            if (emotesContainer) emotesContainer.classList.remove('hidden');
            if (shopSubtitle) shopSubtitle.textContent = 'Buka ekspresi & emote unik untuk berkomunikasi & bereaksi saat bermain!';
            this._renderEmotesUI();
          });
        }

        // Quick Emote Trigger (Mobile Touch)
        const tEmoteBtn = document.getElementById('t-emote-btn');
        const emoteDrawer = document.getElementById('emote-picker-drawer');
        if (tEmoteBtn && emoteDrawer) {
          tEmoteBtn.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            this.audio.init();
            if (emoteDrawer.classList.contains('hidden')) {
              this._renderEmotePickerDrawer();
              emoteDrawer.classList.remove('hidden');
            } else {
              emoteDrawer.classList.add('hidden');
            }
          });
          window.addEventListener('pointerdown', (e) => {
            if (!emoteDrawer.contains(e.target) && e.target !== tEmoteBtn) {
              emoteDrawer.classList.add('hidden');
            }
          });
        }

        // Shortcut Tombol Angka Keyboard 1-6 untuk Emote Cepat
        this.input.onEmoteTrigger = (index) => {
          const unlockedIds = this.storage.getUnlockedEmotes();
          const unlockedCatalog = EMOTES_CATALOG.filter(e => unlockedIds.includes(e.id));
          if (unlockedCatalog[index]) {
            this.triggerPlayerEmote(unlockedCatalog[index].icon);
          }
        };

        this._syncMuteIcon();
        this._updateStartMenuHero();
        document.getElementById('start-high').textContent = this.scoring.highScore;
      }

      _updateStartMenuHero() {
        const skinId = this.storage.getSelectedSkin() || 'scout';
        const skinData = SKINS_CATALOG.find(s => s.id === skinId) || SKINS_CATALOG[0];
        const nameEl = document.getElementById('start-hero-name');
        if (nameEl) {
          nameEl.textContent = skinData.name;
          nameEl.style.color = skinData.color;
        }
      }

      triggerPlayerEmote(icon) {
        if (!this.player) return;
        this.player.triggerEmote(icon);
        this.audio.emote();
        if (this.mp) {
          this.mp.broadcastEmote(icon);
        }
      }

      _renderEmotePickerDrawer() {
        const drawer = document.getElementById('emote-picker-drawer');
        if (!drawer) return;
        drawer.innerHTML = '';
        const unlockedIds = this.storage.getUnlockedEmotes();
        const unlockedCatalog = EMOTES_CATALOG.filter(e => unlockedIds.includes(e.id));
        unlockedCatalog.forEach(em => {
          const item = document.createElement('div');
          item.className = 'emote-pick-item';
          item.textContent = em.icon;
          item.title = em.name;
          item.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            this.triggerPlayerEmote(em.icon);
            drawer.classList.add('hidden');
          });
          drawer.appendChild(item);
        });
      }

      _openSkinsModal() {
        const tabSkins = document.getElementById('tab-shop-skins');
        const tabEmotes = document.getElementById('tab-shop-emotes');
        const skinsContainer = document.getElementById('skins-container');
        const emotesContainer = document.getElementById('emotes-container');
        if (tabSkins && tabEmotes && skinsContainer && emotesContainer) {
          tabSkins.classList.add('active');
          tabEmotes.classList.remove('active');
          skinsContainer.classList.remove('hidden');
          emotesContainer.classList.add('hidden');
        }
        this._renderSkinsUI();
        document.getElementById('screen-skins').classList.remove('hidden');
      }

      _renderSkinsUI() {
        const totalCoins = this.storage.getTotalCoins();
        document.getElementById('skins-total-coins').textContent = totalCoins;
        const container = document.getElementById('skins-container');
        container.innerHTML = '';

        const selectedSkin = this.storage.getSelectedSkin();
        const unlockedSkins = this.storage.getUnlockedSkins();

        for (const skin of SKINS_CATALOG) {
          const isSelected = selectedSkin === skin.id;
          const isUnlocked = unlockedSkins.includes(skin.id);

          const card = document.createElement('div');
          card.className = `skin-card ${isSelected ? 'selected' : ''}`;

          let btnHtml = '';
          if (isSelected) {
            btnHtml = `<button class="skin-btn btn-active" disabled>DIPAKAI ✓</button>`;
          } else if (isUnlocked) {
            btnHtml = `<button class="skin-btn btn-select" data-skin="${skin.id}">PILIH</button>`;
          } else {
            const canAfford = totalCoins >= skin.price;
            btnHtml = `<button class="skin-btn btn-buy" data-skin="${skin.id}" data-price="${skin.price}" ${canAfford ? '' : 'style="opacity:0.5;"'}>BUKA (${skin.price} 💰)</button>`;
          }

          card.innerHTML = `
            <div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);border-radius:4px;flex-shrink:0;">
              <div style="width:32px;height:32px;image-rendering:pixelated;transform:scale(1.25);transform-origin:center;background:url(assets/player/${skin.id}/Idle.png) 0 0 no-repeat;"></div>
            </div>
            <div style="flex:1;min-width:0;">
              <div class="name" style="color:${skin.color};">${skin.name}</div>
              <div class="desc">${skin.desc}</div>
              <div>${btnHtml}</div>
            </div>
          `;

          container.appendChild(card);
        }

        // Event listeners untuk tombol-tombol skin
        container.querySelectorAll('.btn-select').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const skinId = e.currentTarget.getAttribute('data-skin');
            this.storage.setSelectedSkin(skinId);
            this.player.skin = skinId;
            this.audio.powerup();
            this._updateStartMenuHero();
            this._renderSkinsUI();
          });
        });

        container.querySelectorAll('.btn-buy').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const skinId = e.currentTarget.getAttribute('data-skin');
            const price = parseInt(e.currentTarget.getAttribute('data-price'), 10);
            if (this.storage.spendTotalCoins(price)) {
              this.storage.unlockSkin(skinId);
              this.storage.setSelectedSkin(skinId);
              this.player.skin = skinId;
              this.audio.coin(true);
              this._updateStartMenuHero();
              this._renderSkinsUI();
            } else {
              this.audio.damage();
            }
          });
        });
      }

      _renderEmotesUI() {
        const totalCoins = this.storage.getTotalCoins();
        const totalCoinsEl = document.getElementById('skins-total-coins');
        if (totalCoinsEl) totalCoinsEl.textContent = totalCoins;
        const container = document.getElementById('emotes-container');
        if (!container) return;
        container.innerHTML = '';

        const unlockedEmotes = this.storage.getUnlockedEmotes();

        for (const em of EMOTES_CATALOG) {
          const isUnlocked = unlockedEmotes.includes(em.id);
          const card = document.createElement('div');
          card.className = `skin-card ${isUnlocked ? 'selected' : ''}`;
          
          let actionHtml = '';
          if (isUnlocked) {
            actionHtml = `<button class="skin-btn btn-active btn-preview-emote" data-icon="${em.icon}" style="background:rgba(34,197,94,0.18); border-color:#22c55e; color:#22c55e; width:100%; cursor:pointer;">TEST 💬</button>`;
          } else {
            const canAfford = totalCoins >= em.price;
            actionHtml = `<button class="skin-btn btn-buy btn-buy-emote" data-emote="${em.id}" data-price="${em.price}" ${canAfford ? '' : 'style="opacity:0.5;"'} style="background:rgba(234,179,8,0.2); border-color:#eab308; color:#facc15; width:100%;">BUKA (${em.price} 💰)</button>`;
          }

          card.innerHTML = `
            <div style="width:36px;height:36px;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.3);border-radius:4px;flex-shrink:0;font-size:22px;">
              ${em.icon}
            </div>
            <div style="flex:1;min-width:0;">
              <div class="name" style="color:#f472b6;">${em.name}</div>
              <div class="desc">${em.desc}</div>
              <div>${actionHtml}</div>
            </div>
          `;
          container.appendChild(card);
        }

        container.querySelectorAll('.btn-preview-emote').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const icon = e.currentTarget.getAttribute('data-icon');
            this.triggerPlayerEmote(icon);
          });
        });

        container.querySelectorAll('.btn-buy-emote').forEach(btn => {
          btn.addEventListener('click', (e) => {
            const emoteId = e.currentTarget.getAttribute('data-emote');
            const price = parseInt(e.currentTarget.getAttribute('data-price'), 10);
            if (this.storage.spendTotalCoins(price)) {
              this.storage.unlockEmote(emoteId);
              const em = EMOTES_CATALOG.find(x => x.id === emoteId);
              if (em) this.triggerPlayerEmote(em.icon);
              this.audio.coin(true);
              this._renderEmotesUI();
            } else {
              this.audio.damage();
            }
          });
        });
      }

      _openLeaderboardModal() {
        if (this.mp && !this.mp.connected) {
          this.mp.connect();
        }
        this._renderLeaderboardUI();
        document.getElementById('screen-leaderboard').classList.remove('hidden');
      }

      _renderLeaderboardUI() {
        const rowsContainer = document.getElementById('leaderboard-rows');
        const isGlobal = this.activeLbTab === 'global';
        const board = isGlobal ? this.storage.getGlobalLeaderboard() : this.storage.getLeaderboard();
        rowsContainer.innerHTML = '';

        const highEl = document.getElementById('lb-high-score-val');
        const infoLabel = document.getElementById('lb-info-label');
        const resetBtn = document.getElementById('btn-leaderboard-reset');
        const subtitleEl = document.getElementById('lb-subtitle');

        if (isGlobal) {
          if (subtitleEl) subtitleEl.textContent = 'Top Rekor Dunia Pemain Online (Sinkronisasi Global)';
          if (infoLabel) infoLabel.textContent = 'STATUS KONEKSI GLOBAL:';
          if (highEl) {
            highEl.textContent = this.mp && this.mp.connected ? '🟢 TERHUBUNG' : '⚪ OFFLINE (CACHE)';
            highEl.style.color = this.mp && this.mp.connected ? '#22c55e' : 'var(--muted)';
          }
          if (resetBtn) resetBtn.style.display = 'none';
        } else {
          if (subtitleEl) subtitleEl.textContent = 'Top 10 Petualang Terhebat di Perangkat Ini';
          if (infoLabel) infoLabel.textContent = 'REKOR TERTINGGI ANDA:';
          if (highEl) {
            highEl.textContent = `${this.storage.getHighScore().toLocaleString()} PTS`;
            highEl.style.color = 'var(--accent)';
          }
          if (resetBtn) resetBtn.style.display = '';
        }

        if (!board || board.length === 0) {
          const emptyTr = document.createElement('tr');
          emptyTr.innerHTML = `<td colspan="3" style="text-align:center; color:var(--muted); padding:16px 0;">${isGlobal ? 'Belum ada rekor global tersinkronisasi.' : 'Belum ada rekor tersimpan. Mulai petualanganmu!'}</td>`;
          rowsContainer.appendChild(emptyTr);
          return;
        }

        const myName = (this.storage.getPlayerName() || '').trim().toUpperCase();

        board.forEach((entry, idx) => {
          const rank = idx + 1;
          let rankClass = '';
          let medal = `${rank}.`;
          if (rank === 1) { rankClass = 'rank-1'; medal = '🥇 1.'; }
          else if (rank === 2) { rankClass = 'rank-2'; medal = '🥈 2.'; }
          else if (rank === 3) { rankClass = 'rank-3'; medal = '🥉 3.'; }

          const isNew = this.lastSavedRecordId && (entry.id === this.lastSavedRecordId);
          const entryUpper = String(entry.name || '').trim().toUpperCase();
          const isMe = entryUpper === myName;
          const tr = document.createElement('tr');
          tr.className = `${rankClass} ${isNew ? 'new-record-row' : ''}`;
          if (isMe && isGlobal) {
            tr.style.background = 'rgba(56, 189, 248, 0.12)';
          }
          const safeName = String(entry.name || 'HERO').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          const tag = entry.preset ? '<span style="font-size:9px; color:var(--muted); font-weight:normal;">(BOT)</span>' : (isMe ? '<span style="font-size:9px; color:var(--accent); font-weight:normal;">(ANDA)</span>' : '');
          tr.innerHTML = `
            <td style="padding-left: 6px;">${medal}</td>
            <td style="letter-spacing:1px; font-weight:bold;">${safeName} ${tag}</td>
            <td style="text-align: right; font-weight:bold; padding-right: 6px;">${Number(entry.score || 0).toLocaleString()}</td>
          `;
          rowsContainer.appendChild(tr);
        });
      }

      _toggleMuteUI() {
        this.audio.init();
        this.audio.toggleMute();
        this._syncMuteIcon();
      }

      _syncMuteIcon() {
        document.getElementById('btn-mute').style.opacity = this.audio.muted ? 0.4 : 1;
      }

      vibrate(pattern) {
        if (typeof navigator !== 'undefined' && navigator.vibrate) {
          try { navigator.vibrate(pattern); } catch {}
        }
      }

      addFloatingText(x, y, text, color = '#facc15', type = '') {
        this.floatingTexts.spawn(x, y, text, color, type);
      }

      startNewGame() {
        if (this.mp) {
          if (!this.mp.connected) this.mp.connect();
          else this.mp.broadcastState();
        }
        const seed = Math.floor(Date.now() % 1000000);
        this.world.reset(seed);
        this.scoring.reset();
        this.particles.clear();
        this.player.reset(120, CONFIG.WORLD.GROUND_Y - 40);
        this.player.skin = this.storage.getSelectedSkin();
        this.camera.reset(this.player.x);
        this.input.resetState();
        this.accumulator = 0;
        this.floatingTexts.clear();
        this.comboCount = 0;
        this.lastCoinTime = 0;
        this.brokeRecord = this.scoring.highScore <= 0;

        // Reset Boss State
        this.boss = null;
        this.lastBossMilestone = 0;
        this.bossAlertTimer = 0;
        this.bossProjectiles = [];

        this.state = 'PLAYING';
        this.audio.startBGM();
        this._updateScreens();
        this._updateHUD();

        // Notifikasi visual awal musim yang diacak saat permainan dimulai
        const startSeasonNames = [
          '🌸 MUSIM SEMI (SPRING) 🌸',
          '☀️ MUSIM PANAS (SUMMER) ☀️',
          '🍂 MUSIM GUGUR (AUTUMN) 🍂',
          '❄️ MUSIM DINGIN (WINTER) ❄️'
        ];
        const startSeasonColors = ['#f472b6', '#facc15', '#fb923c', '#38bdf8'];
        const sIdx = this.scoring.startSeason || 0;
        this.addFloatingText(this.player.x + 80, this.player.y - 45, startSeasonNames[sIdx], startSeasonColors[sIdx], 'milestone');
      }

      pauseGame() {
        if (this.state !== 'PLAYING') return;
        this.state = 'PAUSED';
        this.audio.stopBGM();
        this.input.resetState();
        this._updateScreens();
      }

      resumeGame() {
        if (this.state !== 'PAUSED') return;
        this.state = 'PLAYING';
        this.audio.startBGM();
        this.input.resetState();
        this.lastTimestamp = performance.now();
        this._updateScreens();
      }

      goToHome() {
        if (this.mp) this.mp.leave();
        this.state = 'START';
        this.boss = null;
        this.lastBossMilestone = 0;
        if (this.bossProjectiles) this.bossProjectiles.length = 0;
        this.audio.stopBGM();
        this.input.resetState();
        this._updateStartMenuHero();
        document.getElementById('start-high').textContent = this.scoring.highScore;
        this._updateScreens();
      }

      triggerGameOver() {
        if (this.mp) this.mp.leave();
        this.state = 'GAMEOVER';
        this.audio.stopBGM();
        this.input.resetState();
        this.audio.gameOver();
        document.getElementById('go-score').textContent = this.scoring.score;
        document.getElementById('go-high').textContent = this.scoring.highScore;
        document.getElementById('go-dist').textContent = `${this.scoring.maxDistanceMeters}m`;
        document.getElementById('go-time').textContent = this.scoring.formatTime();

        // Otomatis simpan rekor ke papan rekor jika memenuhi syarat Top 10
        if (this.scoring.score > 0 && this.storage.isLeaderboardEligible(this.scoring.score)) {
          const autoRes = this.storage.addLeaderboardEntry(this.storage.getPlayerName(), this.scoring.score);
          this.lastSavedRecordId = autoRes.entryId;
          this.storage.addGlobalLeaderboardEntry({ id: autoRes.entryId, name: this.storage.getPlayerName(), score: this.scoring.score, timestamp: Date.now() });
          if (this.mp) {
            this.mp.broadcastRecord(this.storage.getPlayerName(), this.scoring.score);
          }
        }

        // Setup Record Input on Game Over
        const recordBox = document.getElementById('go-record-input');
        const inputInitials = document.getElementById('input-initials');
        const formEl = document.getElementById('go-record-form');
        const msgEl = document.getElementById('go-record-msg');
        const titleEl = document.getElementById('go-record-title');

        if (recordBox && inputInitials) {
          recordBox.classList.remove('hidden');
          if (this.scoring.score > 0) {
            if (formEl) formEl.classList.remove('hidden');
            if (msgEl) msgEl.classList.add('hidden');
            inputInitials.value = this.storage.getPlayerName();
            if (titleEl) {
              if (this.storage.isLeaderboardEligible(this.scoring.score)) {
                titleEl.textContent = '🏆 REKOR TOP 10 TERCAPAI! MASUKKAN INISIAL:';
              } else {
                titleEl.textContent = '📝 SIMPAN SKOR KE PAPAN REKOR:';
              }
            }
            setTimeout(() => {
              inputInitials.focus();
              inputInitials.select();
            }, 80);
          } else {
            if (formEl) formEl.classList.add('hidden');
            if (msgEl) {
              msgEl.textContent = '💡 Kumpulkan koin atau jelajahi lebih jauh untuk mencatat skor pertamamu!';
              msgEl.style.color = 'var(--muted)';
              msgEl.classList.remove('hidden');
            }
            if (titleEl) titleEl.textContent = '📝 PAPAN REKOR PETUALANG';
          }
        }

        this._updateScreens();
      }

      _updateScreens() {
        document.getElementById('screen-start').classList.toggle('hidden', this.state !== 'START');
        document.getElementById('screen-pause').classList.toggle('hidden', this.state !== 'PAUSED');
        document.getElementById('screen-gameover').classList.toggle('hidden', this.state !== 'GAMEOVER');
      }

      _startMainLoop() {
        if (this.loopRunning) return;
        this.loopRunning = true;
        this.lastTimestamp = performance.now();

        const tick = (now) => {
          let frameTime = (now - this.lastTimestamp) / 1000;
          this.lastTimestamp = now;
          if (frameTime > 0.25) frameTime = 0.25;

          if (this.state === 'PLAYING') {
            this.accumulator += frameTime;
            let steps = 0;
            while (this.accumulator >= CONFIG.FIXED_DT && steps < CONFIG.MAX_SUBSTEPS) {
              this._fixedUpdate(CONFIG.FIXED_DT);
              this.input.consumeFrameFlags();
              this.accumulator -= CONFIG.FIXED_DT;
              steps++;
            }
            if (steps >= CONFIG.MAX_SUBSTEPS) {
              this.accumulator = 0;
            }
            this._updateHUD();
          } else {
            this.globalTime += frameTime;
          }

          this._renderFrame();
          requestAnimationFrame(tick);
        };

        requestAnimationFrame(tick);
      }

      _fixedUpdate(dt) {
        this.globalTime += dt;

        if (this.mp) {
          this.mp.update(dt);
        }

        // Notifikasi Rekor Baru Real-time
        if (!this.brokeRecord && this.scoring.score > this.scoring.highScore && this.scoring.highScore > 0) {
          this.brokeRecord = true;
          this.addFloatingText(this.player.x + this.player.w / 2, this.player.y - 28, '🏆 REKOR BARU TERCAPAI! 🏆', '#facc15');
          this.audio.newRecord();
          this.vibrate([30, 50, 40]);
        }

        // Update Floating Pop-up Text (Zero-GC pool update)
        this.floatingTexts.update(dt);

        // Update Boss Alert Timer
        if (this.bossAlertTimer > 0) {
          this.bossAlertTimer = Math.max(0, this.bossAlertTimer - dt);
        }

        // Milestone Boss Encounter Check (muncul di 400-500m & setiap kelipatan pergantian musim 500m)
        const currentTier = Math.floor(this.scoring.maxDistanceMeters / 500);
        const targetBossDist = currentTier * 500 + 400;
        if (this.scoring.maxDistanceMeters >= targetBossDist && this.lastBossMilestone <= currentTier && (!this.boss || this.boss.defeated)) {
          this.lastBossMilestone = currentTier + 1;
          this.bossAlertTimer = 3.5;
          this.audio.siren();
          this.camera.shake(0.35, 7);
          this.bossProjectiles = [];

          const bossTier = currentTier + 1;
          const bossHp = 4 + Math.min(6, currentTier * 2);

          this.boss = {
            x: this.player.x + 360,
            y: 155,
            w: 48,
            h: 36,
            tier: bossTier,
            hp: bossHp,
            maxHp: bossHp,
            state: 'HOVER',      // 'HOVER', 'TELEGRAPH', 'DIVE', 'STUNNED', 'RECOVER'
            timer: 3.2,
            shootTimer: Math.max(1.2, 2.0 - currentTier * 0.25),
            vx: -120,
            vy: 0,
            targetX: 0,
            phase: 0,
            defeated: false
          };
          this.addFloatingText(this.player.x + 80, 100, `⚠️ CYBER-TITAN MK-${bossTier} INCOMING! ⚠️`, '#ef4444');
        }

        // Update Titan Drone Mini-Boss AI, Attacks & Collision
        if (this.boss && !this.boss.defeated) {
          const boss = this.boss;
          const isEnraged = boss.hp <= 1;

          // Batas layar horizontal tempat bos bertarung
          const minBossX = this.player.x - 120;
          const maxBossX = this.player.x + CONFIG.CANVAS_WIDTH - 200;

          // --- STATE MACHINE BOS ---
          if (boss.state === 'HOVER') {
            boss.phase += dt * (isEnraged ? 4.2 : 3.0);
            boss.y = 155 + Math.sin(boss.phase) * 30;

            // Manuver horizontal mengintai & mendekati pemain
            const targetDir = this.player.x > boss.x + 16 ? 1 : -1;
            boss.vx = targetDir * (isEnraged ? 150 : 105);
            boss.x += boss.vx * dt;
            boss.x = Math.max(minBossX, Math.min(maxBossX, boss.x));

            // Tembak Plasma Bomb berkala ke arah pemain
            boss.shootTimer -= dt;
            if (boss.shootTimer <= 0) {
              boss.shootTimer = isEnraged ? 1.6 : 2.4;
              const aimDx = Math.max(-140, Math.min(140, (this.player.x - boss.x) * 0.7));
              this.bossProjectiles.push({
                x: boss.x + 18,
                y: boss.y + boss.h,
                w: 12,
                h: 12,
                vx: aimDx,
                vy: 190,
                type: 'bomb'
              });
              this.audio.bossShoot();
              this.particles.spawn(boss.x + 24, boss.y + boss.h, 6, '#facc15', 80);
            }

            // Hitung mundur menuju serangan menukik (Dive-Bomb Slam)
            boss.timer -= dt;
            if (boss.timer <= 0) {
              boss.state = 'TELEGRAPH';
              boss.timer = isEnraged ? 0.55 : 0.8;
              boss.targetX = Math.max(minBossX + 30, Math.min(maxBossX - 30, this.player.x - 12));
              boss.targetGroundY = this.world.getSurfaceYAt(boss.targetX, boss.w);
              this.audio.siren();
            }

          } else if (boss.state === 'TELEGRAPH') {
            // Berhenti di udara, bergetar membidik koordinat target
            boss.timer -= dt;
            if (boss.timer <= 0) {
              boss.state = 'DIVE';
              boss.x = boss.targetX;
              boss.vy = isEnraged ? 560 : 460;
              boss.targetGroundY = this.world.getSurfaceYAt(boss.x, boss.w);
              this.audio.bossSlam();
            }

          } else if (boss.state === 'DIVE') {
            boss.y += boss.vy * dt;
            this.particles.spawn(boss.x + 24, boss.y, 2, '#f97316', 60);

            // Menghantam tanah / platform di ketinggian dinamis terrain (tidak tembus jika tanah berundak)
            const surfaceY = boss.targetGroundY || this.world.getSurfaceYAt(boss.x, boss.w);
            const slamY = surfaceY - boss.h;
            if (boss.y >= slamY) {
              boss.y = slamY;
              boss.vy = 0;
              boss.state = 'STUNNED';
              boss.timer = isEnraged ? 1.0 : 1.4;
              this.camera.shake(0.35, 8);
              this.vibrate(35);
              this.particles.spawn(boss.x + 24, surfaceY, 24, '#f59e0b', 180);

              // Lepas 2 Shockwaves energi merambat di tanah ke kiri & kanan sesuai level tanah!
              const swSpd = isEnraged ? 230 : 180;
              const swY = surfaceY - 14;
              this.bossProjectiles.push(
                { x: boss.x - 6, y: swY, w: 16, h: 14, vx: -swSpd, vy: 0, life: 1.1, type: 'shockwave' },
                { x: boss.x + boss.w - 10, y: swY, w: 16, h: 14, vx: swSpd, vy: 0, life: 1.1, type: 'shockwave' }
              );
            }

          } else if (boss.state === 'STUNNED') {
            // Bos terhenti di tanah, kesempatan emas pemain melompat dan menginjak kepalanya!
            boss.timer -= dt;
            if (Math.random() < 0.25) {
              this.particles.spawn(boss.x + 12 + Math.random() * 24, boss.y - 4, 1, '#94a3b8', 35);
            }
            if (boss.timer <= 0) {
              boss.state = 'RECOVER';
            }

          } else if (boss.state === 'HURT') {
            // Bos diam di tanah (flinch) terkena injakan, memberi waktu hero mendarat aman
            boss.timer -= dt;
            if (Math.random() < 0.35) {
              this.particles.spawn(boss.x + 24, boss.y + 18, 1, '#ef4444', 40);
            }
            if (boss.timer <= 0) {
              boss.state = 'RECOVER';
            }

          } else if (boss.state === 'RECOVER') {
            // Bos baru terbang kembali ke angkasa setelah hero menjauh dengan aman
            boss.y -= (isEnraged ? 260 : 200) * dt;
            if (boss.y <= 155) {
              boss.state = 'HOVER';
              boss.timer = isEnraged ? 2.4 : 3.4;
              boss.shootTimer = 1.4;
            }
          }

          // Tabrakan Pemain vs Bos (Injakan Kepala)
          if (CollisionSystem.overlaps(this.player, boss)) {
            const playerBottom = this.player.y + this.player.h;
            const isStomp = this.player.vy > 0 && (playerBottom - this.player.vy * dt) <= boss.y + 20;

            if (isStomp) {
              boss.hp -= 1;
              // Pentalan tinggi ke atas dan melengkung ke samping menjauhi bos
              this.player.vy = CONFIG.PHYSICS.BOUNCE_VELOCITY * 1.35;
              const bounceDir = this.player.x < boss.x + boss.w / 2 ? -1 : 1;
              this.player.vx = bounceDir * 140;
              // Wajib beri invulnTimer aman 1.2 detik agar hero 100% kebal tabrakan dari bos
              this.player.invulnTimer = 1.2;
              this.camera.shake(0.28, 7);
              this.particles.spawn(boss.x + 24, boss.y + 18, 20, '#f43f5e', 180);
              this.vibrate(boss.hp <= 0 ? [30, 40, 60] : 30);

              if (boss.hp <= 0) {
                // Bos Kalah
                boss.defeated = true;
                this.bossProjectiles = [];
                this.audio.bossDefeat();

                const bTier = boss.tier || 1;
                const scoreReward = 1000 + (bTier - 1) * 500;
                const coinReward = 30 + (bTier - 1) * 15;

                this.scoring.addScore(scoreReward);
                this.storage.addTotalCoins(coinReward);
                this.camera.shake(0.5, 10);
                this.particles.spawn(boss.x + 24, boss.y + 18, 45, '#f59e0b', 250);
                this.addFloatingText(boss.x + 24, boss.y - 18, `🏆 TITAN MK-${bTier} HANCUR! +${scoreReward} PTS (+${coinReward} KOIN) 🏆`, '#facc15');

                // Hamburkan koin emas & permata dengan efek animasi letupan air mancur fisik (Fountain Burst)
                const bCenterX = boss.x + boss.w / 2;
                const bCenterY = boss.y + boss.h / 2;
                const curSeg = this.world.getOrCreateSegment(Math.floor(bCenterX / CONFIG.WORLD.SEGMENT_WIDTH));

                // Koin Emas & Permata meletup membusur ke atas lalu jatuh memantul dinamis di atas platform
                const dropCount = 8 + Math.min(6, (bTier - 1) * 2);
                for (let k = 0; k < dropCount; k++) {
                  const angle = -Math.PI / 2 + ((k - (dropCount / 2 - 0.5)) / (dropCount / 2)) * (Math.PI / 3) + (Math.random() - 0.5) * 0.2;
                  const speed = 220 + Math.random() * 120;
                  curSeg.coins.push({
                    id: `boss_coin_${Date.now()}_${k}_${Math.random()}`,
                    x: bCenterX - 8,
                    y: bCenterY - 8,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    w: 16, h: 16,
                    special: k % 2 === 0,
                    collected: false
                  });
                }

                // Hadiah Life Powerup (+1 Extra Nyawa) meletup tinggi di tengah
                curSeg.powerups.push({
                  id: `boss_heart_${Date.now()}`,
                  x: bCenterX - 10,
                  y: bCenterY - 10,
                  vx: (Math.random() - 0.5) * 50,
                  vy: -320,
                  w: 20, h: 20,
                  type: 'life',
                  collected: false
                });
              } else {
                this.audio.bossHit();
                this.addFloatingText(boss.x + 24, boss.y - 14, `HIT! HP: ${boss.hp}/${boss.maxHp}`, '#ef4444');
                // Masuk ke state 'HURT' (flinch / jeda aman 0.75 detik di tanah)
                // Bos DIAM di tanah sambil berkedip terkena pukulan, TIDAK langsung terbang naik menyodok hero!
                boss.state = 'HURT';
                boss.timer = 0.75;
              }
            } else if (this.player.invulnTimer <= 0) {
              // Jika bukan stomp, HANYA beri damage jika bos TIDAK sedang 'HURT' atau 'STUNNED'
              if (boss.state !== 'HURT' && boss.state !== 'STUNNED') {
                this._applyPlayerDamage(false);
              }
            }
          }
        }

        // Update Proyektil & Shockwaves Bos
        for (let i = this.bossProjectiles.length - 1; i >= 0; i--) {
          const pr = this.bossProjectiles[i];
          pr.x += pr.vx * dt;
          pr.y += pr.vy * dt;

          if (Math.abs(pr.x - this.player.x) > 600) {
            this.bossProjectiles.splice(i, 1);
            continue;
          }

          if (pr.type === 'shockwave') {
            pr.life -= dt;
            if (pr.life <= 0) {
              this.bossProjectiles.splice(i, 1);
              continue;
            }
          } else if (pr.type === 'bomb') {
            const bombGroundY = this.world.getSurfaceYAt(pr.x, pr.w || 12);
            if (pr.y >= bombGroundY - (pr.h || 12)) {
              this.particles.spawn(pr.x + 6, bombGroundY, 8, '#facc15', 90);
              this.bossProjectiles.splice(i, 1);
              continue;
            }
          }

          // Tabrakan Proyektil dengan Pemain
          if (CollisionSystem.overlaps(this.player, pr)) {
            if (this.player.invulnTimer <= 0) {
              if (this.player.shieldTimer > 0) {
                this.player.shieldTimer = 0;
                this.player.invulnTimer = CONFIG.PHYSICS.INVULNERABLE_TIME;
                this.audio.damage();
                this.camera.shake(0.2, 5);
                this.addFloatingText(this.player.x + 10, this.player.y - 14, 'SHIELD PECAH!', '#38bdf8');
              } else {
                this._applyPlayerDamage(false);
              }
              this.bossProjectiles.splice(i, 1);
            }
          }
        }

        // 1. Update Active Segments & Moving Platforms
        const { activeSegments, activePlatforms } = this.world.updateActiveSegments(
          this.player.x, dt, this.player, this.audio, this.particles, this.scoring
        );

        // 2. Update Player Physics & Collision
        this.player.update(dt, this.input, activePlatforms, this.audio, this.particles);

        // 3. Cek Jatuh ke Jurang
        if (this.player.y > CONFIG.WORLD.DEATH_Y) {
          this._applyPlayerDamage(true);
          return;
        }

        // 4. Update Koin, Power-up, dan Musuh pada Segmen Aktif
        for (let s = 0; s < activeSegments.length; s++) {
          const seg = activeSegments[s];

          // Koin & Efek Magnet
          for (let i = 0; i < seg.coins.length; i++) {
            const c = seg.coins[i];
            if (c.collected) continue;

            // Animasi Hamburan Fisik Koin (misal dari hadiah kalahnya Boss Titan)
            if (c.vy !== undefined) {
              c.vy += 650 * dt;
              c.x += (c.vx || 0) * dt;
              const prevY = c.y;
              c.y += c.vy * dt;

              // Deteksi pendaratan dinamis pada semua platform aktif di bawah koin (c.x)
              // Menghindari bug koin terjebak di dalam tanah jika terrain memiliki beda level/ketinggian!
              const coinBottom = c.y + (c.h || 16);
              const prevBottom = prevY + (c.h || 16);
              const coinMidX = c.x + (c.w || 16) / 2;

              let landedPlat = null;
              let highestY = Infinity;

              for (let pIdx = 0; pIdx < activePlatforms.length; pIdx++) {
                const plat = activePlatforms[pIdx];
                if (coinMidX >= plat.x && coinMidX <= plat.x + plat.w) {
                  if (prevBottom <= plat.y + 14 && coinBottom >= plat.y) {
                    if (plat.y < highestY) {
                      highestY = plat.y;
                      landedPlat = plat;
                    }
                  }
                }
              }

              if (landedPlat) {
                c.y = landedPlat.y - (c.h || 16);
                if (Math.abs(c.vy) > 40) {
                  c.vy = -c.vy * 0.52;
                  c.vx = (c.vx || 0) * 0.72;
                  if (Math.random() < 0.35) {
                    this.particles.spawn(c.x + 8, c.y + 8, 2, c.special ? '#f472b6' : '#facc15', 50);
                  }
                } else {
                  delete c.vy;
                  delete c.vx;
                  delete c.groundY;
                }
              } else if (c.y > CONFIG.WORLD.DEATH_Y) {
                c.collected = true;
              }
            }

            if (this.player.magnetTimer > 0) {
              const dx = (this.player.x + this.player.w / 2) - (c.x + c.w / 2);
              const dy = (this.player.y + this.player.h / 2) - (c.y + c.h / 2);
              const dist = Math.hypot(dx, dy);
              if (dist < CONFIG.POWERUPS.MAGNET_RADIUS && dist > 1) {
                c.x += (dx / dist) * 320 * dt;
                c.y += (dy / dist) * 320 * dt;
              }
            }

            if (CollisionSystem.overlaps(this.player, c)) {
              c.collected = true;

              // Sistem Combo Koin Berturut-turut
              const now = this.globalTime;
              if (now - this.lastCoinTime < 1.6) {
                this.comboCount = Math.min(10, this.comboCount + 1);
              } else {
                this.comboCount = 1;
              }
              this.lastCoinTime = now;

              const comboBonus = this.comboCount > 1 ? this.comboCount * 5 : 0;
              this.scoring.collectCoin(c.special, (totalCoins) => {
                const maxL = CONFIG.SCORING.MAX_LIVES || 5;
                if (this.scoring.lives < maxL) {
                  this.scoring.lives += 1;
                  this.addFloatingText(this.player.x, this.player.y - 48, `★ ${totalCoins} KOIN: +1 EXTRA NYAWA! ★`, '#22c55e', 'milestone');
                } else {
                  this.scoring.addScore(500);
                  this.addFloatingText(this.player.x, this.player.y - 48, `★ ${totalCoins} KOIN: NYAWA PENUH (+500 SKOR)! ★`, '#facc15', 'milestone');
                }
                this.audio.extraLife();
                this.camera.shake(0.2, 4);
                this.particles.spawn(this.player.x + this.player.w / 2, this.player.y + this.player.h / 2, 16, '#22c55e', 140);
              });
              if (comboBonus > 0) this.scoring.score += comboBonus;

              this.audio.coin(c.special);

              const coinText = c.special 
                ? '+50★ SUPER!' 
                : (this.comboCount > 1 ? `+${10 + comboBonus} (COMBO x${this.comboCount})` : '+10');
              const coinColor = c.special ? '#f472b6' : (this.comboCount > 1 ? '#38bdf8' : '#facc15');

              this.addFloatingText(c.x + 8, c.y - 6, coinText, coinColor, 'coin');
              this.particles.spawn(c.x + 8, c.y + 8, 6, c.special ? '#f72585' : '#ffd166', 110);
              this.particles.spawnPop(c.x + 8, c.y + 8);
              if (c.special) this.camera.shake(0.12, 3);
            }
          }

          // Power-Ups
          for (let i = 0; i < seg.powerups.length; i++) {
            const pu = seg.powerups[i];
            if (pu.collected) continue;

            // Animasi Hamburan Fisik Hadiah Powerup (misal Heart/Shield dari Boss Titan)
            if (pu.vy !== undefined) {
              pu.vy += 620 * dt;
              pu.x += (pu.vx || 0) * dt;
              const prevY = pu.y;
              pu.y += pu.vy * dt;

              const puBottom = pu.y + (pu.h || 20);
              const prevBottom = prevY + (pu.h || 20);
              const puMidX = pu.x + (pu.w || 20) / 2;

              let landedPlat = null;
              let highestY = Infinity;

              for (let pIdx = 0; pIdx < activePlatforms.length; pIdx++) {
                const plat = activePlatforms[pIdx];
                if (puMidX >= plat.x && puMidX <= plat.x + plat.w) {
                  if (prevBottom <= plat.y + 14 && puBottom >= plat.y) {
                    if (plat.y < highestY) {
                      highestY = plat.y;
                      landedPlat = plat;
                    }
                  }
                }
              }

              if (landedPlat) {
                pu.y = landedPlat.y - (pu.h || 20);
                if (Math.abs(pu.vy) > 40) {
                  pu.vy = -pu.vy * 0.48;
                  pu.vx = (pu.vx || 0) * 0.70;
                  this.particles.spawn(pu.x + 10, pu.y + 10, 3, '#ec4899', 60);
                } else {
                  delete pu.vy;
                  delete pu.vx;
                  delete pu.groundY;
                }
              } else if (pu.y > CONFIG.WORLD.DEATH_Y) {
                pu.collected = true;
              }
            }

            if (CollisionSystem.overlaps(this.player, pu)) {
              pu.collected = true;
              this.audio.powerup();
              this.camera.shake(0.15, 4);
              this.vibrate([25, 35, 25]);
              this.particles.spawn(pu.x + 10, pu.y + 10, 10, '#38bdf8', 130);
              this.particles.spawnPop(pu.x + 10, pu.y + 10);
              if (pu.type === 'mushroom') {
                this.audio.grow();
                this.camera.shake(0.2, 5);
                if (!this.player.isBig) {
                  this.player.isBig = true;
                  this.player.y -= 10; // Geser naik agar kaki sejajar platform
                  this.player.w = 28;
                  this.player.h = 36;
                  this.player.growTimer = 0.6;
                  this.scoring.score += 250;
                  this.addFloatingText(pu.x + 10, pu.y - 12, '🍄 SUPER HERO! +250 PTS', '#ef4444');
                  this.particles.spawn(this.player.x + 14, this.player.y + 18, 22, '#ef4444', 160);
                } else {
                  this.scoring.score += 1000;
                  this.addFloatingText(pu.x + 10, pu.y - 12, '🍄 MAX POWER! +1000 PTS', '#f59e0b');
                  this.particles.spawn(this.player.x + 14, this.player.y + 18, 16, '#f59e0b', 140);
                }
              } else if (pu.type === 'shield') {
                this.player.shieldTimer = CONFIG.POWERUPS.SHIELD_DURATION;
                this.addFloatingText(pu.x + 10, pu.y - 12, 'SHIELD AKTIF!', '#38bdf8');
              } else if (pu.type === 'magnet') {
                this.player.magnetTimer = CONFIG.POWERUPS.MAGNET_DURATION;
                this.addFloatingText(pu.x + 10, pu.y - 12, 'MAGNET AKTIF!', '#a855f7');
              } else if (pu.type === 'life') {
                this.scoring.lives = Math.min(CONFIG.SCORING.MAX_LIVES, this.scoring.lives + 1);
                this.addFloatingText(pu.x + 10, pu.y - 12, '+1 EXTRA NYAWA!', '#22c55e');
              }
            }
          }

          // Musuh Deterministik
          for (let i = 0; i < seg.enemies.length; i++) {
            const en = seg.enemies[i];
            if (en.defeated) continue;

            if (en.hitTimer > 0) {
              en.hitTimer = Math.max(0, en.hitTimer - dt);
            }

            // AI Pergerakan Musuh
            en.x += en.vx * dt;
            if (en.x <= en.minX) {
              en.x = en.minX;
              en.vx = Math.abs(en.vx);
            } else if (en.x >= en.maxX) {
              en.x = en.maxX;
              en.vx = -Math.abs(en.vx);
            }

            if (en.type === 'jumper') {
              en.jumpTimer -= dt;
              if (en.jumpTimer <= 0 && en.y >= en.baseY - 1) {
                en.vy = -360;
                en.jumpTimer = 1.4;
              }
              en.vy += CONFIG.PHYSICS.GRAVITY * 0.85 * dt;
              en.y += en.vy * dt;
              if (en.y > en.baseY) {
                en.y = en.baseY;
                en.vy = 0;
              }
            } else if (en.type === 'flyer') {
              en.phase += dt * 3.2;
              en.y = en.baseY + Math.sin(en.phase) * 26;
            } else if (en.type === 'bee') {
              en.phase += dt * 5.2;
              en.y = en.baseY + Math.sin(en.phase) * 18;
            }

            // Anti-Stacking: Musuh darat saling memantul saat berpapasan agar tidak menembus satu sama lain
            if (en.type !== 'flyer' && en.type !== 'bee') {
              for (let j = i + 1; j < seg.enemies.length; j++) {
                const other = seg.enemies[j];
                if (!other.defeated && other.type !== 'flyer' && other.type !== 'bee') {
                  if (Math.abs(en.y - other.y) < 18 && Math.abs(en.x - other.x) < 28) {
                    if (en.x < other.x) {
                      en.vx = -Math.abs(en.vx);
                      other.vx = Math.abs(other.vx);
                    } else {
                      en.vx = Math.abs(en.vx);
                      other.vx = -Math.abs(other.vx);
                    }
                  }
                }
              }
            }

            // Interaksi Tabrakan dengan Pemain
            if (CollisionSystem.overlaps(this.player, en)) {
              const playerBottom = this.player.y + this.player.h;
              const isStomp = this.player.vy > 0 && (playerBottom - this.player.vy * dt) <= en.y + 14;

              if (isStomp) {
                en.hp = (en.hp !== undefined ? en.hp : (en.type === 'tank' ? 3 : 1)) - 1;
                this.player.vy = CONFIG.PHYSICS.BOUNCE_VELOCITY;
                this.audio.stomp();
                this.camera.shake(0.18, 5);
                this.vibrate(20);
                en.hitTimer = 0.25;

                if (en.hp <= 0) {
                  en.defeated = true;
                  this.scoring.defeatEnemy();
                  const pts = en.type === 'tank' ? '+250 TANK HANCUR!' : '+100 STOMP!';
                  if (en.type === 'tank') this.scoring.score += 150;
                  this.addFloatingText(en.x + 12, en.y - 12, pts, '#fb923c');
                  this.particles.spawn(en.x + 12, en.y + 12, en.type === 'tank' ? 24 : 12, '#ff9f1c', 160);
                } else {
                  // Robot masih bertahan (HP berkurang)
                  this.scoring.score += 50;
                  this.addFloatingText(en.x + 12, en.y - 12, `HIT! HP: ${en.hp}/3`, '#ef4444');
                  this.particles.spawn(en.x + 12, en.y + 12, 12, '#38bdf8', 130);
                }
              } else if (this.player.invulnTimer <= 0) {
                if (this.player.shieldTimer > 0) {
                  this.player.shieldTimer = 0;
                  this.player.invulnTimer = CONFIG.PHYSICS.INVULNERABLE_TIME;
                  this.audio.damage();
                  this.camera.shake(0.2, 5);
                  this.addFloatingText(this.player.x + 10, this.player.y - 14, 'SHIELD PECAH!', '#38bdf8');
                  this.particles.spawn(this.player.x + 12, this.player.y + 15, 10, '#38bdf8', 120);
                } else {
                  const dir = this.player.x < en.x ? -1 : 1;
                  this.player.vx = dir * CONFIG.PHYSICS.KNOCKBACK_X;
                  this.player.vy = CONFIG.PHYSICS.KNOCKBACK_Y;
                  this._applyPlayerDamage(false);
                }
              }
            }
          }
        }

        // 5. Update Progress, Camera, & Particles
        this.scoring.updateProgress(this.player.x, 120, dt, (seasonIdx) => {
          const seasonNames = [
            '🌸 MEMASUKI MUSIM SEMI (SPRING) 🌸',
            '☀️ MEMASUKI MUSIM PANAS (SUMMER) ☀️',
            '🍂 MEMASUKI MUSIM GUGUR (AUTUMN) 🍂',
            '❄️ MEMASUKI MUSIM DINGIN (WINTER) ❄️'
          ];
          const seasonColors = ['#f472b6', '#facc15', '#fb923c', '#38bdf8'];
          this.audio.powerup();
          this.camera.shake(0.22, 5);
          this.addFloatingText(this.player.x, this.player.y - 45, seasonNames[seasonIdx], seasonColors[seasonIdx], 'milestone');
        });
        this.camera.update(dt, this.player);
        this.particles.update(dt);
      }

      _applyPlayerDamage(fellInPit) {
        this.vibrate(fellInPit ? [40, 40, 60] : 50);
        // Mario mechanic: Jika berwujud Super Hero dan terkena musuh (bukan jatuh ke jurang),
        // hero menyusut kembali ke wujud Mini Hero tanpa kehilangan nyawa!
        if (!fellInPit && this.player.isBig) {
          this.player.isBig = false;
          this.player.w = 20;
          this.player.h = 26;
          this.player.growTimer = 0.6; // Efek flicker transisi mengecil
          this.player.invulnTimer = CONFIG.PHYSICS.INVULNERABLE_TIME;
          this.audio.shrink();
          this.camera.shake(0.25, 6);
          this.addFloatingText(this.player.x + 10, this.player.y - 14, 'KEMBALI MINI!', '#fbbf24');
          this.particles.spawn(this.player.x + 10, this.player.y + 13, 14, '#fbbf24', 140);
          return;
        }

        this.scoring.lives -= 1;
        this.audio.damage();
        this.camera.shake(0.35, 9);
        this.addFloatingText(this.player.x + 10, this.player.y - 14, '-1 NYAWA', '#ff4d6d');
        this.particles.spawn(this.player.x + 12, this.player.y + 15, 14, '#ff4d6d', 150);

        if (this.scoring.lives <= 0) {
          this.triggerGameOver();
          return;
        }

        this.player.invulnTimer = CONFIG.PHYSICS.INVULNERABLE_TIME;
        if (fellInPit) {
          this.player.isBig = false;
          this.player.w = 20;
          this.player.h = 26;
          this.player.x = this.player.safeCheckpoint.x;
          this.player.y = this.player.safeCheckpoint.y;
          this.player.vx = 0;
          this.player.vy = 0;
          this.player.onGround = true;
          this.player.groundPlatform = null;
          this.player.invulnTimer = 2.2;
          this.camera.x = this.player.x - 120;
        }
      }

      _updateHUD() {
        if (!this._hud) {
          this._hud = {
            lives: document.getElementById('hud-lives'),
            score: document.getElementById('hud-score'),
            high: document.getElementById('hud-high'),
            coins: document.getElementById('hud-coins'),
            dist: document.getElementById('hud-dist'),
            season: document.getElementById('hud-season'),
            time: document.getElementById('hud-time'),
            pBar: document.getElementById('powerup-bar')
          };
          this._hudCache = {};
        }

        const h = this._hud;
        const c = this._hudCache;

        if (c.lives !== this.scoring.lives) {
          c.lives = this.scoring.lives;
          let heartsHtml = '';
          const maxLives = CONFIG.SCORING.MAX_LIVES || 3;
          for (let i = 0; i < maxLives; i++) {
            heartsHtml += '<img class="pixel-heart" src="assets/ui/' + (i < c.lives ? 'heart' : 'heart_empty') + '.png" alt="heart">';
          }
          h.lives.innerHTML = heartsHtml;
        }

        if (c.score !== this.scoring.score) {
          c.score = this.scoring.score;
          h.score.textContent = c.score;
        }

        if (c.high !== this.scoring.highScore) {
          c.high = this.scoring.highScore;
          h.high.textContent = c.high;
        }

        if (c.coins !== this.scoring.coins) {
          c.coins = this.scoring.coins;
          h.coins.textContent = c.coins;
        }

        if (c.dist !== this.scoring.maxDistanceMeters) {
          c.dist = this.scoring.maxDistanceMeters;
          h.dist.textContent = `${c.dist}m`;
        }

        const curSeasonIdx = ((this.scoring.startSeason || 0) + Math.floor(this.scoring.maxDistanceMeters / 500)) % 4;
        if (c.season !== curSeasonIdx && h.season) {
          c.season = curSeasonIdx;
          const sBadges = ['🌸 SEMI', '☀️ PANAS', '🍂 GUGUR', '❄️ DINGIN'];
          h.season.textContent = sBadges[curSeasonIdx];
        }

        const fTime = this.scoring.formatTime();
        if (c.time !== fTime) {
          c.time = fTime;
          h.time.textContent = fTime;
        }

        let badges = '';
        if (this.player.isBig) {
          badges += `<div class="badge badge-super" style="color:#ef4444;border-color:#ef4444;"><img class="ico" style="width:16px;height:16px;object-fit:cover;object-position:0 0;margin-right:4px;" src="assets/items/mushroom_super.png">SUPER</div>`;
        }
        if (this.player.shieldTimer > 0) {
          badges += `<div class="badge badge-shield"><img class="ico" style="width:16px;height:16px;object-fit:cover;object-position:0 0;margin-right:4px;" src="assets/items/shield_melon.png">SHIELD ${Math.ceil(this.player.shieldTimer)}s</div>`;
        }
        if (this.player.magnetTimer > 0) {
          badges += `<div class="badge badge-magnet"><img class="ico" style="width:16px;height:16px;object-fit:cover;object-position:0 0;margin-right:4px;" src="assets/items/magnet_pineapple.png">MAGNET ${Math.ceil(this.player.magnetTimer)}s</div>`;
        }
        if (c.badges !== badges) {
          c.badges = badges;
          h.pBar.innerHTML = badges;
        }
      }

      _renderFrame() {
        const currentSegIdx = Math.floor(this.player.x / CONFIG.WORLD.SEGMENT_WIDTH);
        const activeSegments = this._activeSegments = this._activeSegments || [];
        activeSegments.length = 0;
        for (let idx = Math.max(-1, currentSegIdx - 2); idx <= currentSegIdx + 2; idx++) {
          activeSegments.push(this.world.getOrCreateSegment(idx));
        }
        this.renderer.render(
          this.camera,
          this.player,
          activeSegments,
          this.particles,
          this.globalTime,
          this.floatingTexts,
          this.boss,
          this.bossAlertTimer,
          this.bossProjectiles,
          this.scoring ? (this.scoring.startSeason || 0) : 0,
          this.mp ? this.mp.peers : null
        );

        if (this.state === 'START') {
          this._renderStartHeroPreview();
        }
      }

      _renderStartHeroPreview() {
        if (!this._heroPreviewCanvas) {
          this._heroPreviewCanvas = document.getElementById('start-hero-canvas');
          this._heroPreviewCtx = this._heroPreviewCanvas?.getContext('2d');
        }
        const ctx = this._heroPreviewCtx;
        if (!ctx) return;
        ctx.clearRect(0, 0, 64, 64);
        const skin = this.storage.getSelectedSkin() || 'scout';
        const img = PLAYER_SPRITES[skin]?.Idle;
        if (img && img.complete && img.naturalWidth) {
          const totalFrames = (img.naturalWidth >> 5) || 1;
          const fr = Math.floor(this.globalTime * 8) % totalFrames;
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, fr * 32, 0, 32, 32, 0, 0, 64, 64);
        }
      }
    }

// Global window assignments for direct file:// compatibility
window.Game = Game;
