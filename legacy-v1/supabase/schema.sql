-- ShoeLucky prototype reference schema (Supabase PostgreSQL)
--
-- IMPORTANT: This schema is provided to make the prototype's data model clear.
-- It is not deployed by the static app. In production, all privileged writes
-- (OTP verification, game assignment, reward selection, coupon issuing,
-- redemption) must happen in trusted server-side code / Edge Functions.
-- Never trust the browser for these operations.

create extension if not exists "pgcrypto";

do $$ begin
  create type public.shop_status as enum ('active', 'paused', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.campaign_status as enum ('draft', 'active', 'paused', 'ended');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.game_mode as enum ('spin', 'scratch', 'random');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.reward_type as enum ('discount', 'bogo');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.coupon_status as enum ('active', 'redeemed', 'expired', 'void');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.admin_role as enum ('super_admin', 'shop_owner');
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Shops and campaigns
-- ---------------------------------------------------------------------------
create table if not exists public.shops (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  area text,
  city text,
  owner_name text,
  owner_email text,
  status public.shop_status not null default 'active',
  accent text default '#d4af37',
  created_at timestamptz not null default now()
);

create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  shop_id uuid not null references public.shops(id) on delete cascade,
  name text not null,
  game_mode public.game_mode not null default 'spin',
  status public.campaign_status not null default 'draft',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists campaigns_shop_idx on public.campaigns(shop_id);

-- Every shop gets a stable public QR token. The QR URL should point to a
-- server-side route that resolves the token to a campaign, never to a
-- client-trusted shop id alone.
create table if not exists public.qr_campaign_tokens (
  token text primary key,
  shop_id uuid not null references public.shops(id) on delete cascade,
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Rewards
-- ---------------------------------------------------------------------------
create table if not exists public.rewards (
  id text primary key,
  label text not null,
  short_label text not null,
  type public.reward_type not null,
  value integer not null check (value > 0),
  weight integer not null default 1 check (weight >= 0),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Customers and OTP (codes must be hashed server-side in real use)
-- ---------------------------------------------------------------------------
create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  name text,
  created_at timestamptz not null default now()
);

create table if not exists public.customer_shops (
  customer_id uuid not null references public.customers(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  first_seen_at timestamptz not null default now(),
  primary key (customer_id, shop_id)
);

create table if not exists public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  phone text not null,
  code_hash text not null,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  attempts integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists otp_phone_idx on public.otp_codes(phone, created_at desc);

-- ---------------------------------------------------------------------------
-- Games and coupons
-- ---------------------------------------------------------------------------
create table if not exists public.game_assignments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  game public.game_mode not null,
  assigned_at timestamptz not null default now()
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  customer_id uuid not null references public.customers(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  campaign_id uuid references public.campaigns(id) on delete set null,
  reward_id text not null references public.rewards(id),
  status public.coupon_status not null default 'active',
  issued_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_at timestamptz,
  redeemed_by uuid,
  -- Server-issued signature or token digest. The client never creates this.
  server_token_hash text,
  created_at timestamptz not null default now()
);

create index if not exists coupons_customer_idx on public.coupons(customer_id);
create index if not exists coupons_shop_idx on public.coupons(shop_id);
create index if not exists coupons_status_idx on public.coupons(status);

create table if not exists public.coupon_redemptions (
  id uuid primary key default gen_random_uuid(),
  coupon_id uuid not null unique references public.coupons(id) on delete cascade,
  shop_id uuid not null references public.shops(id) on delete cascade,
  redeemed_by uuid not null,
  redeemed_at timestamptz not null default now(),
  note text
);

-- ---------------------------------------------------------------------------
-- Admin profiles
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role public.admin_role not null default 'shop_owner',
  shop_id uuid references public.shops(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists profiles_shop_idx on public.profiles(shop_id);

-- ---------------------------------------------------------------------------
-- Helper functions for RLS
-- ---------------------------------------------------------------------------
create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'super_admin'
  );
$$;

create or replace function public.owns_shop(target_shop uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'shop_owner'
      and p.shop_id = target_shop
  );
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security (illustrative; harden and test before production)
-- ---------------------------------------------------------------------------
alter table public.shops enable row level security;
alter table public.campaigns enable row level security;
alter table public.qr_campaign_tokens enable row level security;
alter table public.rewards enable row level security;
alter table public.customers enable row level security;
alter table public.customer_shops enable row level security;
alter table public.game_assignments enable row level security;
alter table public.coupons enable row level security;
alter table public.coupon_redemptions enable row level security;
alter table public.profiles enable row level security;

drop policy if exists shops_read on public.shops;
create policy shops_read on public.shops
  for select to authenticated
  using (public.is_super_admin() or public.owns_shop(id) or status = 'active');

drop policy if exists shops_write on public.shops;
create policy shops_write on public.shops
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists campaigns_read on public.campaigns;
create policy campaigns_read on public.campaigns
  for select to authenticated
  using (public.is_super_admin() or public.owns_shop(shop_id));

drop policy if exists campaigns_write on public.campaigns;
create policy campaigns_write on public.campaigns
  for all to authenticated
  using (public.is_super_admin() or public.owns_shop(shop_id))
  with check (public.is_super_admin() or public.owns_shop(shop_id));

drop policy if exists rewards_read on public.rewards;
create policy rewards_read on public.rewards for select to authenticated using (true);

drop policy if exists rewards_write on public.rewards;
create policy rewards_write on public.rewards
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

drop policy if exists coupons_read_own on public.coupons;
create policy coupons_read_own on public.coupons
  for select to authenticated
  using (
    public.is_super_admin()
    or public.owns_shop(shop_id)
    or exists (
      select 1 from public.customers c
      where c.id = customer_id and c.phone = coalesce(current_setting('request.jwt.claims', true)::jsonb->>'phone', '')
    )
  );

-- Coupon writes normally happen in a trusted Edge Function using a service key.
-- These policies only allow a narrow local-update path for demo parity.
drop policy if exists coupons_redeem on public.coupons;
create policy coupons_redeem on public.coupons
  for update to authenticated
  using (public.is_super_admin() or public.owns_shop(shop_id))
  with check (public.is_super_admin() or public.owns_shop(shop_id));

drop policy if exists redemptions_read on public.coupon_redemptions;
create policy redemptions_read on public.coupon_redemptions
  for select to authenticated
  using (public.is_super_admin() or public.owns_shop(shop_id));

drop policy if exists redemptions_write on public.coupon_redemptions;
create policy redemptions_write on public.coupon_redemptions
  for insert to authenticated
  with check (public.is_super_admin() or public.owns_shop(shop_id));

drop policy if exists profiles_self on public.profiles;
create policy profiles_self on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_super_admin());

-- Notes for server-side implementation:
-- 1. Verify OTP by comparing a hash, enforce expiry + attempt limits, then issue
--    a short-lived signed session. Never accept "123456" as production auth.
-- 2. Select game and reward in an Edge Function using the active reward pool.
-- 3. Generate coupon codes server-side with high entropy; store only a hash if
--    the code is presented by clients.
-- 4. Redeem inside a database transaction that locks the coupon row, checks
--    shop scope, expiry, status, and server token, then writes the redemption.
-- 5. Rate-limit scans, OTP requests, spins, and redemption attempts.
