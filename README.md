# Spreadsheet Customer Treelogy

Next.js 16 app yang membaca Google Spreadsheet **restricted** secara realtime
(polling tiap beberapa detik) menggunakan **Google Service Account**.

Default spreadsheet: `10WeFeTkA4PCs7ngNkpJ4D6giLwqu5U68`

---

## 1. Buat Service Account & Credentials

1. Buka https://console.cloud.google.com/ → buat / pilih project apa saja.
2. **APIs & Services → Library** → enable **Google Sheets API**.
3. **APIs & Services → Credentials → Create credentials → Service account**.
4. Setelah service account dibuat, masuk tab **Keys → Add key → JSON**.
   File JSON akan ter-download. Simpan baik-baik.
5. Salin nilai `client_email` (mirip `xxx@your-proj.iam.gserviceaccount.com`).

## 2. Share spreadsheet ke service account

Karena email Anda sudah punya akses **organize** ke spreadsheet, buka sheet-nya
→ tombol **Share** → tempel `client_email` di atas → role **Viewer** → Send.

## 3. Set environment variables

```bash
cp .env.local.example .env.local
```

Isi `.env.local` dengan salah satu cara:

**Cara A — split fields (paling umum):**

```
GOOGLE_SERVICE_ACCOUNT_EMAIL="xxx@your-proj.iam.gserviceaccount.com"
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMII...\n-----END PRIVATE KEY-----\n"
```

> Penting: pakai tanda kutip ganda dan tetap pertahankan literal `\n`
> (jangan ditekan Enter). Kode otomatis convert `\n` → newline.

**Cara B — seluruh JSON (raw atau base64):**

```
GOOGLE_SERVICE_ACCOUNT_JSON='{"type":"service_account", ... }'
```

Optional override sheet:

```
SPREADSHEET_ID="10WeFeTkA4PCs7ngNkpJ4D6giLwqu5U68"
```

## 4. Jalankan

```bash
npm run dev
```

Buka http://localhost:3000 → tabel akan refresh tiap 5 detik.
Anda bisa pilih tab sheet, ubah interval polling (2/5/10/30s), pause, atau
tekan "Refresh now".

---

## Cara kerja

- `lib/sheets.ts` — auth via JWT service account (scope read-only).
- `app/api/sheet/route.ts` — Route Handler `GET /api/sheet` ambil metadata
  + values. `dynamic = "force-dynamic"` dan `Cache-Control: no-store` agar
  selalu fresh.
- `app/page.tsx` — Client Component dengan polling loop (setTimeout, bukan
  setInterval, supaya request tidak overlap).

## Deploy ke Vercel

1. Push repo ke Git provider, lalu import di Vercel.
2. Tambahkan env vars yang sama di project Vercel (Settings → Environment Variables).
   Untuk `GOOGLE_PRIVATE_KEY`, paste isi key dengan literal `\n` — sama seperti
   `.env.local`.
3. Deploy. Route Handler berjalan di Fluid Compute (Node.js) — kompatibel
   dengan `googleapis`.

## Troubleshooting

- **`The caller does not have permission`** → service account belum di-share
  ke spreadsheet, atau salah email.
- **`error:1E08010C:DECODER routines::unsupported`** → `GOOGLE_PRIVATE_KEY`
  ke-mangle. Pastikan masih ada `\n` literal di `.env.local`.
- **`Google Sheets API has not been used in project ...`** → enable Sheets API
  di Cloud Console.
