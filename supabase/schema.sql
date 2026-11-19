-- Run in the Supabase SQL editor.
create table if not exists public.chat_logs (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  ip_hash text,
  question text not null,
  answer text,
  model text,
  status text not null default 'ok'
);

create index if not exists chat_logs_created_at_idx on public.chat_logs (created_at desc);

-- Only the server (service role key) may access logs; the service role bypasses RLS.
alter table public.chat_logs enable row level security;
