# FG TEN - Platform Alur Kerja Fotografer & Klien

Platform manajemen alur kerja (CRM & Workflow Pipeline) khusus fotografer profesional untuk mengelola seluruh tahapan kerja dengan klien, mulai dari inquiry, booking, DP, pemotretan, kurasi/seleksi, editing retouch, hingga pengiriman tautan galeri dan pelunasan.

- **Domain Target**: `fg.ten.my.id`
- **Hosting / Deployment**: Cloudflare Pages / Workers
- **Database**: Cloudflare Workers KV
- **Repository**: [https://github.com/lastengtf/fg-tenmyid](https://github.com/lastengtf/fg-tenmyid)

---

## 🎯 Fitur Utama

1. **Dashboard & Ringkasan Alur Kerja**:
   - Jumlah proyek aktif, jadwal 7 hari ke depan, antrean editing, dan galeri siap kirim.
   - Pelacakan tagihan belum lunas (outstanding balance).
   - Agenda pemotretan terdekat.

2. **9 Tahapan Alur Kerja Fotografer (Workflow Pipeline)**:
   - `Inquiry / Tanya` &rarr; `Booked / Terjadwal` &rarr; `DP Masuk` &rarr; `Selesai Foto` &rarr; `Seleksi Foto` &rarr; `Proses Editing` &rarr; `Galeri Siap` &rarr; `Galeri Terkirim` &rarr; `Selesai & Ditutup`.
   - Perubahan status secara instan langsung dari tabel atau modal detail.

3. **Portal Klien Publik (Tanpa Perlu Login Klien)**:
   - Tautan unik per proyek (misal: `https://fg.ten.my.id/?portal=proj_xxx`) untuk dibagikan ke klien via WhatsApp dengan satu klik.
   - Klien dapat melihat status pengerjaan, detail tanggal & venue lokasi (Google Maps link), rincian tagihan & nomor rekening, serta tautan Google Drive / Cloud Gallery ketika foto sudah siap diunduh.

4. **Database Klien & WhatsApp Direct**:
   - Simpan kontak klien, akun Instagram, dan preferensi gaya foto.
   - Tombol langsung untuk chat WhatsApp klien dengan template pesan otomatis.

5. **Manajemen Jadwal & Agenda**:
   - Tampilan urutan sesi foto berdasarkan tanggal dan jam agar jadwal pemotretan tidak bentrok (*double-booking*).

6. **Katalog Paket Layanan & Harga**:
   - Kelola paket foto (Wedding, Prewedding, Wisuda, Portrait, Event) beserta rincian deliverables.

7. **Sistem Login & Keamanan**:
   - Akses fotografer dilindungi login email & password yang disesuaikan dengan variabel di dashboard Cloudflare (`AUTH_EMAIL` & `AUTH_PASSWORD`).

---

## ⚙️ Konfigurasi Cloudflare

### 1. Cloudflare KV Binding
Konfigurasi KV sesuai instruksi:
```toml
# wrangler.toml
[[kv_namespaces]]
binding = "FG_KV"
id = "dca0f9f18b5540268eecef0363cf8b43"
```

### 2. Environment Variables di Cloudflare Dashboard
Buka **Cloudflare Dashboard** &gt; **Pages** &gt; Proyek `fg-tenmyid` &gt; **Settings** &gt; **Variables and Secrets**:
- `AUTH_EMAIL`: Email fotografer untuk login (contoh: `admin@fg.ten.my.id` atau email pribadi Anda).
- `AUTH_PASSWORD`: Password fotografer untuk login.
- `SESSION_SECRET`: Kunci rahasia sesi acak (opsional).

### 3. Custom Domain
Buka **Cloudflare Dashboard** &gt; **Pages** &gt; **Custom Domains** &gt; Tambahkan:
`fg.ten.my.id`

---

## 💻 Menjalankan Secara Lokal

### Prasyarat
- Node.js (v18+)
- NPM

### Instalasi & Menjalankan Dev Server
```bash
# Jalankan server lokal Cloudflare Pages dengan binding KV
npm run dev
```
Secara default akan berjalan di `http://localhost:8788`.

Kredensial login lokal (tersedia di `.dev.vars`):
- **Email**: `admin@fg.ten.my.id`
- **Password**: `admin123`

---

## 🚀 Deploy ke Cloudflare

### Opsi A: Otomatis via Git Push (Direkomendasikan)
Hubungkan repository `https://github.com/lastengtf/fg-tenmyid` ke Cloudflare Pages di dashboard:
- **Build command**: (kosongkan atau `npm run build`)
- **Build output directory**: `public`
Setiap push ke `main`/`master` akan langsung otomatis dideploy oleh Cloudflare.

### Opsi B: Deploy Langsung via Wrangler CLI
```bash
npx wrangler pages deploy public --project-name=fg-tenmyid
```
