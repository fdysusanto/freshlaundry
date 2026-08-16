-- ========================================================
-- SKEMA DATABASE FRESHWASH MARKETPLACE MULTI-LAUNDRY (POSTGRESQL SUPABASE)
-- ========================================================

-- 1. ENUM DEFINITIONS
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('customer', 'courier', 'laundry_owner', 'laundry_staff', 'platform_admin');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE order_status AS ENUM (
    'pending',
    'assigned',
    'picked_up',
    'in_washing',
    'ready_for_delivery',
    'out_for_delivery',
    'delivered',
    'cancelled'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE service_type AS ENUM ('kiloan', 'express', 'dry_clean', 'satuan');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('unpaid', 'paid');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE verification_status AS ENUM ('pending', 'verified', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE assignment_status AS ENUM ('offered', 'accepted', 'rejected', 'expired', 'completed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE payout_status AS ENUM ('pending', 'paid');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 2. PROFILES TABLE (Tied to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'customer',
  avatar_url TEXT,
  address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. LAUNDRIES TABLE (Mitra Laundry Partners)
CREATE TABLE IF NOT EXISTS public.laundries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id),
  description TEXT,
  phone TEXT NOT NULL,
  address TEXT NOT NULL,
  latitude NUMERIC(10, 7),
  longitude NUMERIC(10, 7),
  logo_url TEXT,
  opening_time TIME DEFAULT '08:00:00',
  closing_time TIME DEFAULT '20:00:00',
  is_open BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  verification_status verification_status NOT NULL DEFAULT 'pending',
  rating NUMERIC(3, 2) NOT NULL DEFAULT 5.0,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. LAUNDRY_USERS TABLE (Staf / Owner Management)
CREATE TABLE IF NOT EXISTS public.laundry_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laundry_id UUID NOT NULL REFERENCES public.laundries(id) ON DELETE CASCADE,
  profile_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'staff')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (laundry_id, profile_id)
);

-- 5. SERVICES TABLE (Katalog Layanan per Laundry)
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laundry_id UUID NOT NULL REFERENCES public.laundries(id) ON DELETE CASCADE,
  code service_type NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  pricing_type TEXT NOT NULL DEFAULT 'per_kg' CHECK (pricing_type IN ('per_kg', 'per_item', 'fixed')),
  price_per_unit NUMERIC(12, 2) NOT NULL,
  unit TEXT NOT NULL DEFAULT 'kg',
  min_weight NUMERIC(6, 2) DEFAULT 1,
  estimated_hours INTEGER NOT NULL DEFAULT 48,
  icon_name TEXT NOT NULL DEFAULT 'Shirt',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (laundry_id, code)
);

-- 6. ORDERS TABLE (Order Inti Marketplace)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tracking_number TEXT NOT NULL UNIQUE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  laundry_id UUID NOT NULL REFERENCES public.laundries(id),
  courier_id UUID REFERENCES public.profiles(id),
  service_type service_type NOT NULL,
  status order_status NOT NULL DEFAULT 'pending',
  estimated_weight_kg NUMERIC(6, 2),
  final_weight_kg NUMERIC(6, 2),
  pickup_address TEXT NOT NULL,
  delivery_address TEXT NOT NULL,
  pickup_date DATE NOT NULL,
  pickup_time_slot TEXT NOT NULL,
  delivery_date DATE,
  notes TEXT,
  subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0,
  delivery_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
  platform_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
  discount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total_price NUMERIC(12, 2) NOT NULL DEFAULT 0,
  payment_status payment_status NOT NULL DEFAULT 'unpaid',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. ORDER_ITEMS TABLE (Rincian Itemized Order)
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id),
  service_name_snapshot TEXT NOT NULL,
  price_snapshot NUMERIC(12, 2) NOT NULL,
  estimated_weight NUMERIC(6, 2),
  actual_weight NUMERIC(6, 2),
  quantity NUMERIC(6, 2) NOT NULL DEFAULT 1,
  subtotal NUMERIC(12, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. ORDER_STATUS_LOGS TABLE (Visual Tracking Audit Log)
CREATE TABLE IF NOT EXISTS public.order_status_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  status order_status NOT NULL,
  notes TEXT,
  updated_by UUID NOT NULL REFERENCES public.profiles(id),
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. COURIER_ASSIGNMENTS TABLE (Penugasan Kurir Driver)
CREATE TABLE IF NOT EXISTS public.courier_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  courier_id UUID NOT NULL REFERENCES public.profiles(id),
  assignment_type TEXT NOT NULL CHECK (assignment_type IN ('pickup', 'delivery')),
  status assignment_status NOT NULL DEFAULT 'offered',
  offered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. LAUNDRY_PAYOUTS TABLE (Pencairan Dana Mitra Laundry)
CREATE TABLE IF NOT EXISTS public.laundry_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  laundry_id UUID NOT NULL REFERENCES public.laundries(id),
  order_id UUID NOT NULL REFERENCES public.orders(id),
  gross_amount NUMERIC(12, 2) NOT NULL,
  platform_fee NUMERIC(12, 2) NOT NULL,
  other_fee NUMERIC(12, 2) DEFAULT 0,
  net_amount NUMERIC(12, 2) NOT NULL,
  status payout_status NOT NULL DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 11. REVIEWS TABLE (Ulasan & Rating Pelanggan)
CREATE TABLE IF NOT EXISTS public.reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES public.profiles(id),
  laundry_id UUID NOT NULL REFERENCES public.laundries(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 12. INDEXES UNTUK PERFORMA TINGGI
CREATE INDEX IF NOT EXISTS idx_orders_customer_id ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_orders_laundry_id ON public.orders(laundry_id);
CREATE INDEX IF NOT EXISTS idx_orders_courier_id ON public.orders(courier_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_tracking_number ON public.orders(tracking_number);
CREATE INDEX IF NOT EXISTS idx_services_laundry_id ON public.services(laundry_id);
CREATE INDEX IF NOT EXISTS idx_laundry_users_laundry_id ON public.laundry_users(laundry_id);
CREATE INDEX IF NOT EXISTS idx_courier_assign_courier_id ON public.courier_assignments(courier_id, status);
CREATE INDEX IF NOT EXISTS idx_order_logs_order_id ON public.order_status_logs(order_id);

-- 13. AUTOMATIC UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_orders_updated_at ON public.orders;
CREATE TRIGGER trigger_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trigger_laundries_updated_at ON public.laundries;
CREATE TRIGGER trigger_laundries_updated_at
BEFORE UPDATE ON public.laundries
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 14. ROW LEVEL SECURITY (RLS) POLICIES
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laundries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laundry_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courier_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.laundry_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Laundries & Services: Public Read (Semua calon customer bisa melihat mitra & harga)
CREATE POLICY "Laundries are viewable by everyone" ON public.laundries FOR SELECT USING (true);
CREATE POLICY "Services are viewable by everyone" ON public.services FOR SELECT USING (true);

-- Customer RLS: Customer hanya bisa melihat & membuat order milik mereka
CREATE POLICY "Customers can view own orders" ON public.orders FOR SELECT USING (auth.uid() = customer_id);
CREATE POLICY "Customers can create orders" ON public.orders FOR INSERT WITH CHECK (auth.uid() = customer_id);

-- Laundry Partner RLS: Owner / Staff hanya bisa melihat & update order laundry milik mereka
CREATE POLICY "Laundry partners can view own laundry orders" ON public.orders FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.laundry_users lu
    WHERE lu.profile_id = auth.uid()
    AND lu.laundry_id = orders.laundry_id
    AND lu.is_active = true
  )
);

CREATE POLICY "Laundry partners can update own laundry orders" ON public.orders FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.laundry_users lu
    WHERE lu.profile_id = auth.uid()
    AND lu.laundry_id = orders.laundry_id
    AND lu.is_active = true
  )
);

-- Courier RLS: Courier bisa melihat order yang ditugaskan
CREATE POLICY "Couriers can view assigned orders" ON public.orders FOR SELECT USING (
  courier_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.courier_assignments ca 
    WHERE ca.courier_id = auth.uid() AND ca.order_id = orders.id
  )
);

-- Platform Admin RLS: Full Access
CREATE POLICY "Platform admins have full access on orders" ON public.orders FOR ALL USING (
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'platform_admin')
);

-- Tracking Publik berdasarkan Resi
CREATE POLICY "Anyone can track by tracking number" ON public.orders FOR SELECT USING (true);
