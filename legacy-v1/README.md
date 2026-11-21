# ShoeLucky — Premium Multi-Shop Rewards Prototype

A polished, mobile-first **UI prototype** for a shoe-store rewards platform. Customers scan a shop-specific QR link, complete a **demo** mobile/OTP flow, receive a Spin Wheel or Scratch Card, and save a demo coupon. Admin dashboards provide Super Admin and Shop Owner views with distinct data scopes.

> **Important:** This is a front-end prototype only. OTP is not real authentication, coupon codes are not signed, redemption is local-only, and no secure server-side validation is implemented. Do not use demo coupons for real purchases.

---

## Run it

No build step or dependencies are required.

```bash
cd /storage/emulated/0/shoes
python3 -m http.server 8080
```

Open <http://localhost:8080>. Opening `index.html` directly also works, but a local server is recommended so `localStorage` behaves consistently.

---

## Customer flow

1. **Landing** — ShoeLucky branding, sneaker art, demo shop selector.
2. **Login** — mobile number entry with shop context from the QR URL.
3. **OTP** — six demo boxes. Demo OTP is always **`123456`**. No SMS is sent.
4. **Game assignment** — campaign assigns Spin Wheel, Scratch Card, or random demo mode.
5. **Spin Wheel** — animated canvas wheel with weighted demo reward selection.
6. **Scratch Card** — scratch with pointer/touch, or use “Reveal instantly (demo)”.
7. **Winning coupon** — reward, demo code, fake QR placeholder, expiry, and copy action.
8. **Coupon wallet** — filterable active / redeemed / expired demo coupon history.

Demo QR links look like:

```
#/login?shop=SL-SH-001&campaign=CMP-1001
```

Open the **QR codes** button in the customer header or the Super Admin top bar to see example shop QR URLs.

---

## Admin flow

Admin demo sign-in is at `#/admin/login`.

| Role | Email | Password | Scope |
|---|---|---|---|
| Super Admin | `super@shoelucky.demo` | `demo1234` | All shops |
| Shop Owner | `owner@soletheory.demo` | `demo1234` | `SL-SH-001` only |
| Shop Owner | `owner@kicksandco.demo` | `demo1234` | `SL-SH-002` only |

Admin pages:

- Super Admin dashboard / Shop Owner dashboard
- Shop management
- Campaign management
- Reward configuration
- Coupon management
- Coupon redemption scanner UI
- Customer analytics
- Settings & architecture (Super Admin only)

Shop Owner views are filtered to their assigned `shopId` in the client for the prototype. Production authorization must be enforced on the server.

---

## Rewards

The demo reward pool contains:

- `10%`, `20%`, `30%`, `50%`, `70%`, `90%` discounts
- Buy 1 Get 1
- Buy 1 Get 2
- Buy 1 Get 3

Reward weights can be changed in **Admin → Rewards** (Super Admin only). They affect local random selection only.

---

## Architecture

```
index.html              App shell and script order
css/styles.css          Black / white / gold design system
js/data.js              Clearly labelled demo fixtures
js/core.js              State, hash router, demo API boundary
js/ui.js                Icons, cards, buttons, modals, toasts, QR placeholders
js/customer.js          Customer screens + game interactions
js/admin.js             Admin screens + scoped demo data views
js/app.js               Bootstrap and global modal wiring
supabase/schema.sql     Reference PostgreSQL schema + RLS starting point
```

### Supabase / server readiness

`SL.api` in `js/core.js` is intentionally thin. Each method mirrors a call a production client would make to a trusted backend:

- `requestOtp` → server creates/rate-limits a hashed OTP
- `verifyOtp` → server verifies hash/expiry and issues a session
- `assignGame` → server assigns game from campaign rules
- `issueCoupon` → server selects reward and creates a signed coupon record
- `redeemCoupon` → server transaction locks, validates, and redeems
- `adminLogin` → Supabase Auth + profile role lookup

`supabase/schema.sql` defines shops, campaigns, QR tokens, rewards, customers, OTP records, game assignments, coupons, redemptions, and admin profiles, plus example RLS policies. It is a starting point, not a deployed or audited security layer.

### What is deliberately **not** implemented

- Real SMS/OTP delivery or real authentication
- Client-side coupon security or signed coupon codes
- Real camera scanning or server redemption validation
- Real payments, purchases, inventory, or fulfillment
- Real Supabase connection or server-side role enforcement

---

## Reset demo data

Use the refresh icon in the admin top bar, or **Admin → Settings → Reset demo**. This clears local state and restores the original fixtures.

---

## Notes

All names, shops, phone numbers, emails, metrics, coupon codes, and QR codes in this project are fictional demo data.
