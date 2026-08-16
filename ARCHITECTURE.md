# FreshWash --- ARCHITECTURE.md

## 1. Tujuan Dokumen

Dokumen ini adalah sumber acuan arsitektur teknis FreshWash. Semua AI
coding agent/developer yang mengerjakan project harus membaca dokumen
ini sebelum mengubah arsitektur, database, authentication, atau business
logic.

FreshWash adalah **marketplace multi-laundry** untuk layanan laundry
pickup & delivery.

FreshWash BUKAN satu bisnis laundry tunggal. Banyak laundry independen
dapat bergabung dan menggunakan satu platform, satu aplikasi/web app,
dan satu backend.

------------------------------------------------------------------------

## 2. Prinsip Arsitektur Utama

### 2.1 Multi-laundry / multi-tenant

Satu platform harus dapat melayani banyak laundry:

-   Laundry A
-   Laundry B
-   Laundry C
-   dan seterusnya

Tidak boleh membuat database atau aplikasi terpisah untuk setiap
laundry.

Setiap data operasional yang dimiliki laundry harus dapat dikaitkan
dengan `laundry_id`.

### 2.2 Pemisahan peran

Role utama:

1.  `platform_admin`
2.  `laundry_owner`
3.  `laundry_staff`
4.  `customer`
5.  `courier`

Role menentukan data dan tindakan yang boleh dilakukan.

### 2.3 Source of truth

-   PostgreSQL/Supabase = source of truth untuk data bisnis.
-   Backend/API = validasi dan akses data.
-   n8n = automation/orchestration, bukan database utama.
-   Frontend = UI, bukan tempat menyimpan business logic penting.

### 2.4 Mobile-first

Customer dan courier terutama menggunakan smartphone.

Web app harus responsive dan nyaman digunakan pada layar mobile.

------------------------------------------------------------------------

## 3. Arsitektur Tingkat Tinggi

``` text
Customer / Laundry / Courier / Admin
                |
                v
        Next.js Web Application
                |
                v
          Backend / API Layer
                |
        +-------+--------+
        |                |
        v                v
 PostgreSQL/Supabase     n8n
        |                |
        |        +-------+--------+
        |        |       |        |
        v        v       v        v
      Orders   WhatsApp Telegram Payment
        |
        v
     Courier
```

Komponen:

### Frontend

Next.js + TypeScript + Tailwind CSS.

### Database

PostgreSQL melalui Supabase.

### Automation

n8n.

### Deployment

VPS untuk service yang di-self-host sesuai kebutuhan.

### Version control

Git/GitHub.

------------------------------------------------------------------------

## 4. Konsep Marketplace

Customer mempunyai dua cara utama memulai order.

### 4.1 Marketplace discovery

Customer membuka FreshWash:

``` text
Lokasi customer
      |
      v
Cari laundry yang tersedia
      |
      +--> Laundry A
      +--> Laundry B
      +--> Laundry C
      |
      v
Customer memilih laundry
      |
      v
Pilih layanan
      |
      v
Buat order
```

### 4.2 Laundry-specific QR/link

Laundry partner dapat mempunyai QR/link khusus.

Contoh:

``` text
/order?laundry_id=LAUNDRY_001
```

Jika customer masuk melalui link tersebut:

-   `laundry_id` harus ditetapkan dari link.
-   Customer tidak perlu memilih laundry lagi.
-   Customer tidak boleh secara tidak sengaja mengubah order menjadi
    laundry lain.
-   Backend tetap harus memvalidasi `laundry_id`.

------------------------------------------------------------------------

## 5. Modul Utama

### Customer

-   Register/login
-   Profil
-   Alamat
-   Lokasi pickup
-   Cari laundry
-   Lihat profil laundry
-   Lihat layanan dan harga
-   Buat order
-   Lihat estimasi biaya
-   Pembayaran
-   Tracking
-   Riwayat order
-   Rating/review
-   Bantuan/komplain

### Laundry Partner

-   Registrasi
-   Profil laundry
-   Jam operasional
-   Area layanan
-   Layanan
-   Harga
-   Order masuk
-   Konfirmasi order
-   Status proses laundry
-   Serah-terima ke courier
-   Laporan transaksi
-   Payout
-   Staff management

### Courier

-   Login
-   Profil
-   Availability
-   Order pickup tersedia
-   Order delivery tersedia
-   Accept/reject assignment
-   Navigasi
-   Bukti pickup
-   Bukti delivery
-   Batch pickup/delivery
-   Pendapatan
-   Riwayat

### Platform Admin

-   Dashboard
-   Laundry management
-   Customer management
-   Courier management
-   Order monitoring
-   Payment monitoring
-   Commission
-   Payout
-   Dispute
-   Reports
-   Platform configuration

------------------------------------------------------------------------

## 6. Aturan Data

Semua order wajib mempunyai:

``` text
customer_id
laundry_id
```

`courier_id` dapat null ketika courier belum ditugaskan.

Contoh:

``` text
Order 001
customer_id = C001
laundry_id  = L001
courier_id  = K001

Order 002
customer_id = C002
laundry_id  = L002
courier_id  = null
```

Laundry L001 hanya boleh mengakses order L001.

Laundry L002 hanya boleh mengakses order L002.

Platform admin dapat mengakses seluruh order.

------------------------------------------------------------------------

## 7. Security / Row Level Security

Jika Supabase digunakan, Row Level Security (RLS) wajib dipertimbangkan
sejak awal.

Contoh aturan:

### Customer

Customer hanya dapat membaca order miliknya sendiri.

``` text
orders.customer_id = current_user.id
```

### Laundry

Laundry owner/staff hanya dapat membaca order milik laundry yang mereka
kelola.

``` text
orders.laundry_id IN user's allowed laundry IDs
```

### Courier

Courier hanya dapat membaca order yang ditugaskan kepadanya atau order
pickup/delivery yang memang tersedia untuknya sesuai business rules.

### Admin

Platform admin dapat membaca seluruh data yang diperlukan.

Jangan mengandalkan frontend untuk security. Semua authorization penting
harus divalidasi di backend/database.

------------------------------------------------------------------------

## 8. Order Lifecycle

Order secara umum:

``` text
DRAFT
  |
  v
PENDING_CONFIRMATION
  |
  v
CONFIRMED
  |
  v
COURIER_ASSIGNED
  |
  v
PICKUP_IN_PROGRESS
  |
  v
PICKED_UP
  |
  v
RECEIVED_BY_LAUNDRY
  |
  v
PROCESSING
  |
  v
READY_FOR_DELIVERY
  |
  v
DELIVERY_ASSIGNED
  |
  v
DELIVERY_IN_PROGRESS
  |
  v
DELIVERED
  |
  v
COMPLETED
```

Status exception:

``` text
CANCELLED
FAILED_PICKUP
FAILED_DELIVERY
DISPUTED
```

Setiap perubahan status penting harus dicatat di `order_status_history`.

------------------------------------------------------------------------

## 9. Courier Assignment

Assignment courier tidak boleh hard-code.

Tahap awal:

1.  Cari courier yang aktif.
2.  Filter berdasarkan area/availability.
3.  Hitung jarak jika data lokasi tersedia.
4.  Pilih courier berdasarkan aturan platform.
5.  Kirim assignment.
6.  Courier menerima atau menolak.
7.  Jika ditolak/expired, cari kandidat berikutnya.

Tahap lanjutan dapat menggunakan batch assignment.

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
        |
        v
    Batch Pickup
```

------------------------------------------------------------------------

## 10. n8n

n8n digunakan untuk:

-   Notifikasi
-   Assignment automation
-   Payment event handling
-   WhatsApp/Telegram
-   Reminder
-   Status notification
-   Scheduled jobs
-   Reporting automation
-   Integrasi eksternal

n8n tidak boleh menjadi satu-satunya tempat menyimpan state order.

Contoh:

``` text
Database = source of truth
n8n = automation
```

------------------------------------------------------------------------

## 11. Integrasi Eksternal

Integrasi yang direncanakan:

-   Google Maps / Maps API
-   WhatsApp API
-   Telegram
-   Payment gateway / QRIS
-   Email
-   Push notification

Semua integrasi harus dibuat melalui service/API layer yang jelas.

------------------------------------------------------------------------

## 12. Development Principle

Sebelum mengubah kode:

1.  Baca `ARCHITECTURE.md`.
2.  Baca `DATABASE.md`.
3.  Baca `BUSINESS_RULES.md`.
4.  Periksa struktur project saat ini.
5.  Jelaskan perubahan yang akan dilakukan.
6.  Jangan mengubah file yang tidak terkait.
7.  Jalankan test/build setelah perubahan.
8.  Laporkan file yang berubah dan hasil test.

AI coding agent tidak boleh mengasumsikan FreshWash adalah
single-laundry.

------------------------------------------------------------------------

## 13. MVP Priority

Prioritas:

1.  Multi-laundry data model
2.  Authentication
3.  Laundry onboarding
4.  Customer
5.  Service/pricing
6.  Order
7.  Courier
8.  Admin
9.  Status tracking
10. n8n notification
11. Maps
12. Payment
13. Rating/review

Jangan mengembangkan fitur kompleks sebelum fondasi multi-laundry benar.
