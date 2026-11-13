/**
     * ============================================================================
     * 10. SCORING MODULE (js/scoring.js)
     * Mengelola Skor, Koin, Nyawa, Progress Coordinate (Jarak), dan High Score.
     * ============================================================================
     */
    class ScoringSystem {
      constructor(storage) {
        this.storage = storage;
        this.highScore = this.storage.getHighScore();
        this.reset();
      }

      reset() {
        this.score = 0;
        this.coins = 0;
        this.lives = CONFIG.SCORING.INITIAL_LIVES;
        this.maxDistanceMeters = 0;
        this.elapsedTime = 0;
        // Musim awal diacak setiap sesi permainan baru (0: Semi, 1: Panas, 2: Gugur, 3: Dingin)
        this.startSeason = Math.floor(Math.random() * 4);
      }

      updateProgress(playerX, startX, dt, onNewSeason = null) {
        this.elapsedTime += dt;
        const meters = Math.max(0, Math.floor((playerX - startX) / CONFIG.WORLD.PIXELS_PER_METER));
        const oldSeason = Math.floor(this.maxDistanceMeters / 500);
        const newSeason = Math.floor(meters / 500);

        // Jarak tempuh hanya bertambah saat pemain mencapai progress baru, tidak berkurang saat mundur
        if (meters > this.maxDistanceMeters) {
          const diff = meters - this.maxDistanceMeters;
          this.maxDistanceMeters = meters;
          this.addScore(diff * CONFIG.SCORING.DISTANCE_MULTIPLIER);
          if (newSeason > oldSeason && onNewSeason) {
            onNewSeason((this.startSeason + newSeason) % 4, newSeason);
          }
        }
      }

      addScore(points) {
        this.score += points;
        if (this.score > this.highScore) {
          this.highScore = this.score;
          this.storage.setHighScore(this.highScore);
        }
      }

      collectCoin(isSpecial, onBonusLife = null) {
        const oldHundreds = Math.floor(this.coins / 100);
        this.coins += 1;
        const newHundreds = Math.floor(this.coins / 100);
        this.storage.addTotalCoins(1);
        this.addScore(isSpecial ? CONFIG.SCORING.COIN_SPECIAL : CONFIG.SCORING.COIN_NORMAL);

        // Setiap 100 koin terkumpul dalam sesi permainan memicu bonus 1 nyawa
        if (newHundreds > oldHundreds && onBonusLife) {
          onBonusLife(this.coins);
        }
      }

      defeatEnemy() {
        this.addScore(CONFIG.SCORING.ENEMY_DEFEAT);
      }

      formatTime() {
        const totalSec = Math.floor(this.elapsedTime);
        const mins = String(Math.floor(totalSec / 60)).padStart(2, '0');
        const secs = String(totalSec % 60).padStart(2, '0');
        return `${mins}:${secs}`;
      }
    }

// Global window assignments for direct file:// compatibility
window.ScoringSystem = ScoringSystem;
