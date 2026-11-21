/* Shared presentation components. No external icon or CSS libraries are used. */
(function () {
  const SL = window.SL;

  const ICONS = {
    home: '<path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V21h14V9.5"/><path d="M9 21v-6h6v6"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9"/><path d="M12 8v13"/><path d="M12 8S9.5 3 7 4.5 8.5 8 12 8Z"/><path d="M12 8s2.5-5 5-3.5S15.5 8 12 8Z"/>',
    ticket: '<path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V7Z"/><path d="M13 7v10" stroke-dasharray="2 2"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
    scan: '<path d="M4 9V5a1 1 0 0 1 1-1h4"/><path d="M20 9V5a1 1 0 0 0-1-1h-4"/><path d="M4 15v4a1 1 0 0 0 1 1h4"/><path d="M20 15v4a1 1 0 0 1-1 1h-4"/><path d="M3 12h18"/>',
    shop: '<path d="M4 9h16l-1 11H5L4 9Z"/><path d="M3 9 5 4h14l2 5"/><path d="M9 20v-6h6v6"/>',
    chart: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4v-.2a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.6-1H3v-4h.2a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6V3h4v.2a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4h-.2a1.7 1.7 0 0 0-1.6 1Z"/>',
    logout: '<path d="M10 17l5-5-5-5"/><path d="M15 12H3"/><path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"/>',
    arrowLeft: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    arrowRight: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    check: '<path d="m5 13 4 4L19 7"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4"/>',
    plus: '<path d="M12 5v14"/><path d="M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z"/><circle cx="12" cy="13" r="4"/>',
    shield: '<path d="M12 3 4 6v6c0 5 3.5 8.5 8 9 4.5-.5 8-4 8-9V6l-8-3Z"/><path d="m9 12 2 2 4-4"/>',
    alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5"/><path d="M12 17.5h.01"/>',
    close: '<path d="M6 6l12 12"/><path d="M18 6 6 18"/>',
    menu: '<path d="M4 7h16"/><path d="M4 12h16"/><path d="M4 17h16"/>',
    dashboard: '<rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="5" rx="1"/><rect x="13" y="10" width="8" height="11" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/>',
    campaign: '<path d="M3 11v2a2 2 0 0 0 2 2h2l7 5V4L7 9H5a2 2 0 0 0-2 2Z"/><path d="M18 9a4 4 0 0 1 0 6"/>',
    reward: '<path d="M12 2 15 8l6 .9-4.5 4.3 1.1 6-5.6-3-5.6 3 1.1-6L3 8.9 9 8l3-6Z"/>',
    wheel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 3v7"/><path d="m19 7-5 4"/><path d="m19 17-5-4"/>',
    scratch: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m5 17 5-5 3 3 3-4 3 4"/><circle cx="8" cy="9" r="1"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>',
    star: '<path d="m12 2 3 6.5 7 1-5 5 1.2 7L12 18l-6.2 3.5L7 14.5l-5-5 7-1L12 2Z"/>',
    trend: '<path d="m3 17 6-6 4 4 8-8"/><path d="M15 7h6v6"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2 20c0-3.5 3-5.5 7-5.5s7 2 7 5.5"/><path d="M16 5.5a3.5 3.5 0 0 1 0 6.8"/><path d="M18 15c2.5.6 4 2.3 4 5"/>',
    calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18"/><path d="M8 3v4"/><path d="M16 3v4"/>',
    filter: '<path d="M3 5h18"/><path d="M6 12h12"/><path d="M10 19h4"/>',
    edit: '<path d="M4 20h4L20 8l-4-4L4 16v4Z"/><path d="m14 6 4 4"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 14h10l1-14"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
    refresh: '<path d="M20 7v5h-5"/><path d="M4 17v-5h5"/><path d="M6.1 9A7 7 0 0 1 18.5 7L20 12"/><path d="M17.9 15A7 7 0 0 1 5.5 17L4 12"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3z"/><path d="M20 14v3"/><path d="M14 20h3"/><path d="M20 20h1"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z"/>',
    sparkle: '<path d="M12 2v7"/><path d="M12 15v7"/><path d="M2 12h7"/><path d="M15 12h7"/><path d="m5 5 4 4"/><path d="m15 15 4 4"/><path d="m19 5-4 4"/><path d="m9 15-4 4"/>'
  };

  SL.icon = function (name, size, extraClass) {
    const body = ICONS[name] || ICONS.star;
    return '<svg class="icon ' + (extraClass || "") + '" width="' + (size || 20) + '" height="' + (size || 20) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + "</svg>";
  };

  SL.logo = function (compact) {
    return '<div class="logo ' + (compact ? "logo--compact" : "") + '">' +
      '<span class="logo__mark">' + SL.icon("bolt", compact ? 16 : 20) + "</span>" +
      '<span class="logo__type">Shoe<span>Lucky</span></span>' +
      "</div>";
  };

  SL.shoeArt = function () {
    return '' +
      '<svg class="shoe-art" viewBox="0 0 460 230" role="img" aria-label="Gold sneaker illustration">' +
        '<defs>' +
          '<linearGradient id="shoeBody" x1="0" y1="0" x2="1" y2="1">' +
            '<stop offset="0" stop-color="#f8e6ad"/><stop offset="0.45" stop-color="#d4af37"/><stop offset="1" stop-color="#8f6d18"/>' +
          '</linearGradient>' +
          '<linearGradient id="shoeSole" x1="0" y1="0" x2="1" y2="0">' +
            '<stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#c9c6bd"/>' +
          '</linearGradient>' +
          '<filter id="shoeGlow" x="-30%" y="-30%" width="160%" height="160%">' +
            '<feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>' +
          '</filter>' +
        '</defs>' +
        '<ellipse cx="230" cy="200" rx="175" ry="14" fill="#000" opacity=".55"/>' +
        '<g filter="url(#shoeGlow)">' +
          '<path d="M61 166c24-3 42-14 56-34l22-31c5-7 13-10 21-7l33 13 40 21c18 9 36 11 58 13 25 3 42 10 54 24 8 9 6 19-6 22H75c-15 0-22-7-14-21Z" fill="url(#shoeBody)"/>' +
          '<path d="M57 173h346c8 0 11 4 7 10-3 5-9 7-16 7H71c-12 0-19-5-19-11 0-4 2-6 5-6Z" fill="url(#shoeSole)"/>' +
          '<path d="M151 115c11 12 17 25 18 40m-4-38c15 13 22 27 23 42m-4-40c17 13 24 27 26 43" stroke="#fff5d6" stroke-width="5" stroke-linecap="round" opacity=".8"/>' +
          '<path d="M258 132c24 11 45 12 70 14" stroke="#7a5d12" stroke-width="5" stroke-linecap="round" opacity=".65"/>' +
          '<path d="M92 153c18-2 32-8 43-18" stroke="#fff8dd" stroke-width="4" stroke-linecap="round" opacity=".75"/>' +
        '</g>' +
        '<circle cx="374" cy="80" r="18" fill="none" stroke="#d4af37" stroke-width="1.5" opacity=".45"/>' +
        '<circle cx="374" cy="80" r="8" fill="#f6dd8f" opacity=".9"/>' +
      '</svg>';
  };

  SL.qrSvg = function (seed, size) {
    const n = 21;
    const cell = 100 / n;
    let hash = 0;
    String(seed || "DEMO").split("").forEach((ch) => { hash = (hash * 31 + ch.charCodeAt(0)) >>> 0; });
    function rand(x, y) {
      let v = (hash + x * 73856093 + y * 19349663) >>> 0;
      v ^= v >>> 13; v = Math.imul(v, 1274126177); return ((v ^ (v >>> 16)) >>> 0) / 4294967295;
    }
    let rects = "";
    for (let y = 0; y < n; y += 1) {
      for (let x = 0; x < n; x += 1) {
        const f1 = x < 7 && y < 7;
        const f2 = x >= n - 7 && y < 7;
        const f3 = x < 7 && y >= n - 7;
        let on = false;
        if (f1 || f2 || f3) {
          const ox = f2 ? x - (n - 7) : x;
          const oy = f3 ? y - (n - 7) : y;
          const ring = ox === 0 || ox === 6 || oy === 0 || oy === 6;
          const core = ox >= 2 && ox <= 4 && oy >= 2 && oy <= 4;
          on = ring || core;
        } else if (x === 6 || y === 6) {
          on = (x + y) % 2 === 0;
        } else {
          on = rand(x, y) > 0.55;
        }
        if (on) rects += '<rect x="' + (x * cell).toFixed(2) + '" y="' + (y * cell).toFixed(2) + '" width="' + cell.toFixed(2) + '" height="' + cell.toFixed(2) + '"/>';
      }
    }
    return '<svg class="qr-svg" width="' + (size || 120) + '" height="' + (size || 120) + '" viewBox="0 0 100 100" fill="#0a0a0b" shape-rendering="crispEdges" aria-label="Demo QR placeholder">' +
      '<rect width="100" height="100" fill="#fff"/><g fill="#0a0a0b">' + rects + "</g></svg>";
  };

  SL.toast = function (message, type) {
    const root = document.getElementById("toast-root");
    if (!root) return;
    const el = document.createElement("div");
    el.className = "toast toast--" + (type || "info");
    el.innerHTML = SL.icon(type === "error" ? "alert" : type === "success" ? "check" : "sparkle", 17) + "<span>" + SL.escapeHtml(message) + "</span>";
    root.appendChild(el);
    requestAnimationFrame(() => el.classList.add("is-in"));
    setTimeout(() => {
      el.classList.remove("is-in");
      setTimeout(() => el.remove(), 260);
    }, 3200);
  };

  SL.modalHandlers = {};
  SL.openModal = function (config) {
    const root = document.getElementById("modal-root");
    SL.modalHandlers = config.handlers || {};
    const actions = (config.actions || []).map((a, i) =>
      '<button class="btn ' + (a.class || "btn-ghost") + '" data-modal-action="' + SL.escapeHtml(a.key || i) + '">' + SL.escapeHtml(a.label) + "</button>"
    ).join("");
    root.innerHTML = '' +
      '<div class="modal-backdrop" data-modal-close="1"></div>' +
      '<div class="modal-card ' + (config.wide ? "modal-card--wide" : "") + '" role="dialog" aria-modal="true" aria-label="' + SL.escapeHtml(config.title || "Dialog") + '">' +
        '<div class="modal-card__head"><div><p class="eyebrow">' + SL.escapeHtml(config.eyebrow || "ShoeLucky") + "</p><h3>" + SL.escapeHtml(config.title || "") + "</h3></div>" +
        '<button class="icon-btn" data-modal-close="1" aria-label="Close">' + SL.icon("close", 19) + "</button></div>" +
        '<div class="modal-card__body">' + (config.body || "") + "</div>" +
        (actions ? '<div class="modal-card__actions">' + actions + "</div>" : "") +
      "</div>";
    root.classList.add("is-active");
    root.setAttribute("aria-hidden", "false");
  };

  SL.closeModal = function () {
    const root = document.getElementById("modal-root");
    root.classList.remove("is-active");
    root.setAttribute("aria-hidden", "true");
    setTimeout(() => { root.innerHTML = ""; SL.modalHandlers = {}; }, 180);
  };

  SL.demoNotice = function (text) {
    return '<div class="demo-notice">' + SL.icon("alert", 16) + "<span>" + SL.escapeHtml(text || "Demo data only — no real authentication or coupon security.") + "</span></div>";
  };

  SL.rewardPill = function (reward, large) {
    if (!reward) return '<span class="reward-pill">—</span>';
    return '<span class="reward-pill ' + (large ? "reward-pill--large" : "") + '" style="--pill-bg:' + SL.escapeHtml(reward.color || "#18181b") + ";--pill-fg:" + SL.escapeHtml(reward.text || "#f6dd8f") + '">' +
      (reward.type === "bogo" ? SL.icon("gift", large ? 18 : 14) : SL.icon("ticket", large ? 18 : 14)) + SL.escapeHtml(reward.label) + "</span>";
  };

  SL.statusPill = function (status) {
    const map = {
      active: "Active", redeemed: "Redeemed", expired: "Expired", paused: "Paused", draft: "Draft",
      won: "Won", super_admin: "Super Admin", shop_owner: "Shop Owner"
    };
    return '<span class="status-pill status-pill--' + SL.escapeHtml(status) + '">' + SL.escapeHtml(map[status] || status) + "</span>";
  };

  SL.statCard = function (label, value, sub, iconName, accent) {
    return '<div class="stat-card">' +
      '<div class="stat-card__top"><span>' + SL.escapeHtml(label) + "</span>" + SL.icon(iconName || "chart", 18) + "</div>" +
      '<strong style="color:' + (accent || "var(--text)") + '">' + SL.escapeHtml(value) + "</strong>" +
      '<small>' + SL.escapeHtml(sub || "") + "</small></div>";
  };

  SL.progressBar = function (label, value, max, color) {
    const pct = Math.max(0, Math.min(100, Math.round((value / (max || 1)) * 100)));
    return '<div class="progress-row"><div class="progress-row__label"><span>' + SL.escapeHtml(label) + "</span><b>" + SL.escapeHtml(value) + "</b></div>" +
      '<div class="progress-track"><span style="width:' + pct + "%;background:" + (color || "linear-gradient(90deg,#b8912d,#f6dd8f)") + '"></span></div></div>';
  };

  SL.emptyState = function (iconName, title, text, actionLabel, actionNav) {
    return '<div class="empty-state">' + SL.icon(iconName || "ticket", 34) + "<h3>" + SL.escapeHtml(title) + "</h3><p>" + SL.escapeHtml(text) + "</p>" +
      (actionLabel ? '<a class="btn btn-gold" data-nav="' + SL.escapeHtml(actionNav || "/") + '">' + SL.escapeHtml(actionLabel) + "</a>" : "") + "</div>";
  };

  SL.confetti = function (container) {
    if (!container) return;
    const colors = ["#d4af37", "#f6dd8f", "#ffffff", "#b8912d", "#8f6d18"];
    for (let i = 0; i < 46; i += 1) {
      const p = document.createElement("span");
      p.className = "confetti-piece";
      p.style.left = (Math.random() * 100) + "%";
      p.style.background = colors[Math.floor(Math.random() * colors.length)];
      p.style.animationDelay = (Math.random() * 0.35) + "s";
      p.style.animationDuration = (1.6 + Math.random() * 1.4) + "s";
      p.style.transform = "rotate(" + Math.random() * 360 + "deg)";
      container.appendChild(p);
      SL.addCleanup(() => p.remove());
    }
  };

  SL.customerHeader = function (opts) {
    const o = opts || {};
    return '<header class="topbar topbar--customer">' +
      (o.back ? '<button class="icon-btn" data-nav="' + SL.escapeHtml(o.back) + '" aria-label="Back">' + SL.icon("arrowLeft", 20) + "</button>" : SL.logo(true)) +
      '<div class="topbar__center">' + (o.title ? "<strong>" + SL.escapeHtml(o.title) + "</strong>" : "") + "</div>" +
      (o.right || '<button class="icon-btn" data-nav="/account" aria-label="Account">' + SL.icon("user", 19) + "</button>") +
      "</header>";
  };

  SL.bottomNav = function (active) {
    const items = [
      { id: "home", label: "Home", icon: "home", nav: "/" },
      { id: "game", label: "Play", icon: "wheel", nav: "/game" },
      { id: "coupons", label: "Coupons", icon: "ticket", nav: "/history" },
      { id: "account", label: "Account", icon: "user", nav: "/account" }
    ];
    return '<nav class="bottom-nav" aria-label="Primary">' + items.map((i) =>
      '<a data-nav="' + i.nav + '" class="bottom-nav__item ' + (active === i.id ? "is-active" : "") + '">' + SL.icon(i.icon, 20) + "<span>" + i.label + "</span></a>"
    ).join("") + "</nav>";
  };

  SL.adminShell = function (active, title, subtitle, content) {
    const admin = SL.state.admin || {};
    const isSuper = admin.role === "super_admin";
    const nav = [
      { id: "dashboard", label: "Overview", icon: "dashboard", nav: "/admin", superOnly: false },
      { id: "shops", label: "Shops", icon: "shop", nav: "/admin/shops", superOnly: false },
      { id: "campaigns", label: "Campaigns", icon: "campaign", nav: "/admin/campaigns", superOnly: false },
      { id: "rewards", label: "Rewards", icon: "reward", nav: "/admin/rewards", superOnly: false },
      { id: "coupons", label: "Coupons", icon: "ticket", nav: "/admin/coupons", superOnly: false },
      { id: "scanner", label: "Redeem", icon: "scan", nav: "/admin/scanner", superOnly: false },
      { id: "analytics", label: "Analytics", icon: "chart", nav: "/admin/analytics", superOnly: false },
      { id: "settings", label: "Settings", icon: "settings", nav: "/admin/settings", superOnly: true }
    ];
    const links = nav.filter((n) => !n.superOnly || isSuper).map((n) =>
      '<a data-nav="' + n.nav + '" class="admin-nav__link ' + (active === n.id ? "is-active" : "") + '">' + SL.icon(n.icon, 18) + "<span>" + n.label + "</span></a>"
    ).join("");
    return '<div class="admin-shell">' +
      '<div class="drawer-overlay" data-action="close-drawer"></div>' +
      '<aside class="admin-sidebar">' +
        '<div class="admin-sidebar__brand">' + SL.logo(true) + '<span class="admin-sidebar__tag">Control Center</span></div>' +
        '<nav class="admin-nav">' + links + "</nav>" +
        '<div class="admin-sidebar__foot">' +
          '<div class="admin-user"><span class="avatar">' + SL.escapeHtml((admin.name || "A").charAt(0)) + "</span><div><strong>" + SL.escapeHtml(admin.name || "Admin") + "</strong><small>" + SL.escapeHtml(admin.role === "super_admin" ? "All shops" : SL.shopById(admin.shopId) ? SL.shopById(admin.shopId).name : "Shop owner") + "</small></div></div>" +
          '<button class="text-btn" data-action="logout-admin">' + SL.icon("logout", 16) + " Sign out</button>" +
        "</div>" +
      "</aside>" +
      '<div class="admin-main">' +
        '<header class="topbar topbar--admin">' +
          '<button class="icon-btn admin-menu" data-action="toggle-drawer" aria-label="Open menu">' + SL.icon("menu", 21) + "</button>" +
          '<div class="topbar__title"><p class="eyebrow">' + SL.escapeHtml(isSuper ? "Super Admin" : "Shop Owner") + "</p><h1>" + SL.escapeHtml(title) + "</h1></div>" +
          '<div class="topbar__actions">' +
            (isSuper ? '<button class="btn btn-ghost btn-sm" data-action="open-shop-qrs">' + SL.icon("qr", 16) + " QR codes</button>" : "") +
            '<button class="icon-btn" data-action="reset-demo" aria-label="Reset demo data" title="Reset demo data">' + SL.icon("refresh", 19) + "</button>" +
          "</div>" +
        "</header>" +
        '<div class="admin-content">' + (subtitle ? '<p class="admin-subtitle">' + SL.escapeHtml(subtitle) + "</p>" : "") + content + "</div>" +
      "</div>" +
      "</div>";
  };
})();
