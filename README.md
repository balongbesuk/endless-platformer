<img width="973" height="554" alt="Offline Adventure Banner" src="https://github.com/user-attachments/assets/9859cf1e-4450-444b-b1c1-50effe828084" />

# Offline Adventure — Endless Pixel Platformer

[![PWA Ready](https://img.shields.io/badge/PWA-Ready-22c55e?logo=pwa)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![Canvas 2D](https://img.shields.io/badge/HTML5-Canvas%202D-f59e0b?logo=html5)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
[![Web Audio API](https://img.shields.io/badge/Web%20Audio-Procedural-38bdf8)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![MQTT Multiplayer](https://img.shields.io/badge/Multiplayer-MQTT%20Live-a855f7)](https://mqtt.org/)
[![No Build Tool](https://img.shields.io/badge/Build-Zero%20Dependencies%20(Pure%20Vanilla)-blue)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Sebuah game platformer pixel art 2D tanpa batas (*endless runner/platformer*) berbasis web yang dapat dimainkan **100% offline** langsung dari browser, dibuka langsung via double-click File Explorer (`file:///`), atau di-install sebagai Progressive Web App (PWA) di perangkat mobile maupun desktop.

---

## 🌟 Fitur Utama

- **Dunia Prosedural Tanpa Batas (*Endless Procedural World*):**
  Pijakan tanah dinamis, jurang, platform kayu bertingkat (*one-way platforms*), dan platform bergerak dihasilkan secara acak berbasis seed deterministik berkesinambungan.
- **Siklus 4 Musim Dinamis (Tiap 500 Meter):**
  Suasana lingkungan berganti secara mulus setiap 500 meter:
  - 🌸 **Musim Semi (0–500m):** Bunga sakura bermekaran, dedaunan merah muda, dan rumput hijau cerah.
  - ☀️ **Musim Panas (500–1000m):** Pepohonan hijau zamrud tropis yang lebat dan langit cerah.
  - 🍂 **Musim Gugur (1000–1500m):** Daun gugur keemasan, rona jingga hangat, dan rumput kering.
  - ❄️ **Musim Dingin (1500m+):** Pohon pinus berselimut es dan lapisan salju putih di permukaan tanah.
- **Multiplayer Real-time Drop-in (Gaya Agar.io / Mabar Langsung):**
  - Bermain bersama pemain lain di dunia yang sama secara instan via MQTT WebSockets tanpa perlu login rumit.
  - Menampilkan posisi pemain lain secara halus (*interpolated sync*), nama tag di atas kepala, dan skin karakter masing-masing.
- **Sistem Reaksi Cepat / Emote Interaktif (💬):**
  - Ekspresikan respon Anda secara instan dengan bubble chat melayang di atas kepala karakter (GG, Jempol, Hati, Api, Tertawa, dsb.).
  - Buka koleksi emote baru di Toko menggunakan koin yang dikumpulkan saat bermain.
- **Pertarungan Bos Berkala (*Milestone Boss Battles*):**
  Di akhir setiap musim (400m, 900m, 1400m, 1900m, dst.), bos **Cyber-Titan Drone** akan muncul dengan laser bidik, serangan menukik (*dive slam*), bom proyektil, dan tingkat kesulitan bertingkat. Kalahkan dengan injakan kepala untuk mendapatkan hujan koin emas dan nyawa ekstra!
- **Pedestal Menu Utama dengan Animasi Standby:**
  Karakter favorit Anda berdiri di atas pedestal bercahaya di menu awal dengan animasi standby/idle hidup (bernapas dan berkedip alami) sebelum memulai petualangan.
- **Papan Rekor Ganda (Lokal & Global):**
  - **Papan Lokal:** Menyimpan riwayat rekor lari dan skor terbaik Anda di perangkat.
  - **Papan Global:** Menampilkan daftar pemain terbaik di seluruh dunia yang disinkronkan secara real-time.
- **Mekanik Gameplay Seru & Power-Ups:**
  - *Stomp Jump:* Injak kepala musuh untuk melambung tinggi dan mengalahkannya.
  - *Super Mushroom:* Tumbuh menjadi raksasa yang kebal dan menghancurkan rintangan.
  - *Shield Melon:* Gelembung pelindung kebal 1x benturan musuh/rintangan.
  - *Magnet Pineapple:* Menghisap koin di sekitar secara magnetis.
  - *Life Apple:* Menambah nyawa darurat.
  - *Coin Streak:* Kumpulkan koin tanpa putus untuk kombo skor dan bonus nyawa tiap 100 koin.
- **Lemari Kostum Karakter (4 Skin Unik):**
  Pilih pahlawan favorit Anda: **Scout** (Ninja Frog), **Ninja** (Mask Dude), **Knight** (Pink Man), atau **Retro** (Virtual Guy).
- **Audio Prosedural Retro:**
  Semua efek suara dan musik latar disintesis langsung menggunakan Web Audio API tanpa perlu mendownload file MP3/WAV eksternal.
- **Offline Total & PWA Ready:**
  Dilengkapi Service Worker modern (`sw.js`) dengan strategi cache adaptif: dapat dimainkan offline sepenuhnya di mana saja.

---

## 🎮 Kontrol Permainan

### Desktop / Keyboard
| Tombol | Fungsi |
|---|---|
| <kbd>A</kbd> / <kbd>D</kbd> atau <kbd>◄</kbd> <kbd>►</kbd> | Bergerak Kiri / Kanan |
| <kbd>Shift</kbd> (Tahan) | Lari Cepat (*Sprint*) |
| <kbd>W</kbd> / <kbd>▲</kbd> / <kbd>Space</kbd> | Lompat (tahan lebih lama untuk lompatan lebih tinggi) |
| <kbd>1</kbd> – <kbd>6</kbd> | Kirim Emote / Reaksi Cepat 💬 |
| <kbd>Esc</kbd> | Jeda Permainan (*Pause*) |
| <kbd>M</kbd> | Bisukan / Bunyikan Suara (*Mute Toggle*) |

### Layar Sentuh / Smartphone
- **Tombol D-Pad ◄ / ► :** Bergerak ke kiri dan kanan dengan ukuran ergonomis.
- **Tombol 🏃 LARI :** Menambah akselerasi dan kecepatan berlari.
- **Tombol ⬆ LOMPAT :** Melompat melewati jurang dan menginjak musuh.
- **Panel Emote :** Akses tombol reaksi instan di layar saat bermain.

---

## 📁 Arsitektur Kode Modular (Zero-Build)

Proyek ini dibangun menggunakan arsitektur modular murni (**Vanilla JavaScript & CSS**) tanpa memerlukan *bundler* atau *compiler* (seperti Webpack, Vite, atau Babel). Kode sangat mudah dibaca, dianalisis, dan dimodifikasi:

```
offline-adventure/
├── index.html              # Markup UI bersih (~360 baris) & pemuatan skrip universal
├── manifest.webmanifest    # Konfigurasi PWA (Desktop & Mobile)
├── sw.js                   # Service worker cache untuk akses 100% offline
├── css/
│   └── style.css           # Styling terpadu, HUD, responsivitas mobile & animasi
├── js/
│   ├── config.js           # Konstanta fisika, loader aset, katalog skin & emote
│   ├── storage.js          # LocalStorage, rekor lokal, & global leaderboard API
│   ├── audio.js            # SoundEngine Web Audio procedural synthesis
│   ├── input.js            # Input keyboard & virtual touch D-Pad
│   ├── collision.js        # Fisika AABB, deteksi stomp, & one-way platforms
│   ├── entities.js         # Entitas Player, ParticlePool, & FloatingTextPool
│   ├── camera.js           # Viewport kamera dengan smooth horizontal tracking
│   ├── world.js            # Generator chunk prosedural & siklus 4 musim
│   ├── scoring.js          # Sistem jarak, koin, nyawa, skor, dan combo
│   ├── multiplayer.js      # Sinkronisasi multi-pemain realtime via MQTT
│   ├── renderer.js         # Engine grafis Canvas 2D multi-layer & efek partikel
│   ├── game.js             # Controller utama, fixed timestep loop, & modal UI
│   ├── main.js             # Bootstrap aplikasi & inisialisasi PWA
│   └── paho-mqtt.min.js    # Client MQTT WebSockets untuk fitur multiplayer
└── assets/                 # Aset gambar sprite (CC0 / Public Domain)
    ├── player/             # Lembaran sprite animasi karakter (Idle, Run, Jump, Fall, Hit)
    ├── kenney/             # Tileset tanah, karakter musuh, & background
    ├── scenery/            # Pohon & semak tematik 4 musim
    ├── items/              # Item buah, mushroom, shield, magnet, dsb.
    ├── effects/            # Partikel debu, gelembung pelindung, & koin
    └── ui/                 # Ikon tombol retro & indikator nyawa
```

---

## 🎨 Kredit & Atribusi Aset (Asset Credits)

Game ini menggunakan aset berkualitas tinggi berlisensi bebas (**Creative Commons CC0 / Public Domain**):

1. **[Kenney.nl](https://kenney.nl/) (Kenney)**
   - *Aset:* Kenney Pixel Platformer, 1-Bit Platformer, Tileset Dunia, UI Icons & Sound Elements.
   - *Lisensi:* [CC0 1.0 Universal (Public Domain Dedication)](https://creativecommons.org/publicdomain/zero/1.0/).
2. **[Pixel Frog](https://pixelfrog-assets.itch.io/pixel-adventure-1) (Pixel Adventure 1)**
   - *Aset:* Animasi karakter utama (Ninja Frog, Mask Dude, Pink Man, Virtual Guy), efek partikel (dust, collected, shield bubble), dan item buah.
   - *Lisensi:* [CC0 1.0 Universal (Public Domain)](https://creativecommons.org/publicdomain/zero/1.0/).
3. **Nature Scenery Assets**
   - *Aset:* Pixel Art Pepohonan & Semak Tematik 4 Musim (Sakura Jepang, Oak Hijau, Maple Jingga, Pinus Salju).
   - *Lisensi:* CC0 / Public Domain.

---

## 🚀 Cara Menjalankan

### Opsi 1: Buka Langsung (Tanpa Server / Double Click)
Anda dapat langsung membuka file `index.html` dengan cara klik ganda (*double-click*) dari File Explorer / Finder. Game dirancang 100% kompatibel dengan protokol `file:///`.

### Opsi 2: Menggunakan Local Web Server
Jika ingin menguji fitur instalasi PWA atau Service Worker:
```bash
# Clone repositori:
git clone https://github.com/balongbesuk/endless-platformer.git
cd endless-platformer

# Jalankan server lokal sederhana:
# Dengan Python:
python -m http.server 8080

# Atau dengan Node.js:
npx serve .
```
Buka `http://localhost:8080` di browser Anda.

---

## 📄 Lisensi Kode

Kode sumber proyek ini dilisensikan di bawah [MIT License](LICENSE).  
Aset grafis dan suara adalah hak cipta masing-masing kreator di bawah lisensi CC0 Public Domain.
