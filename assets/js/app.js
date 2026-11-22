/* ShoeLucky — API-driven frontend.
 * Customer and admin rules are enforced by server.py (SQLite).
 * Auth providers are config-driven; this file contains no security decisions.
 */
(function () {
  'use strict';

  var SHOP_KEY = 'sl_shop', TOKEN_KEY = 'sl_token', ADMIN_KEY = 'sl_admin_token', DEVICE_KEY = 'sl_device';

  var ICONS = {
    back: '<path d="M19 12H5"/><path d="m12 19-7-7 7-7"/>',
    arrow: '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
    wheel: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="2"/><path d="M12 3v7"/><path d="m19 7-5 4"/><path d="m19 17-5-4"/>',
    gift: '<rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v9h14v-9"/><path d="M12 8v13"/><path d="M12 8S9.5 3 7 4.5 8.5 8 12 8Z"/><path d="M12 8s2.5-5 5-3.5S15.5 8 12 8Z"/>',
    ticket: '<path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V7Z"/><path d="M13 7v10" stroke-dasharray="2 2"/>',
    phone: '<rect x="6" y="2" width="12" height="20" rx="2"/><path d="M10 18h4"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6 8-6s8 2 8 6"/>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M15 9V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h4"/>',
    check: '<path d="m5 13 4 4L19 7"/>',
    lock: '<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 9v5M12 17.5h.01"/>',
    chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
    shop: '<path d="M3 9 5 4h14l2 5"/><path d="M5 9v11h14V9"/><path d="M4 9h16"/><path d="M10 20v-6h4v6"/>',
    scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M20 8V5a1 1 0 0 0-1-1h-3M4 16v3a1 1 0 0 0 1 1h3M20 16v3a1 1 0 0 1-1 1h-3"/><path d="M4 12h16"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    refresh: '<path d="M20 11a8 8 0 1 0-2.3 6"/><path d="M20 5v6h-6"/>'
  };

  function icon(name, size) {
    return '<svg class="icon" width="' + (size || 18) + '\" height=\"' + (size || 18) +
      '\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" stroke-linecap=\"round\" stroke-linejoin=\"round\" aria-hidden=\"true\">' +
      (ICONS[name] || ICONS.gift) + '</svg>';
  }
  function esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/\"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function timeUntilMidnight() {
    var now = new Date();
    var end = new Date(now);
    end.setHours(24, 0, 0, 0);
    var mins = Math.max(1, Math.floor((end - now) / 60000));
    var h = Math.floor(mins / 60), m = mins % 60;
    return (h ? h + 'h ' : '') + m + 'm';
  }
  function contactOf(user) {
    if (!user) return '';
    return user.email || user.phone || '';
  }
  function providerLabel(provider) {
    if (provider === 'google') return 'Google';
    if (provider === 'google-local') return 'Google (local)';
    return 'Mobile';
  }
  function getDevice() {
    var d = localStorage.getItem(DEVICE_KEY);
    if (!d) { d = 'DEV-' + Math.random().toString(36).slice(2, 12).toUpperCase(); localStorage.setItem(DEVICE_KEY, d); }
    return d;
  }

  /* ---------------- API ---------------- */
  var token = localStorage.getItem(TOKEN_KEY) || '';
  var adminToken = localStorage.getItem(ADMIN_KEY) || '';
  var device = getDevice();

  // Backend origin for the static frontend (Vercel). Replace if your Render
  // service has a different URL. On the backend host and localhost we stay
  // same-origin so the app also works when served by server_flask.py.
  var API_ORIGIN = 'https://shoelucky.onrender.com';
  function apiBase() {
    var host = location.hostname;
    if (!host || host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return '/api';
    if (/\.onrender\.com$/i.test(host)) return '/api'; // backend serves the frontend
    return API_ORIGIN.replace(/\/$/, '') + '/api';
  }

  async function api(method, path, data, admin) {
    var headers = {};
    var t = admin ? adminToken : token;
    if (t) headers.Authorization = 'Bearer ' + t;
    if (data !== undefined) headers['Content-Type'] = 'application/json';
    var res;
    try {
      res = await fetch(apiBase() + path, {
        method: method, headers: headers,
        body: data === undefined ? undefined : JSON.stringify(data)
      });
    } catch (e) {
      throw new Error('Server se connect nahi ho paya (' + apiBase() + '). Backend URL check karein.');
    }
    var out = {};
    try { out = await res.json(); } catch (e) {}
    if (!res.ok) throw new Error(out.error || ('Request failed (' + res.status + ')'));
    return out;
  }

  var state = {
    config: {}, shops: [], rewards: [], me: null, coupons: [], couponTab: 'all',
    admin: null, dash: null, adminCoupons: [], analytics: null, audit: null,
    shopId: localStorage.getItem(SHOP_KEY) || 'SL-SH-001',
    renderSeq: 0
  };

  /* ---------------- routing ---------------- */
  function go(path) {
    if (location.hash === '#' + path) render();
    else location.hash = '#' + path;
  }
  function routePath() { return (location.hash || '#/').slice(1).split('?')[0] || '/'; }

  /* ---------------- shared UI ---------------- */
  function logo(dark) {
    return '<div class="logo"><span class="logo__mark">S</span><span class="logo__text" style="' +
      (dark ? '' : 'color:#fff') + '\">Shoe<span>Lucky</span></span></div>';
  }
  function topbar(title, back) {
    return '<div class="topbar d-flex align-items-center">' +
      (back ? '<button class="icon-btn" data-go=\"' + back + '\" aria-label=\"Back\">' + icon('back', 20) + '</button>' : logo(true)) +
      '<div class="flex-fill"></div>' + (title ? '<h1>' + esc(title) + '</h1>' : '') + '<div class="flex-fill"></div>' +
      (back ? '<button class="icon-btn\" data-act=\"account\" aria-label=\"Account\">' + icon('user', 19) + '</button>' : '<span style=\"width:38px\"></span>') +
      '</div>';
  }
  function bottomNav(active) {
    var items = [
      { id: 'home', label: 'Play', icon: 'wheel', path: '/home' },
      { id: 'coupons', label: 'Coupons', icon: 'ticket', path: '/coupons' }
    ];
    return '<nav class="bottom-nav d-grid">' + items.map(function (i) {
      return '<a class="nav-item ' + (active === i.id ? 'is-active' : '') + '\" data-go=\"' + i.path + '\">' +
        icon(i.icon, 19) + '<span>' + i.label + '</span></a>';
    }).join('') + '</nav>';
  }
  function adminNav(active) {
    var items = [
      { id: 'overview', label: 'Home', icon: 'chart', path: '/admin' },
      { id: 'coupons', label: 'Coupons', icon: 'ticket', path: '/admin/coupons' },
      { id: 'analytics', label: 'Reports', icon: 'chart', path: '/admin/analytics' },
      { id: 'audit', label: 'Activity', icon: 'refresh', path: '/admin/audit' }
    ];
    return '<nav class="bottom-nav admin-nav d-grid">' + items.map(function (i) {
      return '<a class="nav-item ' + (active === i.id ? 'is-active' : '') + '\" data-go=\"' + i.path + '\">' +
        icon(i.icon, 18) + '<span>' + i.label + '</span></a>';
    }).join('') + '</nav>';
  }
  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg; el.classList.add('is-in');
    clearTimeout(toast.t);
    toast.t = setTimeout(function () { el.classList.remove('is-in'); }, 2800);
  }
  function openSheet(title, body, actions) {
    var root = document.getElementById('sheet');
    var acts = (actions || []).map(function (a, i) {
      return '<button class="btn ' + (a.style || 'btn--gold') + '\" data-sheet-action=\"' + (a.key || i) + '\">' + esc(a.label) + '</button>';
    }).join('');
    root.innerHTML = '<div class="sheet__panel"><div class="sheet__head"><h3>' + esc(title) +
      '</h3><button class="icon-btn" data-sheet-close=\"1\">' + icon('close', 18) + '</button></div>' + body +
      (acts ? '<div class="btn-row" style=\"margin-top:16px\">' + acts + '</div>' : '') + '</div>';
    root.classList.add('is-open'); root.setAttribute('aria-hidden', 'false');
    sheetActions = {};
    (actions || []).forEach(function (a, i) { sheetActions[a.key || i] = a.fn; });
  }
  function closeSheet() {
    var root = document.getElementById('sheet');
    root.classList.remove('is-open'); root.setAttribute('aria-hidden', 'true'); sheetActions = {};
  }
  var sheetActions = {};
  var googleScriptPromise = null;

  function loadGoogleGIS() {
    if (window.google && window.google.accounts && window.google.accounts.id) return Promise.resolve();
    if (googleScriptPromise) return googleScriptPromise;
    googleScriptPromise = new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = resolve;
      script.onerror = reject;
      (document.head || document.body).appendChild(script);
    });
    return googleScriptPromise;
  }

  function onGoogleCredential(response) {
    if (!response || !response.credential) { toast('Google sign-in was cancelled'); return; }
    api('POST', '/customer/google', {
      credential: response.credential, deviceId: device, shopId: state.shopId
    }).then(function (res) {
      token = res.token; localStorage.setItem(TOKEN_KEY, token); state.me = null;
      toast('Signed in with Google'); go('/home');
    }).catch(function (err) { toast(err.message); });
  }

  function initGoogleSignIn() {
    if (!state.config.googleClientId) return;
    loadGoogleGIS().then(function () {
      var gis = window.google && window.google.accounts && window.google.accounts.id;
      var host = document.getElementById('google-signin');
      if (!gis || !host) return;
      gis.initialize({
        client_id: state.config.googleClientId,
        callback: onGoogleCredential,
        ux_mode: 'popup'
      });
      host.innerHTML = '';
      var width = Math.min(340, (window.innerWidth || 390) - 72);
      gis.renderButton(host, {
        theme: 'outline', size: 'large', shape: 'pill', width: width, locale: 'en'
      });
    }).catch(function () {
      var host = document.getElementById('google-signin');
      if (host) host.innerHTML = '<div class="google-error">Google sign-in is unavailable right now.</div>';
    });
  }

  function shoeSvg() {
    return '<svg class="hero__shoe" viewBox="0 0 260 140" aria-hidden="true">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4dfa4"/><stop offset=".55" stop-color="#c99b2b"/><stop offset="1" stop-color="#8a6614"/></linearGradient></defs>' +
      '<path d="M20 104c16-2 27-9 36-23l14-22c4-6 10-8 16-5l24 11 27 16c13 7 26 9 42 10 18 2 31 8 39 19 5 7 2 12-7 12H27c-11 0-15-8-7-18Z" fill="url(#g)"/>' +
      '<path d="M17 110h226c6 0 8 5 3 9-3 3-7 4-12 4H27c-9 0-14-5-14-9 0-3 1-4 4-4Z" fill="#f7f5ef"/>' +
      '<path d="M88 70c8 9 12 19 13 30m-4-29c11 10 16 21 17 32m-4-30c12 10 18 21 19 33" stroke="#fff4d2" stroke-width="4" stroke-linecap="round" opacity=".8"/>' +
      '</svg>';
  }

  function confetti() {
    var layer = document.createElement('div'); layer.className = 'confetti';
    var colors = ['#c99b2b', '#f4e7c4', '#ffffff', '#9c7417'];
    for (var i = 0; i < 34; i++) {
      var p = document.createElement('i');
      p.style.left = (Math.random() * 100) + '%';
      p.style.background = colors[i % colors.length];
      p.style.animationDelay = (Math.random() * .4) + 's';
      layer.appendChild(p);
    }
    var host = document.querySelector('.coupon__top');
    if (host) host.appendChild(layer);
  }

  /* ---------------- customer views ---------------- */
  function landing() {
    var opts = state.shops.map(function (s) {
      return '<option value="' + esc(s.id) + '"' + (s.id === state.shopId ? ' selected' : '') + '>' +
        esc(s.name) + ' · ' + esc(s.id) + '</option>';
    }).join('');
    var googleBlock = state.config.googleClientId
      ? '<div class="google-signin" id="google-signin"></div>'
      : '<div class="notice notice--quiet">' + icon('lock', 14) +
        '<span>Sign-in is not configured on this server yet.</span></div>';
    return '<section class="hero">' + logo() +
      '<div class="hero__kicker">ShoeLucky Club · member rewards</div>' +
      '<h1>Play. Win.<span>Save big.</span></h1>' +
      '<p>Your favourite shoe shop, now with a rewards counter. Spin once a day, scratch your weekly card and redeem instant coupons at the counter.</p>' +
      shoeSvg() +
      '<div class="hero__foot">' + icon('check', 13) + ' 1 daily spin · 1 weekly scratch card · instant coupons</div>' +
      '</section>' +
      '<div class="card entry-card">' +
        '<div class="entry-head"><div><p class="eyebrow">Membership</p>' +
          '<h2 class="title">Join in seconds</h2></div><span class="entry-badge">Free</span></div>' +
        '<div class="field" style="margin-bottom:16px"><label>Your shop</label>' +
          '<select class="input" id="shop-select">' + opts + '</select></div>' +
        '<div class="rule-list">' +
          '<div class="rule"><span class="rule__num">1</span><span>New members get <b>1 scratch card per week</b>.</span></div>' +
          '<div class="rule"><span class="rule__num">2</span><span>One <b>spin every day</b>, tracked by number and device.</span></div>' +
          '<div class="rule"><span class="rule__num">3</span><span>Winning coupons are issued instantly and stay valid for <b>7 days</b>.</span></div>' +
        '</div>' +
        googleBlock +
        '<button class="link-btn" data-go="/admin/login" style="width:100%;margin-top:12px">Admin / Shop owner panel →</button>' +
      '</div>' +
      '<p class="center small muted" style="padding:4px 18px 20px">One account per mobile number. Show your coupon code at the counter.</p>';
  }

  function home() {
    var me = state.me || { user: { name: 'Member' }, spinAvailable: false, scratchLeft: 0 };
    var name = (me.user.name || 'Member').split(' ')[0];
    var shop = me.user.shop ? me.user.shop.name : 'ShoeLucky Club';
    var profilePic = me.user.photo || '/assets/images/default-profile.png';
    return '<div class="screen home-screen">' +
      '<div class="topbar d-flex align-items-center">' + logo(true) + '<div class="flex-fill"></div>' +
        '<button class="icon-btn" data-act="account">' + icon('user', 18) + '</button></div>' +
      '<div class="profile-section">' +
        '<div class="profile-avatar"><img src="' + profilePic + '" alt="User"></div>' +
        '<div class="profile-info">' +
          '<h4>' + esc(me.user.name || 'Member') + '</h4>' +
          '<p>' + esc(me.user.shop ? me.user.shop.name : 'ShoeLucky Club') + '</p>' +
        '</div>' +
      '</div>' +
      '<div class="member-card">' +
        '<div class="member-card__top"><span>ShoeLucky Club</span><span class="member-tier">' +
          icon('check', 11) + ' Member</span></div>' +
        '<h2>Hi ' + esc(name) + ' <span>👋</span></h2>' +
        '<p>' + esc(shop) + ' · ' + new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' }) + '</p>' +
        '<div class="member-card__stats">' +
          '<div><strong>' + me.scratchLeft + '</strong><small>Scratch left</small></div>' +
          '<div><strong>' + (me.spinAvailable ? '1' : '0') + '</strong><small>Spins today</small></div>' +
          '<div><strong>' + timeUntilMidnight() + '</strong><small>Resets in</small></div>' +
        '</div>' +
      '</div>' +
      '<div class="section-head"><div><p class="eyebrow">Today’s play</p><h3>Choose a game</h3></div>' +
        '<span class="section-head__line"></span></div>' +
      '<div class="game-grid">' +
        '<button class="game-card game-card--spin" data-go="/spin"' + (me.spinAvailable ? '' : ' disabled') + '>' +
          '<span class="game-card__icon">' + icon('wheel', 23) + '</span>' +
          '<span><strong>Spin the wheel</strong><small>' +
          (me.spinAvailable ? 'Your daily spin is ready' : 'Next spin after midnight') + '</small></span>' +
          '<span class="game-card__arrow">' + icon('arrow', 18) + '</span></button>' +
        '<button class="game-card game-card--scratch" data-go="/scratch"' + (me.scratchLeft > 0 ? '' : ' disabled') + '>' +
          '<span class="game-card__icon">' + icon('gift', 23) + '</span>' +
          '<span><strong>Scratch card</strong><small>' +
          (me.scratchLeft > 0 ? me.scratchLeft + ' card' + (me.scratchLeft > 1 ? 's' : '') + ' left' : 'Weekly card finished. Come back next week.') +
          '</small></span><span class="game-card__arrow">' + icon('arrow', 18) + '</span></button>' +
      '</div>' +
      '<button class="wallet-strip" data-go="/coupons">' + icon('ticket', 18) +
        '<span><strong>My coupons</strong><small>View rewards and codes</small></span>' + icon('arrow', 16) + '</button>' +
      '<div class="info-card card">' +
        '<p class="eyebrow">How it works</p>' +
        '<div class="rule"><span class="rule__num">1</span><span>You get 1 scratch card per week.</span></div>' +
        '<div class="rule"><span class="rule__num">2</span><span>One spin per day, checked by mobile number and device.</span></div>' +
        '<div class="rule"><span class="rule__num">3</span><span>Coupons stay valid for 7 days.</span></div>' +
      '</div>' + bottomNav('home') + '</div>';
  }

  var WHEEL_COLORS = ['#151619', '#c99b2b', '#242529', '#e3c675', '#101114', '#b18420', '#2c2d31', '#d8ad45'];
  var WHEEL_TEXT = ['#f3e9cf', '#17130a', '#fff', '#17130a', '#fff', '#17130a', '#fff', '#17130a'];
  var spinRotation = 0, spinning = false, scratchDone = false;

  function spin() {
    if (!state.me || !state.me.spinAvailable) {
      return '<div class="screen">' + topbar('Spin wheel', '/home') +
        '<div class="card center idle-card">' + icon('lock', 34) +
        '<h2 class="title" style="margin-top:12px">Today’s spin is used</h2>' +
        '<p class="subtitle">Your next spin unlocks after midnight. Come back tomorrow for another chance.</p>' +
        '<div class="pill pill--gold">' + icon('wheel', 13) + ' Resets in ' + timeUntilMidnight() + '</div>' +
        '<button class="btn btn--gold" data-go="/home" style="margin-top:16px">Back to games</button></div>' + bottomNav('home') + '</div>';
    }
    var list = state.rewards.length ? state.rewards : [
      { short: '10%' }, { short: '20%' }, { short: '30%' }, { short: '50%' },
      { short: 'B1G1' }, { short: '70%' }, { short: 'B1G2' }, { short: '90%' }
    ];
    var gradient = 'conic-gradient(from 0deg,' + WHEEL_COLORS.map(function (c, i) {
      return c + ' ' + (i * 45) + 'deg ' + ((i + 1) * 45) + 'deg';
    }).join(',') + ')';
    var labels = list.map(function (r, i) {
      var angle = i * 45 + 22.5;
      var rad = (angle - 90) * Math.PI / 180;
      var x = 50 + 36 * Math.cos(rad), y = 50 + 36 * Math.sin(rad);
      return '<span class="wheel-label" style="left:' + x.toFixed(1) + '%;top:' + y.toFixed(1) +
        '%;color:' + WHEEL_TEXT[i] + '">' + esc(r.short) + '</span>';
    }).join('');
    return '<div class="screen spin-screen">' + topbar('Spin wheel', '/home') +
      '<div class="center page-intro"><p class="eyebrow">One spin · every day</p><h2 class="title">Lucky Spin</h2>' +
        '<p class="subtitle">The reward is chosen by the server when you spin.</p></div>' +
      '<div class="wheel-stage"><div class="wheel-glow"></div><div class="wheel-pointer"></div>' +
        '<div class="wheel-rim"><div class="wheel-disc" id="wheel" style="background:' + gradient + '">' + labels + '</div></div>' +
        '<div class="wheel-hub">SL</div></div>' +
      '<p class="wheel-status" id="wheel-status">Ready to spin</p>' +
      '<button class="btn btn--gold" id="spin-btn" data-act="spin">' + icon('wheel', 18) + ' Spin now</button>' +
      bottomNav('home') + '</div>';
  }

  function scratch() {
    if (!state.me || state.me.scratchLeft <= 0) {
      return '<div class="screen">' + topbar('Scratch card', '/home') +
        '<div class="card center idle-card">' + icon('gift', 34) +
        '<h2 class="title" style="margin-top:12px">All welcome cards used</h2>' +
        '<p class="subtitle">Your 2 welcome scratch cards have been claimed. Check your wallet for the rewards.</p>' +
        '<button class="btn btn--gold" data-go="/home">Back to games</button></div>' + bottomNav('home') + '</div>';
    }
    return '<div class="screen">' + topbar('Scratch card', '/home') +
      '<div class="center page-intro"><p class="eyebrow">Welcome card ' + state.me.scratchLeft +
        ' of 2</p><h2 class="title">Scratch & reveal</h2>' +
        '<p class="subtitle">Scratch the foil to reveal your reward.</p></div>' +
      '<div class="scratch-card" id="scratch-card">' +
        '<div class="scratch-prize"><small>You won</small><strong id="prize-short">?</strong><span id="prize-label">Reveal to see</span></div>' +
        '<canvas class="scratch-canvas" id="scratch-canvas"></canvas>' +
        '<div class="scratch-hint"><strong>SCRATCH HERE</strong><small>Use your finger or mouse</small></div>' +
      '</div>' +
      '<div class="progress"><span id="scratch-progress"></span></div>' +
      '<button class="btn btn--ghost" data-act="reveal">Reveal card</button>' +
      bottomNav('home') + '</div>';
  }

  function win(id) {
    var c = state.coupons.find(function (x) { return x.id === id; });
    if (!c) {
      return '<div class="screen">' + topbar('Coupon', '/coupons') +
        '<div class="card center"><p class="subtitle">Loading coupon…</p></div>' + bottomNav('coupons') + '</div>';
    }
    return '<div class="screen win-screen">' + topbar('You won', '/home') +
      '<div class="win-head"><span class="win-seal">' + icon('check', 22) + '</span>' +
        '<p class="eyebrow">Reward unlocked</p><h2 class="title">Nice win!</h2></div>' +
      '<div class="card coupon">' +
        '<div class="coupon__top"><div class="coupon__label">Reward coupon · ' + esc(c.source) + '</div>' +
          '<strong class="coupon__value">' + esc(c.short) + '</strong><div>' + esc(c.label) + '</div></div>' +
        '<div class="coupon__body"><div class="coupon__code">' + esc(c.code) + '</div>' +
          '<div class="coupon__meta">' +
            '<div class="meta-cell"><small>Issued</small><strong>' + esc(fmtDate(c.issuedAt)) + '</strong></div>' +
            '<div class="meta-cell"><small>Valid till</small><strong>' + esc(fmtDate(c.expiresAt)) + '</strong></div>' +
          '</div>' +
          '<div class="btn-row" style="margin-top:16px">' +
            '<button class="btn btn--gold" data-act="copy-code" data-code="' + esc(c.code) + '">' + icon('copy', 16) + ' Copy code</button>' +
            '<button class="btn btn--ghost" data-go="/home">Back to games</button>' +
          '</div></div></div>' +
      '<div class="notice notice--quiet" style="margin-top:14px">' + icon('ticket', 15) +
        '<span>Show this code at the shop counter before it expires.</span></div>' +
      bottomNav('home') + '</div>';
  }

  function coupons() {
    var all = state.coupons || [];
    var tab = state.couponTab || 'all';
    var list = all.filter(function (c) {
      if (tab === 'active') return c.status === 'active';
      if (tab === 'redeemed') return c.status !== 'active';
      return true;
    });
    var tabs = [['all', 'All'], ['active', 'Active'], ['redeemed', 'Redeemed']].map(function (t) {
      return '<button class="tab ' + (tab === t[0] ? 'is-active' : '') + '" data-act="tab" data-tab="' + t[0] + '">' +
        t[1] + '</button>';
    }).join('');
    return '<div class="screen wallet-screen">' +
      '<div class="topbar d-flex align-items-center">' + logo(true) + '<div class="flex-fill"></div>' +
        '<h1>My coupons</h1><div class="flex-fill"></div><span style="width:38px"></span></div>' +
      '<div class="between wallet-head"><div><p class="eyebrow">Coupon wallet</p>' +
        '<h2 class="title" style="margin:0">Your rewards</h2></div><span class="pill pill--gold">' + all.length + ' total</span></div>' +
      '<div class="tabs">' + tabs + '</div>' +
      (list.length ? list.map(function (c) {
        return '<button class="coupon-item" data-go="/win/' + c.id + '">' +
          '<span class="coupon-item__icon">' + esc(c.short.slice(0, 2)) + '</span>' +
          '<span><strong>' + esc(c.label) + '</strong><small>' + esc(c.code) + ' · ' + esc(c.source) + '</small></span>' +
          '<span class="status ' + (c.status === 'active' ? '' : 'status--used') + '">' +
            esc(c.status === 'active' ? 'Active' : 'Redeemed') + '</span></button>';
      }).join('') : '<div class="card center empty-wallet">' + icon('ticket', 30) +
        '<p class="subtitle" style="margin-top:10px">No coupons here yet. Play a game to win one.</p>' +
        '<button class="btn btn--gold" data-go="/home">Play now</button></div>') +
      bottomNav('coupons') + '</div>';
  }

  /* ---------------- admin views ---------------- */
  function adminShell(title, active, content, subtitle) {
    var a = state.admin || { name: 'Admin', role: 'shop_owner' };
    return '<div class=\"screen admin-screen\">' +
      '<div class=\"topbar d-flex align-items-center admin-topbar\">' + logo(true) +
        '<div class="flex-fill"></div><div class="topbar__title\"><p class="eyebrow">' +
          (a.role === 'super_admin' ? 'Super Admin' : 'Shop Owner') + '</p><h1>' + esc(title) + '</h1></div>' +
        '<div class="flex-fill"></div><button class="icon-btn" data-act="admin-logout" title="Sign out">' + icon('lock', 18) + '</button></div>' +
      (subtitle ? '<p class=\"admin-subtitle\">' + esc(subtitle) + '</p>' : '') + content +
      adminNav(active) + '</div>';
  }

  function adminLogin() {
    var setup = state.config.devCredentials;
    var firstEmail = setup && setup.accounts.length ? setup.accounts[0].email : '';
    var setupBlock = setup
      ? '<div class="divider"></div><div class="setup-head"><p class="eyebrow">Local setup accounts</p>' +
        '<span class="small muted">Password: ' + esc(setup.password) + '</span></div>' +
        setup.accounts.map(function (c) {
          return '<button class="setup-cred" data-act="fill-admin" data-email="' + esc(c.email) +
            '" data-password="' + esc(setup.password) + '">' +
            '<strong>' + esc(c.label) + '</strong><span>' + esc(c.email) + '</span>' + icon('arrow', 14) + '</button>';
        }).join('') +
        '<div class="notice notice--quiet" style="margin-top:12px">' + icon('lock', 14) +
        '<span>Passwords are hashed and every permission check runs on the server.</span></div>'
      : '';
    return '<div class="screen screen--tight">' + topbar('Admin login', '/') +
      '<div class="card auth-card admin-login-card" style="margin-top:8px">' +
        '<div class="game-card__icon" style="margin-bottom:14px">' + icon('lock', 22) + '</div>' +
        '<h2 class="title">Admin / Shop owner</h2>' +
        '<p class="subtitle">Sign in to manage coupons, reports and your shop.</p>' +
        '<form data-form="admin-login">' +
          '<div class="field"><label>Email</label><input class="input" name="email" type="email" value="' +
            esc(firstEmail) + '" autocomplete="username" required /></div>' +
          '<div class="field"><label>Password</label><input class="input" name="password" type="password" autocomplete="current-password" required /></div>' +
          '<button class="btn btn--dark" type="submit">' + icon('lock', 17) + ' Sign in to panel</button>' +
        '</form>' + setupBlock +
      '</div></div>';
  }

  function adminDashboard() {
    var d = state.dash || { stats: {}, recent: [], role: 'shop_owner' };
    var s = d.stats || {};
    var isSuper = d.role === 'super_admin';
    var stats = [
      ['Shops', s.shops || 0, 'shop'], ['Players', s.players || 0, 'user'],
      ['Coupons', s.coupons || 0, 'ticket'], ['Redeemed', s.redeemed || 0, 'check']
    ];
    return adminShell('Overview', 'overview',
      '<div class="console-strip"><span class="live-dot"></span>' +
        '<div><strong>' + (isSuper ? 'All shops' : 'Your shop') + '</strong><small>Live data · server enforced</small></div>' +
        '<span class="console-scope">' + esc(state.admin ? state.admin.name : 'Admin') + '</span></div>' +
      '<div class="stat-grid">' + stats.map(function (x) {
        return '<div class="stat"><span class="stat__icon">' + icon(x[2], 17) + '</span>' +
          '<strong>' + x[1] + '</strong><small>' + x[0] + '</small></div>';
      }).join('') + '</div>' +
      '<div class="admin-card card"><div class="admin-card__head"><div><h3>Quick actions</h3>' +
        '<p>Most used operator tools</p></div></div>' +
        '<div class="chip-row">' +
          '<button class="btn btn--gold btn-sm" data-go="/admin/coupons">' + icon('scan', 15) + ' Redeem coupon</button>' +
          '<button class="btn btn--ghost btn-sm" data-go="/admin/analytics">' + icon('chart', 15) + ' Reports</button>' +
          (isSuper ? '<button class="btn btn--ghost btn-sm" data-go="/admin/shops">' + icon('shop', 15) + ' Manage shops</button>' +
            '<button class="btn btn--ghost btn-sm" data-go="/admin/rewards">' + icon('gift', 15) + ' Reward weights</button>' : '') +
        '</div></div>' +
      '<div class="admin-card card"><div class="admin-card__head"><div><h3>Recent coupons</h3>' +
        '<p>Latest records in your scope</p></div><button class="text-btn" data-go="/admin/coupons">View all →</button></div>' +
        (d.recent && d.recent.length ? '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>Code</th><th>Reward</th><th>Status</th><th>Date</th></tr></thead><tbody>' +
          d.recent.map(function (c) {
            return '<tr><td class="mono">' + esc(c.code) + '</td><td>' + esc(c.label) + '</td><td>' + statusPill(c.status) +
              '</td><td>' + esc(fmtDate(c.issuedAt)) + '</td></tr>';
          }).join('') + '</tbody></table></div>' : '<div class="empty-line">' + icon('ticket', 20) +
          '<span>No coupons yet. They will appear here after the first win.</span></div>') + '</div>',
      isSuper ? 'Super Admin · all shops' : 'Shop Owner · your shop only');
  }

  function statusPill(s) {
    var active = s === 'active';
    return '<span class="status ' + (active ? '' : 'status--used') + '">' +
      (active ? 'Active' : 'Redeemed') + '</span>';
  }

  function adminShops() {
    var d = state.dash || { shops: [] };
    var shops = d.shops || [];
    return adminShell('Shops', 'overview',
      '<div class="admin-card card"><div class="admin-card__head"><div><h3>Shop directory</h3>' +
        '<p>Shop IDs define each store’s data scope</p></div><span class="pill pill--gold">' +
        shops.length + ' active</span></div>' +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Shop</th><th>Shop ID</th><th>Area</th><th>Status</th></tr></thead><tbody>' +
        shops.map(function (s) {
          return '<tr><td><strong>' + esc(s.name) + '</strong></td><td class="mono">' + esc(s.id) +
            '</td><td>' + esc(s.area || '—') + '</td><td>' + statusPill(s.status) + '</td></tr>';
        }).join('') + '</tbody></table></div></div>' +
      '<div class="admin-card card"><div class="admin-card__head"><div><h3>Add a shop</h3>' +
        '<p>New shops become selectable on the customer page</p></div></div>' +
        '<form data-form="create-shop" class="form-grid">' +
          '<div class="field"><label>Shop name</label><input class="input" name="name" placeholder="Runway Kicks" required /></div>' +
          '<div class="field"><label>Area</label><input class="input" name="area" placeholder="Main Road" /></div>' +
          '<div class="field field--full"><label>Owner</label><input class="input" name="owner" placeholder="Owner name" /></div>' +
          '<button class="btn btn--gold" type="submit">' + icon('plus', 16) + ' Create shop</button>' +
        '</form></div>', 'Super Admin only');
  }

  function adminCoupons() {
    var list = state.adminCoupons || [];
    var active = list.filter(function (c) { return c.status === 'active'; }).length;
    return adminShell('Coupons', 'coupons',
      '<div class="admin-card card redeem-card"><div class="admin-card__head"><div><h3>Redeem coupon</h3>' +
        '<p>Shop, expiry and double-use are checked on the server</p></div>' + icon('scan', 20) + '</div>' +
        '<form data-form="redeem" class="redeem-row">' +
          '<div class="redeem-row__info">' +
            '<input class="input mono" name="code" placeholder="SL-XXXXXX" autocomplete="off" required />' +
            '<div class="redeem-row__hint small">Server validates shop, expiry & double-use</div>' +
          '</div>' +
          '<button class="btn btn--gold" type="submit">' + icon('check', 16) + ' Verify & Redeem</button>' +
        '</form></div>' +
      '<div class="admin-card card"><div class="admin-card__head"><div><h3>Coupon records</h3>' +
        '<p>' + list.length + ' total · ' + active + ' active</p></div></div>' +
        (list.length ? '<div class="table-wrap"><table class="table"><thead><tr>' +
          '<th>Code</th><th>Reward</th><th>Customer</th><th>Status</th><th>Verified</th></tr></thead><tbody>' +
          list.map(function (c) {
            var verified = c.redeemedAt ? '<span class="status--used">Redeemed</span>' : '<span class="status">Active</span>';
            return '<tr><td class="mono">' + esc(c.code) + '</td><td>' + esc(c.label) + '</td><td>' +
              esc(c.userName || '—') + '</td><td>' + statusPill(c.status) + '</td><td>' + verified + '</td></tr>';
          }).join('') + '</tbody></table></div>' : '<div class="empty-line">' + icon('ticket', 20) +
          '<span>No coupons in this scope yet.</span></div>') + '</div>');
  }

  function adminRewards() {
    var list = state.rewards || [];
    var total = list.reduce(function (sum, r) { return sum + (Number(r.weight) || 0); }, 0) || 1;
    return adminShell('Rewards', 'overview',
      '<div class="admin-card card"><div class="admin-card__head"><div><h3>Reward weights</h3>' +
        '<p>Chance is calculated from the total weight on every server draw</p></div>' +
        '<span class="pill pill--gold">' + list.length + ' rewards</span></div>' +
        list.map(function (r) {
          var chance = Math.round(((Number(r.weight) || 0) / total) * 100);
          return '<form data-form="reward" data-id="' + esc(r.id) + '" class="reward-row">' +
            '<div class="reward-row__name"><strong>' + esc(r.label) + '</strong><small class="mono">' +
              esc(r.id) + ' · ' + chance + '% chance</small></div>' +
            '<input class="input" name="weight" type="number" min="0" max="100" value="' + r.weight + '" aria-label="Weight for ' + esc(r.label) + '" />' +
            '<button class="btn btn--ghost btn-sm" type="submit">Save</button></form>';
        }).join('') + '</div>' +
      '<div class="notice">' + icon('alert', 15) +
        '<span>Changes apply to new draws immediately. Rewards marked ineligible never appear on scratch cards.</span></div>',
      'Super Admin only');
  }

  function adminAnalytics() {
    var a = state.analytics || { byReward: {}, daily: [], players: 0, coupons: 0 };
    var max = Math.max.apply(null, [1].concat((a.daily || []).map(function (d) { return d.plays || 0; })));
    var entries = Object.keys(a.byReward || {});
    var maxReward = Math.max.apply(null, [1].concat(entries.map(function (k) { return a.byReward[k] || 0; })));
    return adminShell('Reports', 'analytics',
      '<div class="console-strip"><span class="live-dot"></span>' +
        '<div><strong>Last 7 days</strong><small>Generated from the server database</small></div></div>' +
      '<div class="stat-grid">' +
        '<div class="stat"><strong>' + (a.players || 0) + '</strong><small>Players</small></div>' +
        '<div class="stat"><strong>' + (a.coupons || 0) + '</strong><small>Coupons</small></div>' +
      '</div>' +
      '<div class="admin-card card"><div class="admin-card__head"><div><h3>Plays · last 7 days</h3>' +
        '<p>Daily spin + scratch activity</p></div></div>' +
        '<div class="chart-bars">' + (a.daily || []).map(function (d) {
          return '<div class="chart-bar"><span class="chart-bar__fill" style="height:' +
            Math.max(6, ((d.plays || 0) / max) * 100) + '%"></span><small>' + esc(d.day) + '</small></div>';
        }).join('') + '</div></div>' +
      '<div class="admin-card card"><div class="admin-card__head"><div><h3>Reward distribution</h3>' +
        '<p>What players have won so far</p></div></div>' +
        (entries.length ? entries.map(function (k) {
          return '<div class="dist-row"><div class="between"><span>' + esc(k) + '</span><strong>' +
            a.byReward[k] + '</strong></div><span class="dist-bar"><i style="width:' +
            Math.max(5, ((a.byReward[k] || 0) / maxReward) * 100) + '%"></i></span></div>';
        }).join('') : '<div class="empty-line">' + icon('chart', 20) +
          '<span>No plays recorded yet.</span></div>') + '</div>');
  }

  function adminAudit() {
    var ev = state.audit || [];
    return adminShell('Activity', 'audit',
      '<div class="admin-card card"><div class="admin-card__head"><div><h3>Audit log</h3>' +
        '<p>Server-side record of important actions</p></div><span class="pill">' + ev.length + ' events</span></div>' +
        (ev.length ? ev.map(function (e) {
          return '<div class="log-row"><span class="log-dot"></span><div class="log-row__body">' +
            '<div class="between"><strong>' + esc(e.action) + '</strong><small>' + esc(fmtDate(e.at)) + '</small></div>' +
            '<span>' + esc(e.actor) + '</span></div></div>';
        }).join('') : '<div class="empty-line">' + icon('refresh', 20) +
          '<span>No activity recorded yet.</span></div>') + '</div>');
  }

  /* ---------------- game actions ---------------- */
  async function doSpin(btn) {
    if (spinning) return;
    spinning = true; btn.disabled = true; btn.innerHTML = 'Choosing…';
    var status = document.getElementById('wheel-status');
    if (status) status.textContent = 'Server se reward aa raha hai…';
    try {
      var res = await api('POST', '/customer/spin');
      var index = Math.max(0, Math.min(7, res.rewardIndex || 0));
      var seg = 360 / 8, centre = index * seg + seg / 2;
      var desired = ((360 - centre) + 360) % 360;
      var delta = desired - (spinRotation % 360);
      if (delta < 0) delta += 360;
      spinRotation += 360 * 6 + delta;
      var wheel = document.getElementById('wheel');
      if (wheel) wheel.style.transform = 'rotate(' + spinRotation + 'deg)';
      cacheCoupon(res.coupon);
      // Show the new coupon code for a moment
      toast('New coupon won: ' + res.coupon.code);
      setTimeout(function () { go('/win/' + res.coupon.id); }, 4300);
    } catch (e) {
      toast(e.message); spinning = false; btn.disabled = false; btn.innerHTML = 'Spin again';
    }
  }

  function cacheCoupon(c) {
    if (!state.coupons.some(function (x) { return x.id === c.id; })) state.coupons.unshift(c);
  }

  async function finishScratch(card) {
    if (scratchDone) return;
    scratchDone = true;
    try {
      var res = await api('POST', '/customer/scratch');
      var s = document.getElementById('prize-short'), l = document.getElementById('prize-label');
      if (s) s.textContent = res.coupon.short;
      if (l) l.textContent = res.coupon.label;
      var bar = document.getElementById('scratch-progress');
      if (bar) bar.style.width = '100%';
      if (card) card.classList.add('is-open');
      cacheCoupon(res.coupon);
      state.me.scratchLeft = res.scratchLeft;
      toast('You won ' + res.coupon.label + '!');
      setTimeout(function () { go('/win/' + res.coupon.id); }, 750);
    } catch (e) {
      toast(e.message); scratchDone = false;
    }
  }

  function initScratch() {
    var canvas = document.getElementById('scratch-canvas');
    if (!canvas) return;
    var card = document.getElementById('scratch-card');
    scratchDone = false;
    var rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    var dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
    var ctx = canvas.getContext('2d', { willReadFrequently: true });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var w = rect.width, h = rect.height;
    var g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#d8d4ca'); g.addColorStop(.45, '#f2eee4'); g.addColorStop(1, '#bdb8ab');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,.05)';
    for (var x = -h; x < w; x += 8) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + h, h); ctx.stroke(); }
    var drawing = false;
    function pos(e) {
      var r = canvas.getBoundingClientRect(), t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    }
    function scratch(e) {
      if (!drawing || scratchDone) return;
      e.preventDefault();
      var p = pos(e);
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath(); ctx.arc(p.x, p.y, 22, 0, Math.PI * 2); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      var data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      var clear = 0, total = 0;
      for (var i = 3; i < data.length; i += 160) { total++; if (data[i] < 60) clear++; }
      var pct = total ? clear / total : 0;
      var bar = document.getElementById('scratch-progress');
      if (bar) bar.style.width = Math.min(100, Math.round(pct * 230)) + '%';
      if (pct > .34) finishScratch(card);
    }
    function down(e) { drawing = true; scratch(e); }
    function up() { drawing = false; }
    canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', scratch);
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointerleave', up);
    canvas.addEventListener('touchstart', down, { passive: false });
    canvas.addEventListener('touchmove', scratch, { passive: false });
    canvas.addEventListener('touchend', up);
  }

  /* ---------------- render ---------------- */
  async function render() {
    var seq = ++state.renderSeq;
    var path = routePath();
    var html = '';
    try {
      if (path === '/') html = landing();
      else if (path === '/home') {
        if (!token) { go('/'); return; }
        state.me = await api('GET', '/customer/me');
        if (seq !== state.renderSeq) return;
        html = home();
      } else if (path === '/spin') {
        if (!token) { go('/'); return; }
        if (!state.me) state.me = await api('GET', '/customer/me');
        if (seq !== state.renderSeq) return;
        spinRotation = 0; spinning = false;
        html = spin();
      } else if (path === '/scratch') {
        if (!token) { go('/'); return; }
        if (!state.me) state.me = await api('GET', '/customer/me');
        if (seq !== state.renderSeq) return;
        html = scratch();
      } else if (path === '/coupons' || path.indexOf('/win/') === 0) {
        if (!token) { go('/'); return; }
        state.coupons = (await api('GET', '/customer/coupons')).coupons;
        if (seq !== state.renderSeq) return;
        html = path === '/coupons' ? coupons() : win(path.split('/')[2]);
      } else if (path === '/admin/login') {
        html = adminLogin();
      } else if (path.indexOf('/admin') === 0) {
        if (!adminToken) { go('/admin/login'); return; }
        try {
          state.dash = await api('GET', '/admin/overview', undefined, true);
          if (seq !== state.renderSeq) return;
          state.admin = { name: 'Admin', role: state.dash.role };
          if (path === '/admin/shops') {
            if (state.dash.role !== 'super_admin') { go('/admin'); return; }
            html = adminShops();
          } else if (path === '/admin/rewards') {
            if (state.dash.role !== 'super_admin') { go('/admin'); return; }
            state.rewards = (await api('GET', '/admin/rewards', undefined, true)).rewards;
            if (seq !== state.renderSeq) return;
            html = adminRewards();
          } else if (path === '/admin/coupons') {
            state.adminCoupons = (await api('GET', '/admin/coupons', undefined, true)).coupons;
            if (seq !== state.renderSeq) return;
            html = adminCoupons();
          } else if (path === '/admin/analytics') {
            state.analytics = await api('GET', '/admin/analytics', undefined, true);
            if (seq !== state.renderSeq) return;
            html = adminAnalytics();
          } else if (path === '/admin/audit') {
            state.audit = (await api('GET', '/admin/audit', undefined, true)).events;
            if (seq !== state.renderSeq) return;
            html = adminAudit();
          } else html = adminDashboard();
        } catch (e) {
          if (e.message.indexOf('Admin') >= 0 || e.message.indexOf('expired') >= 0) {
            adminToken = ''; localStorage.removeItem(ADMIN_KEY); go('/admin/login'); return;
          }
          throw e;
        }
      } else { go('/'); return; }
    } catch (e) {
      html = '<div class="screen"><div class="card center" style="margin-top:40px">' + icon('alert', 32) +
        '<h2 class="title" style="margin-top:12px">Error</h2><p class="subtitle">' + esc(e.message) +
        '</p><button class="btn btn--gold" data-go="/">Back</button></div></div>';
    }
    var app = document.getElementById('app');
    app.innerHTML = html;
    window.scrollTo(0, 0);
    if (path === '/') initGoogleSignIn();
    if (path === '/scratch') initScratch();
    if (path.indexOf('/win/') === 0 && document.querySelector('.coupon__top')) confetti();
    if (path === '/') {
      var sel = document.getElementById('shop-select');
      if (sel) sel.addEventListener('change', function () {
        state.shopId = sel.value; localStorage.setItem(SHOP_KEY, sel.value);
        if (token) { token = ''; localStorage.removeItem(TOKEN_KEY); state.me = null; }
        toast('Shop changed to ' + sel.options[sel.selectedIndex].text.split(' · ')[0]);
      });
    }
  }

  /* ---------------- events ---------------- */
  document.addEventListener('click', function (e) {
    var close = e.target.closest('[data-sheet-close]');
    if (close) { closeSheet(); return; }
    var sa = e.target.closest('[data-sheet-action]');
    if (sa && sheetActions[sa.getAttribute('data-sheet-action')]) {
      sheetActions[sa.getAttribute('data-sheet-action')](); return;
    }
    var nav = e.target.closest('[data-go]');
    if (nav) { go(nav.getAttribute('data-go')); return; }
    var act = e.target.closest('[data-act]');
    if (!act) return;
    var name = act.getAttribute('data-act');
    if (name === 'tab') { state.couponTab = act.getAttribute('data-tab') || 'all'; render(); return; }
    if (name === 'copy-code') copy(act.getAttribute('data-code') || '');
    if (name === 'spin') doSpin(act);
    if (name === 'reveal') finishScratch(document.getElementById('scratch-card'));
    if (name === 'account') {
      var user = state.me ? state.me.user : null;
      var shopName = user && user.shop ? user.shop.name : 'ShoeLucky Club';
      openSheet('Account', '<div class="account-head">' + icon('user', 24) +
        '<div><strong>' + esc(user ? user.name : 'Guest') + '</strong><span>' +
        esc(user ? contactOf(user) : '') + '</span></div></div>' +
        '<div class="account-rows"><div class="between"><span>Shop</span><strong>' + esc(shopName) + '</strong></div>' +
        '<div class="between"><span>Sign-in method</span><strong>' +
        esc(user ? providerLabel(user.provider) : '—') + '</strong></div></div>',
        [{ label: 'Sign out', key: 'out', style: 'btn--ghost', fn: function () {
          token = ''; localStorage.removeItem(TOKEN_KEY); state.me = null; closeSheet(); go('/');
        } }, { label: 'Close', key: 'close', fn: closeSheet }]);
    }
    if (name === 'fill-admin') {
      var f = document.querySelector('[data-form="admin-login"]');
      if (f) {
        f.elements.email.value = act.getAttribute('data-email') || '';
        f.elements.password.value = act.getAttribute('data-password') || '';
      }
    }
    if (name === 'admin-logout') {
      adminToken = ''; localStorage.removeItem(ADMIN_KEY); state.admin = null; go('/admin/login');
    }
  });

  document.addEventListener('submit', function (e) {
    var form = e.target.closest('[data-form]');
    if (!form) return;
    e.preventDefault();
    var type = form.getAttribute('data-form');

    

    if (type === 'admin-login') {
      api('POST', '/admin/login', {
        email: form.elements.email.value.trim(), password: form.elements.password.value
      }, true).then(function (res) {
        adminToken = res.token; localStorage.setItem(ADMIN_KEY, adminToken);
        state.admin = res.admin; toast('Welcome back, ' + res.admin.name.split(' ')[0]); go('/admin');
      }).catch(function (err) { toast(err.message); });
    }

    if (type === 'create-shop') {
      api('POST', '/admin/shops', {
        name: form.elements.name.value.trim(), area: form.elements.area.value.trim(),
        owner: form.elements.owner.value.trim()
      }, true).then(function () { toast('Shop created'); go('/admin/shops'); })
        .catch(function (err) { toast(err.message); });
    }

    if (type === 'redeem') {
      api('POST', '/admin/redeem', { code: form.elements.code.value.trim() }, true)
        .then(function () { toast('Coupon redeemed ✓'); go('/admin/coupons'); })
        .catch(function (err) { toast(err.message); });
    }

    if (type === 'reward') {
      api('POST', '/admin/rewards', {
        id: form.getAttribute('data-id'), weight: Number(form.elements.weight.value), active: true
      }, true).then(function () { toast('Weight saved'); go('/admin/rewards'); })
        .catch(function (err) { toast(err.message); });
    }
  });

  document.getElementById('sheet').addEventListener('click', function (e) {
    if (e.target.classList.contains('sheet')) closeSheet();
  });
  window.addEventListener('hashchange', render);

  function copy(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast('Copied'); })
        .catch(function () { fallbackCopy(text); });
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    var el = document.createElement('textarea');
    el.value = text; document.body.appendChild(el); el.select();
    try { document.execCommand('copy'); toast('Copied'); } catch (e) { toast('Copy unavailable'); }
    el.remove();
  }

  /* ---------------- boot ---------------- */
  function showFatal(msg) {
    var app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = '<div style="max-width:420px;margin:15vh auto;padding:24px;text-align:center;font-family:system-ui,sans-serif">' +
      '<h2 style="margin:0 0 8px;color:#111">Could not load ShoeLucky</h2>' +
      '<p style="margin:0 0 16px;color:#555">' + esc(msg || 'Unexpected error') + '</p>' +
      '<p style="margin:0 0 16px;color:#777;font-size:13px">API: ' + esc(apiBase()) + '</p>' +
      '<button onclick="location.reload()" style="padding:10px 18px;border:0;border-radius:8px;background:#c99b2b;color:#fff;font-weight:600;cursor:pointer">Retry</button></div>';
  }
  window.addEventListener('error', function (e) { showFatal(e.message); });
  window.addEventListener('unhandledrejection', function (e) {
    showFatal(e.reason && e.reason.message ? e.reason.message : e.reason);
  });

  (async function boot() {
    var apiDown = '';
    try {
      try { state.config = await api('GET', '/config'); } catch (e) { apiDown = e.message; }
      try {
        var d = await api('GET', '/shops');
        state.shops = d.shops || [];
        if (!state.shops.some(function (s) { return s.id === state.shopId; }) && state.shops.length) {
          state.shopId = state.shops[0].id;
        }
      } catch (e) {}
      try { state.rewards = (await api('GET', '/rewards/public')).rewards || []; } catch (e) {}
      await render();
      if (apiDown) {
        var app = document.getElementById('app');
        var bar = document.createElement('div');
        bar.style.cssText = 'padding:10px 14px;background:#fff4d6;color:#7a5a00;font-size:13px;text-align:center';
        bar.textContent = 'Backend unreachable at ' + apiBase() + ' — some features are unavailable.';
        if (app) app.insertBefore(bar, app.firstChild);
      }
    } catch (e) {
      showFatal(e && e.message);
    }
  })();
})();
