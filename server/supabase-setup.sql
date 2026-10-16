-- ছোট কাজ (ChotoKaj) — Supabase সেটআপ
-- চালানোর জায়গা: Supabase Dashboard → SQL Editor → New query → এই পুরো লেখাটা পেস্ট করে Run

-- ১) অ্যাপের ডেটা রাখার টেবিল (একটাই সারি, ভিতরে পুরো ডেটা JSON হিসেবে থাকে)
create table if not exists public.ck_state (
  id int primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
insert into public.ck_state (id, data) values (1, '{}'::jsonb)
on conflict (id) do nothing;

-- ২) স্ক্রিনশট রাখার স্টোরেজ বালতি (public — যাতে অ্যাপে ছবি দেখা যায়)
insert into storage.buckets (id, name, public)
values ('proofs', 'proofs', true)
on conflict (id) do nothing;
