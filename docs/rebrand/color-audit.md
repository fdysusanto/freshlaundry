# Hard-Coded Color Audit Report

> **Document Status**: Complete Audit for Phase Rebrand 1  
> **Scope**: Color usage analysis across the application. No colors were modified in this phase.

---

## Executive Summary

The existing UI heavily utilizes Tailwind CSS utility classes with standard Tailwind palette tokens (`teal`, `blue`, `slate`, `emerald`, `amber`, `red`, `sky`).  
Primary brand highlights and CTAs currently rely on **Teal** (`teal-500`, `teal-600`, `teal-700`) and **Blue** (`blue-600`, `indigo-600`).

---

## Category A — Brand Colors (Rebrand Candidates)

These colors represent primary CTAs, active navigation states, brand accents, and primary action buttons. They are primary candidates for migration to `brand-primary`, `brand-secondary`, `brand-accent`, or `brand-support` in Phase Rebrand 3.

### 1. Primary CTAs & Brand Highlights
- **`teal-500` / `teal-600` / `teal-700`**:
  - `components/layout/Navbar.tsx`: Active link highlights, login buttons, brand accents.
  - `components/layout/MobileNav.tsx`: Active tab highlight.
  - `app/globals.css`: Text selection highlight (`selection:bg-teal-500`).
  - `components/ui/Button.tsx`: Default primary button variants (`bg-teal-600 hover:bg-teal-700`).
  - `components/ui/Stepper.tsx`: Completed step badges and progress bars.
  - Marketplace components (`LaundryCard.tsx`, `ServiceItemCard.tsx`, `LocationPickerHeader.tsx`): Category filters, action buttons, rating badges.

### 2. Secondary Highlights & Badges
- **`blue-600` / `blue-700` / `blue-50`**:
  - `components/ui/Badge.tsx`: Info badge variant.
  - `components/admin/MetricsOverview.tsx`: Stat cards.
  - `components/owner/WeightVerificationModal.tsx`: Info callouts.
  - `components/courier/CourierWeighModal.tsx`: Primary action button.

---

## Category B — Semantic Colors (Must Remain Independent)

> [!IMPORTANT]
> Semantic status colors convey operational system states and **MUST NOT** be automatically replaced by Cuciyan brand tokens.

### 1. Success States (Green / Emerald)
- **`emerald-500`, `emerald-600`, `emerald-700`, `green-600`, `bg-emerald-50`**:
  - Payment success badges, completed order status (`completed`), verified partner badges, online courier indicators.

### 2. Warning & Pending States (Amber / Yellow)
- **`amber-500`, `amber-600`, `amber-700`, `bg-amber-50`**:
  - Pending payment badges (`unpaid`, `pending`), weigh verification pending callouts, refund pending warnings.

### 3. Error, Danger & Cancelled States (Red / Rose)
- **`red-500`, `red-600`, `rose-600`, `bg-red-50`**:
  - Order cancellation alerts (`cancelled`), failed payment notices (`failed`), destructive delete actions, error toast messages.

### 4. Informational & Operational States (Sky / Indigo / Violet)
- **`sky-500`, `sky-600`, `indigo-500`, `violet-600`**:
  - Courier dispatch status (`courier_assigned`, `pickup_in_transit`, `delivery_in_transit`), in-process laundry status (`washing`, `ironing`, `ready_for_delivery`).

---

## Category C — Decorative & Neutral Colors

These colors form the foundation of page layouts, cards, borders, and typography across the app.

- **Backgrounds**: `bg-slate-50`, `bg-white`, `bg-slate-100`
- **Surfaces & Cards**: `bg-white`, `bg-slate-50/50`, `border-slate-200`, `border-slate-100`
- **Primary Typography**: `text-slate-900`, `text-slate-800`
- **Secondary Typography**: `text-slate-600`, `text-slate-500`, `text-slate-400`
