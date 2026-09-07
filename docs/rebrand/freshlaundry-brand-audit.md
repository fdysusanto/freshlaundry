# FreshLaundry Brand Reference Audit

> **Document Status**: Complete Audit for Phase Rebrand 1  
> **Scope**: Documentation only. Zero code references were changed during Phase 1.

---

## 1. Global & Layout References

- **Metadata (`app/layout.tsx`)**:
  - Title: `'FreshWash - Laundry Pickup & Delivery Cepat & Higienis'`
  - Description: Contains references to laundry pickup & delivery features.
- **Navbar Component (`components/layout/Navbar.tsx`)**:
  - Text link / Brand logo text: `FreshWash`
- **Footer Component (`components/layout/Footer.tsx`)**:
  - Brand header text: `FreshWash`
  - Copyright line: `© 2026 FreshWash Laundry. Built for Supabase PostgreSQL & n8n Automation.`
- **Favicon**:
  - `app/favicon.ico`

---

## 2. Customer Application

- **Authentication Pages (`app/(auth)/`)**:
  - Login (`app/(auth)/login/page.tsx`): `"Masuk ke portal FreshWash untuk mengelola pesanan Anda."`
  - Register (`app/(auth)/register/page.tsx`): `"Bergabunglah dengan FreshWash untuk kemudahan laundry pickup."`
  - Reset Password (`app/(auth)/reset-password/page.tsx`): `"Masukkan password baru Anda untuk akun FreshWash."`
- **Customer Pages (`app/customer/` & `app/(dashboard)/customer/`)**:
  - Account (`app/customer/account/page.tsx`): `"Apakah Anda yakin ingin keluar dari akun FreshLaundry?"`
  - Partner Registration Promo: `"Daftarkan laundry Anda dan mulai menerima pesanan dari pelanggan FreshLaundry."`
  - Marketplace (`app/customer/laundries/page.tsx`): References to FreshLaundry marketplace.
  - Laundry Details (`app/customer/laundries/[laundryId]/page.tsx`): `"ID ... tidak terdaftar di marketplace FreshWash."`
  - Orders (`app/customer/orders/page.tsx` & `app/(dashboard)/customer/page.tsx`): Default fallback laundry name `FreshWash Laundry Partner`.
- **Marketplace Components**:
  - `components/marketplace/LocationRequiredCard.tsx`: `"FreshLaundry memerlukan lokasi Anda..."`
- **Services & Storage Keys**:
  - Favorites storage key (`hooks/useFavorites.ts`): `'freshlaundry_favorite_ids'`
  - Location key (`services/locationService.ts`): `'freshlaundry_marketplace_manual_location'`

---

## 3. Laundry Partner & Owner Portal

- **Partner Registration (`app/(auth)/register/partner/`)**:
  - Registration page (`page.tsx`): `"Bergabunglah sebagai mitra resmi FreshWash..."` and `"Tim FreshLaundry akan melakukan verifikasi data usaha Anda."`
  - Status page (`status/page.tsx`): `"Status verifikasi outlet laundry Anda oleh tim platform FreshWash."`
- **Owner Dashboard (`app/owner/` & `components/owner/`)**:
  - Main page (`app/owner/page.tsx`): `"Memuat Dashboard Partner FreshLaundry..."`, `"mitra yang tampil pada marketplace FreshLaundry."`
  - Laundry Registration (`app/owner/laundry/register/page.tsx`): `"dikaji oleh Admin Platform FreshWash."`, placeholder `"Contoh: FreshWash Express Kebayoran"`
  - Home Dashboard (`components/owner/OwnerHomeDashboard.tsx`): Default outlet name fallback `'FreshLaundry'`

---

## 4. Courier Application

- **Courier Account (`app/(dashboard)/courier/account/page.tsx`)**:
  - Subtitle: `"Logistik Partner FreshLaundry"`
  - Email fallback: `'courier@freshlaundry.com'`
- **Courier Task Cards (`components/courier/TaskCard.tsx`)**:
  - Laundry name fallback: `'FreshWash Partner Outlet'`

---

## 5. System, Emails & Refund Notices

- **Payment Webhook (`app/api/webhooks/payment/route.ts`)**:
  - Health check response: `'FreshLaundry Payment Webhook Endpoint Active'`
- **Order Details (`app/orders/[id]/page.tsx`)**:
  - Refund notice: `"Pengembalian dana sedang diproses secara manual oleh FreshLaundry."`
  - Laundry fallback: `'FreshWash Express Kebayoran'`
- **Admin Refund Portal (`app/(dashboard)/admin/refunds/page.tsx` & `components/admin/AdminRefundModal.tsx`)**:
  - Description & Modal list: `"rekening platform FreshLaundry ke customer."`

---

## 6. Technical & Infrastructure References

- **Database Seeds & Migrations (`database/`)**:
  - Seed SQL (`seeds/001_initial_laundries_and_services.sql`): Test accounts like `owner@freshlaundry.com`.
  - Migration Headers (`migrations/003_*.sql` through `045_*.sql`): Top comment header `-- FRESHWASH / FRESHLAUNDRY MARKETPLACE`.
- **Utils & Constants**:
  - Constants (`utils/constants.ts`): Admin email `'admin@freshlaundry.com'`, default laundry name `'FreshWash Express Kebayoran'`.
  - Utilities (`utils/serviceCodeUtils.ts`): Header comments.
- **Maintenance & Audit Scripts (`scripts/`)**:
  - `scripts/audit_test_accounts.ts`: Test emails `@freshlaundry.com`.
  - `scripts/update-demo-users.ts`: Comments and email lists.
  - `scripts/update-demo-email.ts`: Legacy demo emails.
- **Documentation**:
  - `ARCHITECTURE.md`, `BUSINESS_RULES.md`, `DATABASE.md`: Architectural documentation referring to FreshWash & FreshLaundry.
