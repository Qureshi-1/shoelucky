# ShoeLucky — customer games + operator console

A mobile-first coupon-games app for shoe shops. The browser renders screens;
**all game rules, permissions and redemption decisions are enforced by
`server.py` with SQLite**.

## Run

```bash
cd /storage/emulated/0/shoes
python3 server.py 8080
```

Open http://localhost:8080

`server.py` uses only the Python standard library — no `pip install`, no npm,
no build step. It creates `shoelucky.db` automatically on first run. Delete that
file to reset the local database.

> `python3 -m http.server` is not enough: the app calls `/api/...` routes.
> Always start `server.py`.

## Customer flow

- Pick your shop on the landing page.
- Sign in with mobile OTP. When no SMS provider is configured, the local setup
  code is shown on the OTP screen; when MSG91 is configured, the code is sent by
  SMS and is no longer displayed.
- If `GOOGLE_CLIENT_ID` is set, Google Identity Services is loaded and the
  returned ID token is verified by the server. Otherwise the Google option is
  hidden — no misleading sign-in button.
- Home shows daily spin availability, welcome cards and time left until reset.
- **Spin Wheel** — 1 spin per day, blocked by mobile number **and device ID** on
  the server.
- **Scratch Card** — new members get 2 cards; each draw is issued server-side.
- Coupons use `SL-XXXXXX` codes, show issue/expiry dates, and can be copied.

No QR code is shown inside the website — the customer is already on the page.
For a printed counter QR later, generate one from your live URL.

## Admin panel

Open **“Admin / Shop owner panel →”** from the landing page (or go to
`#/admin/login`).

On a local setup, the login screen offers one-click account fills. The initial
accounts are:

| Account | Password | Role | Sees |
| --- | --- | --- | --- |
| `super@shoelucky.app` | value of `BOOTSTRAP_ADMIN_PASSWORD` | Super Admin | all shops, shops/reward management |
| `owner@soletheory.app` | same | Shop Owner | only `SL-SH-001` |
| `owner@kicksandco.app` | same | Shop Owner | only `SL-SH-002` |

The default bootstrap password is `ChangeMe2026!`. Change it with:

```bash
BOOTSTRAP_ADMIN_PASSWORD='your-strong-password' python3 server.py 8080
```

Admin screens:

- **Overview** — scope strip, live stats, quick actions, recent coupons
- **Coupons** — redeem by code (server checks shop, expiry, double-use) + records
- **Reports** — 7-day plays, reward distribution
- **Activity** — audit log
- **Shops / Rewards** — Super Admin only (create shop, change reward weights)

## Configuration

| Variable | Purpose |
| --- | --- |
| `SHOELUCKY_ENV=production` | Disables local OTP/Google fallbacks and hides setup credentials |
| `GOOGLE_CLIENT_ID` | Enables real Google Identity Services sign-in + server-side ID-token verification |
| `SMS_PROVIDER=msg91` | Enables real OTP delivery |
| `MSG91_AUTH_KEY` | MSG91 API key |
| `MSG91_TEMPLATE_ID` | Optional MSG91 template ID |
| `ALLOW_LOCAL_OTP=0` | Disables the local OTP fallback without full production mode |
| `BOOTSTRAP_ADMIN_PASSWORD` | Password used when the admin table is first seeded |

Example production start:

```bash
SHOELUCKY_ENV=production \
GOOGLE_CLIENT_ID='xxxx.apps.googleusercontent.com' \
SMS_PROVIDER=msg91 MSG91_AUTH_KEY='...' MSG91_TEMPLATE_ID='...' \
BOOTSTRAP_ADMIN_PASSWORD='a-long-random-value' \
python3 server.py 8080
```

`GET /api/config` tells the browser which providers are enabled. No provider
secret is sent to the client; local setup credentials are only exposed when
`SHOELUCKY_ENV` is not `production`.

## What is solid

- SQLite persistence with WAL + atomic writes for spin / scratch / redeem
- PBKDF2 password hashing (120k iterations) + random bearer tokens with expiry
- Role scoping: shop owners cannot view or redeem another shop's coupons
- Server-side reward draw, daily limit, scratch quota and expiry checks
- Audit trail for sign-ins, spins, scratches, redemption, shop/reward changes
- OTP rate-limiting (5 requests / 10 min per number)
- Local-only fallback is clearly labelled in the UI and disabled in production

For a public deployment also add HTTPS, reverse-proxy hardening, monitoring and
a proper secrets manager. Tokens currently live in `localStorage`.

## Files

- `server.py` — stdlib HTTP + JSON API + SQLite schema/rules/providers
- `index.html` — app shell (Bootstrap first, then the theme)
- `assets/vendor/` — local Bootstrap 5.3.3 CSS + JS bundle
- `assets/styles/app.css` — premium theme, layout, animations, admin styles
- `assets/js/app.js` — routing, API client, screens, wheel + scratch UI
- `legacy-v1/` — earlier static prototype kept for reference only

## Quick checks

```bash
curl http://localhost:8080/api/health
curl http://localhost:8080/api/config
```