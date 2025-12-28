# Fin.Journey (Static Website)

Platform edukasi literasi keuangan digital (FinTech) dengan modul multi-format, simulasi, dan gamifikasi.
Semua progress disimpan lokal di browser (localStorage), tidak membutuhkan backend.

## Cara menjalankan
1. Buka `index.html` untuk landing page.
2. Klik "Mulai Perjalanan Finansial" untuk masuk ke `home.html`.

> Catatan: beberapa browser membatasi pemutaran iframe video jika dibuka dari file system.
> Untuk pengalaman terbaik, jalankan lewat server lokal sederhana.

### Server lokal (opsional)
- Python:
  - `python -m http.server 8000`
  - buka `http://localhost:8000`

## Struktur
- `index.html` – Landing page
- `home.html` – Homepage
- `modules.html` – Modul edukasi + kuis
- `tools.html` – Simulasi budgeting & tabungan
- `gamification.html` – Level, poin, badge, progress
- `security.html` – Keamanan & pelaporan (link iasc.ojk.go.id)
- `about.html`, `faq.html` – Informasi tambahan
- `css/styles.css` – Styling
- `js/app.js` – Gamifikasi & tools

## Kustomisasi konten
- Ganti iframe video sesuai kebutuhan.
- Tambah gambar/ilustrasi ke folder `assets/`.
- Ubah pertanyaan kuis di `modules.html`.
