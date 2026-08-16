# FreshWash --- DATABASE.md

## 1. Tujuan

Dokumen ini mendefinisikan database FreshWash marketplace multi-laundry.

Database utama: PostgreSQL, direkomendasikan melalui Supabase.

Prinsip utama:

> Satu database mendukung banyak laundry.

Setiap data tenant/operasional laundry harus mempunyai hubungan yang
jelas dengan `laundry_id`.

------------------------------------------------------------------------

## 2. Entity Relationship

``` text
auth.users
    |
    +---- profiles
             |
             +---- customers
             |
             +---- couriers
             |
             +---- laundry_users
                         |
                         v
                      laundries
                         |
              +----------+----------+
              |          |          |
              v          v          v
          services   addresses   orders
                                  |
                  +---------------+---------------+
                  |               |               |
                  v               v               v
             order_items    assignments    payments
                                  |
                                  v
                         order_status_history
```

------------------------------------------------------------------------

## 3. profiles

Menyimpan identitas umum user.

  Column       Type            Notes
  ------------ --------------- ------------------------------
  id           uuid            PK, sama dengan auth user id
  full_name    text            Nama
  phone        text            Nomor telepon
  avatar_url   text nullable   Foto
  role         enum/text       Role utama
  is_active    boolean         Aktif/nonaktif
  created_at   timestamptz     
  updated_at   timestamptz     

Role:

``` text
platform_admin
laundry_owner
laundry_staff
customer
courier
```

------------------------------------------------------------------------

## 4. customers

  Column               Type            Notes
  -------------------- --------------- --------------
  id                   uuid            PK
  profile_id           uuid            FK profiles
  default_address_id   uuid nullable   FK addresses
  created_at           timestamptz     
  updated_at           timestamptz     

------------------------------------------------------------------------

## 5. couriers

  Column              Type                   Notes
  ------------------- ---------------------- ---------------------
  id                  uuid                   PK
  profile_id          uuid                   FK profiles
  vehicle_type        text                   motor/mobil/etc
  vehicle_number      text nullable          
  is_available        boolean                Bisa menerima order
  current_latitude    numeric nullable       
  current_longitude   numeric nullable       
  last_location_at    timestamptz nullable   
  rating              numeric                
  created_at          timestamptz            
  updated_at          timestamptz            

------------------------------------------------------------------------

## 6. laundries

Setiap laundry partner mempunyai satu record.

  Column                Type            Notes
  --------------------- --------------- ---------------------------
  id                    uuid            PK
  code                  text            Unique public code
  name                  text            Nama laundry
  owner_id              uuid            FK profiles
  description           text nullable   
  phone                 text            
  address               text            
  latitude              numeric         
  longitude             numeric         
  logo_url              text nullable   
  opening_time          time            
  closing_time          time            
  is_open               boolean         
  is_active             boolean         
  verification_status   text            pending/verified/rejected
  created_at            timestamptz     
  updated_at            timestamptz     

Contoh:

``` text
L001 = Laundry A
L002 = Laundry B
L003 = Laundry C
```

------------------------------------------------------------------------

## 7. laundry_users

Menghubungkan staff dengan laundry.

  Column       Type          Notes
  ------------ ------------- --------------
  id           uuid          PK
  laundry_id   uuid          FK laundries
  profile_id   uuid          FK profiles
  role         text          owner/staff
  is_active    boolean       
  created_at   timestamptz   

Unique:

``` text
(laundry_id, profile_id)
```

------------------------------------------------------------------------

## 8. addresses

  Column         Type            Notes
  -------------- --------------- --------------
  id             uuid            PK
  customer_id    uuid            FK customers
  label          text            Rumah/Kantor
  address_text   text            Alamat
  latitude       numeric         
  longitude      numeric         
  notes          text nullable   
  created_at     timestamptz     
  updated_at     timestamptz     

------------------------------------------------------------------------

## 9. services

Layanan milik laundry tertentu.

  Column            Type               Notes
  ----------------- ------------------ -----------------------
  id                uuid               PK
  laundry_id        uuid               FK laundries
  name              text               Nama layanan
  pricing_type      text               per_kg/per_item/fixed
  price             numeric            Harga
  min_weight        numeric nullable   
  estimated_hours   integer nullable   
  description       text nullable      
  is_active         boolean            
  created_at        timestamptz        
  updated_at        timestamptz        

Contoh:

``` text
Laundry A
- Cuci Kering 10.000/kg
- Cuci Setrika 12.000/kg

Laundry B
- Cuci Kering 9.000/kg
- Express 15.000/kg
```

Harga antar laundry boleh berbeda.

------------------------------------------------------------------------

## 10. orders

Ini adalah tabel inti.

  Column                    Type                   Notes
  ------------------------- ---------------------- ----------------------------
  id                        uuid                   PK
  order_number              text                   Unique public order number
  customer_id               uuid                   FK customers
  laundry_id                uuid                   FK laundries, WAJIB
  courier_id                uuid nullable          FK couriers
  pickup_address_id         uuid                   FK addresses
  pickup_address_snapshot   jsonb                  Snapshot alamat saat order
  pickup_latitude           numeric                
  pickup_longitude          numeric                
  estimated_weight          numeric nullable       Input customer
  actual_weight             numeric nullable       Berat aktual
  subtotal                  numeric                
  delivery_fee              numeric                
  platform_fee              numeric                
  discount                  numeric                
  total_amount              numeric                
  payment_status            text                   
  status                    text                   Order status
  pickup_scheduled_at       timestamptz nullable   
  notes                     text nullable          
  created_at                timestamptz            
  updated_at                timestamptz            

### Critical rule

`laundry_id` wajib ada.

Tidak boleh membuat order tanpa laundry.

------------------------------------------------------------------------

## 11. order_items

  Column                  Type               Notes
  ----------------------- ------------------ ----------------
  id                      uuid               PK
  order_id                uuid               FK orders
  service_id              uuid               FK services
  service_name_snapshot   text               Snapshot nama
  price_snapshot          numeric            Snapshot harga
  estimated_weight        numeric nullable   
  actual_weight           numeric nullable   
  quantity                numeric            
  subtotal                numeric            
  created_at              timestamptz        

Snapshot diperlukan supaya perubahan harga layanan di masa depan tidak
mengubah histori order lama.

------------------------------------------------------------------------

## 12. courier_assignments

  Column            Type                   Notes
  ----------------- ---------------------- ---------------------------------------------
  id                uuid                   PK
  order_id          uuid                   FK orders
  courier_id        uuid                   FK couriers
  assignment_type   text                   pickup/delivery
  status            text                   offered/accepted/rejected/expired/completed
  offered_at        timestamptz            
  responded_at      timestamptz nullable   
  completed_at      timestamptz nullable   
  created_at        timestamptz            

Satu order dapat memiliki beberapa assignment jika courier pertama
menolak.

------------------------------------------------------------------------

## 13. order_status_history

  Column       Type            Notes
  ------------ --------------- -------------
  id           uuid            PK
  order_id     uuid            FK orders
  old_status   text nullable   
  new_status   text            
  changed_by   uuid nullable   FK profiles
  note         text nullable   
  created_at   timestamptz     

Tujuannya agar seluruh perjalanan order dapat diaudit.

------------------------------------------------------------------------

## 14. payments

  Column         Type                   Notes
  -------------- ---------------------- ------------------------------
  id             uuid                   PK
  order_id       uuid                   FK orders
  provider       text                   
  method         text                   QRIS/etc
  reference      text nullable          
  amount         numeric                
  status         text                   pending/paid/failed/refunded
  paid_at        timestamptz nullable   
  raw_response   jsonb nullable         
  created_at     timestamptz            
  updated_at     timestamptz            

------------------------------------------------------------------------

## 15. laundry_payouts

Untuk pencatatan settlement ke laundry partner.

  Column         Type                   Notes
  -------------- ---------------------- --------------
  id             uuid                   PK
  laundry_id     uuid                   FK laundries
  order_id       uuid                   FK orders
  gross_amount   numeric                
  platform_fee   numeric                
  other_fee      numeric                
  net_amount     numeric                
  status         text                   pending/paid
  paid_at        timestamptz nullable   
  created_at     timestamptz            

------------------------------------------------------------------------

## 16. reviews

  Column        Type            Notes
  ------------- --------------- --------------
  id            uuid            PK
  order_id      uuid            FK orders
  customer_id   uuid            FK customers
  laundry_id    uuid            FK laundries
  rating        integer         1-5
  comment       text nullable   
  created_at    timestamptz     

------------------------------------------------------------------------

## 17. QR / Laundry Link

QR laundry tidak harus mempunyai tabel khusus pada MVP.

Public URL dapat menggunakan:

``` text
/order?laundry_id=<public-code>
```

Contoh:

``` text
/order?laundry_id=L001
```

Backend harus:

1.  Mencari laundry.
2.  Memastikan laundry aktif.
3.  Mengunci context order ke laundry tersebut.
4.  Memvalidasi service yang dipilih memang milik laundry tersebut.

Jangan hanya mempercayai `laundry_id` dari frontend.

------------------------------------------------------------------------

## 18. Row Level Security

RLS wajib dirancang.

### Customer

Boleh membaca:

``` text
orders.customer_id = own customer id
```

### Laundry owner/staff

Boleh membaca:

``` text
orders.laundry_id = user's permitted laundry_id
```

Boleh mengubah status hanya untuk order yang dimiliki laundry tersebut.

### Courier

Boleh membaca order yang:

-   ditugaskan kepadanya; atau
-   ditawarkan kepadanya; atau
-   termasuk available assignment sesuai aturan.

### Admin

Dapat membaca seluruh data platform sesuai permission.

------------------------------------------------------------------------

## 19. Index yang Direkomendasikan

Index minimal:

``` text
orders(customer_id)
orders(laundry_id)
orders(courier_id)
orders(status)
orders(created_at)
orders(laundry_id, status)
services(laundry_id)
courier_assignments(courier_id, status)
laundries(latitude, longitude) jika pendekatan geo sederhana digunakan
```

Jika pencarian lokasi berkembang, pertimbangkan PostGIS.

------------------------------------------------------------------------

## 20. Prinsip Database

Jangan:

-   menyimpan semua order dalam satu JSON besar;
-   menggunakan Google Sheets sebagai database utama;
-   menyimpan status hanya di n8n;
-   mempercayai harga dari frontend;
-   mempercayai `laundry_id` dari frontend tanpa validasi;
-   menghapus histori transaksi secara permanen.

Harga, fee, dan total harus dihitung/validasi di backend.
