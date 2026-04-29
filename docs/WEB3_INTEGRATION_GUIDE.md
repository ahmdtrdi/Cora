# CORA GameFi - Web3 Integration Guide

Dokumen ini adalah panduan resmi bagi tim **Frontend (FE)** dan **Backend (BE)** untuk berinteraksi dengan *Smart Contract* CORA yang telah di-deploy ke jaringan Solana Devnet.

## 📌 Informasi Utama
- **Network:** Solana Devnet (`https://api.devnet.solana.com`)
- **Program ID:** `(ISI_DENGAN_PROGRAM_ID_ANDA)`
- **Token Mint (USDC Mock):** `(BISA_DIISI_DENGAN_MINT_ADDRESS_USDC_DEVNET)`
- **Lokasi File IDL:** `packages/solana-program/target/idl/solana_program.json`
- **Lokasi Tipe TypeScript:** `packages/solana-program/target/types/solana_program.ts`

*(Catatan untuk FE/BE: Gunakan file tipe `.ts` di atas untuk mendapatkan autocompletion otomatis di VS Code saat menggunakan pustaka `@coral-xyz/anchor`).*

---

## ⏱️ Aturan Waktu (Timeouts)
Sistem *smart contract* memiliki batas waktu darurat (Fallback) yang berjalan di *blockchain*:
1. **Fase Deposit (`DEPOSIT_TIMEOUT`):** **15 Detik**. Jika salah satu pemain tidak menekan *approve* deposit dalam 15 detik, match bisa di-refund.
2. **Fase Bermain (`MATCH_TIMEOUT`):** **10 Menit (600 Detik)**. Jika Server Backend *crash* dan tidak mengirimkan pemenang selama 10 menit, pemain bisa menarik uang mereka kembali secara otomatis.

---

## ⚙️ Instruksi Smart Contract (API Docs)

Berikut adalah daftar fungsi yang bisa dipanggil oleh klien ke *blockchain*:

### 1. `initialize_match`
- **Aktor:** Frontend (Pemain A yang membuat *room*)
- **Fungsi:** Membuat *brankas* (Vault PDA) di *blockchain* untuk menyimpan uang taruhan.
- **Parameter:**
  - `match_id` (`[u8; 32]`): ID unik pertandingan yang digenerate oleh Backend menggunakan SHA-256 (jangan gunakan string!).
  - `wager_amount` (`u64`): Jumlah taruhan (dalam format desimal terkecil token).
  - `server_pubkey` (`Pubkey`): Alamat publik dompet Server Backend (untuk verifikasi *anti-cheat* nanti).

### 2. `deposit_wager`
- **Aktor:** Frontend (Pemain A & Pemain B)
- **Fungsi:** Memindahkan USDC dari dompet pemain ke *Vault PDA* yang dibuat pada langkah 1.
- **Kondisi:** Pemain akan melihat *pop-up Phantom wallet* untuk menyetujui transaksi pemotongan saldo. Setelah kedua pemain sukses memanggil fungsi ini, status pertandingan berubah menjadi `Active`.

### 3. `settle_match` ⚠️ (PENTING UNTUK BACKEND)
- **Aktor:** Backend (Server) / Frontend (menggunakan *signature* dari Server)
- **Fungsi:** Mengakhiri pertandingan, mendistribusikan hadiah ke pemenang, dan memotong *fee* 2.5% untuk *Treasury* tim.
- **Parameter Baru:**
  - `action` (`u8`): 
    - `0` = Pertandingan Normal (Menang/Kalah).
    - `1` = Penalti Anti-Cheat.
  - `target` (`Pubkey`): 
    - Jika `action = 0`, target adalah dompet **Pemenang**.
    - Jika `action = 1`, target adalah dompet **Cheater**. (Pemain jujur akan di-refund 100%, uang *cheater* 100% masuk ke *Treasury* tim).
  - `signature` (`[u8; 64]`): Tanda tangan kriptografi (Ed25519) dari Backend.

**🚨 PERHATIAN TIM BACKEND:** 
Format pembuatan *signature* telah berubah! Anda **TIDAK BOLEH** lagi menandatangani pesan string (misal: `"SETTLE:..."`). *Smart Contract* sekarang mewajibkan Anda untuk menandatangani array byte mentah berukuran tepat **65-byte**:
- **Byte ke-0:** Angka `action` (`0` atau `1`).
- **Byte ke-1 s/d 32:** 32-byte `match_id`.
- **Byte ke-33 s/d 64:** 32-byte `Pubkey` milik `target` dalam bentuk raw byte (bukan string *Base58*).

### 4. `refund`
- **Aktor:** Frontend (Siapapun / Pemain yang dirugikan)
- **Fungsi:** Mengambil kembali uang 100% tanpa potongan *fee*.
- **Kondisi Berhasil:**
  - Status `WaitingDeposit` DAN waktu sudah lewat 15 detik (Lawan kabur/AFK saat fase deposit).
  - Status `Active` DAN waktu sudah lewat 10 Menit (Server mati/bermasalah).

---

## 🛠️ Flow Chart Sederhana
1. **BE** membuat Room & `match_id` bytes.
2. **FE (Player A)** panggil `initialize_match` di blockchain.
3. **FE (Player A & B)** panggil `deposit_wager`.
4. *--- Game Berlangsung via WebSocket ---*
5. Game selesai, **BE** memvalidasi gerakan.
   - *Jika Normal:* BE membuat *signature* 65-byte dengan `action=0`, `target=Pemenang`.
   - *Jika Nge-cheat:* BE membuat *signature* 65-byte dengan `action=1`, `target=Cheater`.
6. **BE (atau FE)** mengirim transaksi `settle_match` ke blockchain menggunakan *signature* tersebut.
7. Blockchain membagikan uang ke dompet pemenang dan *Treasury* secara instan. Uang tidak lagi dipegang oleh *smart contract*.
