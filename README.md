# Sistem Pencatatan Kas & E-Statement

Aplikasi web untuk mencatat transaksi keuangan (masuk/keluar) dan mengekspor
laporan mutasi (**e-Statement**) dalam format **PDF** dengan desain profesional
menyerupai e-Statement bank.

Dibangun di atas **Google Apps Script** (Web App) dengan **Google Sheets**
sebagai database — tanpa server tambahan, gratis, dan berjalan di akun Google
Anda sendiri.

---

## ✨ Fitur

- **Input transaksi** (Masuk / Keluar) lewat web app, saldo berjalan dihitung otomatis.
- **Riwayat transaksi** real-time + hapus transaksi (saldo dihitung ulang).
- **Export PDF e-Statement** per rentang tanggal, desain menyerupai e-Statement
  bank (warna, tipografi, dan tata letak dicocokkan dari dokumen referensi):
  - Header biru (`#007DFE`) + judul entitas + logo kanan-atas + alamat.
  - Ringkasan saldo (Saldo Awal, Dana Masuk hijau, Dana Keluar, Saldo Akhir biru).
  - Tabel mutasi dua bahasa (ID/EN), nominal hitam tebal, saldo biru tebal.
  - **Footer** disclaimer (kiri) + call center (kanan) di tiap halaman.
  - **Multi-halaman** otomatis dengan penomoran `x dari y / x of y` — header &
    footer berulang di tiap halaman. Paginasi **berbasis tinggi**, jadi tiap
    halaman selalu muat satu lembar A4 berapa pun panjang keterangan.
- **Pengaturan header dinamis**: nama, cabang, nomor rekening, jenis rekening,
  mata uang, alamat, saldo awal akun, dan teks footer.
- **Upload logo** (bisa diganti-ganti) yang muncul di header PDF.

---

## 📁 Struktur File

| File | Keterangan |
| :--- | :--- |
| `Code.gs` | Backend: simpan transaksi, hitung saldo, generate PDF, pengaturan, logo. |
| `Index.html` | Antarmuka web app (form input, riwayat, export, pengaturan). |
| `Statement.html` | Template HTML/CSS untuk render PDF e-Statement. |
| `appsscript.json` | Manifest (timezone, scope OAuth). |

---

## 🚀 Cara Deploy

### Opsi A — Manual (paling mudah)

1. Buka [Google Sheets](https://sheets.google.com) → buat **Spreadsheet baru**.
   Ini akan menjadi database (sheet `Transaksi` & `Pengaturan` dibuat otomatis).
2. Menu **Extensions → Apps Script**.
3. Di editor Apps Script:
   - Hapus isi `Code.gs` bawaan, salin-tempel isi **`Code.gs`** dari repo ini.
   - Buat file HTML baru bernama **`Index`** (File → New → HTML), tempel isi `Index.html`.
   - Buat file HTML baru bernama **`Statement`**, tempel isi `Statement.html`.
   - Buka **Project Settings** (ikon gerigi) → centang *"Show appsscript.json"*,
     lalu samakan isinya dengan `appsscript.json` di repo (khususnya `oauthScopes`).
4. Klik **Deploy → New deployment → Web app**.
   - *Execute as*: **Me**
   - *Who has access*: **Only myself** (atau sesuai kebutuhan).
5. Setujui izin (OAuth) yang diminta. Buka URL Web App → aplikasi siap dipakai.

### Opsi B — Dengan `clasp` (untuk developer)

```bash
npm install -g @google/clasp
clasp login
clasp create --type sheets --title "Pencatatan Kas"
# salin Code.gs, Index.html, Statement.html, appsscript.json ke folder proyek
clasp push
clasp deploy
```

> Catatan: nama file HTML di Apps Script **tanpa ekstensi** — `Index.html`
> menjadi file bernama `Index`, `Statement.html` menjadi `Statement`.

---

## 🧾 Penggunaan

1. **Pengaturan** (panel kiri bawah): isi Nama, Cabang, Nomor Rekening, Jenis
   Rekening, Mata Uang, Alamat/teks header, dan **Saldo Awal Akun** (saldo
   pembuka sebelum transaksi pertama). Unggah **logo** bila diinginkan.
   Nilai default sudah terisi sesuai contoh.
2. **Tambah Transaksi**: pilih tanggal/waktu, jenis (Masuk/Keluar), nominal,
   dan keterangan (boleh beberapa baris — gunakan Enter untuk baris baru).
3. **Cetak e-Statement**: pilih rentang tanggal → **Cetak e-Statement** → PDF
   otomatis terunduh.

---

## ⚙️ Catatan Teknis

- **Saldo Awal periode** pada PDF = saldo akun tepat sebelum transaksi pertama
  dalam rentang tanggal (dihitung dari `Saldo Awal Akun` + seluruh transaksi
  sebelum periode).
- Paginasi berbasis tinggi diatur di `Code.gs` (`CFG.PAGE1_ROW_BUDGET`,
  `CFG.PAGEN_ROW_BUDGET`, `CFG.ROW_BASE_H`, `CFG.ROW_LINE_H`). Bila hasil PDF
  di Apps Script sedikit meluber/terlalu longgar, sesuaikan angka anggaran ini.
- **Logo**: agar menyatu dengan header biru, unggah logo berlatar transparan
  (PNG) atau berlatar warna `#007DFE`. Logo tampil di kanan-atas header.
- **Footer** default berisi teks contoh; ubah lewat menu Pengaturan
  (Footer Kiri/Kanan) sesuai entitas Anda.
- Format angka mengikuti gaya Indonesia (`9.553.519,52`) dan tanggal
  `dd MMM yyyy` + jam `HH:mm:ss WIB` (timezone `Asia/Jakarta`).
- Logo disimpan di Google Drive (folder `E-Statement Assets`) dan disematkan ke
  PDF sebagai data URI base64 sehingga selalu tampil.
