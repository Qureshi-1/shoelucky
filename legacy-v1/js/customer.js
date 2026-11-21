/* Customer-facing screens and interactions. */
(function () {
  const SL = window.SL;

  function shopChip(shop) {
    if (!shop) return "";
    return '<button class="shop-context card" data-action="change-shop">' +
      '<span class="shop-context__icon">' + SL.icon("shop", 19) + "</span>" +
      "<span><strong>" + SL.escapeHtml(shop.name) + "</strong><small>" + SL.escapeHtml(shop.id + " · " + shop.area) + "</small></span>" +
      '<span style="margin-left:auto;color:var(--muted)">' + SL.icon("edit", 16) + "</span>" +
      "</button>";
  }

  function openShopModal() {
    const current = SL.currentShop();
    const body = "<p class='muted' style='margin:0 0 14px;font-size:12.5px'>Choose a demo storefront. Each shop has its own ID and QR campaign links.</p>" +
      SL.state.shops.filter((s) => s.status === "active").map((s) =>
        '<button class="shop-option" data-modal-action="choose-shop" data-shop="' + s.id + '" style="background:rgba(255,255,255,.035);border:1px solid var(--line);">' +
          '<span class="shop-option__dot" style="background:' + SL.escapeHtml(s.accent) + '">' + SL.escapeHtml(s.name.charAt(0)) + "</span>" +
          "<span><strong>" + SL.escapeHtml(s.name) + "</strong><small>" + SL.escapeHtml(s.id + " · " + s.area) + "</small></span>" +
          '<span class="shop-option__go">' + (current.id === s.id ? SL.icon("check", 18) : SL.icon("arrowRight", 18)) + "</span>" +
        "</button>"
      ).join("");
    SL.openModal({
      eyebrow: "Demo storefronts",
      title: "Select a shop",
      body: body,
      actions: [{ label: "Close", key: "close", class: "btn-ghost" }],
      handlers: {
        close: SL.closeModal,
        "choose-shop": (el, data) => {
          const shop = SL.shopById(data.shop);
          if (!shop) return;
          SL.state.context.shopId = shop.id;
          SL.state.context.campaignId = null;
          SL.save();
          SL.closeModal();
          SL.toast("Now shopping at " + shop.name, "success");
          SL.navigate("/login");
        }
      }
    });
  }

  SL.views = SL.views || {};

  SL.views.landing = function () {
    const activeShops = SL.state.shops.filter((s) => s.status === "active").length;
    return '<div class="screen">' +
      '<header class="topbar topbar--customer" style="margin:-18px -18px 0">' + SL.logo(true) +
        '<div class="topbar__center"></div><button class="icon-btn" data-action="open-shop-modal" aria-label="Demo shops">' + SL.icon("shop", 19) + "</button></header>" +
      '<section class="hero">' +
        '<div class="hero__badge"><span class="chip chip--gold">' + SL.icon("sparkle", 13) + " Multi-shop rewards prototype</span></div>" +
        '<h1>Scan. Play.<span>Save big.</span></h1>' +
        '<p class="hero__copy">Walk into a partner sneaker shop, scan its QR code, and unlock a surprise discount or buy-one-get-one reward.</p>' +
        '<div class="hero__cta">' +
          '<button class="btn btn-gold" data-nav="/login">' + SL.icon("scan", 18) + " Enter with shop code</button>" +
          '<button class="btn btn-ghost" data-action="open-shop-modal">' + SL.icon("qr", 18) + " Explore demo shops</button>" +
        "</div>" +
        '<div class="hero__mini">' + SL.icon("shield", 14) + " Demo experience · no real purchase required</div>" +
        '<div class="hero__art"><span class="hero__orb"></span>' + SL.shoeArt() + "</div>" +
      "</section>" +
      '<section class="card trust-row">' +
        '<div class="trust-cell"><strong>' + activeShops + "</strong><span>Partner shops</span></div>" +
        '<div class="trust-cell"><strong>9</strong><span>Reward types</span></div>' +
        '<div class="trust-cell"><strong>7 days</strong><span>Coupon validity</span></div>' +
      "</section>" +
      '<div class="section-head"><div><p class="eyebrow">How it works</p><h2>Three steps to a better deal</h2></div></div>' +
      '<section class="card pad">' +
        '<div class="how-step"><span class="how-step__num">01</span><div><h4>Scan the shop QR</h4><p>Every store has a unique shop ID and campaign link.</p></div></div>' +
        '<div class="how-step"><span class="how-step__num">02</span><div><h4>Verify & get your game</h4><p>Demo OTP only. You receive a Spin Wheel or Scratch Card.</p></div></div>' +
        '<div class="how-step"><span class="how-step__num">03</span><div><h4>Claim your coupon</h4><p>Save the reward in your coupon wallet and show it in store.</p></div></div>' +
      "</section>" +
      '<div class="section-head"><div><p class="eyebrow">Possible drops</p><h2>Rewards up for grabs</h2></div></div>' +
      '<section class="reward-grid">' +
        SL.state.rewards.slice(0, 5).map((r) => '<div class="card reward-tile">' + SL.rewardPill(r) + "<strong>" + SL.escapeHtml(r.short) + "</strong><small>or better</small></div>").join("") +
      "</section>" +
      SL.demoNotice("Prototype only: OTP, game outcomes, coupon codes, and redemption are simulated locally. No secure server validation is included.") +
      '<footer class="landing-foot">ShoeLucky · Premium rewards prototype · ' + new Date().getFullYear() + "</footer>" +
      SL.bottomNav("home") +
      "</div>";
  };

  SL.views.login = function (params) {
    if (params && params.shop) {
      const shop = SL.shopById(params.shop);
      if (shop) {
        SL.state.context.shopId = shop.id;
        const campaign = params.campaign && SL.campaignById(params.campaign);
        SL.state.context.campaignId = campaign && campaign.shopId === shop.id ? campaign.id : null;
        SL.save();
      }
    }
    const shop = SL.currentShop();
    return '<div class="screen">' + SL.customerHeader({ back: "/" }) +
      '<div class="auth-art"><div class="auth-art__circle">' + SL.icon("scan", 48) + "</div></div>" +
      '<h1 class="auth-title">Welcome to ShoeLucky</h1>' +
      '<p class="auth-sub">Enter your mobile number to continue with ' + SL.escapeHtml(shop.name) + ".</p>" +
      shopChip(shop) +
      '<form data-form="login">' +
        '<div class="field"><label class="field__label" for="phone">Mobile number</label>' +
          '<div class="input-row"><div class="input-prefix">+1</div><input class="input" id="phone" name="phone" type="tel" inputmode="numeric" autocomplete="tel" placeholder="415 555 0112" value="415 555 0112" /></div>' +
        "</div>" +
        SL.demoNotice("Demo screen: no SMS is sent. Any 6+ digit number works; OTP is shown on the next screen.") +
        '<button class="btn btn-gold btn-block" type="submit" style="margin-top:18px">' + SL.icon("arrowRight", 18) + " Send demo OTP</button>" +
      "</form>" +
      '<p class="assign-alt">By continuing you agree this is a prototype demo, not a real account service.</p>' +
      "</div>";
  };

  SL.views.otp = function () {
    const shop = SL.currentShop();
    const phone = SL.state.pendingPhone || (SL.state.customer && SL.state.customer.phone) || "+1 415 555 0112";
    return '<div class="screen">' + SL.customerHeader({ back: "/login" }) +
      '<div class="auth-art"><div class="auth-art__circle">' + SL.icon("lock", 44) + "</div></div>" +
      '<h1 class="auth-title">Check your messages</h1>' +
      '<p class="auth-sub">We would normally text a code to <strong class="gold">' + SL.escapeHtml(phone) + "</strong> for " + SL.escapeHtml(shop.name) + ".</p>" +
      '<form data-form="otp">' +
        '<div class="otp-row">' +
          [0, 1, 2, 3, 4, 5].map((i) => '<input class="input otp-input" id="otp-' + i + '" data-otp="' + i + '" type="text" inputmode="numeric" maxlength="1" autocomplete="one-time-code" aria-label="OTP digit ' + (i + 1) + '" />').join("") +
        "</div>" +
        '<div class="otp-hint">' + SL.icon("alert", 15) + ' Demo OTP: <strong>123456</strong><br /><span style="color:var(--muted);font-size:11px">This is a UI demo only — it is not real authentication.</span></div>' +
        '<button class="btn btn-gold btn-block" type="submit" style="margin-top:18px">' + SL.icon("check", 18) + " Verify & continue</button>" +
      "</form>" +
      '<div class="timer-line"><button class="text-btn" data-action="resend-otp">' + SL.icon("refresh", 14) + " Resend demo OTP</button><span>01:42</span></div>" +
      "</div>";
  };

  SL.views.game = function () {
    const customer = SL.state.customer;
    if (!customer) return "";
    if (!SL.state.game) SL.state.game = Math.random() < 0.5 ? "spin" : "scratch";
    const isSpin = SL.state.game === "spin";
    const shop = SL.currentShop();
    const campaign = SL.campaignById(SL.state.context.campaignId) || SL.state.campaigns.find((c) => c.shopId === shop.id && c.status === "active");
    return '<div class="screen">' + SL.customerHeader({ title: "Your game" }) +
      '<div class="section-head"><div><p class="eyebrow">Assignment complete</p><h2>Hi, ' + SL.escapeHtml(customer.name.split(" ")[0]) + " 👋</h2><p>Your shop assigned a surprise game.</p></div></div>" +
      '<section class="card card--gold assignment-card">' +
        '<div class="assignment-icon">' + SL.icon(isSpin ? "wheel" : "scratch", 44) + "</div>" +
        '<span class="chip chip--gold">' + (isSpin ? "Spin Wheel" : "Scratch Card") + " assigned</span>" +
        "<h2>" + (isSpin ? "Take a spin" : "Scratch to reveal") + "</h2>" +
        "<p>" + (isSpin ? "Tap the wheel and let luck decide your discount." : "Scratch the gold panel to uncover your hidden reward.") + "</p>" +
        '<div class="assignment-meta">' +
          '<span class="chip">' + SL.icon("shop", 13) + SL.escapeHtml(shop.name) + "</span>" +
          '<span class="chip">' + SL.icon("campaign", 13) + SL.escapeHtml(campaign ? campaign.name : "Demo campaign") + "</span>" +
        "</div>" +
        '<button class="btn btn-gold btn-block" data-nav="' + (isSpin ? "/spin" : "/scratch") + '">' + SL.icon("bolt", 18) + " Play now</button>" +
      "</section>" +
      '<div style="margin-top:14px">' + SL.demoNotice("Game assignment is decided locally for this prototype. A production build must select rewards on the server.") + "</div>" +
      '<button class="btn btn-ghost btn-block" data-nav="/login" style="margin-top:12px">' + SL.icon("shop", 17) + " Use a different shop</button>" +
      SL.bottomNav("game") +
      "</div>";
  };

  SL.views.spin = function () {
    const shop = SL.currentShop();
    return '<div class="screen">' + SL.customerHeader({ back: "/game", title: "Spin the wheel" }) +
      '<div class="section-head"><div><p class="eyebrow">' + SL.escapeHtml(shop.name) + "</p><h2>Lucky Spin</h2><p>One spin per demo session.</p></div>" + SL.rewardPill({ label: "Up to 90%", color: "#18181b", text: "#f6dd8f", type: "discount" }) + "</div>" +
      '<div class="wheel-wrap">' +
        '<div class="wheel-glow"></div><div class="wheel-pointer"></div>' +
        '<div class="wheel-frame"><div class="wheel-inner" id="wheel-inner"><canvas class="wheel-canvas" id="wheel-canvas"></canvas></div></div>' +
        '<div class="wheel-hub"><span>SL</span></div>' +
      "</div>" +
      '<p class="wheel-caption">Rewards shown are demo labels. Outcome is simulated in your browser.</p>' +
      '<button class="btn btn-gold btn-block" id="spin-btn" data-action="spin-now">' + SL.icon("wheel", 18) + " Spin now</button>" +
      '<button class="btn btn-ghost btn-block" data-nav="/game" style="margin-top:10px">Back to assignment</button>' +
      "</div>";
  };

  SL.views.scratch = function () {
    const shop = SL.currentShop();
    if (!SL.state.reward) SL.state.reward = SL.pickReward();
    const reward = SL.state.reward;
    return '<div class="screen">' + SL.customerHeader({ back: "/game", title: "Scratch card" }) +
      '<div class="section-head"><div><p class="eyebrow">' + SL.escapeHtml(shop.name) + "</p><h2>Scratch & win</h2><p>Scratch the panel with your finger or mouse.</p></div></div>" +
      '<div class="scratch-card" id="scratch-card">' +
        '<div class="scratch-prize"><small>You won</small><strong>' + SL.escapeHtml(reward.label) + "</strong><span>Demo reward · " + SL.escapeHtml(shop.name) + "</span></div>" +
        '<canvas class="scratch-canvas" id="scratch-canvas"></canvas>' +
        '<div class="scratch-hint">' + SL.icon("sparkle", 30) + "<strong>SCRATCH HERE</strong><span>Reveal your surprise reward</span></div>" +
      "</div>" +
      '<div class="scratch-progress"><span id="scratch-progress"></span></div>' +
      '<button class="btn btn-gold btn-block" data-action="scratch-reveal">' + SL.icon("eye", 18) + " Reveal instantly (demo)</button>" +
      '<button class="btn btn-ghost btn-block" data-nav="/game" style="margin-top:10px">Back to assignment</button>' +
      "</div>";
  };

  SL.views.win = function () {
    const coupon = SL.state.coupons.find((c) => c.id === SL.state.lastCouponId) || SL.visibleCouponsForCustomer()[0];
    const reward = coupon ? SL.rewardById(coupon.rewardId) : SL.state.reward;
    const shop = coupon ? SL.shopById(coupon.shopId) : SL.currentShop();
    return '<div class="screen">' + SL.customerHeader({ back: "/game", title: "You won" }) +
      '<section class="win-hero"><div class="confetti-layer" id="confetti-layer"></div>' +
        '<div class="win-badge">' + SL.icon("star", 36) + "</div><h1>Congratulations!</h1>" +
        "<p>Your demo reward is ready to save.</p>" +
        '<div class="card card--gold win-reward"><span class="win-reward__label">Your reward</span><strong class="win-reward__value gold">' + SL.escapeHtml(reward ? reward.label : "Surprise") + "</strong>" +
          '<span class="chip chip--gold">' + SL.icon("shop", 13) + SL.escapeHtml(shop ? shop.name : "Demo shop") + "</span></div>" +
      "</section>" +
      '<section class="card coupon-ticket">' +
        '<div class="coupon-code"><div><small>Demo coupon code</small><strong>' + SL.escapeHtml(coupon ? coupon.code : "DEMO-0000") + "</strong></div>" +
          '<button class="mini-btn" data-action="copy-coupon" data-code="' + SL.escapeHtml(coupon ? coupon.code : "") + '" aria-label="Copy coupon code">' + SL.icon("copy", 16) + "</button></div>" +
        '<div class="coupon-qr">' + SL.qrSvg(coupon ? coupon.code : "DEMO", 74) + "</div>" +
      "</section>" +
      '<div class="coupon-meta">' +
        '<div class="card meta-cell"><small>Valid until</small><strong>' + SL.escapeHtml(SL.formatDate(coupon ? coupon.expiresAt : new Date().toISOString())) + "</strong></div>" +
        '<div class="card meta-cell"><small>Shop ID</small><strong>' + SL.escapeHtml(shop ? shop.id : "—") + "</strong></div>" +
        '<div class="card meta-cell"><small>Campaign</small><strong>' + SL.escapeHtml((coupon && SL.campaignById(coupon.campaignId) && SL.campaignById(coupon.campaignId).name) || "Demo") + "</strong></div>" +
        '<div class="card meta-cell"><small>Status</small>' + SL.statusPill(coupon ? coupon.status : "active") + "</div>" +
      "</div>" +
      '<div style="margin-top:16px">' + SL.demoNotice("Demo coupon only. This code has no server validation and is not production-secure. Do not use it for real purchases.") + "</div>" +
      '<button class="btn btn-gold btn-block" data-nav="/history" style="margin-top:16px">' + SL.icon("ticket", 18) + " View coupon wallet</button>" +
      '<button class="btn btn-ghost btn-block" data-nav="/" style="margin-top:10px">Back to home</button>' +
      "</div>";
  };

  SL.views.history = function () {
    const coupons = SL.visibleCouponsForCustomer();
    const filter = SL.state.ui.couponFilter || "all";
    const shown = coupons.filter((c) => filter === "all" || c.status === filter);
    const activeCount = coupons.filter((c) => c.status === "active" && !SL.isExpired(c)).length;
    return '<div class="screen">' + SL.customerHeader({ title: "Coupon wallet" }) +
      '<div class="section-head"><div><p class="eyebrow">Your rewards</p><h2>Coupon history</h2><p>' + activeCount + " active demo coupon" + (activeCount === 1 ? "" : "s") + ".</p></div></div>" +
      '<div class="history-filters">' +
        [["all", "All"], ["active", "Active"], ["redeemed", "Redeemed"], ["expired", "Expired"]].map((f) =>
          '<button class="filter-chip ' + (filter === f[0] ? "is-active" : "") + '" data-action="filter-coupons" data-filter="' + f[0] + '">' + f[1] + "</button>"
        ).join("") +
      "</div>" +
      (shown.length ? shown.map((c) => {
        const reward = SL.rewardById(c.rewardId);
        const shop = SL.shopById(c.shopId);
        return '<button class="card history-item" data-action="view-coupon" data-id="' + c.id + '">' +
          '<span class="history-item__icon">' + SL.icon(reward && reward.type === "bogo" ? "gift" : "ticket", 19) + "</span>" +
          "<span><strong>" + SL.escapeHtml(reward ? reward.label : "Reward") + "</strong><small>" + SL.escapeHtml(shop ? shop.name : "Shop") + " · " + SL.escapeHtml(SL.formatDate(c.issuedAt, { month: "short", day: "numeric" })) + "</small><small class='mono'>" + SL.escapeHtml(c.code) + "</small></span>" +
          SL.statusPill(SL.isExpired(c) && c.status === "active" ? "expired" : c.status) +
          "</button>";
      }).join("") : SL.emptyState("ticket", "No coupons here", "Play a game to unlock your first demo reward.", "Find a game", "/game")) +
      '<div style="margin-top:18px">' + SL.demoNotice("Coupon records are stored locally for this prototype only.") + "</div>" +
      SL.bottomNav("coupons") +
      "</div>";
  };

  SL.views.account = function () {
    const customer = SL.state.customer;
    if (!customer) return "";
    const shop = SL.shopById(customer.shopId) || SL.currentShop();
    const mine = SL.visibleCouponsForCustomer();
    return '<div class="screen">' + SL.customerHeader({ title: "Account" }) +
      '<section class="card pad" style="text-align:center">' +
        '<div class="avatar" style="width:64px;height:64px;margin:0 auto 12px;font-size:24px">' + SL.escapeHtml(customer.name.charAt(0)) + "</div>" +
        '<h2 style="margin:0;font-size:20px">' + SL.escapeHtml(customer.name) + "</h2>" +
        '<p class="muted" style="margin:4px 0 16px;font-size:12.5px">' + SL.escapeHtml(customer.phone) + "</p>" +
        '<div class="chip-row" style="justify-content:center"><span class="chip chip--gold">' + SL.icon("shop", 13) + SL.escapeHtml(shop.name) + '</span><span class="chip">' + SL.icon("ticket", 13) + mine.length + " coupons</span></div>" +
      "</section>" +
      '<section class="card pad" style="margin-top:14px">' +
        '<div class="section-head" style="margin:0 0 10px"><h3>Demo session</h3></div>' +
        '<div class="how-step"><span class="how-step__num">' + SL.icon("shield", 16) + "</span><div><h4>Local demo profile</h4><p>No real account, SMS, or identity verification.</p></div></div>" +
        '<div class="how-step"><span class="how-step__num">' + SL.icon("qr", 16) + "</span><div><h4>Shop ID: " + SL.escapeHtml(shop.id) + "</h4><p>Unique storefront identifier for this demo.</p></div></div>" +
      "</section>" +
      '<button class="btn btn-ghost btn-block" data-nav="/history" style="margin-top:14px">' + SL.icon("ticket", 17) + " Coupon wallet</button>" +
      '<button class="btn btn-ghost btn-block" data-nav="/admin/login" style="margin-top:10px">' + SL.icon("shield", 17) + " Admin demo access</button>" +
      '<button class="btn btn-danger btn-block" data-action="logout-customer" style="margin-top:10px">' + SL.icon("logout", 17) + " Sign out of demo</button>" +
      SL.bottomNav("account") +
      "</div>";
  };

  SL.views.adminLogin = function () {
    const isAdmin = !!SL.state.admin;
    if (isAdmin) {
      setTimeout(() => SL.navigate(SL.state.admin.role === "super_admin" ? "/admin" : "/admin"), 0);
      return '<div class="screen"><div class="center" style="padding-top:80px">' + SL.icon("refresh", 30) + "<p>Redirecting…</p></div></div>";
    }
    return '<div class="screen">' + SL.customerHeader({ back: "/" }) +
      '<div class="auth-art"><div class="auth-art__circle">' + SL.icon("shield", 44) + "</div></div>" +
      '<h1 class="auth-title">Admin access</h1>' +
      '<p class="auth-sub">Demo dashboards for Super Admin and Shop Owners.</p>' +
      '<form data-form="admin-login">' +
        '<div class="field"><label class="field__label" for="admin-email">Email</label><input class="input" id="admin-email" name="email" type="email" value="super@shoelucky.demo" autocomplete="username" /></div>' +
        '<div class="field"><label class="field__label" for="admin-password">Password</label><input class="input" id="admin-password" name="password" type="password" value="demo1234" autocomplete="current-password" /></div>' +
        '<button class="btn btn-gold btn-block" type="submit">' + SL.icon("lock", 17) + " Sign in to demo</button>" +
      "</form>" +
      '<div class="section-head"><h3>Demo credentials</h3></div>' +
      '<div class="card pad">' +
        '<div class="how-step"><span class="how-step__num">SA</span><div><h4>Super Admin</h4><p>super@shoelucky.demo · demo1234<br />Manages all shops.</p></div></div>' +
        '<div class="how-step"><span class="how-step__num">SO</span><div><h4>Shop Owner — Sole Theory</h4><p>owner@soletheory.demo · demo1234<br />Sees only own shop data.</p></div></div>' +
        '<div class="how-step"><span class="how-step__num">SO</span><div><h4>Shop Owner — Kicks & Co.</h4><p>owner@kicksandco.demo · demo1234<br />Sees only own shop data.</p></div></div>' +
      "</div>" +
      SL.demoNotice("Demo login only. There is no real authentication, session, or permission enforcement on a static client.") +
      "</div>";
  };

  /* ---------------- Forms & actions ---------------- */
  SL.forms.login = function (form) {
    const phone = form.elements.phone.value.trim();
    if (phone.replace(/\D/g, "").length < 6) { SL.toast("Enter a valid mobile number", "error"); return; }
    SL.api.requestOtp("+1 " + phone, SL.state.context.shopId, SL.state.context.campaignId).then(() => {
      SL.toast("Demo OTP sent to the screen", "info");
      SL.navigate("/otp");
    });
  };

  SL.forms.otp = function (form) {
    const digits = Array.prototype.map.call(form.querySelectorAll("[data-otp]"), (i) => i.value).join("");
    if (digits.length !== 6) { SL.toast("Enter all 6 demo digits", "error"); return; }
    SL.api.verifyOtp(digits, SL.state.pendingPhone || "+1 415 555 0112").then((res) => {
      if (!res.ok) { SL.toast(res.error, "error"); return; }
      SL.api.assignGame().then(() => {
        SL.toast("Verified with demo OTP", "success");
        SL.navigate("/game");
      });
    });
  };

  SL.forms["admin-login"] = function (form) {
    SL.api.adminLogin(form.elements.email.value, form.elements.password.value).then((res) => {
      if (!res.ok) { SL.toast(res.error, "error"); return; }
      SL.toast("Welcome, " + res.user.name, "success");
      SL.navigate("/admin");
    });
  };

  SL.actions["open-shop-modal"] = function () { openShopModal(); };
  SL.actions["change-shop"] = function () { openShopModal(); };
  SL.actions["resend-otp"] = function () { SL.toast("Demo OTP is still 123456", "info"); };
  SL.actions["filter-coupons"] = function (el, data) { SL.state.ui.couponFilter = data.filter; SL.render(SL.views.history(), { shell: "customer" }); };
  SL.actions["copy-coupon"] = function (el, data) { SL.copy(data.code || ""); };
  SL.actions["logout-customer"] = function () {
    SL.state.customer = null;
    SL.state.game = null;
    SL.state.reward = null;
    SL.save();
    SL.toast("Signed out of demo", "info");
    SL.navigate("/");
  };
  SL.actions["view-coupon"] = function (el, data) {
    const c = SL.state.coupons.find((x) => x.id === data.id);
    if (!c) return;
    const reward = SL.rewardById(c.rewardId);
    const shop = SL.shopById(c.shopId);
    SL.openModal({
      eyebrow: "Demo coupon",
      title: c.code,
      body: '<div class="coupon-ticket"><div class="coupon-code"><div><small>Reward</small><strong>' + SL.escapeHtml(reward ? reward.label : "—") + "</strong></div></div>" +
        '<div class="coupon-qr">' + SL.qrSvg(c.code, 68) + "</div></div>" +
        '<div class="coupon-meta"><div class="card meta-cell"><small>Shop</small><strong>' + SL.escapeHtml(shop ? shop.name : "—") + "</strong></div>" +
        '<div class="card meta-cell"><small>Issued</small><strong>' + SL.escapeHtml(SL.formatDate(c.issuedAt)) + "</strong></div>" +
        '<div class="card meta-cell"><small>Expires</small><strong>' + SL.escapeHtml(SL.formatDate(c.expiresAt)) + "</strong></div>" +
        '<div class="card meta-cell"><small>Status</small>' + SL.statusPill(SL.isExpired(c) && c.status === "active" ? "expired" : c.status) + "</div></div>" +
        '<div style="margin-top:14px">' + SL.demoNotice("Demo record only — no secure validation.") + "</div>",
      actions: [
        { label: "Copy code", key: "copy", class: "btn-ghost" },
        { label: "Close", key: "close", class: "btn-gold" }
      ],
      handlers: {
        copy: () => SL.copy(c.code),
        close: SL.closeModal
      }
    });
  };

  /* ---------------- Wheel ---------------- */
  function drawWheel(canvas) {
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const size = rect.width;
    const cx = size / 2;
    const cy = size / 2;
    const radius = size / 2;
    const rewards = SL.state.rewards;
    const seg = (Math.PI * 2) / rewards.length;
    rewards.forEach((r, i) => {
      const start = -Math.PI / 2 + i * seg;
      const end = start + seg;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, radius - 2, start, end);
      ctx.closePath();
      ctx.fillStyle = r.color;
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,.12)";
      ctx.lineWidth = 1;
      ctx.stroke();

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(start + seg / 2);
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      ctx.fillStyle = r.text || "#fff";
      ctx.font = "800 " + Math.max(11, size * 0.043) + "px Inter, system-ui, sans-serif";
      ctx.fillText(r.short, radius - 18, 0);
      ctx.restore();
    });
    ctx.beginPath();
    ctx.arc(cx, cy, radius - 2, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(246,221,143,.55)";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  SL.redrawWheel = drawWheel;

  SL.spinState = { rotation: 0, spinning: false };
  SL.actions["spin-now"] = function (btn) {
    if (SL.spinState.spinning) return;
    SL.spinState.spinning = true;
    btn.disabled = true;
    btn.innerHTML = SL.icon("refresh", 18) + " Spinning…";
    const reward = SL.pickReward();
    const index = SL.state.rewards.findIndex((r) => r.id === reward.id);
    const seg = 360 / SL.state.rewards.length;
    const center = index * seg + seg / 2;
    const desired = (360 - center + 360) % 360;
    let delta = desired - (SL.spinState.rotation % 360);
    if (delta < 0) delta += 360;
    SL.spinState.rotation += 360 * 6 + delta;
    const inner = document.getElementById("wheel-inner");
    if (inner) inner.style.transform = "rotate(" + SL.spinState.rotation + "deg)";
    const timer = setTimeout(() => {
      SL.issueCoupon(reward.id);
      SL.toast(reward.label + " unlocked (demo)", "success");
      SL.navigate("/win");
    }, 4750);
    SL.addCleanup(() => clearTimeout(timer));
  };

  /* ---------------- Scratch card ---------------- */
  SL.scratchState = { revealed: false, issuing: false };
  function finishScratch(card) {
    if (SL.scratchState.revealed || SL.scratchState.issuing) return;
    SL.scratchState.issuing = true;
    SL.scratchState.revealed = true;
    if (card) card.classList.add("is-revealed");
    const progress = document.getElementById("scratch-progress");
    if (progress) progress.style.width = "100%";
    setTimeout(() => {
      SL.issueCoupon(SL.state.reward ? SL.state.reward.id : null);
      SL.toast("Reward revealed (demo)", "success");
      SL.navigate("/win");
    }, 700);
  }
  SL.actions["scratch-reveal"] = function () { finishScratch(document.getElementById("scratch-card")); };

  function initScratch() {
    const canvas = document.getElementById("scratch-canvas");
    if (!canvas) return;
    const card = document.getElementById("scratch-card");
    SL.scratchState = { revealed: false, issuing: false };
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width;
    const h = rect.height;
    const grad = ctx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, "#d9d5c8");
    grad.addColorStop(0.35, "#f3eedf");
    grad.addColorStop(0.7, "#b8b3a4");
    grad.addColorStop(1, "#e8e2d2");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = "rgba(0,0,0,.06)";
    ctx.lineWidth = 1;
    for (let i = -h; i < w; i += 9) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + h, h);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(212,175,55,.22)";
    for (let i = 0; i < 60; i += 1) ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);

    let drawing = false;
    let lastCheck = 0;
    function point(e) {
      const r = canvas.getBoundingClientRect();
      const t = e.touches ? e.touches[0] : e;
      return { x: t.clientX - r.left, y: t.clientY - r.top };
    }
    function scratch(e) {
      if (!drawing || SL.scratchState.revealed) return;
      e.preventDefault();
      const p = point(e);
      ctx.globalCompositeOperation = "destination-out";
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = "source-over";
      const now = Date.now();
      if (now - lastCheck > 140) {
        lastCheck = now;
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let clear = 0;
        let total = 0;
        for (let i = 3; i < data.length; i += 4 * 40) { total += 1; if (data[i] < 60) clear += 1; }
        const pct = total ? clear / total : 0;
        const bar = document.getElementById("scratch-progress");
        if (bar) bar.style.width = Math.min(100, Math.round(pct * 220)) + "%";
        if (pct > 0.36) finishScratch(card);
      }
    }
    function down(e) { drawing = true; scratch(e); }
    function up() { drawing = false; }
    canvas.addEventListener("pointerdown", down);
    canvas.addEventListener("pointermove", scratch);
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointerleave", up);
    canvas.addEventListener("touchstart", down, { passive: false });
    canvas.addEventListener("touchmove", scratch, { passive: false });
    canvas.addEventListener("touchend", up);
    SL.addCleanup(() => {
      canvas.removeEventListener("pointerdown", down);
      canvas.removeEventListener("pointermove", scratch);
      canvas.removeEventListener("pointerup", up);
      canvas.removeEventListener("pointerleave", up);
      canvas.removeEventListener("touchstart", down);
      canvas.removeEventListener("touchmove", scratch);
      canvas.removeEventListener("touchend", up);
    });
  }

  function initOtp() {
    const inputs = Array.prototype.slice.call(document.querySelectorAll("[data-otp]"));
    if (!inputs.length) return;
    inputs.forEach((input, i) => {
      input.addEventListener("input", () => {
        input.value = input.value.replace(/\D/g, "").slice(0, 1);
        if (input.value && i < inputs.length - 1) inputs[i + 1].focus();
      });
      input.addEventListener("keydown", (e) => {
        if (e.key === "Backspace" && !input.value && i > 0) inputs[i - 1].focus();
      });
      input.addEventListener("paste", (e) => {
        const text = (e.clipboardData || window.clipboardData).getData("text").replace(/\D/g, "").slice(0, 6);
        if (!text) return;
        e.preventDefault();
        text.split("").forEach((ch, idx) => { if (inputs[idx]) inputs[idx].value = ch; });
        inputs[Math.min(text.length, inputs.length - 1)].focus();
      });
    });
    setTimeout(() => inputs[0].focus(), 80);
  }

  SL.onRender(function (route) {
    if (!route) return;
    if (route.path === "/otp") initOtp();
    if (route.path === "/spin") {
      SL.spinState = { rotation: 0, spinning: false };
      drawWheel(document.getElementById("wheel-canvas"));
    }
    if (route.path === "/scratch") initScratch();
    if (route.path === "/win") {
      const layer = document.getElementById("confetti-layer");
      if (layer) SL.confetti(layer);
    }
  });

  /* ---------------- Routes ---------------- */
  SL.route("/", SL.views.landing);
  SL.route("/login", SL.views.login);
  SL.route("/otp", SL.views.otp);
  SL.route("/game", SL.views.game, { auth: "customer" });
  SL.route("/spin", SL.views.spin, { auth: "customer" });
  SL.route("/scratch", SL.views.scratch, { auth: "customer" });
  SL.route("/win", SL.views.win, { auth: "customer" });
  SL.route("/history", SL.views.history, { auth: "customer" });
  SL.route("/account", SL.views.account, { auth: "customer" });
  SL.route("/admin/login", SL.views.adminLogin);
})();
