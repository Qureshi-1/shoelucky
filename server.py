#!/usr/bin/env python3
"""ShoeLucky backend — stdlib only (no pip install needed).

Run:  python3 server.py [port]      (default 8080)
Open: http://localhost:8080

Production-capable core:
  * SQLite persistence (shoelucky.db)
  * PBKDF2 password hashing + bearer tokens with expiry
  * Reward drawing, daily spin limit, scratch quota — all decided SERVER-SIDE
  * Admin roles: super_admin sees every shop, shop_owner sees only own shop
  * Atomic coupon redemption + audit log
  * Real Google ID-token verification when GOOGLE_CLIENT_ID is set
  * Real MSG91 OTP delivery when SMS_PROVIDER=msg91 + MSG91_AUTH_KEY are set
With no provider configured, a clearly-flagged local fallback keeps development
usable. Set SHOELUCKY_ENV=production to disable that fallback.
"""
import hashlib
import hmac
import json
import os
import secrets
import sqlite3
import string
import threading
import time
from datetime import datetime, timedelta, timezone
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from urllib.parse import urlencode, quote, urlparse, parse_qs
import urllib.request

import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(ROOT, "shoelucky.db")
PORT = int(os.environ.get("PORT") or 8080)
if len(sys.argv) > 1 and sys.argv[1].isdigit():
    PORT = int(sys.argv[1])

ENV = os.environ.get("SHOELUCKY_ENV", "local").strip().lower()
PRODUCTION = ENV in ("production", "prod", "live")
GOOGLE_CLIENT_ID = os.environ.get("GOOGLE_CLIENT_ID", "").strip()
SMS_PROVIDER = os.environ.get("SMS_PROVIDER", "").strip().lower()
MSG91_AUTH_KEY = os.environ.get("MSG91_AUTH_KEY", "").strip()
MSG91_TEMPLATE_ID = os.environ.get("MSG91_TEMPLATE_ID", "").strip()
ALLOW_LOCAL_OTP = os.environ.get("ALLOW_LOCAL_OTP", "1").strip() == "1" and not PRODUCTION
BOOTSTRAP_PASSWORD = os.environ.get("BOOTSTRAP_ADMIN_PASSWORD", "ChangeMe2026!")

LOCAL_OTP = "123456"
TOKEN_TTL = 7 * 24 * 3600
ADMIN_TTL = 12 * 3600
OTP_TTL = 10 * 60
COUPON_DAYS = 7

_db_lock = threading.Lock()
_otp_rate = {}
_rate_lock = threading.Lock()

# ---------------------------------------------------------------- DB helpers
def connect():
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    con.execute("PRAGMA journal_mode = WAL")
    return con


def utcnow():
    return datetime.now(timezone.utc)


def now_iso():
    return utcnow().isoformat(timespec="seconds")


def day_today():
    return utcnow().strftime("%Y-%m-%d")


def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt), 120000).hex()
    return salt, digest


def verify_password(password, salt, digest):
    _, calc = hash_password(password, salt)
    return hmac.compare_digest(calc, digest)


def new_id(prefix):
    return prefix + "-" + secrets.token_hex(5).upper()


def coupon_code():
    alphabet = string.ascii_uppercase + string.digits
    return "SL-" + "".join(secrets.choice(alphabet) for _ in range(6))


def init_db():
    with connect() as con:
        con.executescript("""
        CREATE TABLE IF NOT EXISTS shops (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, area TEXT, owner_name TEXT,
          status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS admins (
          id TEXT PRIMARY KEY, email TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
          role TEXT NOT NULL, shop_id TEXT, salt TEXT NOT NULL, digest TEXT NOT NULL,
          created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY, phone TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
          email TEXT, provider TEXT NOT NULL, shop_id TEXT, device_id TEXT,
          scratch_left INTEGER NOT NULL DEFAULT 2, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS otps (
          id TEXT PRIMARY KEY, phone TEXT NOT NULL, code TEXT NOT NULL,
          expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0
        );
        CREATE TABLE IF NOT EXISTS rewards (
          id TEXT PRIMARY KEY, label TEXT NOT NULL, short TEXT NOT NULL,
          weight INTEGER NOT NULL, scratch_eligible INTEGER NOT NULL DEFAULT 0,
          active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS spins (
          id TEXT PRIMARY KEY, user_id TEXT NOT NULL, phone TEXT NOT NULL,
          device_id TEXT, day TEXT NOT NULL, reward_id TEXT NOT NULL,
          coupon_id TEXT NOT NULL, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS coupons (
          id TEXT PRIMARY KEY, code TEXT UNIQUE NOT NULL, user_id TEXT NOT NULL,
          shop_id TEXT NOT NULL, reward_id TEXT NOT NULL, label TEXT NOT NULL,
          short TEXT NOT NULL, source TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
          issued_at TEXT NOT NULL, expires_at TEXT NOT NULL,
          redeemed_at TEXT, redeemed_by TEXT
        );
        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY, kind TEXT NOT NULL, subject_id TEXT NOT NULL,
          expires_at INTEGER NOT NULL, created_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS audit (
          id TEXT PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL,
          detail TEXT, created_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_coupons_shop ON coupons(shop_id);
        CREATE INDEX IF NOT EXISTS idx_coupons_user ON coupons(user_id);
        CREATE INDEX IF NOT EXISTS idx_spins_day ON spins(day);
        """)

        # Lightweight migrations for databases created by earlier local builds.
        user_cols = [r["name"] for r in con.execute("PRAGMA table_info(users)")]
        if "email" not in user_cols:
            con.execute("ALTER TABLE users ADD COLUMN email TEXT")
        con.execute("UPDATE users SET name='Shopper' WHERE name IN ('Demo User','Google Demo User')")
        con.execute("UPDATE users SET provider='google-local' WHERE provider='google-demo'")

        # Old local seed emails used a .demo suffix; move them to the new seed IDs
        # and refresh their password to the current bootstrap password.
        for old, new in (
            ("super@shoelucky.demo", "super@shoelucky.app"),
            ("owner@soletheory.demo", "owner@soletheory.app"),
            ("owner@kicksandco.demo", "owner@kicksandco.app"),
        ):
            legacy = con.execute("SELECT 1 FROM admins WHERE email=?", (old,)).fetchone()
            if not legacy:
                continue
            if con.execute("SELECT 1 FROM admins WHERE email=?", (new,)).fetchone():
                con.execute("DELETE FROM admins WHERE email=?", (old,))
            else:
                salt, digest = hash_password(BOOTSTRAP_PASSWORD)
                con.execute("UPDATE admins SET email=?, salt=?, digest=? WHERE email=?",
                            (new, salt, digest, old))

        if con.execute("SELECT COUNT(*) FROM shops").fetchone()[0] == 0:
            con.executemany(
                "INSERT INTO shops(id,name,area,owner_name,status,created_at) VALUES(?,?,?,?,?,?)",
                [
                    ("SL-SH-001", "Sole Theory", "Main Road", "Ravi Kumar", "active", now_iso()),
                    ("SL-SH-002", "Kicks & Co.", "Market Street", "Imran Shaikh", "active", now_iso()),
                    ("SL-SH-003", "Street Kicks", "Station Road", "Neha Verma", "active", now_iso()),
                ],
            )

        if con.execute("SELECT COUNT(*) FROM rewards").fetchone()[0] == 0:
            rewards = [
                ("D10", "10% OFF", "10%", 95, 1, 1),
                ("D20", "20% OFF", "20%", 5, 1, 1),
                ("D30", "30% OFF", "30%", 0, 1, 1),
                ("D50", "50% OFF", "50%", 0, 0, 1),
                ("B1G1", "Buy 1 Get 1", "B1G1", 0, 0, 1),
                ("D70", "70% OFF", "70%", 0, 0, 1),
                ("B1G2", "Buy 1 Get 2", "B1G2", 0, 0, 1),
                ("D90", "90% OFF", "90%", 0, 0, 1),
            ]
            con.executemany(
                "INSERT INTO rewards(id,label,short,weight,scratch_eligible,active,sort) VALUES(?,?,?,?,?,?,?)",
                [r + (i,) for i, r in enumerate(rewards)],
            )

        if con.execute("SELECT COUNT(*) FROM admins").fetchone()[0] == 0:
            for email, name, role, shop_id in [
                ("super@shoelucky.app", "Super Admin", "super_admin", None),
                ("owner@soletheory.app", "Ravi Kumar", "shop_owner", "SL-SH-001"),
                ("owner@kicksandco.app", "Imran Shaikh", "shop_owner", "SL-SH-002"),
            ]:
                salt, digest = hash_password(BOOTSTRAP_PASSWORD)
                con.execute(
                    "INSERT INTO admins(id,email,name,role,shop_id,salt,digest,created_at) VALUES(?,?,?,?,?,?,?,?)",
                    (new_id("ADM"), email, name, role, shop_id, salt, digest, now_iso()),
                )


_local = threading.local()


def audit(actor, action, detail=None):
    """Use the request's connection when inside a route (avoids write-lock deadlock)."""
    con = getattr(_local, "con", None)
    own = con is None
    if own:
        con = connect()
    try:
        con.execute(
            "INSERT INTO audit(id,actor,action,detail,created_at) VALUES(?,?,?,?,?)",
            (new_id("LOG"), actor, action, json.dumps(detail) if detail else None, now_iso()),
        )
        if own:
            con.commit()
    finally:
        if own:
            con.close()


# ---------------------------------------------------------------- API helpers
class ApiError(Exception):
    def __init__(self, status, message):
        self.status = status
        self.message = message


def send_sms_otp(phone, code):
    """Send via MSG91 when configured. Returns True when an SMS was dispatched."""
    if SMS_PROVIDER != "msg91" or not MSG91_AUTH_KEY:
        return False
    mobile = "91" + phone[-10:]
    params = {
        "authkey": MSG91_AUTH_KEY,
        "mobile": mobile,
        "otp": code,
    }
    if MSG91_TEMPLATE_ID:
        params["template_id"] = MSG91_TEMPLATE_ID
    url = "https://api.msg91.com/api/v5/otp?" + urlencode(params)
    try:
        req = urllib.request.Request(url, method="GET")
        with urllib.request.urlopen(req, timeout=8) as resp:
            if resp.status >= 400:
                raise RuntimeError("provider status " + str(resp.status))
        return True
    except Exception as exc:
        raise ApiError(502, "OTP service unavailable: " + str(exc)[:120])


def verify_google_token(credential):
    """Verify a Google ID token through Google's own tokeninfo endpoint."""
    if not GOOGLE_CLIENT_ID:
        raise ApiError(503, "Google sign-in is not configured for this server")
    if not credential:
        raise ApiError(400, "Google credential missing")
    url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + quote(credential)
    try:
        with urllib.request.urlopen(url, timeout=8) as resp:
            info = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        raise ApiError(401, "Google credential could not be verified: " + str(exc)[:120])
    if info.get("aud") != GOOGLE_CLIENT_ID:
        raise ApiError(401, "Google credential is for a different app")
    try:
        if int(info.get("exp", 0)) < int(time.time()):
            raise ApiError(401, "Google credential expired")
    except (TypeError, ValueError):
        raise ApiError(401, "Google credential is invalid")
    if not info.get("email") or info.get("email_verified") not in ("true", True):
        raise ApiError(401, "Google account email is not verified")
    return info


def public_config():
    cfg = {
        "googleClientId": GOOGLE_CLIENT_ID,
        "smsConfigured": SMS_PROVIDER == "msg91" and bool(MSG91_AUTH_KEY),
        "localOtp": ALLOW_LOCAL_OTP and not (SMS_PROVIDER == "msg91" and bool(MSG91_AUTH_KEY)),
        "environment": ENV,
        "couponPrefix": "SL",
    }
    if not PRODUCTION:
        # Local setup shortcuts only. Never exposed when SHOELUCKY_ENV=production.
        cfg["devCredentials"] = {
            "password": BOOTSTRAP_PASSWORD,
            "accounts": [
                {"label": "Super Admin", "email": "super@shoelucky.app"},
                {"label": "Owner · Sole Theory", "email": "owner@soletheory.app"},
                {"label": "Owner · Kicks & Co.", "email": "owner@kicksandco.app"},
            ],
        }
    return cfg


def body_json(handler):
    length = int(handler.headers.get("Content-Length") or 0)
    if not length:
        return {}
    try:
        data = json.loads(handler.rfile.read(length).decode("utf-8"))
        return data if isinstance(data, dict) else {}
    except Exception:
        raise ApiError(400, "Invalid JSON body")


def token_from(handler):
    auth = handler.headers.get("Authorization") or ""
    return auth[7:].strip() if auth.lower().startswith("bearer ") else ""


def session_user(handler, con):
    token = token_from(handler)
    if not token:
        raise ApiError(401, "Sign in required")
    row = con.execute(
        "SELECT * FROM sessions WHERE token=? AND kind='customer' AND expires_at>?",
        (token, int(time.time())),
    ).fetchone()
    if not row:
        raise ApiError(401, "Session expired — sign in again")
    user = con.execute("SELECT * FROM users WHERE id=?", (row["subject_id"],)).fetchone()
    if not user:
        raise ApiError(401, "Account not found")
    return user


def session_admin(handler, con):
    token = token_from(handler)
    if not token:
        raise ApiError(401, "Admin sign-in required")
    row = con.execute(
        "SELECT * FROM sessions WHERE token=? AND kind='admin' AND expires_at>?",
        (token, int(time.time())),
    ).fetchone()
    if not row:
        raise ApiError(401, "Admin session expired")
    admin = con.execute("SELECT * FROM admins WHERE id=?", (row["subject_id"],)).fetchone()
    if not admin:
        raise ApiError(401, "Admin not found")
    return admin


def require_super(admin):
    if admin["role"] != "super_admin":
        raise ApiError(403, "Super Admin only")


def shop_filter(admin):
    return None if admin["role"] == "super_admin" else admin["shop_id"]


def pub_user(u, con):
    shop = con.execute("SELECT id,name,area FROM shops WHERE id=?", (u["shop_id"],)).fetchone()
    return {
        "id": u["id"], "name": u["name"], "phone": u["phone"], "email": u["email"],
        "provider": u["provider"], "shop": dict(shop) if shop else None,
        "scratchLeft": u["scratch_left"], "createdAt": u["created_at"],
    }


def pub_coupon(c):
    return {
        "id": c["id"], "code": c["code"], "rewardId": c["reward_id"],
        "label": c["label"], "short": c["short"], "source": c["source"],
        "status": c["status"], "issuedAt": c["issued_at"], "expiresAt": c["expires_at"],
        "redeemedAt": c["redeemed_at"], "shopId": c["shop_id"],
    }


def pick_reward(con, scratch=False):
    rows = con.execute(
        "SELECT * FROM rewards WHERE active=1 " + ("AND scratch_eligible=1 " if scratch else "") + "ORDER BY sort"
    ).fetchall()
    if not rows:
        raise ApiError(500, "No active rewards configured")
    total = sum(r["weight"] for r in rows)
    roll = secrets.randbelow(total) + 1
    for r in rows:
        roll -= r["weight"]
        if roll <= 0:
            return r
    return rows[-1]


def issue_coupon(con, user, reward, source):
    code = coupon_code()
    while con.execute("SELECT 1 FROM coupons WHERE code=?", (code,)).fetchone():
        code = coupon_code()
    cid = new_id("CPN")
    con.execute(
        """INSERT INTO coupons(id,code,user_id,shop_id,reward_id,label,short,source,status,issued_at,expires_at)
           VALUES(?,?,?,?,?,?,?,?, 'active', ?, ?)""",
        (cid, code, user["id"], user["shop_id"], reward["id"], reward["label"],
         reward["short"], source, now_iso(), (utcnow() + timedelta(days=COUPON_DAYS)).isoformat(timespec="seconds")),
    )
    return con.execute("SELECT * FROM coupons WHERE id=?", (cid,)).fetchone()


# ---------------------------------------------------------------- API routes
def _route(method, path, query, handler, con):
    try:
        # ---- public ----
        if method == "GET" and path == "/api/health":
            return 200, {"ok": True, "service": "ShoeLucky", "time": now_iso()}

        if method == "GET" and path == "/api/config":
            return 200, public_config()

        if method == "GET" and path == "/api/shops":
            rows = con.execute("SELECT id,name,area,status FROM shops WHERE status='active' ORDER BY id").fetchall()
            return 200, {"shops": [dict(r) for r in rows]}

        if method == "GET" and path == "/api/rewards/public":
            rows = con.execute("SELECT id,label,short,weight FROM rewards WHERE active=1 ORDER BY sort").fetchall()
            return 200, {"rewards": [dict(r) for r in rows]}

        if method == "POST" and path == "/api/customer/otp/send":
            data = body_json(handler)
            phone = "".join(ch for ch in str(data.get("phone", "")) if ch.isdigit())
            if len(phone) < 10:
                raise ApiError(400, "Valid mobile number daalein")
            sms_ready = SMS_PROVIDER == "msg91" and bool(MSG91_AUTH_KEY)
            if not sms_ready and not ALLOW_LOCAL_OTP:
                raise ApiError(503, "OTP service is not configured on this server")
            with _rate_lock:
                now = time.time()
                hits = [t for t in _otp_rate.get(phone, []) if now - t < 600]
                if len(hits) >= 5:
                    raise ApiError(429, "Too many requests — please try again later")
                hits.append(now)
                _otp_rate[phone] = hits
            use_local_code = ALLOW_LOCAL_OTP and not sms_ready
            otp_code = LOCAL_OTP if use_local_code else "%06d" % secrets.randbelow(1000000)
            con.execute("UPDATE otps SET used=1 WHERE phone=? AND used=0", (phone,))
            con.execute(
                "INSERT INTO otps(id,phone,code,expires_at,used) VALUES(?,?,?,?,0)",
                (new_id("OTP"), phone, otp_code, int(time.time()) + OTP_TTL),
            )
            sms_sent = send_sms_otp(phone, otp_code)
            return 200, {
                "ok": True,
                "smsSent": sms_sent,
                "devCode": otp_code if use_local_code else None,
            }

        if method == "POST" and path == "/api/customer/otp/verify":
            data = body_json(handler)
            phone = "".join(ch for ch in str(data.get("phone", "")) if ch.isdigit())
            code = "".join(ch for ch in str(data.get("code", "")) if ch.isdigit())
            device = str(data.get("deviceId", ""))[:100]
            shop_id = str(data.get("shopId") or "SL-SH-001")[:40]
            if len(code) != 6:
                raise ApiError(400, "6-digit OTP daalein")
            rec = con.execute(
                "SELECT * FROM otps WHERE phone=? AND code=? AND used=0 AND expires_at>? ORDER BY expires_at DESC",
                (phone, code, int(time.time())),
            ).fetchone()
            if not rec:
                raise ApiError(400, "OTP invalid ya expire ho gaya — dobara bhejein")
            con.execute("UPDATE otps SET used=1 WHERE id=?", (rec["id"],))
            shop = con.execute("SELECT id FROM shops WHERE id=? AND status='active'", (shop_id,)).fetchone()
            if not shop:
                shop_id = "SL-SH-001"
            user = con.execute("SELECT * FROM users WHERE phone=?", (phone,)).fetchone()
            if not user:
                con.execute(
                    "INSERT INTO users(id,phone,name,provider,shop_id,device_id,scratch_left,created_at) VALUES(?,?,?,?,?,?,2,?)",
                    (new_id("USR"), phone, "Shopper", "phone", shop_id, device, now_iso()),
                )
                user = con.execute("SELECT * FROM users WHERE phone=?", (phone,)).fetchone()
            else:
                con.execute("UPDATE users SET shop_id=?, device_id=? WHERE id=?", (shop_id, device, user["id"]))
                user = con.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
            token = secrets.token_urlsafe(32)
            con.execute(
                "INSERT INTO sessions(token,kind,subject_id,expires_at,created_at) VALUES(?,'customer',?,?,?)",
                (token, user["id"], int(time.time()) + TOKEN_TTL, now_iso()),
            )
            audit(user["phone"], "customer.signin", {"provider": "phone"})
            return 200, {"token": token, "user": pub_user(user, con)}

        if method == "POST" and path == "/api/customer/google":
            data = body_json(handler)
            device = str(data.get("deviceId", ""))[:100]
            shop_id = str(data.get("shopId") or "SL-SH-001")[:40]

            if not GOOGLE_CLIENT_ID:
                if not ALLOW_LOCAL_OTP:
                    raise ApiError(503, "Google sign-in is not configured on this server")
                # Local fallback only — disabled when GOOGLE_CLIENT_ID is configured.
                phone = "9" + "".join(secrets.choice(string.digits) for _ in range(9))
                con.execute(
                    "INSERT INTO users(id,phone,name,provider,shop_id,device_id,scratch_left,created_at) "
                    "VALUES(?,?,?,?,?,?,2,?)",
                    (new_id("USR"), phone, "Shopper", "google-local", shop_id, device, now_iso()),
                )
                user = con.execute("SELECT * FROM users WHERE phone=?", (phone,)).fetchone()
                actor = phone
                provider = "google-local"
            else:
                info = verify_google_token(str(data.get("credential", "")))
                email = info["email"].strip().lower()
                display_name = str(info.get("name") or email.split("@")[0])[:80]
                actor = email
                user = con.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
                if user:
                    con.execute("UPDATE users SET shop_id=?, device_id=? WHERE id=?", (shop_id, device, user["id"]))
                    user = con.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
                else:
                    seed = int(hashlib.sha256(email.encode()).hexdigest(), 16) % (10 ** 9)
                    phone = "9" + str(seed).zfill(9)
                    while con.execute("SELECT 1 FROM users WHERE phone=?", (phone,)).fetchone():
                        seed = (seed + 1) % (10 ** 9)
                        phone = "9" + str(seed).zfill(9)
                    uid = new_id("USR")
                    con.execute(
                        "INSERT INTO users(id,phone,name,email,provider,shop_id,device_id,scratch_left,created_at) "
                        "VALUES(?,?,?,?,?,?,?,2,?)",
                        (uid, phone, display_name, email, "google", shop_id, device, now_iso()),
                    )
                    user = con.execute("SELECT * FROM users WHERE id=?", (uid,)).fetchone()
                provider = "google"

            token = secrets.token_urlsafe(32)
            con.execute(
                "INSERT INTO sessions(token,kind,subject_id,expires_at,created_at) VALUES(?,'customer',?,?,?)",
                (token, user["id"], int(time.time()) + TOKEN_TTL, now_iso()),
            )
            audit(actor, "customer.signin", {"provider": provider})
            return 200, {"token": token, "user": pub_user(user, con)}

        # ---- customer (token) ----
        if method == "GET" and path == "/api/customer/me":
            user = session_user(handler, con)
            today = day_today()
            used = con.execute(
                "SELECT 1 FROM spins WHERE day=? AND (phone=? OR device_id=?) LIMIT 1",
                (today, user["phone"], user["device_id"] or "__none__"),
            ).fetchone()
            return 200, {
                "user": pub_user(user, con),
                "spinAvailable": not bool(used),
                "scratchLeft": user["scratch_left"],
            }

        if method == "POST" and path == "/api/customer/spin":
            user = session_user(handler, con)
            today = day_today()
            with _db_lock:
                used = con.execute(
                    "SELECT 1 FROM spins WHERE day=? AND (phone=? OR device_id=?) LIMIT 1",
                    (today, user["phone"], user["device_id"] or "__none__"),
                ).fetchone()
                if used:
                    raise ApiError(409, "Aaj ka spin use ho chuka hai")
                reward = pick_reward(con)
                coupon = issue_coupon(con, user, reward, "spin")
                con.execute(
                    "INSERT INTO spins(id,user_id,phone,device_id,day,reward_id,coupon_id,created_at) VALUES(?,?,?,?,?,?,?,?)",
                    (new_id("SPN"), user["id"], user["phone"], user["device_id"], today,
                     reward["id"], coupon["id"], now_iso()),
                )
            audit(user["phone"], "customer.spin", {"reward": reward["id"], "coupon": coupon["code"]})
            return 200, {"coupon": pub_coupon(coupon), "rewardIndex": int(reward["id"] and list([
                "D10", "D20", "D30", "D50", "B1G1", "D70", "B1G2", "D90"]).index(reward["id"]))}

        if method == "POST" and path == "/api/customer/scratch":
            user = session_user(handler, con)
            with _db_lock:
                fresh = con.execute("SELECT scratch_left FROM users WHERE id=?", (user["id"],)).fetchone()
                if fresh["scratch_left"] <= 0:
                    raise ApiError(409, "Scratch cards khatam")
                reward = pick_reward(con, scratch=True)
                coupon = issue_coupon(con, user, reward, "scratch")
                con.execute("UPDATE users SET scratch_left=scratch_left-1 WHERE id=?", (user["id"],))
            audit(user["phone"], "customer.scratch", {"reward": reward["id"], "coupon": coupon["code"]})
            return 200, {"coupon": pub_coupon(coupon), "scratchLeft": fresh["scratch_left"] - 1}

        if method == "GET" and path == "/api/customer/coupons":
            user = session_user(handler, con)
            rows = con.execute("SELECT * FROM coupons WHERE user_id=? ORDER BY issued_at DESC", (user["id"],)).fetchall()
            return 200, {"coupons": [pub_coupon(c) for c in rows]}

        # ---- admin auth ----
        if method == "POST" and path == "/api/admin/login":
            data = body_json(handler)
            email = str(data.get("email", "")).strip().lower()
            password = str(data.get("password", ""))
            admin = con.execute("SELECT * FROM admins WHERE email=?", (email,)).fetchone()
            if not admin or not verify_password(password, admin["salt"], admin["digest"]):
                raise ApiError(401, "Email ya password galat hai")
            token = secrets.token_urlsafe(32)
            con.execute(
                "INSERT INTO sessions(token,kind,subject_id,expires_at,created_at) VALUES(?,'admin',?,?,?)",
                (token, admin["id"], int(time.time()) + ADMIN_TTL, now_iso()),
            )
            audit(admin["email"], "admin.login")
            return 200, {"token": token, "admin": {
                "id": admin["id"], "name": admin["name"], "email": admin["email"],
                "role": admin["role"], "shopId": admin["shop_id"],
            }}

        # ---- admin (token + role) ----
        if method == "GET" and path == "/api/admin/overview":
            admin = session_admin(handler, con)
            sf = shop_filter(admin)
            where = "WHERE shop_id=?" if sf else ""
            args = (sf,) if sf else ()
            coupons = con.execute("SELECT * FROM coupons " + where, args).fetchall()
            users = con.execute("SELECT * FROM users " + where, args).fetchall()
            shops = con.execute("SELECT COUNT(*) FROM shops WHERE status='active'").fetchone()[0]
            return 200, {
                "role": admin["role"],
                "stats": {
                    "shops": shops if not sf else 1,
                    "players": len(users),
                    "coupons": len(coupons),
                    "redeemed": sum(1 for c in coupons if c["status"] == "redeemed"),
                    "spins": con.execute(
                        "SELECT COUNT(*) FROM spins s JOIN users u ON u.id=s.user_id WHERE u.shop_id=?" if sf
                        else "SELECT COUNT(*) FROM spins", (sf,) if sf else ()
                    ).fetchone()[0],
                },
                "recent": [pub_coupon(c) for c in coupons[-6:][::-1]],
                "shops": [dict(r) for r in con.execute("SELECT id,name,area,status FROM shops ORDER BY id")],
            }

        if method == "GET" and path == "/api/admin/shops":
            admin = session_admin(handler, con)
            rows = con.execute("SELECT * FROM shops ORDER BY id").fetchall()
            return 200, {"shops": [dict(r) for r in rows], "role": admin["role"]}

        if method == "POST" and path == "/api/admin/shops":
            admin = session_admin(handler, con)
            require_super(admin)
            data = body_json(handler)
            name = str(data.get("name", "")).strip()
            if not name:
                raise ApiError(400, "Shop name required")
            sid = "SL-SH-" + str(con.execute("SELECT COUNT(*) FROM shops").fetchone()[0] + 1).zfill(3)
            while con.execute("SELECT 1 FROM shops WHERE id=?", (sid,)).fetchone():
                sid = "SL-SH-" + str(int(sid[-3:]) + 1).zfill(3)
            con.execute(
                "INSERT INTO shops(id,name,area,owner_name,status,created_at) VALUES(?,?,?,?, 'active', ?)",
                (sid, name, str(data.get("area", ""))[:80], str(data.get("owner", ""))[:80], now_iso()),
            )
            audit(admin["email"], "admin.shop.create", {"id": sid, "name": name})
            return 200, {"id": sid, "name": name}

        if method == "GET" and path == "/api/admin/coupons":
            admin = session_admin(handler, con)
            sf = shop_filter(admin)
            q = "SELECT c.*, u.name AS user_name, u.phone AS user_phone FROM coupons c JOIN users u ON u.id=c.user_id "
            if sf:
                q += " WHERE c.shop_id=?"
            q += " ORDER BY c.issued_at DESC LIMIT 200"
            rows = con.execute(q, (sf,) if sf else ()).fetchall()
            return 200, {"coupons": [{
                **pub_coupon(c), "userName": c["user_name"], "userPhone": c["user_phone"]
            } for c in rows]}

        if method == "POST" and path == "/api/admin/redeem":
            admin = session_admin(handler, con)
            data = body_json(handler)
            code = str(data.get("code", "")).strip().upper()
            with _db_lock:
                row = con.execute("SELECT * FROM coupons WHERE code=?", (code,)).fetchone()
                if not row:
                    raise ApiError(404, "Coupon nahi mila")
                sf = shop_filter(admin)
                if sf and row["shop_id"] != sf:
                    raise ApiError(403, "Ye coupon aapke shop ka nahi hai")
                if row["status"] == "redeemed":
                    raise ApiError(409, "Coupon pehle hi redeem ho chuka hai")
                if row["status"] != "active":
                    raise ApiError(409, "Coupon active nahi hai")
                if utcnow() > datetime.fromisoformat(row["expires_at"]):
                    raise ApiError(409, "Coupon expire ho chuka hai")
                con.execute(
                    "UPDATE coupons SET status='redeemed', redeemed_at=?, redeemed_by=? WHERE id=? AND status='active'",
                    (now_iso(), admin["id"], row["id"]),
                )
            audit(admin["email"], "admin.coupon.redeem", {"code": code, "shop": row["shop_id"]})
            return 200, {"ok": True, "coupon": pub_coupon(
                con.execute("SELECT * FROM coupons WHERE id=?", (row["id"],)).fetchone())}

        if method == "GET" and path == "/api/admin/rewards":
            session_admin(handler, con)
            rows = con.execute("SELECT * FROM rewards ORDER BY sort").fetchall()
            return 200, {"rewards": [dict(r) for r in rows]}

        if method == "POST" and path == "/api/admin/rewards":
            admin = session_admin(handler, con)
            require_super(admin)
            data = body_json(handler)
            rid = str(data.get("id", ""))
            weight = int(data.get("weight", -1))
            if weight < 0 or weight > 100:
                raise ApiError(400, "Weight 0–100 ke beech rakhein")
            row = con.execute("SELECT * FROM rewards WHERE id=?", (rid,)).fetchone()
            if not row:
                raise ApiError(404, "Reward nahi mila")
            con.execute("UPDATE rewards SET weight=?, active=? WHERE id=?", (weight, 1 if data.get("active") else 0, rid))
            audit(admin["email"], "admin.reward.update", {"id": rid, "weight": weight})
            return 200, {"ok": True}

        if method == "GET" and path == "/api/admin/analytics":
            admin = session_admin(handler, con)
            sf = shop_filter(admin)
            users = con.execute("SELECT * FROM users " + ("WHERE shop_id=?" if sf else ""), (sf,) if sf else ()).fetchall()
            ids = [u["id"] for u in users]
            coupons = con.execute("SELECT * FROM coupons " + ("WHERE shop_id=?" if sf else ""), (sf,) if sf else ()).fetchall()
            by_reward = {}
            for c in coupons:
                by_reward[c["label"]] = by_reward.get(c["label"], 0) + 1
            daily = []
            for i in range(6, -1, -1):
                d = (utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
                daily.append({
                    "day": d[5:],
                    "plays": con.execute(
                        "SELECT COUNT(*) FROM spins s JOIN users u ON u.id=s.user_id WHERE s.day=? AND u.shop_id=?" if sf
                        else "SELECT COUNT(*) FROM spins WHERE day=?",
                        (d, sf) if sf else (d,),
                    ).fetchone()[0],
                    "coupons": con.execute(
                        "SELECT COUNT(*) FROM coupons WHERE substr(issued_at,1,10)=? AND shop_id=?" if sf
                        else "SELECT COUNT(*) FROM coupons WHERE substr(issued_at,1,10)=?",
                        (d, sf) if sf else (d,),
                    ).fetchone()[0],
                })
            return 200, {
                "players": len(users), "coupons": len(coupons),
                "byReward": by_reward, "daily": daily,
            }

        if method == "GET" and path == "/api/admin/audit":
            admin = session_admin(handler, con)
            rows = con.execute("SELECT * FROM audit ORDER BY created_at DESC LIMIT 60").fetchall()
            return 200, {"events": [{
                "actor": r["actor"], "action": r["action"], "detail": r["detail"], "at": r["created_at"]
            } for r in rows]}

        raise ApiError(404, "API route nahi mila")
    except ApiError:
        raise


def handle_api(method, path, query, handler):
    """One connection per request: commit on success, rollback on error."""
    con = connect()
    _local.con = con
    try:
        result = _route(method, path, query, handler, con)
        con.commit()
        return result
    except Exception:
        con.rollback()
        raise
    finally:
        _local.con = None
        con.close()


# ---------------------------------------------------------------- HTTP server
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=ROOT, **kw)

    def log_message(self, fmt, *args):
        if os.environ.get("SL_VERBOSE"):
            super().log_message(fmt, *args)

    def end_headers(self):
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        self.send_header("Referrer-Policy", "no-referrer")
        super().end_headers()

    @staticmethod
    def _blocked_static(path):
        low = path.lower()
        if ".." in low or "/." in low:
            return True
        return low.endswith((".db", ".db-wal", ".db-shm", ".py", ".pyc", ".log", ".env"))

    def list_directory(self, path):
        self.send_error(404, "Not found")
        return None

    def _send(self, status, payload):
        raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(raw)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(raw)

    def do_GET(self):
        u = urlparse(self.path)
        if u.path.startswith("/api/"):
            try:
                status, payload = handle_api("GET", u.path, parse_qs(u.query), self)
            except ApiError as e:
                status, payload = e.status, {"error": e.message}
            except Exception as e:
                status, payload = 500, {"error": "Server error: " + str(e)}
            return self._send(status, payload)
        if self._blocked_static(u.path):
            return self._send(404, {"error": "Not found"})
        if u.path == "/":
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):
        u = urlparse(self.path)
        if u.path.startswith("/api/"):
            try:
                status, payload = handle_api("POST", u.path, parse_qs(u.query), self)
            except ApiError as e:
                status, payload = e.status, {"error": e.message}
            except Exception as e:
                status, payload = 500, {"error": "Server error: " + str(e)}
            return self._send(status, payload)
        return self._send(404, {"error": "Not found"})


def main():
    init_db()
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print("ShoeLucky backend ready → http://localhost:%d" % PORT)
    print("DB: %s" % DB_PATH)
    print("Bootstrap admin: super@shoelucky.app / " + BOOTSTRAP_PASSWORD)
    if not GOOGLE_CLIENT_ID:
        print("Notice: GOOGLE_CLIENT_ID not set — local Google fallback is active")
    if not (SMS_PROVIDER == "msg91" and MSG91_AUTH_KEY):
        print("Notice: SMS provider not configured — local OTP fallback is active")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nbye")
        server.shutdown()


if __name__ == "__main__":
    main()
