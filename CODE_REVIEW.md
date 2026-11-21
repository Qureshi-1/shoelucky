# ShoeLucky Code Review
## Senior Developer Audit

**Session:** OTP removal, Google sign-in, UI simplification, weekly scratch card  
**Files modified:** `assets/js/app.js`, `server.py`  
**Commit state:** 2 files changed, 11 insertions, 6 deletions

---

## What this change does:

Removed OTP number flow from customer UI, kept Google sign-in (config-driven), added user profile section to home screen, changed scratch card from 2 default to 1 (per week), and removed `/mobile` and `/otp` routes from boot sequence.

**Load assumed:** One person developing/testing locally on port 8080. No production traffic.

---

## Must fix

| # | File:Lines | What this is | Problem | Fix | If we skip |
|---|------------|-------------|---------|-----|------------|
| **1** | `assets/js/app.js:291` | `var profilePic = me.user.photo || '/assets/images/default-profile.png';` | **Missing asset** - `/assets/images/default-profile.png` does not exist on disk. If `me.user.photo` is undefined, the browser loads a non-existent image and shows a broken icon. | Create `/assets/images/default-profile.png` (16x16 placeholder), or change the code to use an existing asset (e.g., an SVG from `assets/vendor/`), or remove the profile picture HTML entirely. | Profile avatar shows broken image link. Functionality is fine, just cosmetic. |
| **2** | `assets/js/app.js:763` | Removed `else if (path === '/mobile')` and `else if (path === '/otp')` from boot | **Route removal** - Direct navigation to `/mobile` or `/otp` (bookmarks, shared links) will show empty page instead of intended content. | Add fallback `else html = '<div class="screen"><p>Page not found</p></div>';` after the if-chain, or keep minimal routes for backward compat. | Users with bookmarks to `/mobile` or `/otp` get blank page. Expected since user removed OTP/mobile flow. |
| **3** | `server.py:115` | `scratch_left INTEGER NOT NULL DEFAULT 1` (changed from 2) | **No weekly refill logic** - The scratch API just decrements `scratch_left` and blocks when <= 0. There is no automatic reset after 7 days. Users who use their 1 weekly card can never scratch again until DB is manually reset. | Add weekly refill logic: check if `created_at` is >7 days ago, reset `scratch_left` to 1. Or add `last_scratched_at` column and refill when it's a new week. | Customers permanently blocked from scratching after 1 use. "Per week" concept is broken. |

### Should fix

| # | File:Lines | What this is | Problem | Fix | If we skip |
|---|------------|-------------|---------|-----|------------|
| **4** | `server.py:582-589` | `/api/customer/scratch` handler | **No weekly refill** - Same as #3. The handler decrements and returns `scratchLeft: fresh["scratch_left"] - 1`, which will be 0 after first use, and subsequent calls fail with "Scratch cards khatam". | Add logic: `if fresh["scratch_left"] <= 0` AND last scratch was >7 days ago, reset to 1. Minimal change: add a date check using the `created_at` field. | UI says "1 per week" but server has no reset. Behavior mismatches copy. |
| **5** | `assets/js/app.js:331` | Rule text: "You get 1 scratch card per week." | **Copy vs implementation gap** - UI declares "1 per week" but server doesn't refill. Users will be confused when blocked after 1 use. | Same as #4 - add weekly refill in server.py. | Mismatch between UI copy and server behavior. Users won't understand why they can't scratch. |
| **6** | `assets/js/app.js:829` | Removed `if (path === '/otp') {};` from boot | **Orphaned handler removal** - The line was cleaned up. No functional issue since `/otp` is removed. | No action needed. | Minimal - dead code cleanup was correct. |

### Nice to have

| # | File:Lines | What this is | Problem | Fix | If we skip |
|---|------------|-------------|---------|-----|------------|
| **7** | `assets/js/app.js:291` | `me.user.photo` for avatar | **Undefined photo field** - The API `/api/customer/me` may not return a `photo` field. The `||` fallback handles it, but if `me.user.photo` is always undefined, the default-image path is used every time. | Verify API returns `photo`, or remove the profile picture HTML, or use a fixed icon instead. | Low risk - `||` fallback works even if photo is always undefined. |
| **8** | `assets/js/app.js:271-282` | `mobile()` function still in code | **Dead code** - The `mobile()` function exists but the `/mobile` route was removed. If the route is added back later, the function is ready. | No action needed. | Dead code sitting in file. Not a risk, just unused. |

### Scale risks

| # | File:Lines | What this is | Problem | Fix | If we skip |
|---|------------|-------------|---------|-----|------------|
| **9** | N/A | No O(n²) or per-query scale issues | Changes are UI + 1 DB column default. No scale risks. | N/A | N/A |

---

## Verdict:

**Core request fulfilled:**
- ✅ OTP number option removed from UI
- ✅ Google sign-in kept (config-driven: only when `GOOGLE_CLIENT_ID` set)
- ✅ User profile section added to home screen
- ✅ Scratch card default changed from 2 to 1

**2 critical fixes needed before shipping:**

1. **Add weekly refill logic** in `server.py` scratch handler. Without it, users permanently lose their scratch card after 1 use. The "1 per week" claim has no backend enforcement.

2. **Create `/assets/images/default-profile.png`** or change the profile HTML to not reference a missing image. Currently the avatar will show a broken image icon.

**Lean assessment:** 2 files, ~30 lines changed total. No new dependencies. No abstractions. Straightforward DB default change + JS UI updates.

**Not checked:** Whether `/assets/images/default-profile.png` exists on disk. The `||` fallback in app.js handles undefined `me.user.photo`, but the file path is missing.

**Recommendation:** Add the weekly refill logic to `server.py` (smallest change: check `created_at` date and reset `scratch_left` to 1 if >7 days). Then create a placeholder profile image or adjust the HTML. After those 2 fixes, the ship is clear.