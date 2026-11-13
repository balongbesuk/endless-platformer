/**
     * ============================================================================
     * 1. CONFIG MODULE (js/config.js)
     * Konfigurasi terpusat untuk Physics, World Generation, Scoring, dan Memory.
     * ============================================================================
     */
    const CONFIG = Object.freeze({
      CANVAS_WIDTH: 800,
      CANVAS_HEIGHT: 450,
      FIXED_DT: 1 / 60,
      MAX_SUBSTEPS: 5,

      PHYSICS: {
        GRAVITY: 1450,
        MAX_FALL_SPEED: 720,
        ACCEL_GROUND: 1500,
        ACCEL_AIR: 950,
        FRICTION_GROUND: 1350,
        FRICTION_AIR: 180,
        MAX_WALK_SPEED: 210,
        MAX_RUN_SPEED: 315,
        JUMP_VELOCITY: -520,
        JUMP_CUT_MULTIPLIER: 0.45,
        COYOTE_TIME: 0.11,
        JUMP_BUFFER_TIME: 0.12,
        BOUNCE_VELOCITY: -360,
        KNOCKBACK_X: 220,
        KNOCKBACK_Y: -280,
        INVULNERABLE_TIME: 1.35
      },

      WORLD: {
        GROUND_Y: 380,
        DEATH_Y: 540,
        SEGMENT_WIDTH: 640,
        MIN_BOUND_X: 0,
        ACTIVE_RADIUS_SEGMENTS: 3,      // Segmen aktif di kiri & kanan pemain
        CACHE_RETENTION_SEGMENTS: 18,   // Batas segmen disimpan di memori untuk eksplorasi mundur
        PIXELS_PER_METER: 32,
        SAFE_JUMP_MARGIN: 0.82          // Faktor keamanan validasi lompatan physics
      },

      SCORING: {
        COIN_NORMAL: 10,
        COIN_SPECIAL: 50,
        ENEMY_DEFEAT: 100,
        DISTANCE_MULTIPLIER: 2,         // Poin per meter baru yang berhasil dicapai
        INITIAL_LIVES: 3,
        MAX_LIVES: 5
      },

      POWERUPS: {
        SHIELD_DURATION: 8.0,
        MAGNET_DURATION: 10.0,
        MAGNET_RADIUS: 150
      },

      STORAGE_KEYS: {
        HIGH_SCORE: 'oa_high_score_v1',
        MUTED: 'oa_audio_muted_v1',
        TOTAL_COINS: 'oa_total_coins_v1',
        SKIN: 'oa_selected_skin_v1',
        UNLOCKED_SKINS: 'oa_unlocked_skins_v1',
        UNLOCKED_EMOTES: 'oa_unlocked_emotes_v1',
        LEADERBOARD: 'oa_arcade_leaderboard_v1',
        GLOBAL_LEADERBOARD: 'oa_global_leaderboard_v1',
        PLAYER_NAME: 'oa_player_name_v1'
      }
    });

    /**
     * Daftar Pilihan Kostum Karakter
     */
    // Helper pemuatan gambar dengan decoding asinkron agar bebas stutter di canvas
    const loadImage = (src) => {
      const img = new Image();
      img.src = src;
      if (img.decode) img.decode().catch(() => {});
      return img;
    };

    // Pixel Adventure 1 (CC0): per skin 5 strip horizontal, frame 32x32
    const PLAYER_SPRITES = Object.fromEntries(['scout', 'ninja', 'knight', 'retro'].map(s => [s,
      Object.fromEntries(['Idle', 'Run', 'Jump', 'Fall', 'Hit'].map(k => [k, loadImage(`assets/player/${s}/${k}.png`)]))
    ]));

    // Kenney Pixel Platformer (CC0): tiles.png = tilemap 18px (20 kolom), bg.png = latar, chars.png = karakter/musuh 24px (9 kolom)
    const KENNEY = Object.fromEntries(['tiles', 'bg', 'chars'].map(k => [k, loadImage(`assets/kenney/${k}.png`)]));

    // Aset Pepohonan & Semak Asli 4 Musim (Pixel Art PNG Bergaris Kontur Presisi)
    const TREE_ASSETS = ['spring', 'summer', 'autumn', 'winter'].map(k => ({
      large: loadImage(`assets/scenery/tree_${k}_large.png`),
      small: loadImage(`assets/scenery/tree_${k}_small.png`)
    }));

    const BUSH_ASSETS = ['spring', 'summer', 'autumn', 'winter'].map(k => loadImage(`assets/scenery/bush_${k}.png`));

    // Pixel Adventure 1 (CC0): effects
    const EFFECTS = Object.fromEntries(['collected', 'dust', 'shield_bubble'].map(k => [k, loadImage(`assets/effects/${k}.png`)]));

    // Pixel Adventure 1 (CC0): items & powerups
    const ITEMS = Object.fromEntries([
      'box_idle', 'box_break', 'shield_melon', 'magnet_pineapple', 'life_apple', 'mushroom_super'
    ].map(k => [k, loadImage(`assets/items/${k}.png`)]));

    const SKINS_CATALOG = Object.freeze([
      { id: 'scout', name: 'Ninja Frog', price: 0, desc: 'Katak ninja lincah (Bawaan)', color: '#38bdf8' },
      { id: 'ninja', name: 'Mask Dude', price: 50, desc: 'Pria bertopeng bulu warna-warni', color: '#06b6d4' },
      { id: 'knight', name: 'Pink Man', price: 100, desc: 'Si mungil putih-merah muda yang imut', color: '#facc15' },
      { id: 'retro', name: 'Virtual Guy', price: 150, desc: 'Sosok biru bergaya digital klasik', color: '#8bac0f' }
    ]);

    const EMOTES_CATALOG = Object.freeze([
      { id: 'laugh', icon: '😂', name: 'Tertawa', price: 0, desc: 'Tawa santai tanpa beban (Bawaan)' },
      { id: 'cry', icon: '😭', name: 'Menangis', price: 25, desc: 'Apes saat jatuh ke jurang' },
      { id: 'thumbsup', icon: '👍', name: 'Mantap', price: 40, desc: 'Jempol sportivitas & kompak' },
      { id: 'fire', icon: '🔥', name: 'Membara', price: 60, desc: 'Semangat lari kencang' },
      { id: 'panic', icon: '💀', name: 'Tengkorak', price: 80, desc: 'Panik dibidik Bos Titan' },
      { id: 'crown', icon: '👑', name: 'Mahkota', price: 120, desc: 'Raja skor petualang' }
    ]);

    const DEFAULT_GLOBAL_LEADERBOARD = Object.freeze([
      { id: 'g_1', name: 'ZENITH', score: 12500, timestamp: 1710000000000, region: 'GLOBAL' },
      { id: 'g_2', name: 'SHADOW', score: 9800, timestamp: 1710000000000, region: 'GLOBAL' },
      { id: 'g_3', name: 'NEXUS', score: 7650, timestamp: 1710000000000, region: 'GLOBAL' },
      { id: 'g_4', name: 'PHOENIX', score: 5400, timestamp: 1710000000000, region: 'GLOBAL' },
      { id: 'g_5', name: 'BLAZE', score: 3200, timestamp: 1710000000000, region: 'GLOBAL' }
    ]);

// Global window assignments for direct file:// compatibility
window.CONFIG = CONFIG;
window.loadImage = loadImage;
window.PLAYER_SPRITES = PLAYER_SPRITES;
window.KENNEY = KENNEY;
window.TREE_ASSETS = TREE_ASSETS;
window.BUSH_ASSETS = BUSH_ASSETS;
window.EFFECTS = EFFECTS;
window.ITEMS = ITEMS;
window.SKINS_CATALOG = SKINS_CATALOG;
window.EMOTES_CATALOG = EMOTES_CATALOG;
window.DEFAULT_GLOBAL_LEADERBOARD = DEFAULT_GLOBAL_LEADERBOARD;
