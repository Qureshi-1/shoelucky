/* Admin dashboards. All scoping here is demo-only UI behaviour: a production
 * build must enforce the same boundaries on the server with RLS + policies. */
(function () {
  const SL = window.SL;

  function isSuper() { return SL.state.admin && SL.state.admin.role === "super_admin"; }
  function ownerShopId() { return isSuper() ? null : (SL.state.admin && SL.state.admin.shopId); }
  function scopedShops() { return isSuper() ? SL.state.shops : SL.state.shops.filter((s) => s.id === ownerShopId()); }
  function scopedCampaigns() { return isSuper() ? SL.state.campaigns : SL.state.campaigns.filter((c) => c.shopId === ownerShopId()); }
  function scopedCoupons() { return isSuper() ? SL.state.coupons : SL.state.coupons.filter((c) => c.shopId === ownerShopId()); }
  function scopedCustomers() { return isSuper() ? SL.state.customers : SL.state.customers.filter((c) => c.shopId === ownerShopId()); }
  function couponInScope(coupon) { return isSuper() || !coupon || coupon.shopId === ownerShopId(); }

  function miniMetric(label, value, sub, iconName) { return SL.statCard(label, String(value), sub, iconName); }
  function campaignUrl(campaign) { return SL.qrUrl(campaign.shopId, campaign.id); }
  function shopName(id) { const s = SL.shopById(id); return s ? s.name : id || "—"; }

  function recentTable(coupons, limit) {
    const rows = coupons.slice(0, limit || 6);
    if (!rows.length) return SL.emptyState("ticket", "No demo coupons yet", "Coupons issued in this prototype will appear here.");
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Code</th><th>Shop</th><th>Reward</th><th>Status</th><th>Issued</th></tr></thead><tbody>' +
      rows.map((c) => {
        const r = SL.rewardById(c.rewardId);
        return "<tr><td><strong class='mono'>" + SL.escapeHtml(c.code) + "</strong></td><td>" + SL.escapeHtml(shopName(c.shopId)) + "</td><td>" + (r ? SL.rewardPill(r) : "—") + "</td><td>" + SL.statusPill(SL.isExpired(c) && c.status === "active" ? "expired" : c.status) + "</td><td>" + SL.escapeHtml(SL.relativeDate(c.issuedAt)) + "</td></tr>";
      }).join("") + "</tbody></table></div>";
  }

  SL.views = SL.views || {};

  SL.views.adminDashboard = function () {
    const superAdmin = isSuper();
    const campaigns = scopedCampaigns();
    const coupons = scopedCoupons();
    const shops = scopedShops();
    const issued = coupons.length;
    const redeemed = coupons.filter((c) => c.status === "redeemed").length;
    const rate = issued ? Math.round((redeemed / issued) * 100) : 0;
    const scans = campaigns.reduce((s, c) => s + c.scans, 0);
    const plays = campaigns.reduce((s, c) => s + c.plays, 0);
    const shop = superAdmin ? null : SL.shopById(ownerShopId());

    const stats = '<div class="stat-grid">' +
      miniMetric(superAdmin ? "Partner shops" : "My shop", shops.length, superAdmin ? "Across all regions" : (shop ? shop.id : "Owner scope"), "shop", "var(--gold-light)") +
      miniMetric("Active campaigns", campaigns.filter((c) => c.status === "active").length, "Demo campaigns", "campaign") +
      miniMetric("Coupons issued", issued, "Local demo records", "ticket") +
      miniMetric("Redemption rate", rate + "%", redeemed + " redeemed", "trend", "var(--success)") +
      "</div>";

    const chart = '<section class="card admin-card"><div class="admin-card__head"><div><h3>QR activity · last 7 days</h3><p>Demo analytics for ' + (superAdmin ? "all shops" : SL.escapeHtml(shop ? shop.name : "your shop")) + "</p></div><span class='chip'>" + SL.icon("scan", 13) + SL.escapeHtml(String(scans)) + " scans</span></div>" +
      '<div class="chart-bars">' + SL.analytics.daily.map((d, i) =>
        '<div class="chart-bar"><span class="chart-bar__fill ' + (i % 2 ? "chart-bar__fill--alt" : "") + '" style="height:' + (35 + (d.plays / 420) * 65) + '%"></span><small>' + d.day + "</small></div>"
      ).join("") + "</div></section>";

    const quick = '<section class="card admin-card"><div class="admin-card__head"><h3>Quick actions</h3></div>' +
      '<div class="chip-row">' +
        '<button class="btn btn-gold btn-sm" data-nav="/admin/campaigns">' + SL.icon("plus", 15) + " New campaign</button>" +
        '<button class="btn btn-ghost btn-sm" data-nav="/admin/scanner">' + SL.icon("scan", 15) + " Redeem demo coupon</button>" +
        '<button class="btn btn-ghost btn-sm" data-nav="/admin/analytics">' + SL.icon("chart", 15) + " View analytics</button>" +
        (superAdmin ? '<button class="btn btn-ghost btn-sm" data-action="open-shop-qrs">' + SL.icon("qr", 15) + " Shop QR codes</button>" : "") +
      "</div></section>";

    const recent = '<section class="card admin-card"><div class="admin-card__head"><div><h3>Recent demo coupons</h3><p>Latest local coupon records in scope</p></div><button class="text-btn" data-nav="/admin/coupons">View all ' + SL.icon("arrowRight", 14) + "</button></div>" + recentTable(coupons, 6) + "</section>";

    const shopList = superAdmin ? '<section class="card admin-card"><div class="admin-card__head"><div><h3>Shop performance</h3><p>Super Admin view · all shops</p></div><button class="text-btn" data-nav="/admin/shops">Manage ' + SL.icon("arrowRight", 14) + '</button></div><div class="table-wrap"><table class="table"><thead><tr><th>Shop</th><th>Shop ID</th><th>Campaigns</th><th>Scans</th><th>Status</th></tr></thead><tbody>' +
      shops.map((s) => {
        const c = SL.state.campaigns.filter((x) => x.shopId === s.id);
        return "<tr><td><strong>" + SL.escapeHtml(s.name) + "</strong><br><small class='muted'>" + SL.escapeHtml(s.area) + "</small></td><td class='mono'>" + SL.escapeHtml(s.id) + "</td><td>" + c.length + "</td><td>" + c.reduce((a, x) => a + x.scans, 0).toLocaleString() + "</td><td>" + SL.statusPill(s.status) + "</td></tr>";
      }).join("") + "</tbody></table></div></section>" : "";

    return SL.adminShell("dashboard", "Overview", superAdmin ? "Super Admin view across every demo shop." : "Shop Owner view restricted to " + (shop ? shop.name : "your shop") + ".",
      '<div class="admin-grid admin-grid--two">' +
        '<div>' + stats + '<div style="height:14px"></div>' + chart + "</div>" +
        "<div>" + quick + recent + "</div>" +
      "</div>" + shopList +
      SL.demoNotice("All numbers shown are fictional demo data. Shop Owner dashboards are filtered in the client for the prototype only."));
  };

  SL.views.adminShops = function () {
    const superAdmin = isSuper();
    const shops = scopedShops();
    const content = '<div class="admin-card__head"><div><h3>' + (superAdmin ? "All shops" : "My shop") + "</h3><p>" + (superAdmin ? "Create and manage demo storefronts." : "Owner access is limited to this shop ID.") + "</p></div>" +
      (superAdmin ? '<button class="btn btn-gold btn-sm" data-action="new-shop">' + SL.icon("plus", 15) + " Add shop</button>" : "") + "</div>" +
      '<div class="table-wrap"><table class="table"><thead><tr><th>Shop</th><th>Shop ID</th><th>QR campaign URL</th><th>Owner</th><th>Status</th><th></th></tr></thead><tbody>' +
      shops.map((s) => {
        const camp = SL.state.campaigns.find((c) => c.shopId === s.id && c.status === "active");
        return "<tr><td><strong>" + SL.escapeHtml(s.name) + "</strong><br><small class='muted'>" + SL.escapeHtml(s.area + " · " + s.city) + "</small></td>" +
          "<td class='mono'>" + SL.escapeHtml(s.id) + "</td>" +
          "<td><button class='text-btn' data-action='copy-qr' data-shop='" + s.id + "' data-campaign='" + (camp ? camp.id : "") + "'>" + SL.icon("copy", 13) + " Copy demo QR URL</button></td>" +
          "<td>" + SL.escapeHtml(s.owner) + "</td><td>" + SL.statusPill(s.status) + "</td>" +
          "<td><div class='row-actions'>" + (superAdmin ? "<button class='mini-btn' data-action='toggle-shop' data-shop='" + s.id + "' title='Toggle status'>" + SL.icon("refresh", 14) + "</button>" : "") +
          "<button class='mini-btn' data-action='shop-qr' data-shop='" + s.id + "' title='Show QR'>" + SL.icon("qr", 14) + "</button></div></td></tr>";
      }).join("") + "</tbody></table></div>";
    return SL.adminShell("shops", "Shop management", superAdmin ? "Every shop has a unique ID and QR campaign URL." : "You can view only your assigned shop.", '<section class="card admin-card">' + content + "</section>" + SL.demoNotice("Shop records are local demo data. Creating or pausing a shop does not affect any real store."));
  };

  SL.views.adminCampaigns = function () {
    const superAdmin = isSuper();
    const campaigns = scopedCampaigns();
    const cards = campaigns.map((c) => {
      const url = campaignUrl(c);
      return '<article class="card campaign-card">' +
        '<div class="campaign-card__top"><div><h3>' + SL.escapeHtml(c.name) + "</h3><p>" + SL.escapeHtml(shopName(c.shopId)) + " · " + SL.escapeHtml(c.id) + "</p></div>" + SL.statusPill(c.status) + "</div>" +
        '<div class="chip-row" style="margin-top:12px"><span class="chip chip--gold">' + SL.icon(c.gameMode === "spin" ? "wheel" : c.gameMode === "scratch" ? "scratch" : "sparkle", 13) + (c.gameMode === "random" ? "Random assignment" : c.gameMode === "spin" ? "Spin Wheel" : "Scratch Card") + "</span>" +
          '<span class="chip">' + SL.icon("scan", 13) + c.scans.toLocaleString() + ' scans</span><span class="chip">' + SL.icon("bolt", 13) + c.plays.toLocaleString() + " plays</span></div>" +
        '<div class="campaign-card__url"><span>' + SL.escapeHtml(url) + "</span><button data-action='copy-url' data-url='" + SL.escapeHtml(url) + "' aria-label='Copy URL'>" + SL.icon("copy", 16) + "</button></div>" +
        '<div class="campaign-card__foot"><span class="muted" style="font-size:11px">Ends ' + SL.escapeHtml(SL.formatDate(c.ends)) + "</span>" +
          '<div class="row-actions"><button class="btn btn-ghost btn-sm" data-action="campaign-qr" data-shop="' + c.shopId + '" data-campaign="' + c.id + '">' + SL.icon("qr", 14) + " QR</button>" +
          (superAdmin || ownerShopId() === c.shopId ? "<button class='mini-btn' data-action='toggle-campaign' data-campaign='" + c.id + "' title='Toggle status'>" + SL.icon("refresh", 14) + "</button>" : "") + "</div></div>" +
        "</article>";
    }).join("");
    return SL.adminShell("campaigns", "Campaign management", "Each campaign owns a shop-specific QR URL and game assignment.",
      '<section class="card admin-card"><div class="admin-card__head"><div><h3>Campaigns</h3><p>' + campaigns.length + " demo campaign" + (campaigns.length === 1 ? "" : "s") + " in scope</p></div>" +
        '<button class="btn btn-gold btn-sm" data-action="new-campaign">' + SL.icon("plus", 15) + " New campaign</button></div>" +
        (cards || SL.emptyState("campaign", "No campaigns", "Create a demo campaign to generate a QR URL.")) + "</section>" +
        SL.demoNotice("Campaign QR URLs point to this static prototype. Production QR routing must be issued and validated server-side."));
  };

  SL.views.adminRewards = function () {
    const superAdmin = isSuper();
    const rows = SL.state.rewards.map((r) =>
      '<div class="reward-row">' + SL.rewardPill(r) +
        '<div class="reward-row__weight"><input class="input" type="number" min="0" max="100" value="' + Number(r.weight) + '" data-weight="' + r.id + '" ' + (superAdmin ? "" : "disabled") + " aria-label='Weight for " + SL.escapeHtml(r.label) + "' /></div>" +
        '<button class="toggle ' + (r.active ? "is-on" : "") + '" data-action="toggle-reward" data-reward="' + r.id + '" ' + (superAdmin ? "" : "disabled") + ' aria-label="Toggle ' + SL.escapeHtml(r.label) + '" aria-pressed="' + !!r.active + '"></button>' +
      "</div>"
    ).join("");
    return SL.adminShell("rewards", "Reward configuration", "Configure demo reward labels, availability, and wheel weights.",
      '<section class="card admin-card"><div class="admin-card__head"><div><h3>Reward pool</h3><p>Weights affect local random selection only.</p></div>' +
        (superAdmin ? '<button class="btn btn-gold btn-sm" data-action="save-rewards">' + SL.icon("check", 15) + " Save weights</button>" : "") + "</div>" +
        rows + "</section>" +
        (!superAdmin ? SL.demoNotice("Shop Owners have read-only access to the global reward catalog in this demo.") : "") +
        SL.demoNotice("Reward odds and eligibility must be computed on a server in production. Never trust browser-side game logic."));
  };

  SL.views.adminCoupons = function () {
    const coupons = scopedCoupons();
    const filter = SL.state.ui.couponFilter || "all";
    const search = SL.state.ui.couponSearch || "";
    const shown = coupons.filter((c) => (filter === "all" || c.status === filter) && (!search || (c.code + " " + SL.rewardById(c.rewardId).label + " " + SL.customerById(c.customerId).name).toLowerCase().indexOf(search.toLowerCase()) >= 0));
    const rows = shown.map((c) => {
      const reward = SL.rewardById(c.rewardId);
      const customer = SL.customerById(c.customerId);
      return "<tr><td><strong class='mono'>" + SL.escapeHtml(c.code) + "</strong></td>" +
        "<td>" + SL.escapeHtml(customer ? customer.name : "Demo customer") + "</td>" +
        (isSuper() ? "<td>" + SL.escapeHtml(shopName(c.shopId)) + "</td>" : "") +
        "<td>" + (reward ? SL.rewardPill(reward) : "—") + "</td>" +
        "<td>" + SL.statusPill(SL.isExpired(c) && c.status === "active" ? "expired" : c.status) + "</td>" +
        "<td>" + SL.escapeHtml(SL.relativeDate(c.issuedAt)) + "</td>" +
        "<td><div class='row-actions'><button class='mini-btn' data-action='admin-view-coupon' data-id='" + c.id + "' title='View'>" + SL.icon("eye", 14) + "</button>" +
          (c.status === "active" && !SL.isExpired(c) ? "<button class='mini-btn' data-action='demo-redeem' data-id='" + c.id + "' title='Redeem demo'>" + SL.icon("check", 14) + "</button>" : "") + "</div></td></tr>";
    }).join("");
    return SL.adminShell("coupons", "Coupon management", "Issue, inspect, and locally redeem demo coupons.",
      '<section class="card admin-card">' +
        '<form class="search-row" data-form="coupon-search">' +
          '<div class="search-box">' + SL.icon("search", 17) + '<input class="input" name="search" placeholder="Search code, customer, reward" value="' + SL.escapeHtml(search) + '" /></div>' +
          '<select class="select" name="status"><option value="all"' + (filter === "all" ? " selected" : "") + '>All statuses</option><option value="active"' + (filter === "active" ? " selected" : "") + '>Active</option><option value="redeemed"' + (filter === "redeemed" ? " selected" : "") + '>Redeemed</option><option value="expired"' + (filter === "expired" ? " selected" : "") + '>Expired</option></select>' +
          '<button class="btn btn-ghost" type="submit">' + SL.icon("filter", 16) + " Filter</button>" +
        "</form>" +
        '<div class="table-wrap"><table class="table"><thead><tr><th>Code</th><th>Customer</th>' + (isSuper() ? "<th>Shop</th>" : "") + '<th>Reward</th><th>Status</th><th>Issued</th><th></th></tr></thead><tbody>' +
        (rows || '<tr><td colspan="' + (isSuper() ? 7 : 6) + '">' + SL.emptyState("ticket", "No matching coupons", "Try another search or filter.") + "</td></tr>") +
        "</tbody></table></div></section>" +
        SL.demoNotice("Redeeming here only changes local demo state. It is not secure and must never be used to authorize a real discount."));
  };

  SL.views.adminScanner = function () {
    const result = SL.state.ui.scannerResult;
    let resultHtml = "";
    if (result) {
      const ok = result.ok;
      const c = result.coupon;
      resultHtml = '<div class="card scan-result"><div class="scan-result__head">' +
        '<span class="scan-result__icon scan-result__icon--' + (ok ? "ok" : "bad") + '">' + SL.icon(ok ? "check" : "close", 22) + "</span>" +
        "<div><strong>" + SL.escapeHtml(ok ? "Demo coupon accepted" : "Cannot redeem") + "</strong><p>" + SL.escapeHtml(result.message) + "</p></div></div>" +
        (c ? '<div class="divider"></div><div class="coupon-meta"><div class="card meta-cell"><small>Code</small><strong class="mono">' + SL.escapeHtml(c.code) + "</strong></div>" +
          '<div class="card meta-cell"><small>Reward</small><strong>' + SL.escapeHtml((SL.rewardById(c.rewardId) || {}).label || "—") + "</strong></div>" +
          '<div class="card meta-cell"><small>Shop</small><strong>' + SL.escapeHtml(shopName(c.shopId)) + "</strong></div>" +
          '<div class="card meta-cell"><small>Status</small>' + SL.statusPill(c.status) + "</div></div>" : "") +
        "</div>";
    }
    return SL.adminShell("scanner", "Coupon redemption scanner", "Demo camera view and manual code validation UI.",
      '<div class="admin-grid admin-grid--two"><div>' +
        '<section class="card admin-card">' +
          '<div class="scanner-view"><div class="scanner-grid"></div><div class="scan-frame"><i></i><b></b></div><div class="scan-line"></div>' +
            '<div class="scanner-center">' + SL.icon("camera", 34) + "<strong>Camera preview placeholder</strong><small>No camera access in this prototype</small></div>" +
          "</div>" +
          '<div class="demo-notice" style="margin-top:14px">' + SL.icon("alert", 16) + "<span>Demo scanner only. No camera is used, no signature is verified, and no server redemption check happens. Not production-secure.</span></div>" +
        "</section></div><div>" +
        '<section class="card admin-card"><div class="admin-card__head"><div><h3>Manual demo entry</h3><p>Type a demo code or simulate a scan.</p></div></div>' +
          '<div class="field"><label class="field__label" for="scan-code">Coupon code</label><input class="input mono" id="scan-code" placeholder="DEMO-001-1040" /></div>' +
          '<div class="chip-row"><button class="btn btn-gold btn-sm" data-action="simulate-scan">' + SL.icon("qr", 15) + " Simulate scan</button>" +
            '<button class="btn btn-ghost btn-sm" data-action="redeem-scanned">' + SL.icon("check", 15) + " Redeem (demo)</button></div>" +
        "</section>" + resultHtml +
      "</div></div>");
  };

  SL.views.adminAnalytics = function () {
    const superAdmin = isSuper();
    const selected = superAdmin ? (SL.state.ui.analyticsShopId || "all") : ownerShopId();
    const shopFilterId = selected === "all" ? null : selected;
    const coupons = shopFilterId ? scopedCoupons().filter((c) => c.shopId === shopFilterId) : scopedCoupons();
    const customers = shopFilterId ? SL.state.customers.filter((c) => c.shopId === shopFilterId) : scopedCustomers();
    const campaigns = shopFilterId ? SL.state.campaigns.filter((c) => c.shopId === shopFilterId) : scopedCampaigns();
    const redeemed = coupons.filter((c) => c.status === "redeemed").length;
    const scans = campaigns.reduce((s, c) => s + c.scans, 0);
    const plays = campaigns.reduce((s, c) => s + c.plays, 0);

    const rewardCounts = SL.state.rewards.map((r) => ({ label: r.short, count: coupons.filter((c) => c.rewardId === r.id).length, color: r.color }));
    const maxReward = Math.max(1, ...rewardCounts.map((r) => r.count));
    const custCounts = customers.map((c) => ({ name: c.name, count: coupons.filter((x) => x.customerId === c.id).length })).sort((a, b) => b.count - a.count).slice(0, 5);

    const filter = superAdmin ? '<div class="search-row"><div class="search-box"><select class="select" id="analytics-shop">' +
      '<option value="all"' + (selected === "all" ? " selected" : "") + ">All shops</option>" +
      SL.state.shops.map((s) => '<option value="' + s.id + '"' + (selected === s.id ? " selected" : "") + ">" + SL.escapeHtml(s.name) + "</option>").join("") +
      "</select></div></div>" : "";

    return SL.adminShell("analytics", "Customer analytics", "Fictional engagement data for demo reporting.",
      filter + '<div class="stat-grid">' +
        miniMetric("QR scans", scans.toLocaleString(), "Demo campaigns", "scan", "var(--gold-light)") +
        miniMetric("Games played", plays.toLocaleString(), "Local demo sum", "wheel") +
        miniMetric("Coupons issued", coupons.length, "In selected scope", "ticket") +
        miniMetric("Redeemed", redeemed, coupons.length ? Math.round((redeemed / coupons.length) * 100) + "% of issued" : "0% of issued", "trend", "var(--success)") +
      "</div>" +
      '<div class="admin-grid admin-grid--two" style="margin-top:14px"><section class="card admin-card"><div class="admin-card__head"><h3>Weekly activity</h3><p>Daily demo engagement</p></div>' +
        '<div class="chart-bars">' + SL.analytics.daily.map((d, i) => '<div class="chart-bar"><span class="chart-bar__fill ' + (i % 2 ? "chart-bar__fill--alt" : "") + '" style="height:' + (35 + (d.plays / 420) * 65) + '%"></span><small>' + d.day + "</small></div>").join("") + "</div></section>" +
      '<section class="card admin-card"><div class="admin-card__head"><h3>Conversion funnel</h3><p>Share of demo QR scans</p></div>' +
        SL.analytics.funnel.map((f) => '<div class="funnel-row"><span>' + SL.escapeHtml(f.label) + '</span><div class="funnel-track"><i style="width:' + f.value + '%"></i></div><strong>' + f.value + "%</strong></div>").join("") +
      "</section></div>" +
      '<div class="admin-grid admin-grid--two"><section class="card admin-card"><div class="admin-card__head"><h3>Reward mix</h3><p>Issued demo coupons by reward</p></div>' +
        rewardCounts.map((r) => SL.progressBar(r.label, r.count, maxReward, "linear-gradient(90deg," + r.color + ",#f6dd8f)")).join("") +
      "</section><section class=\"card admin-card\"><div class=\"admin-card__head\"><h3>Top customers</h3><p>By demo coupon count</p></div>" +
        (custCounts.length ? custCounts.map((c, i) => '<div class="how-step"><span class="how-step__num">' + (i + 1) + '</span><div><h4>' + SL.escapeHtml(c.name) + '</h4><p>' + c.count + " demo coupon" + (c.count === 1 ? "" : "s") + "</p></div></div>").join("") : SL.emptyState("users", "No customers", "No demo customers in this scope.")) +
      "</section></div>" +
      SL.demoNotice("Analytics are hard-coded / locally derived demo figures, not real customer data."));
  };

  SL.views.adminSettings = function () {
    return SL.adminShell("settings", "Settings & architecture", "Prototype notes for a future Supabase-backed build.",
      '<section class="card admin-card"><div class="admin-card__head"><div><h3>Supabase PostgreSQL readiness</h3><p>Data shapes and boundaries are prepared; this prototype does not connect to a database.</p></div></div>' +
        '<div class="how-step"><span class="how-step__num">1</span><div><h4>Database schema</h4><p><span class="mono">supabase/schema.sql</span> defines shops, campaigns, rewards, customers, coupons, and redemptions.</p></div></div>' +
        '<div class="how-step"><span class="how-step__num">2</span><div><h4>Row Level Security</h4><p>Shop owners must be scoped to their shop ID. Super Admin policies see all rows.</p></div></div>' +
        '<div class="how-step"><span class="how-step__num">3</span><div><h4>Secure server logic</h4><p>OTP, game assignment, coupon signing, and redemption belong in Edge Functions or a trusted backend.</p></div></div>' +
        '<div class="how-step"><span class="how-step__num">4</span><div><h4>Client replacement</h4><p>Swap <span class="mono">SL.api</span> demo methods for authenticated HTTPS calls.</p></div></div>' +
      "</section>" +
      '<section class="card admin-card"><div class="admin-card__head"><div><h3>Demo data controls</h3><p>Reset local prototype state to the original fixtures.</p></div><button class="btn btn-danger btn-sm" data-action="reset-demo">' + SL.icon("refresh", 15) + " Reset demo</button></div>" +
        SL.demoNotice("Resetting clears locally stored coupon changes, sessions, shops, campaigns, rewards, and settings.") +
      "</section>" +
      SL.demoNotice("This static client does not implement production security. Do not use demo coupons for real redemptions."));
  };

  /* ---------------- Admin forms & actions ---------------- */
  SL.forms["admin-login"] = SL.forms["admin-login"] || function () {};
  SL.forms["create-shop"] = function (form) {
    const name = form.elements.name.value.trim();
    if (!name) { SL.toast("Enter a shop name", "error"); return; }
    SL.api.createShop({ name, area: form.elements.area.value.trim(), owner: form.elements.owner.value.trim() }).then((res) => {
      SL.closeModal();
      SL.toast("Demo shop created", "success");
      SL.render(SL.views.adminShops(), { shell: "admin" });
    });
  };
  SL.forms["create-campaign"] = function (form) {
    const name = form.elements.name.value.trim();
    if (!name) { SL.toast("Enter a campaign name", "error"); return; }
    SL.api.createCampaign({ name, shopId: form.elements.shopId.value, gameMode: form.elements.gameMode.value }).then((res) => {
      SL.closeModal();
      SL.toast("Demo campaign created", "success");
      SL.render(SL.views.adminCampaigns(), { shell: "admin" });
    });
  };
  SL.forms["coupon-search"] = function (form) {
    SL.state.ui.couponSearch = form.elements.search.value.trim();
    SL.state.ui.couponFilter = form.elements.status.value;
    SL.render(SL.views.adminCoupons(), { shell: "admin" });
  };

  function shopQrModal(shopId, campaignId) {
    const shop = SL.shopById(shopId);
    if (!shop) return;
    const campaigns = SL.state.campaigns.filter((c) => c.shopId === shopId);
    const body = '<p class="muted" style="margin:0 0 14px;font-size:12.5px">' + SL.escapeHtml(shop.name) + " · " + SL.escapeHtml(shop.id) + "</p>" +
      (campaigns.length ? campaigns.map((c) => '<div class="qr-list-item"><div class="qr-list-item__qr">' + SL.qrSvg(campaignUrl(c), 58) + "</div><div><strong>" + SL.escapeHtml(c.name) + "</strong><small>" + SL.escapeHtml(campaignUrl(c)) + "</small></div><button class='mini-btn' data-modal-action='copy-url' data-url='" + SL.escapeHtml(campaignUrl(c)) + "'>" + SL.icon("copy", 14) + "</button></div>").join("") : SL.emptyState("qr", "No campaigns", "Create a campaign to generate a QR URL.")) +
      '<div style="margin-top:14px">' + SL.demoNotice("Fake QR placeholders link into this prototype only.") + "</div>";
    SL.openModal({ eyebrow: "Demo QR", title: shop.name, body, wide: true, actions: [{ label: "Close", key: "close", class: "btn-ghost" }],
      handlers: { close: SL.closeModal, "copy-url": (el, data) => SL.copy(data.url || "") } });
  }

  SL.actions["toggle-drawer"] = function () {
    const shell = document.querySelector(".admin-shell");
    if (shell) shell.classList.toggle("is-drawer-open");
  };
  SL.actions["close-drawer"] = function () {
    const shell = document.querySelector(".admin-shell");
    if (shell) shell.classList.remove("is-drawer-open");
  };
  SL.actions["logout-admin"] = function () {
    SL.state.admin = null;
    SL.save();
    SL.toast("Admin signed out", "info");
    SL.navigate("/admin/login");
  };
  SL.actions["reset-demo"] = function () {
    SL.openModal({
      eyebrow: "Demo controls", title: "Reset all demo data?",
      body: "<p class='muted' style='margin:0;font-size:13px'>This clears local coupon changes, sessions, shops, campaigns, and reward configuration in this browser.</p>",
      actions: [{ label: "Cancel", key: "cancel", class: "btn-ghost" }, { label: "Reset demo", key: "confirm", class: "btn-danger" }],
      handlers: {
        cancel: SL.closeModal,
        confirm: () => { SL.resetDemo(); SL.closeModal(); SL.toast("Demo data reset", "success"); SL.navigate("/admin/login"); }
      }
    });
  };
  SL.actions["open-shop-qrs"] = function () { shopQrModal(SL.currentShop().id); };
  SL.actions["shop-qr"] = function (el, data) { shopQrModal(data.shop); };
  SL.actions["campaign-qr"] = function (el, data) { shopQrModal(data.shop, data.campaign); };
  SL.actions["copy-qr"] = function (el, data) {
    const campaign = data.campaign && SL.campaignById(data.campaign);
    SL.copy(campaign ? campaignUrl(campaign) : SL.qrUrl(data.shop));
  };
  SL.actions["copy-url"] = function (el, data) { SL.copy(data.url || ""); };
  SL.actions["toggle-shop"] = function (el, data) {
    const shop = SL.shopById(data.shop);
    if (!shop) return;
    shop.status = shop.status === "active" ? "paused" : "active";
    SL.save(); SL.render(SL.views.adminShops(), { shell: "admin" });
    SL.toast(shop.name + " set to " + shop.status, "info");
  };
  SL.actions["toggle-campaign"] = function (el, data) {
    const campaign = SL.campaignById(data.campaign);
    if (!campaign) return;
    campaign.status = campaign.status === "active" ? "paused" : "active";
    SL.save(); SL.render(SL.views.adminCampaigns(), { shell: "admin" });
    SL.toast(campaign.name + " set to " + campaign.status, "info");
  };
  SL.actions["toggle-reward"] = function (el, data) {
    if (!isSuper()) return;
    const reward = SL.rewardById(data.reward);
    if (!reward) return;
    reward.active = !reward.active;
    SL.save(); SL.render(SL.views.adminRewards(), { shell: "admin" });
  };
  SL.actions["save-rewards"] = function () {
    if (!isSuper()) return;
    document.querySelectorAll("[data-weight]").forEach((input) => {
      const reward = SL.rewardById(input.getAttribute("data-weight"));
      if (reward) reward.weight = Math.max(0, Math.min(100, Number(input.value) || 0));
    });
    SL.save(); SL.toast("Demo reward weights saved", "success");
  };
  SL.actions["new-shop"] = function () {
    if (!isSuper()) return;
    SL.openModal({ eyebrow: "Super Admin", title: "Add demo shop",
      body: '<form data-form="create-shop">' +
        '<div class="field"><label class="field__label">Shop name</label><input class="input" name="name" placeholder="Runway Kicks" required /></div>' +
        '<div class="field"><label class="field__label">Area</label><input class="input" name="area" placeholder="Midtown" /></div>' +
        '<div class="field"><label class="field__label">Owner name</label><input class="input" name="owner" placeholder="Demo Owner" /></div>' +
        '<button class="btn btn-gold btn-block" type="submit">' + SL.icon("plus", 16) + " Create demo shop</button></form>",
      actions: [{ label: "Cancel", key: "close", class: "btn-ghost" }], handlers: { close: SL.closeModal } });
  };
  SL.actions["new-campaign"] = function () {
    SL.openModal({ eyebrow: "Campaign builder", title: "New demo campaign",
      body: '<form data-form="create-campaign">' +
        '<div class="field"><label class="field__label">Campaign name</label><input class="input" name="name" placeholder="Friday Drop" required /></div>' +
        (isSuper() ? '<div class="field"><label class="field__label">Shop</label><select class="select" name="shopId">' + SL.state.shops.map((s) => '<option value="' + s.id + '">' + SL.escapeHtml(s.name) + "</option>").join("") + "</select></div>" : '<input type="hidden" name="shopId" value="' + ownerShopId() + '" />') +
        '<div class="field"><label class="field__label">Game assignment</label><select class="select" name="gameMode"><option value="spin">Spin Wheel</option><option value="scratch">Scratch Card</option><option value="random">Random (demo)</option></select></div>' +
        '<button class="btn btn-gold btn-block" type="submit">' + SL.icon("plus", 16) + " Create campaign</button></form>",
      actions: [{ label: "Cancel", key: "close", class: "btn-ghost" }], handlers: { close: SL.closeModal } });
  };
  SL.actions["admin-view-coupon"] = function (el, data) {
    const c = SL.state.coupons.find((x) => x.id === data.id);
    if (!c || !couponInScope(c)) return;
    SL.openModal({ eyebrow: "Demo coupon", title: c.code,
      body: '<div class="coupon-meta"><div class="card meta-cell"><small>Customer</small><strong>' + SL.escapeHtml((SL.customerById(c.customerId) || {}).name || "Demo") + "</strong></div>" +
        '<div class="card meta-cell"><small>Shop</small><strong>' + SL.escapeHtml(shopName(c.shopId)) + "</strong></div>" +
        '<div class="card meta-cell"><small>Reward</small><strong>' + SL.escapeHtml((SL.rewardById(c.rewardId) || {}).label || "—") + "</strong></div>" +
        '<div class="card meta-cell"><small>Status</small>' + SL.statusPill(c.status) + "</div></div><div style='margin-top:14px'>" + SL.demoNotice("Demo record only.") + "</div>",
      actions: [{ label: "Close", key: "close", class: "btn-gold" }], handlers: { close: SL.closeModal } });
  };
  SL.actions["demo-redeem"] = function (el, data) {
    const c = SL.state.coupons.find((x) => x.id === data.id);
    if (!c || !couponInScope(c)) { SL.toast("Coupon outside your shop scope", "error"); return; }
    SL.api.redeemCoupon(c.code).then((res) => {
      SL.toast(res.ok ? "Demo coupon redeemed locally" : res.error, res.ok ? "success" : "error");
      if (res.ok) SL.render(SL.views.adminCoupons(), { shell: "admin" });
    });
  };
  SL.actions["simulate-scan"] = function () {
    const pool = scopedCoupons().filter((c) => c.status === "active" && !SL.isExpired(c));
    const input = document.getElementById("scan-code");
    if (!pool.length) { SL.state.ui.scannerResult = { ok: false, message: "No active demo coupons in your scope." }; SL.render(SL.views.adminScanner(), { shell: "admin" }); return; }
    const c = pool[Math.floor(Math.random() * pool.length)];
    if (input) input.value = c.code;
    SL.state.ui.scannerResult = { ok: true, message: "Demo code loaded. Review it, then redeem locally.", coupon: c };
    SL.render(SL.views.adminScanner(), { shell: "admin" });
    SL.toast("Demo code loaded", "info");
  };
  SL.actions["redeem-scanned"] = function () {
    const input = document.getElementById("scan-code");
    const code = input ? input.value.trim() : "";
    if (!code) { SL.toast("Enter or simulate a demo code", "error"); return; }
    SL.api.redeemCoupon(code).then((res) => {
      if (!couponInScope(res.coupon)) {
        SL.state.ui.scannerResult = { ok: false, message: "This demo coupon belongs to another shop." };
      } else {
        SL.state.ui.scannerResult = { ok: res.ok, message: res.ok ? "Locally marked as redeemed. No server validation performed." : (res.error || "Unable to redeem."), coupon: res.coupon };
      }
      SL.render(SL.views.adminScanner(), { shell: "admin" });
      SL.toast(res.ok && couponInScope(res.coupon) ? "Demo redemption recorded" : "Demo redemption rejected", res.ok && couponInScope(res.coupon) ? "success" : "error");
    });
  };

  SL.onRender(function (route) {
    if (!route || route.path !== "/admin/analytics") return;
    const select = document.getElementById("analytics-shop");
    if (!select) return;
    select.addEventListener("change", () => {
      SL.state.ui.analyticsShopId = select.value;
      SL.render(SL.views.adminAnalytics(), { shell: "admin" });
    });
  });

  /* ---------------- Routes ---------------- */
  SL.route("/admin", SL.views.adminDashboard, { auth: "admin" });
  SL.route("/admin/shops", SL.views.adminShops, { auth: "admin" });
  SL.route("/admin/campaigns", SL.views.adminCampaigns, { auth: "admin" });
  SL.route("/admin/rewards", SL.views.adminRewards, { auth: "admin" });
  SL.route("/admin/coupons", SL.views.adminCoupons, { auth: "admin" });
  SL.route("/admin/scanner", SL.views.adminScanner, { auth: "admin" });
  SL.route("/admin/analytics", SL.views.adminAnalytics, { auth: "admin" });
  SL.route("/admin/settings", SL.views.adminSettings, { auth: "admin", role: "super_admin" });
})();
