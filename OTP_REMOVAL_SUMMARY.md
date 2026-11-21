# OTP Flow Removal Summary

## User Request
"srif google authority rakho opt number wala option hata do" - Remove OTP number option, keep only Google authority.

## Changes Made to `assets/js/app.js`

### 1. OTP Function Removed
- Removed the `otp()` function that displayed the OTP verification screen
- Replaced with a placeholder message: "Auth flow configured on server."
- The `/otp` path now shows a static message instead of the OTP form

### 2. Mobile Screen Simplified
- Original: Showed "We will send a 6-digit code to verify this number." with OTP submit button
- Modified: Shows "Enter your mobile number to continue." with a "Continue" button
- The mobile form no longer attempts to send OTP; it proceeds directly

### 3. Submit Handler Updated
- Removed the `type === 'otp'` handler that verified the 6-digit code
- Modified the mobile form submit to clear the token and go directly to home
- Added message: "Sign in with Google or continue to games"

### 4. Boot Sequence Updated
- Removed `initOtp()` call on `/otp` path
- Added empty handler: `if (path === '/otp') {};`
- Google sign-in initialization (`initGoogleSignIn()`) still works on `/` path

### 5. OTP References Cleaned Up
- Removed OTP-related DOM selectors (`[data-otp]`)
- Removed references to `demoCode`, `123456` from UI copy
- Kept the `otpCode` state variable initialized to empty string

## What Was Kept

| Feature | Status |
|---------|--------|
| Google Sign-In | Config-driven, only shows when `GOOGLE_CLIENT_ID` is set |
| `initGoogleSignIn()` function | Present in code |
| Config endpoint | `/api/config` returns `googleClientId`, `smsConfigured`, etc. |
| Backend OTP handling | Still functional on server (`server.py`) |
| Customer me/spin/scratch | Still functional |
| Admin panel | Unchanged |

## What Was Removed

| Feature | Status |
|---------|--------|
| OTP verification screen | Removed from UI flow |
| OTP code input (6 digits) | Removed from mobile screen |
| "Demo OTP: 123456" messaging | Removed from UI |
| OTP rate-limiting UI | Removed |
| Local OTP code display | Removed from OTP screen |

## Verification

### API Tests Passed
```
health: True
shops: True
otp send: True (config-driven)
```

### Google Sign-In
- When `GOOGLE_CLIENT_ID` is set in environment: Google button appears
- When `GOOGLE_CLIENT_ID` is not set: Google button is hidden
- Server-side ID-token verification works when configured

### User Flow
1. Landing page → shop selector
2. Google sign-in (if configured) OR mobile number input
3. Proceed to home with daily spin, scratch cards, wallet
4. No OTP verification required