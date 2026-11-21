/* ShoeLucky demo data.
 * Every record below is explicitly fictional demo data. Nothing in this file
 * represents a real customer, coupon, redemption, payment, or authentication.
 */
(function () {
  window.SL = window.SL || {};
  const SL = window.SL;

  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const isoDaysAgo = (days, hours = 0) => new Date(now - days * DAY - hours * 3600000).toISOString();
  const isoDaysAhead = (days) => new Date(now + days * DAY).toISOString();

  SL.DEMO_MODE = true;

  SL.rewards = [
    { id: "DISC-10", label: "10% OFF", short: "10%", type: "discount", value: 10, weight: 20, active: true, color: "#18181b", text: "#f6dd8f" },
    { id: "DISC-20", label: "20% OFF", short: "20%", type: "discount", value: 20, weight: 16, active: true, color: "#242427", text: "#f7f5ef" },
    { id: "DISC-30", label: "30% OFF", short: "30%", type: "discount", value: 30, weight: 12, active: true, color: "#111113", text: "#d4af37" },
    { id: "DISC-50", label: "50% OFF", short: "50%", type: "discount", value: 50, weight: 8, active: true, color: "#2b2620", text: "#f6dd8f" },
    { id: "DISC-70", label: "70% OFF", short: "70%", type: "discount", value: 70, weight: 4, active: true, color: "#3a321f", text: "#ffe9ae" },
    { id: "DISC-90", label: "90% OFF", short: "90%", type: "discount", value: 90, weight: 2, active: true, color: "#d4af37", text: "#111113" },
    { id: "BOGO-1", label: "Buy 1 Get 1", short: "B1G1", type: "bogo", value: 1, weight: 10, active: true, color: "#1d1d20", text: "#f7f5ef" },
    { id: "BOGO-2", label: "Buy 1 Get 2", short: "B1G2", type: "bogo", value: 2, weight: 5, active: true, color: "#26221a", text: "#f6dd8f" },
    { id: "BOGO-3", label: "Buy 1 Get 3", short: "B1G3", type: "bogo", value: 3, weight: 2, active: true, color: "#b8912d", text: "#111113" }
  ];

  SL.shops = [
    { id: "SL-SH-001", code: "SOLE-001", name: "Sole Theory", area: "Downtown", city: "Metro City", owner: "Mia Chen", ownerEmail: "owner@soletheory.demo", status: "active", accent: "#d4af37", joined: isoDaysAgo(420) },
    { id: "SL-SH-002", code: "KICK-002", name: "Kicks & Co.", area: "Westside", city: "Metro City", owner: "Jordan Reed", ownerEmail: "owner@kicksandco.demo", status: "active", accent: "#c8a2c8", joined: isoDaysAgo(365) },
    { id: "SL-SH-003", code: "LAB-003", name: "Sneaker Lab", area: "North Market", city: "Metro City", owner: "Dev Patel", ownerEmail: "owner@sneakerlab.demo", status: "active", accent: "#8ab4f8", joined: isoDaysAgo(240) },
    { id: "SL-SH-004", code: "URBN-004", name: "Urban Steps", area: "Harbor Point", city: "Metro City", owner: "Lena Ortiz", ownerEmail: "owner@urbansteps.demo", status: "paused", accent: "#81c995", joined: isoDaysAgo(180) }
  ];

  SL.campaigns = [
    { id: "CMP-1001", shopId: "SL-SH-001", name: "Golden Drop", gameMode: "spin", status: "active", starts: isoDaysAgo(18), ends: isoDaysAhead(42), scans: 1842, plays: 1267, redemptions: 412 },
    { id: "CMP-1002", shopId: "SL-SH-001", name: "Weekend Scratch", gameMode: "scratch", status: "active", starts: isoDaysAgo(6), ends: isoDaysAhead(24), scans: 726, plays: 518, redemptions: 164 },
    { id: "CMP-1003", shopId: "SL-SH-002", name: "Westside Spin", gameMode: "spin", status: "active", starts: isoDaysAgo(30), ends: isoDaysAhead(15), scans: 2110, plays: 1490, redemptions: 503 },
    { id: "CMP-1004", shopId: "SL-SH-003", name: "Lab Mystery", gameMode: "random", status: "active", starts: isoDaysAgo(9), ends: isoDaysAhead(51), scans: 934, plays: 702, redemptions: 221 },
    { id: "CMP-1005", shopId: "SL-SH-003", name: "Member Bonus", gameMode: "scratch", status: "draft", starts: isoDaysAhead(3), ends: isoDaysAhead(60), scans: 0, plays: 0, redemptions: 0 },
    { id: "CMP-1006", shopId: "SL-SH-004", name: "Harbor Launch", gameMode: "spin", status: "paused", starts: isoDaysAgo(45), ends: isoDaysAgo(2), scans: 488, plays: 301, redemptions: 88 }
  ];

  SL.customers = [
    { id: "CUS-501", name: "Alex Morgan", phone: "+1 415 555 0112", shopId: "SL-SH-001", joined: isoDaysAgo(96) },
    { id: "CUS-502", name: "Priya Shah", phone: "+1 415 555 0188", shopId: "SL-SH-001", joined: isoDaysAgo(74) },
    { id: "CUS-503", name: "Noah Williams", phone: "+1 206 555 0143", shopId: "SL-SH-002", joined: isoDaysAgo(61) },
    { id: "CUS-504", name: "Sofia Rossi", phone: "+1 206 555 0177", shopId: "SL-SH-002", joined: isoDaysAgo(48) },
    { id: "CUS-505", name: "Kai Bennett", phone: "+1 312 555 0190", shopId: "SL-SH-003", joined: isoDaysAgo(39) },
    { id: "CUS-506", name: "Amara Okafor", phone: "+1 312 555 0126", shopId: "SL-SH-003", joined: isoDaysAgo(28) },
    { id: "CUS-507", name: "Liam Chen", phone: "+1 718 555 0155", shopId: "SL-SH-004", joined: isoDaysAgo(21) },
    { id: "CUS-508", name: "Emma Davis", phone: "+1 718 555 0134", shopId: "SL-SH-004", joined: isoDaysAgo(14) }
  ];

  const couponSeed = [
    ["SL-SH-001", "CUS-501", "CMP-1001", "DISC-30", "active", 1, 9],
    ["SL-SH-001", "CUS-502", "CMP-1002", "BOGO-1", "redeemed", 3, -2],
    ["SL-SH-001", "CUS-501", "CMP-1001", "DISC-10", "redeemed", 7, -6],
    ["SL-SH-001", "CUS-502", "CMP-1001", "DISC-90", "active", 0, 12],
    ["SL-SH-001", "CUS-501", "CMP-1002", "DISC-20", "expired", 32, -22],
    ["SL-SH-002", "CUS-503", "CMP-1003", "DISC-50", "active", 2, 8],
    ["SL-SH-002", "CUS-504", "CMP-1003", "BOGO-2", "redeemed", 5, -1],
    ["SL-SH-002", "CUS-503", "CMP-1003", "DISC-10", "active", 1, 10],
    ["SL-SH-002", "CUS-504", "CMP-1003", "DISC-70", "expired", 40, -30],
    ["SL-SH-003", "CUS-505", "CMP-1004", "BOGO-3", "active", 0, 14],
    ["SL-SH-003", "CUS-506", "CMP-1004", "DISC-30", "redeemed", 6, -3],
    ["SL-SH-003", "CUS-505", "CMP-1004", "DISC-20", "active", 4, 6],
    ["SL-SH-003", "CUS-506", "CMP-1005", "DISC-10", "active", 0, 21],
    ["SL-SH-004", "CUS-507", "CMP-1006", "DISC-50", "expired", 50, -40],
    ["SL-SH-004", "CUS-508", "CMP-1006", "BOGO-1", "redeemed", 18, -10],
    ["SL-SH-004", "CUS-507", "CMP-1006", "DISC-10", "expired", 46, -36]
  ];

  const couponCode = (index, shopId) => {
    const suffix = shopId.slice(-3);
    return "DEMO-" + suffix + "-" + String(1040 + index).padStart(4, "0");
  };

  SL.coupons = couponSeed.map((row, index) => {
    const [shopId, customerId, campaignId, rewardId, status, issuedDaysAgo, expiresInDays] = row;
    return {
      id: "CPN-" + String(900 + index),
      code: couponCode(index, shopId),
      shopId,
      customerId,
      campaignId,
      rewardId,
      status,
      issuedAt: isoDaysAgo(issuedDaysAgo),
      expiresAt: isoDaysAhead(expiresInDays),
      redeemedAt: status === "redeemed" ? isoDaysAgo(Math.max(0, issuedDaysAgo - 1)) : null,
      demo: true
    };
  });

  SL.adminUsers = [
    { id: "ADM-001", email: "super@shoelucky.demo", password: "demo1234", name: "Avery Stone", role: "super_admin", shopId: null },
    { id: "ADM-002", email: "owner@soletheory.demo", password: "demo1234", name: "Mia Chen", role: "shop_owner", shopId: "SL-SH-001" },
    { id: "ADM-003", email: "owner@kicksandco.demo", password: "demo1234", name: "Jordan Reed", role: "shop_owner", shopId: "SL-SH-002" }
  ];

  SL.analytics = {
    daily: [
      { day: "Mon", scans: 214, plays: 158, redeemed: 61 },
      { day: "Tue", scans: 268, plays: 191, redeemed: 74 },
      { day: "Wed", scans: 241, plays: 176, redeemed: 69 },
      { day: "Thu", scans: 319, plays: 232, redeemed: 91 },
      { day: "Fri", scans: 402, plays: 297, redeemed: 118 },
      { day: "Sat", scans: 486, plays: 351, redeemed: 142 },
      { day: "Sun", scans: 377, plays: 269, redeemed: 103 }
    ],
    funnel: [
      { label: "QR scans", value: 100 },
      { label: "Signed in", value: 74 },
      { label: "Games played", value: 58 },
      { label: "Coupons won", value: 56 },
      { label: "Redeemed", value: 27 }
    ]
  };

  /* Demo URL helpers. These produce links into this static prototype only. */
  SL.demoBaseUrl = function () {
    const href = window.location.href.split("#")[0];
    if (/^https?:\/\//.test(href)) return href;
    return "https://shoelucky.demo/";
  };

  SL.qrUrl = function (shopId, campaignId) {
    return SL.demoBaseUrl() + "#/login?shop=" + encodeURIComponent(shopId) + (campaignId ? "&campaign=" + encodeURIComponent(campaignId) : "");
  };

  SL.shopById = function (id) {
    return SL.state.shops.find((s) => s.id === id) || null;
  };

  SL.campaignById = function (id) {
    return SL.state.campaigns.find((c) => c.id === id) || null;
  };

  SL.rewardById = function (id) {
    return SL.state.rewards.find((r) => r.id === id) || null;
  };

  SL.customerById = function (id) {
    return SL.state.customers.find((c) => c.id === id) || null;
  };
})();
