<img width="974" height="557" alt="image" src="https://github.com/user-attachments/assets/805eab77-8994-4f31-a6bf-486003e590ee" />


# Offline Adventure — Endless Pixel Platformer

[![PWA Ready](https://img.shields.io/badge/PWA-Ready-22c55e?logo=pwa)](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps)
[![Canvas 2D](https://img.shields.io/badge/HTML5-Canvas%202D-f59e0b?logo=html5)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
[![Web Audio API](https://img.shields.io/badge/Web%20Audio-Procedural-38bdf8)](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Sebuah game platformer pixel art 2D tanpa batas (*endless runner/platformer*) berbasis web yang dapat dimainkan **100% offline** langsung dari browser atau di-install sebagai Progressive Web App (PWA).

---

## 🌟 Fitur Utama

- **Dunia Prosedural Tanpa Batas (*Endless Procedural World*):**
  Pijakan tanah, jurang dinamis, platform kayu bertingkat, dan platform bergerak dihasilkan secara acak berbasis seed deterministik.
- **Siklus 4 Musim Dinamis (Tiap 500 Meter):**
  Suasana lingkungan berganti secara mulus setiap 500 meter:
  - 🌸 **Musim Semi (0–500m):** Bunga sakura bermekaran, dedaunan merah muda, dan rumput hijau cerah.
  - ☀️ **Musim Panas (500–1000m):** Pepohonan hijau zamrud tropis yang lebat dan langit cerah.
  - 🍂 **Musim Gugur (1000–1500m):** Daun gugur keemasan, rona jingga hangat, dan rumput kering.
  - ❄️ **Musim Dingin (1500m+):** Pohon pinus berselimut es dan lapisan salju putih di permukaan tanah.
- **Pertarungan Bos Berkala (*Milestone Boss Battles*):**
  Di akhir setiap musim (400m, 900m, 1400m, 1900m, dst.), bos **Cyber-Titan Drone** akan muncul dengan laser bidik, serangan menukik (*dive slam*), bom proyektil, dan tingkat kesulitan yang bertambah tiap tier. Kalahkan dengan 4–10 injakan kepala untuk mendapatkan hujan koin emas dan nyawa ekstra!
- **Mekanik Gameplay Seru:**
  - *Stomp Jump:* Injak kepala musuh untuk mengalahkannya dan melambung tinggi.
  - *Power-Ups:* Super Mushroom (tumbuh besar), Shield Melon (kebal 1x serangan), Magnet Pineapple (menarik koin), dan Life Apple (+1 nyawa).
  - *Combo Koin:* Kumpulkan koin berturut-turut untuk mendapatkan bonus combo skor dan nyawa gratis setiap 100 koin.
- **Lemari Kostum Karakter (4 Skin Unik):**
  Ganti karakter pahlawanmu dengan Scout (Ninja Frog), Ninja (Mask Dude), Knight (Pink Man), atau Retro (Virtual Guy).
- **Audio Prosedural Retro:**
  Semua efek suara (lompat, koin, ledakan, musik tema latar) disintesis secara real-time via Web Audio API tanpa perlu mendownload file audio eksternal.
- **Dukungan PWA & Offline Total:**
  Dilengkapi Service Worker (`sw.js`) dengan cache modern — game dapat di-install di Android, iOS, Windows, Mac, dan tetap bisa dimainkan tanpa koneksi internet.

---

## 🎮 Kontrol Permainan

### Desktop / Keyboard
| Tombol | Fungsi |
|---|---|
| <kbd>A</kbd> / <kbd>D</kbd> atau <kbd>◄</kbd> <kbd>►</kbd> | Bergerak Kiri / Kanan |
| <kbd>Shift</kbd> (Tahan) | Lari Cepat (*Sprint*) |
| <kbd>W</kbd> / <kbd>▲</kbd> / <kbd>Space</kbd> | Lompat (tahan untuk lompatan tinggi) |
| <kbd>Esc</kbd> | Jeda Permainan (*Pause*) |
| <kbd>M</kbd> | Bisukan Suara (*Mute Audio*) |

### Layar Sentuh / Smartphone
- **Tombol Arah ◄ / ► :** Bergerak ke kiri dan kanan.
- **Tombol 🏃 LARI :** Menambah kecepatan lari.
- **Tombol LOMPAT :** Melompat melewati rintangan dan musuh.

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

## 🚀 Cara Menjalankan Secara Lokal

Game ini dibangun murni menggunakan HTML5 Canvas dan JavaScript standar (*Vanilla JS*), tanpa perlu instalasi build tools / npm.

1. Clone repositori:
   ```bash
   git clone https://github.com/balongbesuk/endless-platformer.git
   cd endless-platformer
   ```
2. Buka file `index.html` langsung di browser favorit Anda, atau jalankan local server:
   ```bash
   # Menggunakan Python:
   python -m http.server 8080

   # Atau menggunakan Node / npx:
   npx serve .
   ```
3. Buka `http://localhost:8080` di browser.

---

## 📄 Lisensi Kode

Kode sumber proyek ini dilisensikan di bawah [MIT License](LICENSE).
Aset grafis dan suara adalah hak cipta masing-masing kreator di bawah lisensi CC0 Public Domain.
