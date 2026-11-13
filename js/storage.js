/**
     * ============================================================================
     * 2. STORAGE MODULE (js/storage.js)
     * Menangani penyimpanan localStorage dengan fallback di memori jika diblokir.
     * ============================================================================
     */
    class StorageManager {
      constructor() {
        this.memoryFallback = {
          [CONFIG.STORAGE_KEYS.HIGH_SCORE]: 0,
          [CONFIG.STORAGE_KEYS.MUTED]: false,
          [CONFIG.STORAGE_KEYS.TOTAL_COINS]: 0,
          [CONFIG.STORAGE_KEYS.SKIN]: 'scout',
          [CONFIG.STORAGE_KEYS.UNLOCKED_SKINS]: '["scout"]',
          [CONFIG.STORAGE_KEYS.UNLOCKED_EMOTES]: '["laugh"]',
          [CONFIG.STORAGE_KEYS.PLAYER_NAME]: 'YOU',
          [CONFIG.STORAGE_KEYS.LEADERBOARD]: '[]',
          [CONFIG.STORAGE_KEYS.GLOBAL_LEADERBOARD]: JSON.stringify(DEFAULT_GLOBAL_LEADERBOARD)
        };
      }

      getHighScore() {
        try {
          const val = localStorage.getItem(CONFIG.STORAGE_KEYS.HIGH_SCORE);
          return val !== null ? Math.max(0, parseInt(val, 10) || 0) : this.memoryFallback[CONFIG.STORAGE_KEYS.HIGH_SCORE];
        } catch {
          return this.memoryFallback[CONFIG.STORAGE_KEYS.HIGH_SCORE];
        }
      }

      setHighScore(score) {
        const clean = Math.floor(score);
        if (clean > this.getHighScore()) {
          this.memoryFallback[CONFIG.STORAGE_KEYS.HIGH_SCORE] = clean;
          try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.HIGH_SCORE, String(clean));
          } catch {}
          return true;
        }
        return false;
      }

      getMuted() {
        try {
          const val = localStorage.getItem(CONFIG.STORAGE_KEYS.MUTED);
          return val !== null ? val === 'true' : this.memoryFallback[CONFIG.STORAGE_KEYS.MUTED];
        } catch {
          return this.memoryFallback[CONFIG.STORAGE_KEYS.MUTED];
        }
      }

      setMuted(muted) {
        this.memoryFallback[CONFIG.STORAGE_KEYS.MUTED] = Boolean(muted);
        try {
          localStorage.setItem(CONFIG.STORAGE_KEYS.MUTED, String(Boolean(muted)));
        } catch {}
      }

      getTotalCoins() {
        try {
          const val = localStorage.getItem(CONFIG.STORAGE_KEYS.TOTAL_COINS);
          return val !== null ? Math.max(0, parseInt(val, 10) || 0) : this.memoryFallback[CONFIG.STORAGE_KEYS.TOTAL_COINS];
        } catch {
          return this.memoryFallback[CONFIG.STORAGE_KEYS.TOTAL_COINS];
        }
      }

      addTotalCoins(amount) {
        const current = this.getTotalCoins();
        const updated = current + amount;
        this.memoryFallback[CONFIG.STORAGE_KEYS.TOTAL_COINS] = updated;
        try {
          localStorage.setItem(CONFIG.STORAGE_KEYS.TOTAL_COINS, String(updated));
        } catch {}
        return updated;
      }

      spendTotalCoins(amount) {
        const current = this.getTotalCoins();
        if (current >= amount) {
          const updated = current - amount;
          this.memoryFallback[CONFIG.STORAGE_KEYS.TOTAL_COINS] = updated;
          try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.TOTAL_COINS, String(updated));
          } catch {}
          return true;
        }
        return false;
      }

      getSelectedSkin() {
        try {
          const val = localStorage.getItem(CONFIG.STORAGE_KEYS.SKIN);
          return val || this.memoryFallback[CONFIG.STORAGE_KEYS.SKIN];
        } catch {
          return this.memoryFallback[CONFIG.STORAGE_KEYS.SKIN];
        }
      }

      setSelectedSkin(skinId) {
        this.memoryFallback[CONFIG.STORAGE_KEYS.SKIN] = skinId;
        try {
          localStorage.setItem(CONFIG.STORAGE_KEYS.SKIN, skinId);
        } catch {}
      }

      getUnlockedSkins() {
        try {
          const val = localStorage.getItem(CONFIG.STORAGE_KEYS.UNLOCKED_SKINS);
          const parsed = JSON.parse(val || this.memoryFallback[CONFIG.STORAGE_KEYS.UNLOCKED_SKINS]);
          return Array.isArray(parsed) ? parsed : ['scout'];
        } catch {
          return ['scout'];
        }
      }

      unlockSkin(skinId) {
        const unlocked = this.getUnlockedSkins();
        if (!unlocked.includes(skinId)) {
          unlocked.push(skinId);
          const serialized = JSON.stringify(unlocked);
          this.memoryFallback[CONFIG.STORAGE_KEYS.UNLOCKED_SKINS] = serialized;
          try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.UNLOCKED_SKINS, serialized);
          } catch {}
          return true;
        }
        return false;
      }

      getUnlockedEmotes() {
        try {
          const val = localStorage.getItem(CONFIG.STORAGE_KEYS.UNLOCKED_EMOTES);
          const parsed = JSON.parse(val || this.memoryFallback[CONFIG.STORAGE_KEYS.UNLOCKED_EMOTES]);
          return Array.isArray(parsed) && parsed.length > 0 ? parsed : ['laugh'];
        } catch {
          return ['laugh'];
        }
      }

      unlockEmote(emoteId) {
        const unlocked = this.getUnlockedEmotes();
        if (!unlocked.includes(emoteId)) {
          unlocked.push(emoteId);
          const serialized = JSON.stringify(unlocked);
          this.memoryFallback[CONFIG.STORAGE_KEYS.UNLOCKED_EMOTES] = serialized;
          try {
            localStorage.setItem(CONFIG.STORAGE_KEYS.UNLOCKED_EMOTES, serialized);
          } catch {}
          return true;
        }
        return false;
      }

      getPlayerName() {
        try {
          let name = localStorage.getItem(CONFIG.STORAGE_KEYS.PLAYER_NAME) || this.memoryFallback[CONFIG.STORAGE_KEYS.PLAYER_NAME];
          if (!name) {
            name = 'HERO' + Math.floor(10 + Math.random() * 90);
            this.setPlayerName(name);
          }
          return name;
        } catch {
          return this.memoryFallback[CONFIG.STORAGE_KEYS.PLAYER_NAME] || 'HERO99';
        }
      }

      setPlayerName(name) {
        const clean = (name || 'HERO').trim().substring(0, 12).toUpperCase().replace(/[^A-Z0-9_]/g, '') || 'HERO99';
        this.memoryFallback[CONFIG.STORAGE_KEYS.PLAYER_NAME] = clean;
        try {
          localStorage.setItem(CONFIG.STORAGE_KEYS.PLAYER_NAME, clean);
        } catch {}
        return clean;
      }

      getLeaderboard() {
        try {
          const val = localStorage.getItem(CONFIG.STORAGE_KEYS.LEADERBOARD);
          if (val !== null) {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) return parsed;
          }
          return JSON.parse(this.memoryFallback[CONFIG.STORAGE_KEYS.LEADERBOARD] || '[]');
        } catch {
          return JSON.parse(this.memoryFallback[CONFIG.STORAGE_KEYS.LEADERBOARD] || '[]');
        }
      }

      resetLeaderboard() {
        const emptyBoard = [];
        const serialized = JSON.stringify(emptyBoard);
        this.memoryFallback[CONFIG.STORAGE_KEYS.LEADERBOARD] = serialized;
        this.memoryFallback[CONFIG.STORAGE_KEYS.HIGH_SCORE] = 0;
        try {
          localStorage.setItem(CONFIG.STORAGE_KEYS.LEADERBOARD, serialized);
          localStorage.setItem(CONFIG.STORAGE_KEYS.HIGH_SCORE, '0');
        } catch {}
        return emptyBoard;
      }

      isLeaderboardEligible(score) {
        const cleanScore = Math.floor(score);
        if (cleanScore <= 0) return false;
        const board = this.getLeaderboard();
        if (board.length < 10) return true;
        return cleanScore >= (board[board.length - 1]?.score || 0);
      }

      addLeaderboardEntry(name, score, entryId = null) {
        const cleanName = (name || 'YOU').trim().substring(0, 12).toUpperCase().replace(/[^A-Z0-9_]/g, '') || 'YOU';
        this.setPlayerName(cleanName);
        const cleanScore = Math.max(0, Math.floor(score));

        if (cleanScore > this.getHighScore()) {
          this.setHighScore(cleanScore);
        }

        let board = this.getLeaderboard();

        // Jika mengupdate entry yang sudah dibuat (misal dari input inisial)
        if (entryId) {
          const existing = board.find(b => b.id === entryId);
          if (existing) {
            existing.name = cleanName;
            existing.score = Math.max(existing.score, cleanScore);
            board.sort((a, b) => b.score - a.score);
            const top10 = board.slice(0, 10);
            const serialized = JSON.stringify(top10);
            this.memoryFallback[CONFIG.STORAGE_KEYS.LEADERBOARD] = serialized;
            try { localStorage.setItem(CONFIG.STORAGE_KEYS.LEADERBOARD, serialized); } catch {}
            const rank = top10.findIndex(item => item.id === entryId) + 1;
            return { board: top10, rank: rank > 0 ? rank : null, cleanName, cleanScore, entryId };
          }
        }

        const newId = entryId || ('rec_' + Date.now());
        board.push({ id: newId, name: cleanName, score: cleanScore, timestamp: Date.now() });
        board.sort((a, b) => b.score - a.score);

        const top10 = board.slice(0, 10);
        const serialized = JSON.stringify(top10);
        this.memoryFallback[CONFIG.STORAGE_KEYS.LEADERBOARD] = serialized;
        try {
          localStorage.setItem(CONFIG.STORAGE_KEYS.LEADERBOARD, serialized);
        } catch {}

        const rank = top10.findIndex(item => item.id === newId) + 1;
        return { board: top10, rank: rank > 0 ? rank : null, cleanName, cleanScore, entryId: newId };
      }

      getGlobalLeaderboard() {
        try {
          const val = localStorage.getItem(CONFIG.STORAGE_KEYS.GLOBAL_LEADERBOARD);
          if (val !== null) {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed) && parsed.length > 0) return parsed;
          }
          return JSON.parse(this.memoryFallback[CONFIG.STORAGE_KEYS.GLOBAL_LEADERBOARD] || '[]');
        } catch {
          return JSON.parse(this.memoryFallback[CONFIG.STORAGE_KEYS.GLOBAL_LEADERBOARD] || '[]');
        }
      }

      addGlobalLeaderboardEntry(entry) {
        if (!entry) return false;
        const cleanScore = Math.floor(Number(entry.score ?? entry.sc));
        if (isNaN(cleanScore) || cleanScore <= 0 || cleanScore > 9999999) return false;

        const cleanName = String(entry.name || entry.n || 'HERO')
          .trim()
          .substring(0, 12)
          .replace(/[^A-Za-z0-9_]/g, '') || 'HERO';

        let board = this.getGlobalLeaderboard();

        // Cari apakah pemain dengan id atau nama yang sama sudah ada di papan rekor
        const existingIdx = board.findIndex(b => (entry.id && b.id === entry.id) || (b.name.toUpperCase() === cleanName.toUpperCase()));
        if (existingIdx !== -1) {
          if (cleanScore > board[existingIdx].score) {
            board[existingIdx].score = cleanScore;
            board[existingIdx].timestamp = entry.timestamp || Date.now();
          } else {
            return false;
          }
        } else {
          board.push({
            id: entry.id || ('g_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6)),
            name: cleanName,
            score: cleanScore,
            timestamp: entry.timestamp || Date.now(),
            region: entry.region || 'ONLINE'
          });
        }

        board.sort((a, b) => b.score - a.score);
        const top15 = board.slice(0, 15);
        const serialized = JSON.stringify(top15);
        this.memoryFallback[CONFIG.STORAGE_KEYS.GLOBAL_LEADERBOARD] = serialized;
        try {
          localStorage.setItem(CONFIG.STORAGE_KEYS.GLOBAL_LEADERBOARD, serialized);
        } catch {}
        return true;
      }
    }

// Global window assignments for direct file:// compatibility
window.StorageManager = StorageManager;
