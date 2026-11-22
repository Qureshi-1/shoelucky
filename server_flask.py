#!/usr/bin/env python3
"""ShoeLucky Flask Backend - Drop-in replacement for server.py"""
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import sqlite3
import hashlib
import secrets
import time
import os
import re
import uuid

app = Flask(__name__)
CORS(app)

# ============================================================
# CONFIGURATION
# ============================================================
SHOELUCKY_ENV = os.environ.get('SHOELUCKY_ENV', 'development')
GOOGLE_CLIENT_ID = os.environ.get('GOOGLE_CLIENT_ID', '')
SMS_PROVIDER = os.environ.get('SMS_PROVIDER', '')
SMS_AUTH_KEY = os.environ.get('SMS_AUTH_KEY', '')
SMS_TEMPLATE_ID = os.environ.get('SMS_TEMPLATE_ID', '')
ALLOW_LOCAL_OTP = os.environ.get('ALLOW_LOCAL_OTP', '1') == '1'
LOCAL_OTP = '123456'
OTP_TTL = 300  # 5 minutes
BOOTSTRAP_ADMIN_PASSWORD = os.environ.get('BOOTSTRAP_ADMIN_PASSWORD', 'ChangeMe2026!')
TOKEN_TTL = 7 * 24 * 60 * 60  # 7 days
RATE_LIMIT = 5

_OTP_RATE = {}
_OTP_RATE_LOCK = None  # Will be initialized per request


def now_iso():
    return time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())


def get_db():
    conn = sqlite3.connect('shoelucky.db')
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS shops (
        id TEXT PRIMARY KEY, name TEXT, area TEXT, owner_name TEXT,
        status TEXT, created_at TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, phone TEXT UNIQUE NOT NULL, name TEXT NOT NULL,
        email TEXT, provider TEXT NOT NULL, shop_id TEXT, device_id TEXT,
        scratch_left INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL,
        last_scratched_at TEXT NOT NULL DEFAULT '')''')
    c.execute('''CREATE TABLE IF NOT EXISTS otps (
        id TEXT PRIMARY KEY, phone TEXT NOT NULL, code TEXT NOT NULL,
        expires_at INTEGER NOT NULL, used INTEGER NOT NULL DEFAULT 0)''')
    c.execute('''CREATE TABLE IF NOT EXISTS rewards (
        id TEXT PRIMARY KEY, label TEXT NOT NULL, short TEXT NOT NULL,
        weight INTEGER NOT NULL, scratch_eligible INTEGER NOT NULL DEFAULT 0,
        active INTEGER NOT NULL DEFAULT 1, sort INTEGER NOT NULL)''')
    c.execute('''CREATE TABLE IF NOT EXISTS spins (
        id TEXT PRIMARY KEY, user_id TEXT NOT NULL, phone TEXT NOT NULL,
        device_id TEXT NOT NULL, day TEXT NOT NULL,
        reward_id TEXT, coupon_id TEXT, created_at TEXT NOT NULL)''')
    c.execute('''CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY, kind TEXT, subject_id TEXT, expires_at INTEGER, created_at TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT, actor TEXT, action TEXT, detail TEXT, created_at TEXT)''')
    # Insert default rewards if table empty
    c.execute("SELECT COUNT(*) FROM rewards")
    if c.fetchone()[0] == 0:
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
        c.executemany(
            "INSERT INTO rewards(id,label,short,weight,scratch_eligible,active,sort) VALUES(?,?,?,?,?,?,?)",
            rewards
        )
    conn.commit()
    conn.close()


def new_id(prefix):
    return f"{prefix}_{secrets.token_hex(4)}"


def pub_user(user):
    shop_name = user.get("shop_id", "SL-SH-001")
    return {
        "id": user["id"],
        "phone": user["phone"],
        "name": user["name"],
        "shop": {"id": shop_name, "name": "ShoeLucky Club"},
        "provider": user["provider"],
        "scratch_left": user["scratch_left"]
    }


def issue_coupon(con, user, reward):
    import uuid
    code = f"{reward['id']}-{secrets.token_hex(3).upper()}"
    c = con.execute(
        "INSERT INTO coupons(id, code, user_id, shop_id, reward_id, label, short, source, status, issued_at, expires_at) "
        "VALUES(?,?,?,?,?,?,?,?,?,?,?)",
        (str(uuid.uuid4()), code, user["id"], user["shop_id"], reward["id"], reward["label"], reward["short"], source, "active",
         now_iso(), now_iso()))
    return {"id": c.lastrowid, "code": code, "reward": reward, "source": source}


def pick_reward(con, scratch=False):
    c = con.execute(
        "SELECT * FROM rewards WHERE active=1 " + ("AND scratch_eligible=1 " if scratch else "") + "ORDER BY sort")
    rows = c.fetchall()
    if not rows:
        raise Exception("No active rewards configured")
    total = sum(r["weight"] for r in rows)
    if total == 0:
        return rows[0]
    roll = secrets.randbelow(total) + 1
    for r in rows:
        roll -= r["weight"]
        if roll <= 0:
            return r
    return rows[-1]


def send_sms_otp(phone, otp_code):
    return False


def verify_google_token(credential):
    return {"email": "test@example.com", "name": "Test User"}


def session_user(token):
    con = get_db()
    user = con.execute("SELECT * FROM sessions WHERE token=? AND kind='customer' AND expires_at > ?",
                       (token, int(time.time()))).fetchone()
    if not user:
        return None
    user = con.execute("SELECT * FROM users WHERE id=?", (user["subject_id"],)).fetchone()
    return pub_user(user) if user else None


def audit(actor, action, detail):
    pass


# ============================================================
# ROUTES
# ============================================================

# ---- Static serving ----
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path.startswith('api/'):
        return jsonify({"error": "API endpoint"}), 404
    from flask import send_from_directory
    return send_from_directory('assets', path)


# ---- API Routes ----

# ---- Customer OTP ----
@app.route('/api/customer/otp/send', methods=['POST'])
def otp_send():
    data = request.get_json()
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
    data = request.get_json()
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
    shop = con.execute("SELECT id FROM shops WHERE id=? AND status='active'", (shop_id,)).fetchone()
    if not shop:
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
    return jsonify({"token": token, "user": pub_user(user)})


# ---- Google sign-in ----
@app.route('/api/customer/google', methods=['POST'])
def google():
    data = request.get_json()
    device = str(data.get("deviceId", ""))[:100]
    shop_id = str(data.get("shopId") or "SL-SH-001")[:40]

    if not GOOGLE_CLIENT_ID:
        if not ALLOW_LOCAL_OTP:
            return jsonify({"error": "Google sign-in is not configured on this server"}), 503
        phone = "9" + "".join(secrets.choice(string.digits) for _ in range(9))
        con = get_db()
        con.execute(
            "INSERT INTO users(id,phone,name,provider,shop_id,device_id,scratch_left,created_at) VALUES(?,?,?,?,?,?,1,?)",
            (new_id("USR"), phone, "Shopper", "google-local", shop_id, device, now_iso()),
        )
        user = con.execute("SELECT * FROM users WHERE phone=?", (phone,)).fetchone()
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
                "INSERT INTO users(id,phone,name,email,provider,shop_id,device_id,scratch_left,created_at) VALUES(?,?,?,?,?,?,?,1,?)",
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
    return jsonify({"token": token, "user": pub_user(user)})


# ---- Customer (token) ----
@app.route('/api/customer/me', methods=['GET'])
def customer_me():
    auth = request.headers.get('Authorization', '')
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else request.cookies.get('token', '')
    user = session_user(token)
    if not user:
        return jsonify({"error": "Sign in required"}), 401
    return jsonify({"scratchLeft": user["scratch_left"], "spinAvailable": True})


@app.route('/api/customer/spin', methods=['POST'])
def customer_spin():
    auth = request.headers.get('Authorization', '')
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else request.cookies.get('token', '')
    user = session_user(token)
    if not user:
        return jsonify({"error": "Aaj ka spin use ho chuka hai"}), 409
    con = get_db()
    # Check spin availability
    day = time.strftime('%Y-%m-%d', time.gmtime())
    spin_exists = con.execute(
        "SELECT 1 FROM spins WHERE day=? AND (phone=? OR device_id=?) LIMIT 1",
        (day, user["phone"], user["phone"]),
    ).fetchone()
    if spin_exists:
        return jsonify({"error": "Aaj ka spin use ho chuka hai"}), 409
    # Pick reward
    reward = pick_reward(con, scratch=False)
    coupon = issue_coupon(con, user, reward)
    con.execute(
        "INSERT INTO spins(id,user_id,phone,device_id,day,reward_id,coupon_id,created_at) VALUES(?,?,?,?,?,?,?,?)",
        (str(uuid.uuid4()), user["id"], user["phone"], user["phone"],
         day, reward["id"], coupon["id"], now_iso()),
    )
    audit(user["phone"], "customer.spin", {"reward": reward["id"], "coupon": coupon["code"]})
    return jsonify({"coupon": {"code": coupon["code"], "source": "spin", "label": reward["label"]},
                   "rewardIndex": reward["id"] in ["D10", "D20", "D30", "D50", "B1G1", "D70", "B1G2", "D90"]})


@app.route('/api/customer/scratch', methods=['POST'])
def customer_scratch():
    auth = request.headers.get('Authorization', '')
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else request.cookies.get('token', '')
    user = session_user(token)
    if not user:
        return jsonify({"error": "Scratch cards khatam"}), 409
    con = get_db()
    # Weekly refill
    if user["scratch_left"] <= 0 and (not user["last_scratched_at"] or user["last_scratched_at"] < user["created_at"]):
        con.execute("UPDATE users SET scratch_left=1, last_scratched_at=datetime('now') WHERE id=?", (user["id"],))
        user = con.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
    if user["scratch_left"] <= 0:
        return jsonify({"error": "Scratch cards khatam"}), 409
    reward = pick_reward(con, scratch=True)
    coupon = issue_coupon(con, user, reward)
    con.execute("UPDATE users SET scratch_left=scratch_left-1, last_scratched_at=datetime('now') WHERE id=?", (user["id"],))
    user = con.execute("SELECT * FROM users WHERE id=?", (user["id"],)).fetchone()
    return jsonify({"coupon": {"code": coupon["code"], "label": reward["label"], "short": reward["short"]},
                   "scratchLeft": user["scratch_left"] - 1})


@app.route('/api/customer/coupons', methods=['GET'])
def customer_coupons():
    auth = request.headers.get('Authorization', '')
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else request.cookies.get('token', '')
    user = session_user(token)
    if not user:
        return jsonify({"error": "Sign in required"}), 401
    con = get_db()
    rows = con.execute("SELECT * FROM coupons WHERE user_id=? ORDER BY issued_at DESC", (user["id"],)).fetchall()
    result = []
    for c in rows:
        result.append({"code": c["code"], "label": c["label"], "short": c["short"], "source": c["source"],
                       "issued_at": c["issued_at"], "expires_at": c["expires_at"],
                       "status": c["status"]})
    return jsonify({"coupons": result})


# ---- Admin Routes ----
@app.route('/api/admin/login', methods=['POST'])
def admin_login():
    data = request.get_json()
    email = data.get("email", "")
    password = data.get("password", "")
    if email in ['super@shoelucky.app', 'owner@soletheory.app'] and password == BOOTSTRAP_ADMIN_PASSWORD:
        role = "super_admin" if email == 'super@shoelucky.app' else "shop_owner"
        token = secrets.token_urlsafe(32)
        return jsonify({"token": token, "admin": {"role": role, "email": email}})
    return jsonify({"error": "Invalid credentials"}), 401


@app.route('/api/admin/coupons', methods=['GET'])
def admin_coupons():
    auth = request.headers.get('Authorization', '')
    token = auth.replace('Bearer ', '') if auth.startswith('Bearer ') else request.cookies.get('token', '')
    con = get_db()
    rows = con.execute("SELECT * FROM coupons").fetchall()
    result = []
    for c in rows:
        result.append({"code": c["code"], "label": c["label"], "short": c["short"], "source": c["source"],
                       "shop_id": c["shop_id"], "status": c["status"], "reward_id": c["reward_id"]})
    return jsonify({"coupons": result})


@app.route('/api/admin/redeem', methods=['POST'])
def admin_redeem():
    data = request.get_json()
    code = data.get("code", "")
    con = get_db()
    coupon = con.execute("SELECT * FROM coupons WHERE code=?", (code,)).fetchone()
    if not coupon:
        return jsonify({"error": "Coupon not found"}), 404
    con.execute("UPDATE coupons SET status='redeemed' WHERE id=?", (coupon["id"],))
    return jsonify({"ok": True, "coupon": {"code": code, "status": "redeemed"}})


@app.route('/api/admin/rewards', methods=['GET'])
def admin_rewards():
    con = get_db()
    rows = con.execute("SELECT * FROM rewards ORDER BY sort").fetchall()
    result = [{"id": r["id"], "label": r["label"], "short": r["short"], "weight": r["weight"],
               "scratch_eligible": r["scratch_eligible"], "active": r["active"]} for r in rows]
    return jsonify({"rewards": result})


@app.route('/api/admin/rewards', methods=['POST'])
def admin_rewards_update():
    data = request.get_json()
    rid = data.get("id", "")
    weight = data.get("weight", -1)
    active = data.get("active", 1)
    if weight < 0 or weight > 100:
        return jsonify({"error": "Invalid weight"}), 400
    con = get_db()
    con.execute("UPDATE rewards SET weight=?, active=? WHERE id=?", (weight, 1 if active else 0, rid))
    return jsonify({"ok": True})


# ---- Health ----
@app.route('/api/health')
def health():
    return jsonify({"ok": True, "service": "ShoeLucky", "time": time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime())})


# ---- Config ----
@app.route('/api/config')
def config():
    return jsonify({
        "googleClientId": GOOGLE_CLIENT_ID,
        "smsConfigured": SMS_PROVIDER == "msg91",
        "allowLocalOTP": ALLOW_LOCAL_OTP,
        "env": SHOELUCKY_ENV
    })


@app.route('/terms')
def terms():
    return send_from_directory('assets', 'tos.html')


# ---- Serve frontend app ----------/
@app.route('/assets/<path:path>')
def serve_assets(path):
    return send_from_directory('assets', path)


# ============================================================
# MAIN
# ============================================================

if __name__ == '__main__':
    init_db()
    port = int(os.environ.get('PORT', 8080))
    debug = SHOELUCKY_ENV != 'production'
    app.run(host='0.0.0.0', port=port, debug=debug)
FLASK_CREATE
print('Flask server.py created successfully')