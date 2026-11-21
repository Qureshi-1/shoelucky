/* Application core: demo state, routing, and a deliberately thin API boundary.
 *
 * The `SL.api` object mirrors calls a production client would make to a server.
 * In this prototype every method resolves against local demo state. Swap the
 * implementation for HTTPS calls to a Supabase-backed server later; keep the
 * authorization, OTP verification, reward selection, coupon signing, and
 * redemption checks on that server, never in this browser bundle.
 */
(function () {
  const SL = window.SL;
  const STORAGE_KEY = "shoelucky-prototype-v1";

  SL.state = {
    shops: SL.shops.map((x) => Object.assign({}, x)),
    campaigns: SL.campaigns.map((x) => Object.assign({}, x)),
    rewards: SL.rewards.map((x) => Object.assign({}, x)),
    customers: SL.customers.map((x) => Object.assign({}, x)),
    coupons: SL.coupons.map((x) => Object.assign({}, x)),
    analytics: SL.analytics,
    customer: null,
    admin: null,
    context: { shopId: null, campaignId: null },
    game: null,
    reward: null,
    lastCouponId: null,
    pendingPhone: null,
    ui: { couponFilter: "all", couponSearch: "", scannerResult: null }
  };

  SL.routes = [];
  SL.actions = {};
  SL.forms = {};
  SL.hooks = [];
  SL.cleanups = [];
  SL.currentRoute = null;

  function loadPersisted() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && typeof saved === "object") {
        if (Array.isArray(saved.coupons)) SL.state.coupons = saved.coupons;
        if (Array.isArray(saved.shops)) SL.state.shops = saved.shops;
        if (Array.isArray(saved.campaigns)) SL.state.campaigns = saved.campaigns;
        if (Array.isArray(saved.rewards)) SL.state.rewards = saved.rewards;
        if (saved.customer) SL.state.customer = saved.customer;
        if (saved.admin) SL.state.admin = saved.admin;
        if (saved.context) SL.state.context = saved.context;
        if (saved.pendingPhone) SL.state.pendingPhone = saved.pendingPhone;
      }
    } catch (_) {
      /* localStorage may be unavailable; the prototype still works in memory. */
    }
  }

  function savePersisted() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          coupons: SL.state.coupons,
          shops: SL.state.shops,
          campaigns: SL.state.campaigns,
          rewards: SL.state.rewards,
          customer: SL.state.customer,
          admin: SL.state.admin,
          context: SL.state.context,
          pendingPhone: SL.state.pendingPhone
        })
      );
    } catch (_) {
      /* Ignore quota / privacy-mode errors. */
    }
  }

  SL.save = savePersisted;

  SL.resetDemo = function () {
    try { localStorage.removeItem(STORAGE_KEY); } catch (_) {}
    SL.state.shops = SL.shops.map((x) => Object.assign({}, x));
    SL.state.campaigns = SL.campaigns.map((x) => Object.assign({}, x));
    SL.state.rewards = SL.rewards.map((x) => Object.assign({}, x));
    SL.state.customers = SL.customers.map((x) => Object.assign({}, x));
    SL.state.coupons = SL.coupons.map((x) => Object.assign({}, x));
    SL.state.customer = null;
    SL.state.admin = null;
    SL.state.context = { shopId: null, campaignId: null };
    SL.state.game = null;
    SL.state.reward = null;
    SL.state.lastCouponId = null;
    SL.state.pendingPhone = null;
    SL.state.ui = { couponFilter: "all", couponSearch: "", scannerResult: null };
  };

  SL.escapeHtml = function (value) {
    return String(value == null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  };

  SL.uid = function (prefix) {
    return prefix + "-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  };

  SL.formatDate = function (iso, opts) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(undefined, opts || { month: "short", day: "numeric", year: "numeric" });
  };

  SL.formatDateTime = function (iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  };

  SL.relativeDate = function (iso) {
    if (!iso) return "—";
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.round(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    const hours = Math.round(mins / 60);
    if (hours < 24) return hours + "h ago";
    const days = Math.round(hours / 24);
    if (days < 30) return days + "d ago";
    return SL.formatDate(iso, { month: "short", day: "numeric" });
  };

  SL.isExpired = function (coupon) {
    return coupon.status === "expired" || new Date(coupon.expiresAt).getTime() < Date.now();
  };

  SL.visibleCouponsForCustomer = function () {
    if (!SL.state.customer) return [];
    return SL.state.coupons.filter((c) => c.customerId === SL.state.customer.id);
  };

  SL.shopCoupons = function (shopId) {
    if (!shopId) return SL.state.coupons;
    return SL.state.coupons.filter((c) => c.shopId === shopId);
  };

  SL.currentShop = function () {
    const id = (SL.state.context.shopId && SL.state.context.shopId) ||
      (SL.state.customer && SL.state.customer.shopId) ||
      (SL.state.admin && SL.state.admin.shopId) ||
      SL.state.shops[0].id;
    return SL.shopById(id) || SL.state.shops[0];
  };

  SL.pickReward = function () {
    const active = SL.state.rewards.filter((r) => r.active && Number(r.weight) > 0);
    const pool = active.length ? active : SL.state.rewards;
    const total = pool.reduce((sum, r) => sum + Number(r.weight || 1), 0);
    let roll = Math.random() * total;
    for (let i = 0; i < pool.length; i += 1) {
      roll -= Number(pool[i].weight || 1);
      if (roll <= 0) return pool[i];
    }
    return pool[pool.length - 1];
  };

  SL.issueCoupon = function (rewardId) {
    const reward = SL.rewardById(rewardId) || SL.pickReward();
    const shop = SL.currentShop();
    const campaign = SL.campaignById(SL.state.context.campaignId);
    const customer = SL.state.customer;
    if (!customer) return null;
    const coupon = {
      id: SL.uid("CPN"),
      code: "DEMO-" + shop.code.slice(-3).toUpperCase() + "-" + String(Math.floor(1000 + Math.random() * 9000)),
      shopId: shop.id,
      campaignId: campaign ? campaign.id : (SL.state.campaigns.find((c) => c.shopId === shop.id) || {}).id || "CMP-DEMO",
      customerId: customer.id,
      rewardId: reward.id,
      status: "active",
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 7 * 24 * 3600000).toISOString(),
      redeemedAt: null,
      demo: true
    };
    SL.state.coupons.unshift(coupon);
    SL.state.reward = reward;
    SL.state.lastCouponId = coupon.id;
    savePersisted();
    return coupon;
  };

  SL.copy = function (text) {
    const done = () => SL.toast("Copied to clipboard", "success");
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(done).catch(() => fallback());
    }
    return Promise.resolve(fallback());
    function fallback() {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.select();
      try { document.execCommand("copy"); done(); } catch (_) { SL.toast("Copy unavailable", "error"); }
      document.body.removeChild(el);
    }
  };

  /* ---------------- API boundary (demo implementations) ---------------- */
  SL.api = {
    requestOtp: function (phone, shopId, campaignId) {
      return new Promise((resolve) => {
        SL.state.pendingPhone = phone || "+1 415 555 0112";
        SL.state.context = { shopId: shopId || SL.state.shops[0].id, campaignId: campaignId || null };
        savePersisted();
        resolve({ ok: true, demoOtp: "123456", note: "Demo only. No SMS is sent." });
      });
    },
    verifyOtp: function (otp, phone) {
      return new Promise((resolve) => {
        if (String(otp).replace(/\s/g, "") !== "123456") {
          resolve({ ok: false, error: "Demo OTP is 123456." });
          return;
        }
        const digits = String(phone || "").replace(/\D/g, "").slice(-4) || "0000";
        let customer = SL.state.customers.find((c) => c.phone.replace(/\D/g, "").slice(-4) === digits);
        if (!customer) {
          customer = {
            id: SL.uid("CUS"),
            name: "Demo Customer",
            phone: phone || "+1 555 555 0100",
            shopId: SL.currentShop().id,
            joined: new Date().toISOString()
          };
          SL.state.customers.unshift(customer);
        }
        SL.state.customer = customer;
        savePersisted();
        resolve({ ok: true, customer });
      });
    },
    assignGame: function () {
      return new Promise((resolve) => {
        const campaign = SL.campaignById(SL.state.context.campaignId);
        const mode = campaign && campaign.gameMode !== "random" ? campaign.gameMode : (Math.random() < 0.5 ? "spin" : "scratch");
        SL.state.game = mode;
        resolve({ ok: true, game: mode, campaign: campaign });
      });
    },
    adminLogin: function (email, password) {
      return new Promise((resolve) => {
        const user = SL.adminUsers.find((u) => u.email.toLowerCase() === String(email).toLowerCase().trim() && u.password === password);
        if (!user) { resolve({ ok: false, error: "Use one of the demo credentials shown below." }); return; }
        SL.state.admin = Object.assign({}, user);
        savePersisted();
        resolve({ ok: true, user: SL.state.admin });
      });
    },
    createShop: function (payload) {
      return new Promise((resolve) => {
        const shop = {
          id: "SL-SH-" + String(SL.state.shops.length + 1).padStart(3, "0"),
          code: String(payload.name || "SHOP").replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase() + "-" + String(SL.state.shops.length + 1).padStart(3, "0"),
          name: payload.name,
          area: payload.area || "Demo Area",
          city: payload.city || "Metro City",
          owner: payload.owner || "Demo Owner",
          ownerEmail: payload.ownerEmail || "owner@demo.local",
          status: "active",
          accent: "#d4af37",
          joined: new Date().toISOString()
        };
        SL.state.shops.push(shop);
        savePersisted();
        resolve({ ok: true, shop });
      });
    },
    createCampaign: function (payload) {
      return new Promise((resolve) => {
        const campaign = {
          id: "CMP-" + (1100 + SL.state.campaigns.length),
          shopId: payload.shopId,
          name: payload.name,
          gameMode: payload.gameMode,
          status: "draft",
          starts: new Date().toISOString(),
          ends: new Date(Date.now() + 30 * 86400000).toISOString(),
          scans: 0,
          plays: 0,
          redemptions: 0
        };
        SL.state.campaigns.push(campaign);
        savePersisted();
        resolve({ ok: true, campaign });
      });
    },
    redeemCoupon: function (code) {
      return new Promise((resolve) => {
        const found = SL.state.coupons.find((c) => c.code.toLowerCase() === String(code).toLowerCase().trim());
        if (!found) { resolve({ ok: false, error: "Demo coupon not found." }); return; }
        if (found.status === "redeemed") { resolve({ ok: false, error: "This demo coupon is already redeemed.", coupon: found }); return; }
        if (SL.isExpired(found)) { resolve({ ok: false, error: "This demo coupon has expired.", coupon: found }); return; }
        found.status = "redeemed";
        found.redeemedAt = new Date().toISOString();
        savePersisted();
        resolve({ ok: true, coupon: found });
      });
    }
  };

  /* ---------------- Router ---------------- */
  function compile(pattern) {
    const keys = [];
    const source = pattern
      .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
      .replace(/:([A-Za-z0-9_]+)/g, (_, key) => { keys.push(key); return "([^/]+)"; });
    return { regex: new RegExp("^" + source + "/?$"), keys };
  }

  SL.route = function (pattern, handler, meta) {
    const compiled = compile(pattern);
    SL.routes.push({ pattern, handler, meta: meta || {}, regex: compiled.regex, keys: compiled.keys });
  };

  SL.parseHash = function () {
    const raw = window.location.hash.replace(/^#/, "") || "/";
    const [path, queryString] = raw.split("?");
    const params = {};
    if (queryString) {
      queryString.split("&").forEach((pair) => {
        if (!pair) return;
        const [k, v] = pair.split("=");
        try { params[decodeURIComponent(k)] = decodeURIComponent(v || ""); } catch (_) {}
      });
    }
    return { path: path || "/", params };
  };

  SL.navigate = function (path) {
    if (window.location.hash === "#" + path) { renderRoute(); return; }
    window.location.hash = path;
  };

  SL.onRender = function (fn) { SL.hooks.push(fn); };
  SL.addCleanup = function (fn) { SL.cleanups.push(fn); };

  SL.render = function (html, options) {
    SL.cleanups.splice(0).forEach((fn) => { try { fn(); } catch (_) {} });
    const app = document.getElementById("app");
    app.innerHTML = html;
    app.className = "app app--" + ((options && options.shell) || "customer");
    document.body.dataset.shell = (options && options.shell) || "customer";
    window.scrollTo({ top: 0, behavior: "instant" in window ? "instant" : "auto" });
    SL.hooks.slice(-8).forEach((fn) => {
      try { fn(SL.currentRoute); } catch (err) { console.error("Render hook error", err); }
    });
  };

  function renderRoute() {
    const parsed = SL.parseHash();
    let match = null;
    let values = [];
    for (const r of SL.routes) {
      const m = r.regex.exec(parsed.path);
      if (m) { match = r; values = m.slice(1); break; }
    }
    if (!match) {
      SL.navigate("/");
      return;
    }
    const params = Object.assign({}, parsed.params);
    match.keys.forEach((key, i) => { params[key] = decodeURIComponent(values[i]); });
    SL.currentRoute = { path: parsed.path, params, meta: match.meta };

    if (match.meta.auth === "customer" && !SL.state.customer) {
      SL.toast("Sign in to continue", "info");
      SL.navigate("/login");
      return;
    }
    if (match.meta.auth === "admin" && !SL.state.admin) {
      SL.toast("Admin sign-in required", "info");
      SL.navigate("/admin/login");
      return;
    }
    if (match.meta.role && SL.state.admin && SL.state.admin.role !== match.meta.role) {
      SL.toast("This area is for Super Admin only", "error");
      SL.navigate("/admin");
      return;
    }
    const html = match.handler(params);
    if (typeof html === "string") {
      const shell = match.meta.shell || (parsed.path.indexOf("/admin") === 0 && parsed.path !== "/admin/login" ? "admin" : "customer");
      SL.render(html, { shell: shell });
    }
  }

  SL.startRouter = function () {
    window.addEventListener("hashchange", renderRoute);
    document.addEventListener("click", function (event) {
      const nav = event.target.closest("[data-nav]");
      if (nav) {
        event.preventDefault();
        SL.navigate(nav.getAttribute("data-nav"));
        return;
      }
      const actionEl = event.target.closest("[data-action]");
      if (actionEl) {
        const name = actionEl.getAttribute("data-action");
        if (SL.actions[name]) {
          event.preventDefault();
          SL.actions[name](actionEl, actionEl.dataset);
        }
      }
    });
    document.addEventListener("submit", function (event) {
      const form = event.target.closest("[data-form]");
      if (!form) return;
      event.preventDefault();
      const name = form.getAttribute("data-form");
      if (SL.forms[name]) SL.forms[name](form, event);
    });
    renderRoute();
  };

  loadPersisted();
})();
