#!/usr/bin/env python3
"""ShoeLucky Flask backend (Render).

Same API surface as server.py. Run locally with `python3 server_flask.py`
or in production with `gunicorn server_flask:app`.
"""
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import hashlib
import secrets
import time
import os
import json
import string
import threading
import urllib.request
from urllib.parse import quote
from datetime import datetime, timedelta, timezone

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# shortcut: SQLite on Render's ephemeral disk resets on redeploy; attach a
# persistent disk (or move to Postgres) before storing real customer data.
DB_PATH = os.path.join(BASE_DIR, 'shoelucky.db')

app = Flask(__name__)
CORS(app, resources={r"/api/*": {"origins": "*"}},
     allow_headers=["Content-Type", "Authorization"],
     methods=["GET", "POST", "OPTIONS"])

# ============================================================
# CONFIGURATION
# ============================================================
SHOELUCKY_ENV = os.environ.get('SHOELUCKY_ENV', 'development')
PRODUCTION = SHOELUCKY_ENV == 'production'
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
SMS_PROVIDER = os.environ.get('SMS_PROVIDER', '')
SMS_AUTH_KEY = os.environ.get('SMS_AUTH_KEY', '')
SMS_TEMPLATE_ID = os.environ.get('SMS_TEMPLATE_ID', '')
ALLOW_LOCAL_OTP = os.environ.get('ALLOW_LOCAL_OTP', '1') == '1'
LOCAL_OTP = '123456'
OTP_TTL = 300
BOOTSTRAP_ADMIN_PASSWORD = os.environ.get('BOOTSTRAP_ADMIN_PASSWORD', 'ChangeMe2026!')
TOKEN_TTL = 7 * 24 * 60 * 60
ADMIN_TTL = 12 * 60 * 60
COUPON_DAYS = 7
RATE_LIMIT = 5

ADMINS = {
    'super@shoelucky.app': {'name': 'Super Admin', 'role': 'super_admin', 'shop_id': None},
    'owner@soletheory.app': {'name': 'Ravi Kumar', 'role': 'shop_owner', 'shop_id': 'SL-SH-001'},
    'owner@kicksandco.app': {'name': 'Imran Shaikh', 'role': 'shop_owner', 'shop_id': 'SL-SH-002'},
}

_OTP_RATE = {}
_OTP_RATE_LOCK = threading.Lock()


def utcnow():
    return datetime.now(timezone.utc)


def now_iso():
    return utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')


def get_db():
    # Autocommit: every write is durable without a commit() in each route.
    con = sqlite3.connect(DB_PATH, timeout=10, isolation_level=None)
    con.row_factory = sqlite3.Row
    return con


def init_db():
    con = get_db()
    con.executescript("""
    CREATE TABLE IF NOT EXISTS shops (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, area TEXT, owner_name TEXT,
      status TEXT NOT NULL DEFAULT 'active', created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, phone TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
      email TEXT, provider TEXT NOT NULL, shop_id TEXT, device_id TEXT,
      scratch_left INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
      last_scratched_at TEXT NOT NULL DEFAULT ''
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
      id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT, action TEXT,
      detail TEXT, created_at TEXT NOT NULL
    );
    """)

    # Databases created by server.py predate the weekly scratch refill column.
    cols = [r[1] for r in con.execute("PRAGMA table_info(users)").fetchall()]
    if 'last_scratched_at' not in cols:
        try:
            con.execute("ALTER TABLE users ADD COLUMN last_scratched_at TEXT NOT NULL DEFAULT ''")
        except sqlite3.OperationalError:
            pass  # another worker added it first

    if con.execute("SELECT COUNT(*) FROM shops").fetchone()[0] == 0:
        con.executemany(
            "INSERT OR IGNORE INTO shops(id,name,area,owner_name,status,created_at) VALUES(?,?,?,?, 'active', ?)",
            [
                ("SL-SH-001", "Sole Theory", "Main Road", "Ravi Kumar", now_iso()),
                ("SL-SH-002", "Kicks & Co.", "Market Street", "Imran Shaikh", now_iso()),
                ("SL-SH-003", "Street Kicks", "Station Road", "Neha Verma", now_iso()),
            ],
        )

    if con.execute("SELECT COUNT(*) FROM rewards").fetchone()[0] == 0:
        rewards = [
            ("D10", "10% OFF", "10%", 95, 1, 1, 1),
            ("D20", "20% OFF", "20%", 5, 1, 1, 2),
            ("D30", "30% OFF", "30%", 0, 1, 1, 3),
            ("D50", "50% OFF", "50%", 0, 0, 1, 4),
            ("B1G1", "Buy 1 Get 1", "B1G1", 0, 0, 1, 5),
            ("D70", "70% OFF", "70%", 0, 0, 1, 6),
            ("B1G2", "Buy 1 Get 2", "B1G2", 0, 0, 1, 7),
            ("D90", "90% OFF", "90%", 0, 0, 1, 8),
        ]
        con.executemany(
            "INSERT OR IGNORE INTO rewards(id,label,short,weight,scratch_eligible,active,sort) VALUES(?,?,?,?,?,?,?)",
            rewards,
        )
    con.close()


def new_id(prefix):
    return prefix + "-" + secrets.token_hex(5).upper()


def coupon_code():
    alphabet = string.ascii_uppercase + string.digits
    return "SL-" + "".join(secrets.choice(alphabet) for _ in range(6))


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
        raise RuntimeError("No active rewards configured")
    total = sum(r["weight"] for r in rows)
    if total <= 0:
        return rows[0]
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
    expires = (utcnow() + timedelta(days=COUPON_DAYS)).isoformat(timespec="seconds")
    con.execute(
        "INSERT INTO coupons(id,code,user_id,shop_id,reward_id,label,short,source,status,issued_at,expires_at) "
        "VALUES(?,?,?,?,?,?,?,?, 'active', ?, ?)",
        (cid, code, user["id"], user["shop_id"] or "SL-SH-001", reward["id"],
         reward["label"], reward["short"], source, now_iso(), expires),
    )
    return con.execute("SELECT * FROM coupons WHERE id=?", (cid,)).fetchone()


def send_sms_otp(phone, otp_code):
    # shortcut: SMS gateway not wired into the Flask build; OTP is backend-only
    # and the customer UI uses Google sign-in. Add MSG91 here if OTP returns.
    return False


def verify_google_token(credential):
    """Verify a Google ID token through Google's tokeninfo endpoint."""
    if not GOOGLE_CLIENT_ID:
        raise ValueError("Google sign-in is not configured for this server")
    if not credential:
        raise ValueError("Google credential missing")
    url = "https://oauth2.googleapis.com/tokeninfo?id_token=" + quote(credential)
    try:
        with urllib.request.urlopen(url, timeout=8) as resp:
            info = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        raise ValueError("Google credential could not be verified: " + str(exc)[:120])
    if info.get("aud") != GOOGLE_CLIENT_ID:
        raise ValueError("Google credential is for a different app")
    try:
        if int(info.get("exp", 0)) < int(time.time()):
            raise ValueError("Google credential expired")
    except (TypeError, ValueError):
        raise ValueError("Google credential is invalid")
    if not info.get("email") or info.get("email_verified") not in ("true", True):
        raise ValueError("Google account email is not verified")
    return info


def bearer_token():
    auth = request.headers.get('Authorization', '')
    return auth[7:] if auth.startswith('Bearer ') else request.cookies.get('token', '')


def session_user(token):
    if not token:
        return None
    con = get_db()
    row = con.execute(
        "SELECT subject_id FROM sessions WHERE token=? AND kind='customer' AND expires_at>?",
        (token, int(time.time())),
    ).fetchone()
    return con.execute("SELECT * FROM users WHERE id=?", (row["subject_id"],)).fetchone() if row else None


def session_admin(token):
    if not token:
        return None
    con = get_db()
    row = con.execute(
        "SELECT subject_id FROM sessions WHERE token=? AND kind='admin' AND expires_at>?",
        (token, int(time.time())),
    ).fetchone()
    if not row:
        return None
    admin = ADMINS.get(row["subject_id"])
    return dict(admin, email=row["subject_id"]) if admin else None


def shop_filter(admin):
    return None if admin["role"] == "super_admin" else admin["shop_id"]


def audit(actor, action, detail=None):
    con = get_db()
    con.execute(
        "INSERT INTO audit(actor,action,detail,created_at) VALUES(?,?,?,?)",
        (actor, action, json.dumps(detail) if detail is not None else None, now_iso()),
    )


def public_config():
    cfg = {
        "googleClientId": GOOGLE_CLIENT_ID,
        "smsConfigured": SMS_PROVIDER == "msg91" and bool(SMS_AUTH_KEY),
        "localOtp": ALLOW_LOCAL_OTP and not (SMS_PROVIDER == "msg91" and bool(SMS_AUTH_KEY)),
        "environment": SHOELUCKY_ENV,
        "couponPrefix": "SL",
    }
    if not PRODUCTION:
        cfg["devCredentials"] = {
            "password": BOOTSTRAP_ADMIN_PASSWORD,
            "accounts": [
                {"label": "Super Admin", "email": "super@shoelucky.app"},
                {"label": "Owner · Sole Theory", "email": "owner@soletheory.app"},
                {"label": "Owner · Kicks & Co.", "email": "owner@kicksandco.app"},
            ],
        }
    return cfg


# ============================================================
# STATIC FRONTEND
# ============================================================
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path.startswith('api/'):
        return jsonify({"error": "Not found"}), 404
    if not path:
        return send_from_directory(BASE_DIR, 'index.html')
    full = os.path.join(BASE_DIR, path)
    if os.path.isfile(full):
        return send_from_directory(BASE_DIR, path)
    asset = os.path.join(BASE_DIR, 'assets', path)
    if os.path.isfile(asset):
        return send_from_directory(os.path.join(BASE_DIR, 'assets'), path)
    if '.' in os.path.basename(path):
        return jsonify({"error": "Not found"}), 404
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/assets/<path:path>')
def serve_assets(path):
    return send_from_directory(os.path.join(BASE_DIR, 'assets'), path)


@app.route('/terms')
def terms():
    return send_from_directory(os.path.join(BASE_DIR, 'assets'), 'tos.html')


# ============================================================
# PUBLIC API
# ============================================================
@app.route('/api/health')
def health():
    return jsonify({"ok": True, "service": "ShoeLucky", "time": now_iso()})


@app.route('/api/config')
def config():
    return jsonify(public_config())


@app.route('/api/shops')
def shops():
    con = get_db()
    rows = con.execute("SELECT id,name,area,status FROM shops WHERE status='active' ORDER BY id").fetchall()
    return jsonify({"shops": [dict(r) for r in rows]})


@app.route('/api/rewards/public')
def rewards_public():
    con = get_db()
    rows = con.execute("SELECT id,label,short,weight FROM rewards WHERE active=1 ORDER BY sort").fetchall()
    return jsonify({"rewards": [dict(r) for r in rows]})


# ============================================================
# CUSTOMER AUTH
# ============================================================
@app.route('/api/customer/otp/send', methods=['POST'])
def otp_send():
    data = request.get_json(silent=True) or {}
    phone = "".join(ch for ch in str(data.get("phone", "")) if ch.isdigit())
    if len(phone) < 10:
        return jsonify({"error": "Valid mobile number daalein"}), 400
    sms_ready = SMS_PROVIDER == "msg91" and bool(SMS_AUTH_KEY)
    if not sms_ready and not ALLOW_LOCAL_OTP:
        return jsonify({"error": "OTP service is not configured on this server"}), 503
    with _OTP_RATE_LOCK:
        now = time.time()
        hits = [t for t in _OTP_RATE.get(phone, []) if now - t < 600]
        if len(hits) >= RATE_LIMIT:
            return jsonify({"error": "Too many requests — please try again later"}), 429
        hits.append(now)
        _OTP_RATE[phone] = hits
    use_local_code = ALLOW_LOCAL_OTP and not sms_ready
    otp_code = LOCAL_OTP if use_local_code else "%06d" % secrets.randbelow(1000000)
    con = get_db()
    con.execute("UPDATE otps SET used=1 WHERE phone=? AND used=0", (phone,))
    con.execute(
        "INSERT INTO otps(id,phone,code,expires_at,used) VALUES(?,?,?,?,0)",
        (new_id("OTP"), phone, otp_code, int(time.time()) + OTP_TTL),
    )
    sms_sent = send_sms_otp(phone, otp_code)
    return jsonify({"ok": True, "smsSent": sms_sent, "devCode": otp_code if use_local_code else None})


@app.route('/api/customer/otp/verify', methods=['POST'])
def otp_verify():
    data = request.get_json(silent=True) or {}
    phone = "".join(ch for ch in str(data.get("phone", "")) if ch.isdigit())
    code = "".join(ch for ch in str(data.get("code", "")) if ch.isdigit())
    device = str(data.get("deviceId", ""))[:100]
    shop_id = str(data.get("shopId") or "SL-SH-001")[:40]
    if len(code) != 6:
        return jsonify({"error": "6-digit OTP daalein"}), 400
    con = get_db()
    rec = con.execute(
        "SELECT * FROM otps WHERE phone=? AND code=? AND used=0 AND expires_at>? ORDER BY expires_at DESC",
        (phone, code, int(time.time())),
    ).fetchone()
    if not rec:
        return jsonify({"error": "OTP invalid ya expire ho gaya — dobara bhejein"}), 400
    con.execute("UPDATE otps SET used=1 WHERE id=?", (rec["id"],))
    if not con.execute("SELECT 1 FROM shops WHERE id=? AND status='active'", (shop_id,)).fetchone():
        shop_id = "SL-SH-001"
    user = con.execute("SELECT * FROM users WHERE phone=?", (phone,)).fetchone()
    if not user:
        con.execute(
            "INSERT INTO users(id,phone,name,provider,shop_id,device_id,scratch_left,created_at) VALUES(?,?,?,?,?,?,1,?)",
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
    return jsonify({"token": token, "user": pub_user(user, con)})


@app.route('/api/customer/google', methods=['POST'])
def google():
    data = request.get_json(silent=True) or {}
    device = str(data.get("deviceId", ""))[:100]
    shop_id = str(data.get("shopId") or "SL-SH-001")[:40]
    con = get_db()

    if not GOOGLE_CLIENT_ID:
        if not ALLOW_LOCAL_OTP:
            return jsonify({"error": "Google sign-in is not configured on this server"}), 503
        phone = "9" + "".join(secrets.choice(string.digits) for _ in range(9))
        con.execute(
            "INSERT INTO users(id,phone,name,provider,shop_id,device_id,scratch_left,created_at) VALUES(?,?,?,?,?,?,1,?)",
            (new_id("USR"), phone, "Shopper", "google-local", shop_id, device, now_iso()),
        )
        user = con.execute("SELECT * FROM users WHERE phone=?", (phone,)).fetchone()
        actor = phone
        provider = "google-local"
    else:
        try:
            info = verify_google_token(str(data.get("credential", "")))
        except ValueError as exc:
            return jsonify({"error": str(exc)}), 401
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
                "VALUES(?,?,?,?,?,?,?,1,?)",
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
    return jsonify({"token": token, "user": pub_user(user, con)})


# ============================================================
# CUSTOMER
# ============================================================
@app.route('/api/customer/me', methods=['GET'])
def customer_me():
    user = session_user(bearer_token())
    if not user:
        return jsonify({"error": "Sign in required"}), 401
    con = get_db()
    today = utcnow().strftime("%Y-%m-%d")
    used = con.execute(
        "SELECT 1 FROM spins WHERE day=? AND (phone=? OR device_id=?) LIMIT 1",
        (today, user["phone"], user["device_id"] or "__none__"),
    ).fetchone()
    return jsonify({
        "user": pub_user(user, con),
        "spinAvailable": not bool(used),
        "scratchLeft": user["scratch_left"],
    })


@app.route('/api/customer/spin', methods=['POST'])
def customer_spin():
    user = session_user(bearer_token())
    if not user:
        return jsonify({"error": "Sign in required"}), 401
    con = get_db()
    today = utcnow().strftime("%Y-%m-%d")
    used = con.execute(
        "SELECT 1 FROM spins WHERE day=? AND (phone=? OR device_id=?) LIMIT 1",
        (today, user["phone"], user["device_id"] or "__none__"),
    ).fetchone()
    if used:
        return jsonify({"error": "Aaj ka spin use ho chuka hai"}), 409
    reward = pick_reward(con)
    coupon = issue_coupon(con, user, reward, "spin")
    con.execute(
        "INSERT INTO spins(id,user_id,phone,device_id,day,reward_id,coupon_id,created_at) VALUES(?,?,?,?,?,?,?,?)",
        (new_id("SPN"), user["id"], user["phone"], user["device_id"] or "", today,
         reward["id"], coupon["id"], now_iso()),
    )
    audit(user["phone"], "customer.spin", {"reward": reward["id"], "coupon": coupon["code"]})
    wheel = ["D10", "D20", "D30", "D50", "B1G1", "D70", "B1G2", "D90"]
    return jsonify({
        "coupon": pub_coupon(coupon),
        "rewardIndex": wheel.index(reward["id"]) if reward["id"] in wheel else 0,
    })


@app.route('/api/customer/scratch', methods=['POST'])
def customer_scratch():
    user = session_user(bearer_token())
    if not user:
        return jsonify({"error": "Sign in required"}), 401
    con = get_db()
    # One card per week: refill an empty card once the last scratch is 7+ days old.
    con.execute(
        "UPDATE users SET scratch_left=1 WHERE id=? AND scratch_left<=0 AND "
        "(last_scratched_at='' OR last_scratched_at <= datetime('now','-7 days'))",
        (user["id"],),
    )
    user = con.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
    if user["scratch_left"] <= 0:
        return jsonify({"error": "Scratch cards khatam"}), 409
    reward = pick_reward(con, scratch=True)
    coupon = issue_coupon(con, user, reward, "scratch")
    con.execute(
        "UPDATE users SET scratch_left=scratch_left-1, last_scratched_at=datetime('now') WHERE id=?",
        (user["id"],),
    )
    fresh = con.execute("SELECT scratch_left FROM users WHERE id=?", (user["id"],)).fetchone()
    audit(user["phone"], "customer.scratch", {"reward": reward["id"], "coupon": coupon["code"]})
    return jsonify({"coupon": pub_coupon(coupon), "scratchLeft": fresh["scratch_left"]})


@app.route('/api/customer/coupons', methods=['GET'])
def customer_coupons():
    user = session_user(bearer_token())
    if not user:
        return jsonify({"error": "Sign in required"}), 401
    con = get_db()
    rows = con.execute("SELECT * FROM coupons WHERE user_id=? ORDER BY issued_at DESC", (user["id"],)).fetchall()
    return jsonify({"coupons": [pub_coupon(c) for c in rows]})


# ============================================================
# ADMIN
# ============================================================
@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json(silent=True) or {}
    email = str(data.get("email", "")).strip().lower()
    password = str(data.get("password", ""))
    admin = ADMINS.get(email)
    if not admin or password != BOOTSTRAP_ADMIN_PASSWORD:
        return jsonify({"error": "Email ya password galat hai"}), 401
    token = secrets.token_urlsafe(32)
    con = get_db()
    con.execute(
        "INSERT INTO sessions(token,kind,subject_id,expires_at,created_at) VALUES(?,'admin',?,?,?)",
        (token, email, int(time.time()) + ADMIN_TTL, now_iso()),
    )
    audit(email, "admin.login")
    return jsonify({"token": token, "admin": {
        "name": admin["name"], "email": email,
        "role": admin["role"], "shopId": admin["shop_id"],
    }})


def require_admin():
    admin = session_admin(bearer_token())
    return admin, (None if admin else (jsonify({"error": "Admin sign in required"}), 401))


@app.route('/api/admin/overview', methods=['GET'])
def admin_overview():
    admin, err = require_admin()
    if err:
        return err
    con = get_db()
    sf = shop_filter(admin)
    where = "WHERE shop_id=?" if sf else ""
    args = (sf,) if sf else ()
    coupons = con.execute("SELECT * FROM coupons " + where, args).fetchall()
    users = con.execute("SELECT * FROM users " + where, args).fetchall()
    spins = con.execute(
        "SELECT COUNT(*) FROM spins s JOIN users u ON u.id=s.user_id WHERE u.shop_id=?" if sf
        else "SELECT COUNT(*) FROM spins", args
    ).fetchone()[0]
    shops_count = con.execute("SELECT COUNT(*) FROM shops WHERE status='active'").fetchone()[0]
    return jsonify({
        "role": admin["role"],
        "stats": {
            "shops": shops_count if not sf else 1,
            "players": len(users),
            "coupons": len(coupons),
            "redeemed": sum(1 for c in coupons if c["status"] == "redeemed"),
            "spins": spins,
        },
        "recent": [pub_coupon(c) for c in coupons[-6:][::-1]],
        "shops": [dict(r) for r in con.execute("SELECT id,name,area,status FROM shops ORDER BY id")],
    })


@app.route('/api/admin/shops', methods=['GET', 'POST'])
def admin_shops():
    admin, err = require_admin()
    if err:
        return err
    con = get_db()
    if request.method == 'GET':
        rows = con.execute("SELECT * FROM shops ORDER BY id").fetchall()
        return jsonify({"shops": [dict(r) for r in rows], "role": admin["role"]})
    if admin["role"] != "super_admin":
        return jsonify({"error": "Super Admin only"}), 403
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    if not name:
        return jsonify({"error": "Shop name required"}), 400
    sid = "SL-SH-" + str(con.execute("SELECT COUNT(*) FROM shops").fetchone()[0] + 1).zfill(3)
    while con.execute("SELECT 1 FROM shops WHERE id=?", (sid,)).fetchone():
        sid = "SL-SH-" + str(int(sid[-3:]) + 1).zfill(3)
    con.execute(
        "INSERT INTO shops(id,name,area,owner_name,status,created_at) VALUES(?,?,?,?, 'active', ?)",
        (sid, name, str(data.get("area", ""))[:80], str(data.get("owner", ""))[:80], now_iso()),
    )
    audit(admin["email"], "admin.shop.create", {"id": sid, "name": name})
    return jsonify({"id": sid, "name": name})


@app.route('/api/admin/coupons', methods=['GET'])
def admin_coupons():
    admin, err = require_admin()
    if err:
        return err
    con = get_db()
    sf = shop_filter(admin)
    q = ("SELECT c.*, u.name AS user_name, u.phone AS user_phone "
         "FROM coupons c JOIN users u ON u.id=c.user_id ")
    if sf:
        q += "WHERE c.shop_id=? "
    q += "ORDER BY c.issued_at DESC LIMIT 200"
    rows = con.execute(q, (sf,) if sf else ()).fetchall()
    return jsonify({"coupons": [
        dict(pub_coupon(c), userName=c["user_name"], userPhone=c["user_phone"]) for c in rows
    ]})


@app.route('/api/admin/redeem', methods=['POST'])
def admin_redeem():
    admin, err = require_admin()
    if err:
        return err
    data = request.get_json(silent=True) or {}
    code = str(data.get("code", "")).strip().upper()
    con = get_db()
    row = con.execute("SELECT * FROM coupons WHERE code=?", (code,)).fetchone()
    if not row:
        return jsonify({"error": "Coupon nahi mila"}), 404
    sf = shop_filter(admin)
    if sf and row["shop_id"] != sf:
        return jsonify({"error": "Ye coupon aapke shop ka nahi hai"}), 403
    if row["status"] == "redeemed":
        return jsonify({"error": "Coupon pehle hi redeem ho chuka hai"}), 409
    if row["status"] != "active":
        return jsonify({"error": "Coupon active nahi hai"}), 409
    try:
        if utcnow() > datetime.fromisoformat(row["expires_at"]).replace(tzinfo=timezone.utc):
            return jsonify({"error": "Coupon expire ho chuka hai"}), 409
    except ValueError:
        pass
    con.execute(
        "UPDATE coupons SET status='redeemed', redeemed_at=?, redeemed_by=? WHERE id=? AND status='active'",
        (now_iso(), admin["email"], row["id"]),
    )
    audit(admin["email"], "admin.coupon.redeem", {"code": code, "shop": row["shop_id"]})
    return jsonify({"ok": True, "coupon": pub_coupon(
        con.execute("SELECT * FROM coupons WHERE id=?", (row["id"],)).fetchone())})


@app.route('/api/admin/rewards', methods=['GET', 'POST'])
def admin_rewards():
    admin, err = require_admin()
    if err:
        return err
    con = get_db()
    if request.method == 'GET':
        rows = con.execute("SELECT * FROM rewards ORDER BY sort").fetchall()
        return jsonify({"rewards": [dict(r) for r in rows]})
    if admin["role"] != "super_admin":
        return jsonify({"error": "Super Admin only"}), 403
    data = request.get_json(silent=True) or {}
    rid = str(data.get("id", ""))
    try:
        weight = int(data.get("weight", -1))
    except (TypeError, ValueError):
        weight = -1
    if weight < 0 or weight > 100:
        return jsonify({"error": "Weight 0–100 ke beech rakhein"}), 400
    if not con.execute("SELECT 1 FROM rewards WHERE id=?", (rid,)).fetchone():
        return jsonify({"error": "Reward nahi mila"}), 404
    con.execute("UPDATE rewards SET weight=?, active=? WHERE id=?",
                (weight, 1 if data.get("active") else 0, rid))
    audit(admin["email"], "admin.reward.update", {"id": rid, "weight": weight})
    return jsonify({"ok": True})


@app.route('/api/admin/analytics', methods=['GET'])
def admin_analytics():
    admin, err = require_admin()
    if err:
        return err
    con = get_db()
    sf = shop_filter(admin)
    users = con.execute("SELECT * FROM users " + ("WHERE shop_id=?" if sf else ""),
                        (sf,) if sf else ()).fetchall()
    coupons = con.execute("SELECT * FROM coupons " + ("WHERE shop_id=?" if sf else ""),
                          (sf,) if sf else ()).fetchall()
    by_reward = {}
    for c in coupons:
        by_reward[c["label"]] = by_reward.get(c["label"], 0) + 1
    daily = []
    for i in range(6, -1, -1):
        d = (utcnow() - timedelta(days=i)).strftime("%Y-%m-%d")
        plays = con.execute(
            "SELECT COUNT(*) FROM spins s JOIN users u ON u.id=s.user_id WHERE s.day=? AND u.shop_id=?" if sf
            else "SELECT COUNT(*) FROM spins WHERE day=?", (d, sf) if sf else (d,)
        ).fetchone()[0]
        daily.append({"day": d[5:], "plays": plays})
    return jsonify({"players": len(users), "coupons": len(coupons),
                    "byReward": by_reward, "daily": daily})


@app.route('/api/admin/audit', methods=['GET'])
def admin_audit():
    admin, err = require_admin()
    if err:
        return err
    con = get_db()
    rows = con.execute("SELECT * FROM audit ORDER BY created_at DESC LIMIT 60").fetchall()
    return jsonify({"events": [
        {"actor": r["actor"], "action": r["action"], "detail": r["detail"], "at": r["created_at"]}
        for r in rows
    ]})


init_db()


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8080))
    app.run(host='0.0.0.0', port=port, debug=not PRODUCTION)
