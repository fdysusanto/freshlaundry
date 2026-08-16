# FreshWash --- BUSINESS_RULES.md

## 1. Ringkasan Bisnis

FreshWash adalah marketplace yang mempertemukan:

-   Customer
-   Laundry partner
-   Courier

FreshWash menyediakan platform pemesanan laundry pickup & delivery.

Laundry partner tetap merupakan bisnis independen.

FreshWash menyediakan teknologi, marketplace, order management, courier
coordination, payment flow, dan automation.

------------------------------------------------------------------------

## 2. Model Marketplace

``` text
CUSTOMER
   |
   v
FRESHWASH MARKETPLACE
   |
   +---- Laundry A
   +---- Laundry B
   +---- Laundry C
   |
   v
COURIER
```

Satu platform dapat mempunyai banyak laundry.

------------------------------------------------------------------------

## 3. Peran dan Hak Akses

### 3.1 Platform Admin

Dapat:

-   melihat seluruh laundry;
-   memverifikasi laundry;
-   melihat seluruh customer;
-   melihat courier;
-   melihat seluruh order;
-   mengatur komisi platform;
-   melihat laporan;
-   menangani dispute;
-   mengatur konfigurasi platform.

Admin tidak boleh mengubah data operasional laundry tanpa
alasan/permission yang sesuai.

------------------------------------------------------------------------

### 3.2 Laundry Owner

Dapat:

-   mengelola profil laundry sendiri;
-   mengelola layanan;
-   mengelola harga;
-   melihat order laundry sendiri;
-   menerima/menolak order sesuai aturan;
-   mengubah status proses laundry;
-   melihat laporan laundry;
-   melihat payout;
-   mengelola staff laundry.

Tidak boleh:

-   melihat order laundry lain;
-   mengubah harga laundry lain;
-   mengakses customer laundry lain tanpa kebutuhan bisnis yang sah;
-   mengubah komisi platform.

------------------------------------------------------------------------

### 3.3 Laundry Staff

Hak akses lebih terbatas daripada owner.

Dapat:

-   melihat order laundry yang ditugaskan;
-   mengubah status operasional sesuai permission;
-   melihat detail order yang diperlukan.

Tidak dapat:

-   mengubah owner;
-   mengubah payout;
-   mengubah pengaturan platform.

------------------------------------------------------------------------

### 3.4 Customer

Dapat:

-   mencari laundry;
-   melihat profil laundry;
-   melihat layanan;
-   membuat order;
-   menyimpan alamat;
-   melihat order sendiri;
-   melakukan pembayaran;
-   tracking;
-   memberikan rating.

Tidak dapat:

-   melihat order customer lain;
-   mengubah harga;
-   mengubah laundry setelah order dikonfirmasi tanpa mengikuti aturan
    perubahan order.

------------------------------------------------------------------------

### 3.5 Courier

Dapat:

-   mengatur availability;
-   melihat assignment;
-   menerima/menolak assignment;
-   melakukan pickup;
-   melakukan delivery;
-   upload bukti;
-   melihat pendapatan dan histori sendiri.

Tidak dapat:

-   melihat seluruh order platform;
-   mengubah harga laundry;
-   mengakses data laundry lain yang tidak terkait assignment.

------------------------------------------------------------------------

## 4. Customer Memilih Laundry

Ada dua flow.

### Flow A --- Marketplace

``` text
Customer
  |
  v
Masukkan lokasi
  |
  v
Cari laundry
  |
  +--> Laundry A
  +--> Laundry B
  +--> Laundry C
  |
  v
Pilih Laundry
  |
  v
Pilih layanan
  |
  v
Order
```

Laundry dapat ditampilkan berdasarkan:

-   jarak;
-   rating;
-   harga;
-   estimasi waktu;
-   status buka;
-   area layanan.

Algoritma ranking dapat dikembangkan kemudian.

------------------------------------------------------------------------

### Flow B --- QR/link laundry

Laundry mendapatkan link khusus:

``` text
/order?laundry_id=L001
```

Customer masuk melalui QR tersebut.

Maka:

``` text
selected_laundry = L001
```

Customer langsung melihat layanan Laundry L001.

Customer tidak diminta memilih laundry lain dalam flow tersebut.

------------------------------------------------------------------------

## 5. Order Creation

Ketika customer membuat order:

1.  Pastikan customer login atau mempunyai mekanisme guest yang valid.
2.  Validasi laundry aktif.
3.  Validasi service memang milik laundry tersebut.
4.  Validasi area pickup jika laundry mempunyai batas area.
5.  Ambil harga dari database.
6.  Jangan percaya harga yang dikirim frontend.
7.  Simpan `estimated_weight`.
8.  Hitung subtotal.
9.  Hitung delivery fee jika berlaku.
10. Hitung platform fee.
11. Terapkan discount yang valid.
12. Simpan total.
13. Buat order status `PENDING_CONFIRMATION` atau status sesuai flow
    pembayaran.
14. Buat order status history.
15. Trigger automation bila diperlukan.

------------------------------------------------------------------------

## 6. Estimated Weight vs Actual Weight

Customer boleh memasukkan estimasi berat.

Contoh:

``` text
Estimasi = 5 kg
```

Saat laundry menimbang:

``` text
Aktual = 5.4 kg
```

Harga akhir harus mengikuti aturan layanan.

Contoh sederhana:

``` text
harga = actual_weight × price_per_kg
```

Namun aturan pembulatan harus didefinisikan per platform/layanan.

Contoh:

-   pembulatan 0.1 kg;
-   pembulatan 0.5 kg;
-   pembulatan ke kg berikutnya.

Jangan mengubah harga order lama hanya karena harga layanan berubah.

Gunakan snapshot harga pada `order_items`.

------------------------------------------------------------------------

## 7. Order Status (State Machine Kanonikal)

Status utama kanonikal PostgreSQL (`order_status`):

``` text
pending             -- Order baru dibuat pelanggan, menunggu konfirmasi/penugasan
assigned            -- Kurir/penugasan telah ditetapkan
picked_up           -- Kurir telah mengambil paket dari alamat pelanggan
in_washing          -- Pakaian dalam proses pencucian & penanganan workshop
ready_for_delivery  -- Pakaian selesai diproses & terkemas, siap diantar
out_for_delivery    -- Kurir sedang dalam perjalanan mengantar paket
delivered           -- Paket telah diterima pelanggan (Terminal Status)
cancelled           -- Pesanan dibatalkan (Terminal Status)
```

Catatan: Payment Status (`payment_status`) bersifat independen (`unpaid`, `pending`, `paid`, `failed`, `refunded`) dan TIDAK dicampur dengan Order Status.

Transisi status yang valid (`VALID_ORDER_TRANSITIONS`):
- `pending` → `assigned` | `cancelled`
- `assigned` → `picked_up` | `cancelled`
- `picked_up` → `in_washing`
- `in_washing` → `ready_for_delivery`
- `ready_for_delivery` → `out_for_delivery`
- `out_for_delivery` → `delivered`

Setiap perubahan status wajib membuat log audit pada `order_status_logs`.

------------------------------------------------------------------------

## 8. Hak Akses Transisi Status Berdasarkan Peran

### Customer
Dapat:
- membuat order (`pending`);
- membatalkan order (`cancelled`) HANYA jika status order saat ini masih `pending` atau `assigned`.

Tidak dapat:
- mengubah status ke `in_washing`, `ready_for_delivery`, `out_for_delivery`, atau `delivered`.

### Laundry Owner & Staff
Dapat:
- mengonfirmasi & menugaskan kurir (`pending` → `assigned`);
- membatalkan order pra-penjemputan (`pending`/`assigned` → `cancelled`);
- memperbarui status proses workshop (`picked_up` → `in_washing`);
- menandai laundry selesai & siap diantar (`in_washing` → `ready_for_delivery`).

### Courier
Dapat:
- mengonfirmasi penjemputan (`assigned` → `picked_up`);
- memulai pengantaran (`ready_for_delivery` → `out_for_delivery`);
- mengonfirmasi serah terima paket (`out_for_delivery` → `delivered`).

### Admin Platform
Dapat:
- melakukan intervensi operasional sesuai grafik transisi valid (`VALID_ORDER_TRANSITIONS`) dengan pencatatan audit trail lengkap.

Dapat melakukan override dengan audit trail.

------------------------------------------------------------------------

## 9. Courier Assignment

Tujuan:

Mendapatkan courier yang tepat untuk pickup/delivery.

MVP:

1.  Cari courier aktif.
2.  Cari courier yang tersedia.
3.  Filter area.
4.  Pilih kandidat.
5.  Kirim assignment.
6.  Courier menerima.
7.  Jika menolak, offer ke kandidat berikutnya.

Tahap lanjut:

-   distance;
-   traffic;
-   courier workload;
-   batching;
-   route optimization.

------------------------------------------------------------------------

## 10. Batch Pickup

Satu courier dapat mengambil beberapa order dalam satu perjalanan.

Contoh:

``` text
Laundry A
 |
 +-- Order 001
 +-- Order 002
 +-- Order 003
 +-- Order 004
       |
       v
    Courier 01
```

Syarat:

-   order mempunyai pickup point/area yang kompatibel;
-   jadwal pickup sesuai;
-   courier mempunyai kapasitas;
-   semua assignment tetap dapat dilacak secara individual.

Jangan menggabungkan order menjadi satu transaksi. Batch hanya merupakan
grouping operasional.

------------------------------------------------------------------------

## 11. Batch Delivery

Konsep sama untuk delivery.

Satu courier dapat mengantar beberapa order jika:

-   rute kompatibel;
-   jadwal kompatibel;
-   kapasitas mencukupi.

------------------------------------------------------------------------

## 12. Laundry Service

Setiap laundry dapat mempunyai layanan sendiri.

Contoh Laundry A:

``` text
Cuci Kering       10.000/kg
Cuci Setrika      12.000/kg
Express            15.000/kg
```

Laundry B:

``` text
Cuci Kering        9.000/kg
Cuci Setrika      11.000/kg
```

Jangan menggunakan satu harga global untuk semua laundry kecuali
platform memang mempunyai aturan khusus.

------------------------------------------------------------------------

## 13. Platform Fee / Commission

Platform dapat mengenakan:

-   fee per order;
-   persentase;
-   kombinasi fee;
-   courier fee;
-   payment fee.

Contoh:

``` text
Order = Rp50.000

Platform fee = Rp2.000
Courier fee  = Rp1.000
Laundry net  = sesuai formula settlement
```

Angka di atas hanya contoh dan tidak boleh dianggap sebagai angka final
bisnis.

Semua fee harus dapat dikonfigurasi.

------------------------------------------------------------------------

## 14. Payment

Payment flow harus memisahkan:

``` text
Order total
Payment status
Settlement
```

Status payment:

``` text
PENDING
PAID
FAILED
EXPIRED
REFUNDED
PARTIALLY_REFUNDED
```

Jangan menganggap customer sudah membayar hanya karena customer menekan
tombol "Saya sudah bayar".

Jika payment gateway digunakan, webhook/provider response harus menjadi
sumber konfirmasi pembayaran.

Untuk QRIS statis, sistem perlu mempunyai mekanisme verifikasi yang
jelas sebelum status dianggap `PAID`.

------------------------------------------------------------------------

## 15. Cancellation

Aturan pembatalan harus mempertimbangkan status.

Contoh:

### Sebelum courier ditugaskan

Customer dapat membatalkan.

### Courier sudah pickup

Pembatalan biasa tidak boleh dilakukan tanpa proses khusus.

### Laundry sudah processing

Pembatalan harus melalui dispute/support.

Aturan final dapat diubah sesuai model bisnis.

------------------------------------------------------------------------

## 16. Dispute

Kasus:

-   berat aktual berbeda;
-   pakaian hilang;
-   pakaian rusak;
-   pickup gagal;
-   delivery gagal;
-   pembayaran bermasalah.

Dispute harus mempunyai:

-   order_id;
-   pihak yang melapor;
-   kategori;
-   deskripsi;
-   bukti;
-   status;
-   resolution;
-   audit trail.

------------------------------------------------------------------------

## 17. Laundry Onboarding

Laundry partner:

``` text
Register
  |
  v
Isi profil
  |
  v
Isi alamat
  |
  v
Isi layanan/harga
  |
  v
Submit verification
  |
  v
Platform admin review
  |
  +--> Verified
  |
  +--> Rejected / Revision
```

Laundry belum boleh menerima order marketplace sebelum status sesuai
dengan aturan platform.

------------------------------------------------------------------------

## 18. Laundry QR Code

Setiap laundry verified dapat mempunyai QR/link.

Contoh:

``` text
FreshWash
Laundry ABC

Scan untuk pesan pickup
```

QR membuka:

``` text
/order?laundry_id=L001
```

QR harus mengarah ke public laundry code yang aman digunakan di URL.

Jangan mengekspos data internal sensitif.

------------------------------------------------------------------------

## 19. Rating

Customer dapat memberikan rating setelah order selesai.

Rating:

``` text
1 - 5
```

Review terkait dengan order dan laundry.

Satu order hanya dapat mempunyai satu review customer untuk laundry,
kecuali platform secara eksplisit mendukung revisi review.

------------------------------------------------------------------------

## 20. Notification

Notification dapat dikirim ketika:

-   order dibuat;
-   laundry menerima;
-   courier ditugaskan;
-   courier menuju pickup;
-   laundry menerima;
-   laundry selesai;
-   delivery dimulai;
-   order selesai;
-   payment berubah;
-   dispute berubah.

Channel:

-   Web notification
-   WhatsApp
-   Telegram
-   Email
-   Push notification

n8n dapat digunakan untuk orchestration.

------------------------------------------------------------------------

## 21. WhatsApp / Chatbot

Chatbot bukan UI utama marketplace.

UI utama:

``` text
Web App
```

Chatbot digunakan sebagai channel tambahan:

-   cek status;
-   bantuan;
-   notifikasi;
-   FAQ;
-   komplain;
-   link ke halaman order.

Customer tidak seharusnya dipaksa mengikuti flow chat panjang untuk
order jika UI web tersedia.

------------------------------------------------------------------------

## 22. Google Maps

Maps digunakan untuk:

-   memilih lokasi;
-   menyimpan latitude/longitude;
-   menghitung jarak;
-   menampilkan rute;
-   membantu courier.

Untuk marketplace, lokasi dapat digunakan untuk mencari laundry
terdekat.

Jangan mengandalkan alamat teks saja.

Simpan:

``` text
latitude
longitude
address_text
```

------------------------------------------------------------------------

## 23. Pricing Rule

Harga final harus dihitung dari data server/database.

## 23. Pricing Engine & Aturan Perhitungan Harga (Fase 4B)

Seluruh perhitungan harga bersifat **autoritatif di server/backend (`services/pricingService.ts`)**. Frontend TIDAK BOLEH menentukan harga unit, subtotal, fee, discount, atau total bayar.

### Formula Perhitungan
```text
ITEM SUBTOTAL = sum(quantity × unit_price_autoritatif_database)
SUBTOTAL      = Math.round(ITEM SUBTOTAL)
CUSTOMER TOTAL = Math.max(0, SUBTOTAL + DELIVERY_FEE + PLATFORM_FEE - DISCOUNT)
```

### Prinsip Utama Perhitungan
1. **Never Trust Client Prices**:
   Client hanya mengirimkan `laundryId`, daftar `items` (`serviceId`, `quantity`), dan opsi `discountCode`. Harga unit diambil dari master data/database Supabase `services`.
2. **Validasi Kepemilikan Multi-Tenant**:
   Setiap `serviceId` yang dipesan WAJIB divalidasi milik `laundryId` yang dipilih. Pesanan yang mencampur layanan Laundry A dengan Laundry B akan ditolak server.
3. **Penyimpanan Nilai Uang (Integer IDR)**:
   Seluruh nilai finansial menggunakan bilangan bulat Rupiah (Integer IDR) tanpa pecahan desimal.
4. **Snapshot Harga (Price Snapshotting)**:
   Saat order dibuat, `price_snapshot` dan `subtotal` disimpan pada `order_items`. Perubahan tarif di katalog layanan di masa depan tidak akan mengubah histori transaksi lama.

## 24. Data Isolation

Aturan paling penting:

``` text
Laundry A tidak boleh melihat data Laundry B.
```

Ini berlaku untuk:

-   order;
-   customer;
-   staff;
-   service;
-   payout;
-   laporan.

Platform admin mempunyai akses lintas tenant sesuai permission.

------------------------------------------------------------------------

## 25. MVP Business Scope

Versi pertama cukup:

### Customer

-   Register/login
-   Cari laundry
-   Pilih laundry
-   Lihat layanan
-   Buat order
-   Tracking
-   Riwayat

### Laundry

-   Register
-   Profile
-   Services
-   Incoming orders
-   Update processing status

### Courier

-   Login
-   Assigned orders
-   Pickup
-   Delivery
-   Status update

### Admin

-   Laundry approval
-   Customer
-   Courier
-   Orders
-   Basic report

### Automation

-   Assignment notification
-   Order status notification

------------------------------------------------------------------------

## 26. Fitur Setelah MVP

Jangan dibuat sebelum MVP stabil:

-   advanced route optimization;
-   AI customer service;
-   loyalty;
-   subscription;
-   promo engine kompleks;
-   wallet;
-   referral;
-   dynamic pricing;
-   advanced analytics;
-   multi-city optimization.

------------------------------------------------------------------------

## 27. Definition of Done

Sebuah fitur dianggap selesai hanya jika:

1.  UI berjalan.
2.  Database berjalan.
3.  Authorization benar.
4.  Data tersimpan dengan benar.
5.  Error handling tersedia.
6.  Mobile responsive.
7.  Tidak merusak role lain.
8.  Test utama berhasil.
9.  `npm run build` berhasil.
10. Tidak ada business logic penting yang hanya berada di frontend.

------------------------------------------------------------------------

## 28. Aturan untuk AI Coding Agent

Sebelum coding:

1.  Baca ketiga dokumen:
    -   `ARCHITECTURE.md`
    -   `DATABASE.md`
    -   `BUSINESS_RULES.md`
2.  Inspect project.
3.  Jangan berasumsi FreshWash adalah satu laundry.
4.  Jangan membuat perubahan besar tanpa menjelaskan rencana.
5.  Jangan menghapus data/schema tanpa konfirmasi.
6.  Jangan mengubah business rule tanpa persetujuan.
7.  Setelah coding, jalankan lint/typecheck/build yang tersedia.
8.  Laporkan:
    -   file yang diubah;
    -   database yang berubah;
    -   endpoint yang berubah;
    -   test yang dijalankan;
    -   hasil test;
    -   known issues.

------------------------------------------------------------------------

## 29. Prinsip Akhir

FreshWash adalah platform.

Laundry adalah tenant/partner.

Customer adalah pengguna marketplace.

Courier adalah operator pickup/delivery.

PostgreSQL adalah source of truth.

Backend adalah penjaga business rules.

n8n adalah automation engine.

Frontend adalah interface.

Semua keputusan teknis harus mempertahankan prinsip tersebut.

------------------------------------------------------------------------

## 30. Payment State Machine & Payment Gateway Abstraction (Fase 4C)

Sistem pembayaran dirancang secara terpisah dan independen dari alur status pesanan (`OrderStatus`).

### Prinsip Utama Pembayaran
1. **Dua State Machine Terpisah**:
   - `OrderStatus`: `pending` → `assigned` → `picked_up` → `in_washing` → `ready_for_delivery` → `out_for_delivery` → `delivered` (atau `cancelled`).
   - `PaymentStatus`: `unpaid` → `pending` → `paid` (atau `failed` / `expired`), serta `paid` → `refunded`.
2. **Kanonikal Payment Status**:
   - `unpaid`: Pesanan baru dibuat, belum ada inisiasi pembayaran.
   - `pending`: Transaksi pembayaran telah dibuat di gateway/QRIS, menunggu konfirmasi/transfer.
   - `paid`: Server telah mengonfirmasi pembayaran berhasil secara autoritatif.
   - `failed`: Pembayaran ditolak/gagal oleh provider.
   - `expired`: Batas waktu pembayaran (misal 15 menit) telah habis.
   - `refunded`: Dana dikembalikan oleh Platform Admin.
3. **Pemberlakuan Idempotensi**:
   Permintaan pemrosesan pembayaran ulang dengan `order_id` yang sama tidak akan membuat transaksi pembayaran ganda jika pembayaran aktif (`pending`) sudah ada.
4. **Verifikasi Jumlah Pembayaran Server-Side**:
   Jumlah tagihan diambil langsung dari Pricing Engine (`total_price` di database). Nominal yang dikirim dari browser pelanggan diabaikan dan divalidasi ketat.
5. **Abstraksi Gateway Independen**:
   Integrasi payment gateway dibungkus melalui antarmuka `PaymentGateway` dengan implementasi `MockPaymentGateway` untuk lingkungan pengujian sebelum gateway riil (seperti Midtrans/Xendit/QRIS) terhubung.

------------------------------------------------------------------------

## 31. Order Creation API & Order Engine Consolidation (Fase 4D)

Order Engine mengonsolidasikan Order State Machine (4A), Server-Side Pricing Engine (4B), dan Payment State Machine (4C) ke dalam satu alur transaksi tunggal autoritatif (`services/checkoutService.ts` dan `POST /api/checkout`).

### Alur Autoritatif Transaksi Checkout
```text
CLIENT (Checkout Form)
  ↓ [Input: laundryId, items, pickup/delivery address, voucherCode, idempotencyKey]
VALIDASI INPUT & AUTENTIKASI
  ↓
IDEMPOTENCY CHECK (Sistem memeriksa idempotency_key di database)
  ├─ Jika Ditemukan (Replayed Request):
  │    → Langsung kembalikan CheckoutResult pesanan & pembayaran yang sudah ada (isDuplicate = true)
  └─ Jika Baru:
       ↓
PRICING ENGINE CALCULATION (pricingService.calculateOrderPricingAsync)
  │    → Verifikasi kepemilikan multi-tenant (service milik laundryId yang dipilih)
  │    → Ambil tarif unit asli dari database Supabase (abaikan unitPrice dari client)
  │    → Hitung subtotal, delivery fee, platform fee (Rp 2.000), diskon voucher, & total_price
       ↓
PERSISTENSI ATOMIK ORDER & SNAPSHOT HARGA (orders + order_items)
  │    → Simpan status order = 'pending', payment_status = 'unpaid'
  │    → Rekam price_snapshot pada order_items
       ↓
INISIASI PEMBAYARAN INITIAL (paymentService.createPaymentAttemptAsync)
  │    → Buat transaksi QRIS/mock gateway menggunakan nominal autoritatif order.total_price
       ↓
RETUR CHECKOUT RESULT KONSOLIDASI (Diterima oleh Frontend)
```

### Prinsip Keamanan & Idempotensi
1. **Pemberlakuan Idempotensi Berbasis Client Key**:
   Client wajib menyediakan `idempotencyKey` unik. Kiriman ganda dengan kunci yang sama dijamin **TIDAK** membuat dua order terpisah di database.
2. **Manipulasi Harga Client Diabaikan**:
   Setiap nominal yang dikirim client (`unitPrice` atau `clientSuppliedTotal`) secara ketat diabaikan dan digantikan oleh perhitungan autoritatif server.
3. **Pemberlakuan Multi-Tenant**:
   Layanan yang tidak terdaftar pada toko laundry yang dipilih akan ditolak secara otomatis sebelum pembuatan order dilakukan.

------------------------------------------------------------------------

## 32. End-to-End Order Operations (Fase 4E)

Platform FreshLaundry mengimplementasikan siklus hidup operasional pesanan end-to-end yang menghubungkan secara aman Pelanggan (Customer), Mitra Laundry (Laundry Owner/Staff), Kurir (Courier), dan Pembayaran (Payment Gateway).

### Alur Siklus Hidup Operasional Pesanan End-to-End
```text
  [CUSTOMER] Checkout Pesanan (POST /api/checkout) 
       ↓ (Order: pending, Payment: pending)
  [PAYMENT] Konfirmasi Pembayaran (POST /api/orders/[id]/payment)
       ↓ (Payment: paid, Order: pending - Dekopel dari Order Status)
  [LAUNDRY] Penerimaan Order oleh Mitra Laundry (pending → assigned)
       ↓ (POST /api/orders/[id]/transition)
  [PLATFORM / LAUNDRY] Penugasan Kurir (POST /api/orders/[id]/assign-courier)
       ↓ (Assigned courier ID & status assigned)
  [COURIER] Penjemputan Pakaian oleh Kurir (assigned → picked_up)
       ↓ (Hanya kurir terdaftar yang dapat melakukan pickup)
  [LAUNDRY] Proses Pencucian di Workshop Laundry (picked_up → in_washing)
       ↓ (Hanya toko laundry pemilik order yang dapat memproses)
  [LAUNDRY] Selesai Cuci & Siap Dikirim (in_washing → ready_for_delivery)
       ↓
  [COURIER] Pengantaran oleh Kurir (ready_for_delivery → out_for_delivery)
       ↓
  [COURIER] Penyelesaian Pengantaran & Serah Terima (out_for_delivery → delivered)
       ↓
  [TERMINAL] Pesanan Selesai (Status 'delivered' & 'cancelled' bersifat TERMINAL & tidak dapat diubah)
```

### Matriks Otorisasi & Keamanan Peran (Role Security)
1. **Aturan Hak Akses Otorisasi**:
   - **Customer**: Hanya dapat membuat pesanan (`POST /api/checkout`) dan membatalkan pesanan (`pending` / `assigned` → `cancelled`). Dilarang mengubah status operasional laundry/kurir.
   - **Laundry Partner (Owner / Staff)**: Dapat menerima pesanan (`pending` → `assigned`), membatalkan pesanan sebelum jemput, memproses pencucian (`picked_up` → `in_washing`), dan menandai cucian siap dikirim (`in_washing` → `ready_for_delivery`). Terisolasi hanya pada order milik toko laundry-nya (`laundryId`).
   - **Courier**: Dapat melakukan penjemputan (`assigned` → `picked_up`), mengantar pesanan (`ready_for_delivery` → `out_for_delivery`), dan menyelesaikan serah terima paket (`out_for_delivery` → `delivered`). Terisolasi hanya pada order yang ditugaskan kepadanya (`courierId`).
   - **Platform Admin**: Memiliki hak otorisasi penuh untuk intervensi operasional sesuai grafik transisi valid (`VALID_ORDER_TRANSITIONS`) dengan pencatatan audit log lengkap.

2. **Audit Logging & Tracing**:
   Setiap transisi status mencatat riwayat pembaruan (`order_status_logs`) dengan menyertakan `status`, `notes`, `updated_by`, dan `timestamp` sebagai jejak audit autoritatif.



