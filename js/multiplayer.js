/**
     * ============================================================================
     * 10b. MULTIPLAYER MANAGER (Agar.io Style Instant Drop-In)
     * Sinkronisasi data pemain online global via MQTT WebSocket broker.
     * ============================================================================
     */
    class MultiplayerManager {
      constructor(game) {
        this.game = game;
        this.client = null;
        this.connected = false;
        this.myId = 'p_' + Math.random().toString(16).substring(2, 10);
        this.peers = new Map();
        this.topic = 'balongbesuk/offline-adventure/global/v1';
        this.recordsTopic = 'balongbesuk/offline-adventure/global/records-v1';
        this.sendTimer = 0;
        this.sendInterval = 0.125; // 8 fps sync (optimal & hemat data)
        this.statusText = 'OFFLINE';
        this.reconnectTimer = null;
        window.addEventListener('beforeunload', () => this.leave());
      }

      connect() {
        if (typeof Paho === 'undefined' || !Paho.MQTT) {
          this.statusText = 'OFFLINE (SOLO)';
          this._updateStatusUI();
          return;
        }

        if (this.client && this.connected) return;

        try {
          const clientId = 'oa_' + this.myId + '_' + Date.now().toString(36);
          this.client = new Paho.MQTT.Client('broker.emqx.io', 8084, '/mqtt', clientId);

          this.client.onConnectionLost = () => {
            this.connected = false;
            this.statusText = 'RECONNECTING...';
            this._updateStatusUI();
            this._scheduleReconnect();
          };

          this.client.onMessageArrived = (msg) => {
            try {
              const data = JSON.parse(msg.payloadString);
              if (msg.destinationName === this.recordsTopic || (data && data.type === 'sync_record')) {
                this._handleRecordMessage(data);
              } else {
                this._handleMessage(data);
              }
            } catch {}
          };

          this.client.connect({
            useSSL: true,
            timeout: 4,
            keepAliveInterval: 20,
            cleanSession: true,
            onSuccess: () => {
              this.connected = true;
              this.statusText = 'ONLINE (GLOBAL)';
              this._updateStatusUI();
              try {
                this.client.subscribe(this.topic, { qos: 0 });
                this.client.subscribe(this.recordsTopic, { qos: 0 });
                if (this.game.state === 'PLAYING') {
                  this.broadcastState();
                }
                const hs = this.game.storage.getHighScore();
                if (hs > 0) {
                  this.broadcastRecord(this.game.storage.getPlayerName(), hs);
                }
              } catch {}
            },
            onFailure: () => {
              this.connected = false;
              this.statusText = 'OFFLINE (SOLO)';
              this._updateStatusUI();
            }
          });
        } catch {
          this.connected = false;
          this.statusText = 'OFFLINE (SOLO)';
          this._updateStatusUI();
        }
      }

      _scheduleReconnect() {
        if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
        this.reconnectTimer = setTimeout(() => {
          if (!this.connected && this.game.state === 'PLAYING') {
            this.connect();
          }
        }, 5000);
      }

      _updateStatusUI() {
        const el = document.getElementById('network-status-tag');
        if (el) {
          if (this.connected) {
            el.textContent = '🟢 ONLINE GLOBAL';
            el.style.color = '#22c55e';
          } else {
            el.textContent = '⚪ SOLO OFFLINE';
            el.style.color = '#94a3b8';
          }
        }
      }

      _handleMessage(data) {
        if (!data || data.id === this.myId) return;

        if (data.leave) {
          this.peers.delete(data.id);
          return;
        }

        // Abaikan paket tidak valid / koordinat NaN
        if (!Number.isFinite(data.x) || !Number.isFinite(data.y)) return;

        const now = performance.now();
        const cleanName = String(data.n || 'HERO').trim().substring(0, 12).replace(/[^A-Za-z0-9_]/g, '') || 'HERO';
        let peer = this.peers.get(data.id);
        if (!peer) {
          peer = {
            id: data.id,
            name: cleanName,
            skin: data.s || 'scout',
            x: data.x,
            y: data.y,
            targetX: data.x,
            targetY: data.y,
            vx: data.vx || 0,
            vy: data.vy || 0,
            facing: data.f || 1,
            score: data.sc || 0,
            dist: data.d || 0,
            activeEmote: data.em ? { icon: data.em, timer: 2.2, maxTimer: 2.2 } : null,
            lastSeen: now
          };
          this.peers.set(data.id, peer);
        } else {
          peer.name = cleanName;
          peer.skin = data.s || peer.skin;
          peer.targetX = data.x;
          peer.targetY = data.y;
          peer.vx = data.vx || 0;
          peer.vy = data.vy || 0;
          peer.facing = data.f || peer.facing;
          peer.score = data.sc || 0;
          peer.dist = data.d || 0;
          if (data.em) {
            peer.activeEmote = { icon: data.em, timer: 2.2, maxTimer: 2.2 };
          }
          peer.lastSeen = now;
        }
      }

      update(dt) {
        const now = performance.now();
        for (const [id, peer] of this.peers.entries()) {
          // Buang pemain yang tidak mengirim update selama > 4 detik
          if (now - peer.lastSeen > 4000) {
            this.peers.delete(id);
            continue;
          }

          // Interpolasi posisi mulus
          peer.x += (peer.targetX - peer.x) * Math.min(1, dt * 14);
          peer.y += (peer.targetY - peer.y) * Math.min(1, dt * 14);

          if (peer.activeEmote) {
            peer.activeEmote.timer -= dt;
            if (peer.activeEmote.timer <= 0) peer.activeEmote = null;
          }
        }

        if (this.connected && this.game.state === 'PLAYING') {
          this.sendTimer += dt;
          // Idle packet throttling: 2 fps saat diam, 8 fps saat bergerak/ber-emote (hemat 60% kuota & daya)
          const p = this.game.player;
          const isIdle = p && Math.abs(p.vx) < 1 && Math.abs(p.vy) < 1 && !p.activeEmote;
          const currentInterval = isIdle ? 0.5 : this.sendInterval;
          if (this.sendTimer >= currentInterval) {
            this.sendTimer = 0;
            this.broadcastState();
          }

          this.lbTimer = (this.lbTimer || 0) + dt;
          if (this.lbTimer >= 0.35) {
            this.lbTimer = 0;
            this._updateLiveLeaderboard();
          }
        }
      }

      broadcastState() {
        if (!this.connected || !this.client || !this.game.player) return;

        const p = this.game.player;
        const payload = {
          id: this.myId,
          n: this.game.storage.getPlayerName(),
          s: p.skin,
          x: Math.round(p.x),
          y: Math.round(p.y),
          vx: Math.round(p.vx),
          vy: Math.round(p.vy),
          f: p.facing,
          sc: this.game.scoring ? this.game.scoring.score : 0,
          d: this.game.scoring ? Math.floor(p.x / CONFIG.WORLD.PIXELS_PER_METER) : 0,
          em: p.activeEmote && p.activeEmote.timer > 1.8 ? p.activeEmote.icon : null
        };

        try {
          const message = new Paho.MQTT.Message(JSON.stringify(payload));
          message.destinationName = this.topic;
          message.qos = 0;
          this.client.send(message);
        } catch {}
      }

      broadcastEmote(icon) {
        if (!this.connected || !this.client || !this.game.player) return;
        const p = this.game.player;
        const payload = {
          id: this.myId,
          n: this.game.storage.getPlayerName(),
          s: p.skin,
          x: Math.round(p.x),
          y: Math.round(p.y),
          vx: Math.round(p.vx),
          vy: Math.round(p.vy),
          f: p.facing,
          sc: this.game.scoring ? this.game.scoring.score : 0,
          d: this.game.scoring ? Math.floor(p.x / CONFIG.WORLD.PIXELS_PER_METER) : 0,
          em: icon
        };
        try {
          const message = new Paho.MQTT.Message(JSON.stringify(payload));
          message.destinationName = this.topic;
          message.qos = 0;
          this.client.send(message);
        } catch {}
      }

      leave() {
        if (this.connected && this.client) {
          try {
            const message = new Paho.MQTT.Message(JSON.stringify({ id: this.myId, leave: true }));
            message.destinationName = this.topic;
            message.qos = 0;
            this.client.send(message);
          } catch {}
        }
        this.peers.clear();
        this._lastLbHtml = '';
        this._lastCount = -1;
        const liveCard = document.getElementById('live-leaderboard');
        if (liveCard) liveCard.classList.add('hidden');
      }

      _handleRecordMessage(data) {
        if (!data || data.id === this.myId) return;
        const score = Number(data.score ?? data.sc);
        const name = String(data.name ?? data.n ?? '');
        if (score > 0 && name) {
          const updated = this.game.storage.addGlobalLeaderboardEntry({
            id: data.id,
            name: name,
            score: score,
            timestamp: data.timestamp || Date.now()
          });
          if (updated && this.game.activeLbTab === 'global') {
            const screenLb = document.getElementById('screen-leaderboard');
            if (screenLb && !screenLb.classList.contains('hidden')) {
              this.game._renderLeaderboardUI();
            }
          }
        }
      }

      broadcastRecord(name, score) {
        if (!this.connected || !this.client || score <= 0) return;
        try {
          const cleanName = String(name || this.game.storage.getPlayerName()).trim().substring(0, 12).replace(/[^A-Za-z0-9_]/g, '') || 'HERO';
          const cleanScore = Math.min(9999999, Math.floor(score));
          const payload = {
            type: 'sync_record',
            id: this.myId,
            name: cleanName,
            score: cleanScore,
            timestamp: Date.now()
          };
          const message = new Paho.MQTT.Message(JSON.stringify(payload));
          message.destinationName = this.recordsTopic;
          message.qos = 0;
          this.client.send(message);
        } catch {}
      }

      _updateLiveLeaderboard() {
        const liveCard = document.getElementById('live-leaderboard');
        const listEl = document.getElementById('live-lb-list');
        const countEl = document.getElementById('live-online-count');
        if (!liveCard || !listEl) return;

        // Sembunyikan dan skip rendering jika sedang tidak bermain atau sendirian
        if (this.game.state !== 'PLAYING' || this.peers.size === 0) {
          liveCard.classList.add('hidden');
          return;
        }
        liveCard.classList.remove('hidden');

        const all = [];
        const myName = this.game.storage.getPlayerName();
        const myScore = this.game.scoring ? this.game.scoring.score : 0;
        all.push({ name: myName, score: myScore, isMe: true });

        for (const peer of this.peers.values()) {
          all.push({ name: peer.name, score: peer.score, isMe: false });
        }

        all.sort((a, b) => b.score - a.score);
        const top5 = all.slice(0, 5);

        if (countEl && this._lastCount !== all.length) {
          this._lastCount = all.length;
          countEl.textContent = `${all.length} Online`;
        }

        const html = top5.map((p, idx) => {
          const rank = idx + 1;
          const crown = rank === 1 ? '👑 ' : '';
          const style = p.isMe ? 'color: #38bdf8; font-weight: bold;' : 'color: #e2e8f0;';
          const safeName = String(p.name).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
          return `<div style="display:flex; justify-content:space-between; margin-bottom:2px; ${style}">
            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:85px;">${crown}${rank}. ${safeName}</span>
            <span style="color:#facc15; margin-left:6px; font-weight:bold;">${p.score.toLocaleString()}</span>
          </div>`;
        }).join('');

        if (this._lastLbHtml !== html) {
          this._lastLbHtml = html;
          listEl.innerHTML = html;
        }
      }
    }

// Global window assignments for direct file:// compatibility
window.MultiplayerManager = MultiplayerManager;
