# Dirhamku — Roadmap Pengembangan

> Dokumen serah-terima untuk AI agent berikutnya. Baca **bagian 1–3 dulu** sebelum mengubah kode.
> Status kode: branch `main`, commit `f55561e` (PR #1 "Add Day Mode" sudah di-merge). Versi app: `5.0.1`.

---

## 1. Konteks proyek

**Dirhamku** = PWA pencatat keuangan pribadi (Bahasa Indonesia). Saat ini **dipakai satu orang (pemilik repo)**, belum ada user lain. Deploy di `https://dirhamku.web.app`.

| Hal | Detail |
|---|---|
| Frontend | Vanilla JS, satu objek global `window.app` di `dirhamku-firebase/public/app.js` (~9.100 baris) + `index.html` (~2.300 baris, semua tab/modal inline) |
| Styling | Tailwind **compiled** (bukan CDN). Sumber `src/input.css` + `tailwind.config.js`. **Wajib** `npm run build:css` setelah menambah class baru, lalu commit `public/styles.css` |
| Library CDN | Phosphor Icons, Chart.js, flatpickr, Firebase compat SDK 10.12 (versi belum di-pin ketat) |
| Backend | Firebase: Auth (Google + email), Firestore, Hosting, 1 Cloud Function (`functions/index.js`) |
| AI | Gemini API dari browser; API key user disimpan di profil Firestore + localStorage |
| Data | `users/{uid}` (profil: `accounts[]`, `categories[]`, `monthlyBudget`, `paydayDate`, `dayModeCycle`, …), `users/{uid}/transactions`, `users/{uid}/recurring_transactions`, `daily_logs/{date_uid}` |
| Balance akun | **Tidak disimpan**; dihitung ulang dari semua transaksi di `loadData()` |
| Tanggal | Semua tulis pakai `dateKey`/`dateStr` `YYYY-MM-DD` (zona lokal). Jangan pakai `new Date("YYYY-MM-DD")` (dibaca UTC) |

**Perintah penting** (jalankan dari `dirhamku-firebase/`):
```bash
npm install
node --check public/app.js     # syntax check wajib sebelum commit
npm run build:css              # regenerasi public/styles.css
npm run release                # naikkan versi (package.json, version.json, sw.js cache name, ?v= di index.html)
firebase deploy --only hosting # deploy (dijalankan pemilik, bukan agent)
```

**Dokumen lama di repo:** `Handover Dirhamku 5.0.txt`, `implementation_plan v5.md`, `implementation_plan_v6_wealth_debt.md`. Handover **sebagian usang** (mis. menyebut Search & Recurring belum jadi, padahal sudah; menyebut Tailwind CDN).

---

## 2. Aturan kerja (dari pemilik repo)

1. Chat ke pemilik: **Bahasa Indonesia gaya santai/gen-z, ringkas, langsung ke hasil** (bukan mengulang isi prompt).
2. Kerja di **branch baru dari `main`**, commit kecil dan deskriptif, lalu PR. Jangan push langsung ke `main`.
3. **Jangan memutasi data produksi Firestore.** Uji dengan data palsu.
4. Verifikasi di browser (lihat bagian 6), sertakan screenshot untuk perubahan UI.
5. Topik **privasi data user** dan **update PWA** sengaja **ditunda** oleh pemilik. Jangan dikerjakan sampai diminta (lihat Fase 2 & 3).
6. Tanya dulu untuk keputusan produk yang ambigu; jangan menebak tampilan yang sudah disetujui (toples koin, animasi) tanpa alasan.

---

## 3. Referensi Day Mode (sudah selesai — jangan dirusak)

**Konsep:** income + tagihan recurring dibagi rata per hari sampai gajian; sisa yang tidak dipakai bergulir ke hari berikutnya. Tampilan: hero "Today's Budget" (toples koin / baterai) + chat penuh. Masuk lewat pill **Day | Month** di Home atau kartu mini Home.

### Aturan bisnis (invarian)
- **Rumus jatah hari ini** = `(income cycle + transfer tabungan bersih − total tagihan cycle − pengeluaran harian sebelum hari ini) ÷ sisa hari (termasuk hari ini)`. Income naik → jatah naik; belanja → jatah turun. Lihat `computeTodayBudget()`.
- **Income otomatis** dari transaksi `Income` di cycle berjalan. Tidak ada input "pemasukan bulanan" (sengaja dihapus).
- **Cycle** (`getBudgetCycle()`, `_detectCycleAnchor()`): mulai dari tanggal income kategori **Salary/Gaji** terakhir (≤45 hari, abaikan entri <50% dari gaji terbesar); fallback income terbesar; fallback `paydayDate`. Berakhir +1 bulan. Gaji telat (`overdue`) → sisa uang dibagi **7 hari** (jangan ditumpuk ke 1 hari). Mode manual: profil `dayModeCycle === 'manual'` memakai `paydayDate` tetap.
- **Yang memakan jatah harian** (`_isDailySpend`): `Expense` yang bukan pembayaran recurring, tidak `exclude_from_budget`, dan tidak dikenali sebagai bayar tagihan.
- **Pencocokan bayar tagihan manual** (`_matchManualBills`): kategori sama **atau** catatan memuat nama tagihan (≥3 huruf), nominal ±10%, satu tagihan hanya boleh "mengklaim" sebanyak kemunculannya per cycle (pembayaran lewat tombol ✓ ikut dihitung). Hasil disimpan di `app._billMatched` (Map `txId → bill`).
- **Transfer** dari/ke akun `purpose === 'emergency_fund'` atau `is_excluded_from_budget` menambah/mengurangi pool.
- **Animasi uang masuk/keluar** dipicu oleh **transaksi baru** (`_detectTodayFx` membandingkan id dengan `_todaySeen`), bukan oleh perubahan angka. Digabung per (arah, tag). Jangan diubah kembali ke berbasis delta sisa.
- Chat dipindah antara tab Input dan Day Mode dengan `_mountChat()` (satu DOM, satu set listener). Jangan diduplikasi.

### Peta kode (semua di `window.app`)
`setHomeMode` / `getHomeMode` · `switchTab` (tab `today`) · `computeTodayBudget` · `getBudgetCycle` · `_detectCycleAnchor` · `_matchManualBills` · `renderToday` · `_renderTodayMini` · `renderTodayBreakdown` · `selectTodayDay` · `setDayModeCycle` · `saveDayModeSettings` · `_setTodayFill` · `_buildJarCoins` · `_detectTodayFx` / `_playTodayFx` / `_fxBurst` · `todaySummaryText` · `SFX.coin/spend`.

### Penyimpanan
- localStorage: `dirhamku_home_mode` (`day|month`), `dirhamku_today_visual` (`jar|battery`), `dirhamku_dashboard_prefs`.
- Profil Firestore: `paydayDate`, `dayModeCycle` (`auto|manual`). `monthlyIncome` hanya sisa onboarding, **tidak dipakai Day Mode**.

---

## 4. Roadmap

Legenda prioritas: **P0** kerjakan dulu · **P1** berikutnya · **P2** nanti. Setiap item punya kriteria selesai (DoD).

### Fase 1 — Menyempurnakan Day Mode (P0/P1)

| # | Item | Prio | Deskripsi | DoD |
|---|---|---|---|---|
| 1.1 | Strip **"Hari ini"** persisten | P0 | Riwayat chat **tidak disimpan** (hilang saat app ditutup). Tambah strip lipat antara hero dan chat berisi transaksi hari ini (ikon kategori, catatan, nominal, tag "makan jatah"/"tagihan"), tap → edit (`openEditTxModal`). Tampil hemat ruang (default terlipat, badge jumlah). | Tutup lalu buka app: transaksi hari ini tetap terlihat. Update real-time setelah simpan lewat chat. Tidak menggeser input chat di layar 360×640. |
| 1.2 | Chip **No Spend Day** | P0 | Pindahkan aksi `logNoSpendDay` ke hero (chip "Gue no spend hari ini 🌿"), hilang otomatis jika sudah ada pengeluaran hari ini; tampilkan streak jika ≥2. Pakai logika `checkNoSpendToday` yang ada. | Chip hanya muncul saat belum ada expense hari ini; tap mencatat log + confetti; kembali normal keesokan hari. |
| 1.3 | Chip **tagihan jatuh tempo** | P1 | Dari `_recurringCache` (`startDate` = jatuh tempo berikutnya), tampilkan tagihan ≤7 hari ("Kos jatuh tempo 3 hari lagi"), tap → sheet tagihan. Sembunyikan yang sudah `lunas` di periode ini (`isPaidForPeriod`, `_billMatched`). | Muncul/hilang benar saat tagihan dibayar (✓ maupun manual). |
| 1.4 | Tombol **"ini bukan tagihan"** | P1 | Pencocokan otomatis bisa salah (kategori sama & nominal mirip). Di detail hari (`renderTodayBreakdown`) beri aksi membatalkan pencocokan per transaksi; simpan flag di transaksi (mis. `notBill: true`) dan hormati di `_matchManualBills`. Kebalikannya: tandai manual "ini bayar tagihan X". | Transaksi yang di-unmatch kembali memakan jatah; flag bertahan setelah reload. |
| 1.5 | Streak **"di bawah jatah"** | P1 | Ganti hitungan "Di Bawah Budget" (`updateConsistencyCard`, pakai budget bulanan rata) dengan versi per-hari memakai `s.dayInfo(ds)` (spent ≤ jatah hari itu). Tampilkan di Day Mode dan kartu Konsistensi. | Angka sama di kedua tempat; unit test skenario untuk hari hemat/over. |
| 1.6 | **Insight harian** | P2 | Satu bubble bot saat Day Mode dibuka (latte factor, weekday vs weekend, dsb. dari `_tryLocalAnswer`/`_computeFinancialMetrics`), maksimal sekali per hari. | Tidak muncul berulang; tidak memanggil Gemini kecuali mode AI aktif. |
| 1.7 | Perapihan layout | P1 | Baris chip di hero terpotong di layar sempit (bisa digeser). Pertimbangkan 2 baris atau ringkas. Tagline Inggris di hero: putuskan bahasa (Indonesia/Inggris) bersama pemilik. | Tidak ada teks terpotong di 360px; tetap enak di 430px. |
| 1.8 | **Konflik definisi budget** | P1 (butuh keputusan) | Home Month (Budget Status, mood ring) memakai `monthlyBudget`; Day Mode memakai income−tagihan. Bisa berbeda kesimpulan. Opsi: (a) biarkan + jelaskan di UI, (b) opsi di Day Mode "batasi dengan `monthlyBudget`", (c) samakan. **Tanya pemilik** sebelum memilih. | Ada satu penjelasan/opsi yang konsisten; tidak ada dua status bertentangan tanpa keterangan. |
| 1.9 | Edge case | P1 | Gaji dicicil (2 kali/bulan); income kategori lain tapi sebenarnya gaji; transaksi bertanggal masa depan; cycle >45 hari; tagihan tahunan/mingguan (cadangan per cycle); multi-akun dengan akun non-budget; ganti zona waktu. Tulis skenario + perbaiki `getBudgetCycle`/`computeTodayBudget` bila perlu. | Tiap skenario punya test (bagian 6) dan perilaku yang terdokumentasi. |
| 1.10 | Animasi di kartu mini Home | P2 | Kartu mini belum bereaksi terhadap uang masuk/keluar. | Opsional; tidak boros baterai. |

### Fase 2 — Kualitas & keandalan (P0 sebelum fitur besar)

| # | Item | Prio | Deskripsi |
|---|---|---|---|
| 2.1 | **Test harness otomatis** | P0 | Belum ada test sama sekali. Buat `dirhamku-firebase/tests/` dengan Playwright (Chromium ada di `/opt/pw-browsers` pada environment cloud) + **stub Firebase in-memory** (mencegat `firebase-*-compat.js` lewat `page.route`, menyediakan `firestore().collection().doc()...`, `Timestamp`, `FieldValue`, auth user palsu; seed lewat `window.__SEED_*`). CDN (Chart.js, Phosphor) disajikan lokal. Skenario minimum: cycle (gaji tgl 1/awal/telat/tanpa Salary/manual), rumus jatah, pencocokan tagihan, animasi 1× per transaksi, pindah tab Home/Input/Day tanpa kehilangan chat. Jalankan di CI (GitHub Actions). |
| 2.2 | **Update PWA** *(ditunda pemilik — kerjakan saat diminta)* | P1 | (a) `compareVersions` hanya membandingkan major.minor → rilis patch (5.0.1→5.0.2) tidak terdeteksi; baca patch juga. (b) `sw.js` cache-first untuk `/` & `/index.html`, nama cache manual → ubah ke network-first untuk HTML/JS. (c) Cek update otomatis saat app dibuka lagi (`visibilitychange` + `registration.update()`), toast "Versi baru tersedia → Muat ulang" (`skipWaiting` + reload di `controllerchange`). (d) Tombol **"Perbaiki aplikasi / Reset cache"** di Settings (unregister SW, hapus `caches`, reload; **jangan** hapus IndexedDB Firestore agar transaksi offline yang belum sync tidak hilang). Catatan: iOS PWA sering nyangkut sampai app di-kill. |
| 2.3 | Bug logika yang diketahui | P1 | `advanceDate`/`revertDate` memakai `new Date("YYYY-MM-DD")` (UTC) dan `setMonth` bisa meloncat (31 Jan → 3 Mar). Kartu Langganan menghitung mingguan ×4 (seharusnya ≈×4,33). `renderPaydayCard` memakai jumlah hari bulan yang salah untuk `totalDaysInCycle` (kecuali saat mengikuti cycle income) dan kalender titiknya berbasis bulan kalender. `onUserDeleted` tidak menghapus `recurring_transactions` & `daily_logs`. |
| 2.4 | Dokumentasi | P2 | Perbarui `Handover` (usang), tambahkan `README.md` (setup, perintah, arsitektur), dan `CLAUDE.md`/`AGENTS.md` berisi aturan bagian 2. |

### Fase 3 — Keamanan & privasi *(ditunda pemilik; wajib selesai SEBELUM ada user lain)*

| # | Item | Deskripsi |
|---|---|---|
| 3.1 | **`firestore.rules`** | Di `users/{userId}` ada `allow read, write` yang membuat validasi pada `allow create` tidak berefek (Firestore mengizinkan bila salah satu rule lolos). `daily_logs` punya `allow get: if request.auth != null` sehingga user lain bisa membaca log orang lain bila tahu ID. Rapikan: validasi skema per koleksi, batasi `get` ke pemilik. Tambahkan test rules dengan Firebase Emulator. |
| 3.2 | **Gemini API key** | Disimpan plaintext di Firestore + localStorage dan dipanggil langsung dari browser. Pindahkan ke Cloud Function proxy (key di Secret Manager) atau minimal jangan disimpan di Firestore. |
| 3.3 | **XSS** | Catatan/nama akun/kategori masuk `innerHTML` tanpa escape di banyak template (termasuk import JSON). Buat helper `esc()` dan terapkan; pertimbangkan CSP. |
| 3.4 | Akses developer & kebijakan | Developer/owner project bisa membaca semua dokumen Firestore. Untuk SaaS: pisahkan project dev/prod, IAM least-privilege, aktifkan Cloud Audit Logs (Data Access), tulis **kebijakan privasi & ToS** (cek kewajiban **UU PDP 27/2022**: consent, hak hapus, pemberitahuan kebocoran), sebutkan Google Gemini sebagai pemroses pihak ketiga. |
| 3.5 | (Opsional) E2EE | Enkripsi `note` (dan nominal) di sisi client dengan kunci dari passphrase; `date/type/category` tetap plaintext untuk query. Konsekuensi: lupa passphrase = data hilang; tidak ada fitur server-side yang membaca isi. Layak karena semua agregasi sudah di client. |

### Fase 4 — Performa & arsitektur (P1/P2)

| # | Item | Deskripsi |
|---|---|---|
| 4.1 | `loadData()` | Mengambil **semua** transaksi dan merender ulang semua tampilan setiap simpan. Ganti ke `onSnapshot` atau query per rentang tanggal + cache; render hanya tab aktif. |
| 4.2 | Streak No Spend | Sampai 30 pembacaan Firestore berurutan pada setiap `renderHome`. Satu query range untuk `daily_logs`, cache per hari. |
| 4.3 | Pecah `app.js` | Monolit 9.000+ baris. Pecah ke ES modules (budget/day-mode, chat+parser, recurring, report, settings, sfx) tanpa mengubah perilaku; gunakan test 2.1 sebagai jaring pengaman. Mulai dari Day Mode yang sudah modular. |
| 4.4 | Dependensi | Pin versi CDN (atau bundle lewat Vite/esbuild). `package.json` di root berisi `firebase@12` yang tidak dipakai; hapus atau selaraskan dengan SDK compat 10.12. Perbarui `firebase-tools`/Node runtime function. |
| 4.5 | Aksesibilitas | Label `aria` untuk tombol ikon, kontras teks kecil di hero, target sentuh ≥44px, dukungan `prefers-reduced-motion` sudah ada (pertahankan). |

### Fase 5 — Fitur besar berikutnya (P2, butuh diskusi produk)

- **Wealth & Debt** (net worth, aset, utang, `debt_payment`): rencana lengkap ada di `implementation_plan_v6_wealth_debt.md`. Bila dikerjakan, integrasikan dengan Day Mode (pembayaran utang tidak dihitung sebagai pengeluaran harian, mirip tagihan).
- **Pengingat/notifikasi** tagihan jatuh tempo (Web Push atau minimal badge saat app dibuka).
- **Edit transaksi Transfer** (form edit belum menangani from/to account — tercatat di Handover).
- **Target tabungan** per bulan (data `savingsTargetPct/Rp` sudah dikumpulkan onboarding tapi belum dipakai di Day Mode) — bisa menjadi "potongan tabungan" opsional dari jatah harian.

---

## 5. Urutan yang disarankan

1. **2.1 Test harness** (agar semua perubahan berikutnya aman) →
2. **1.1 Strip "Hari ini"** → **1.2 No Spend chip** → **1.3 Tagihan jatuh tempo** →
3. **1.4 "Bukan tagihan"** + **1.9 Edge case** + keputusan **1.8** →
4. **2.2 Update PWA** + **2.3 Bug logika** (bila pemilik sudah minta) →
5. **Fase 3 keamanan** sebelum membuka ke user lain →
6. Fase 4 dan 5 sesuai kebutuhan.

## 6. Cara memverifikasi perubahan (yang dipakai sejauh ini)

1. `node --check public/app.js` dan `npm run build:css`.
2. Sajikan `public/` dengan `python3 -m http.server 8765`.
3. Playwright (Chromium) viewport **390×844**, `serviceWorkers: 'block'`; cegat `firebase-app-compat.js` dengan stub in-memory, cegat Chart.js/Phosphor/flatpickr dengan salinan lokal (`npm i chart.js @phosphor-icons/web flatpickr` di folder sementara). Seed data: transaksi (`[hariLalu, tipe, nominal, kategori, catatan]`), recurring, profil.
4. Ambil screenshot di beberapa state (normal, over budget, setup/tanpa income, mode baterai) dan bandingkan angka dengan hitungan manual. Contoh acuan: income 5,5jt, tagihan 1,686jt, 30 hari → `(5.500.000 − 1.686.000) ÷ 30 ≈ 127.133/hari` sebagai jatah dasar.
5. Pastikan **tidak ada error console** (abaikan gagal-muat resource eksternal di sandbox).

## 7. Pertanyaan terbuka untuk pemilik

- Konflik definisi budget Month vs Day (item 1.8): opsi mana?
- Bahasa tagline hero: Inggris (sekarang) atau Indonesia?
- Kapan Fase 2.2 (update PWA) dan Fase 3 (privasi/keamanan) dimulai?
- Apakah "target tabungan" perlu memotong jatah harian?
