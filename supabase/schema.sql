-- 똥 피하기: 닉네임별 누적 랭킹 스키마
-- Supabase 대시보드 > SQL Editor 에 이 파일 전체를 붙여넣고 실행하세요.

create table if not exists public.leaderboard (
  name text primary key,
  best_hp smallint not null check (best_hp between 0 and 5),
  total_wins integer not null default 1,
  first_achieved_at timestamptz not null default now(),
  best_achieved_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 닉네임별 최고 기록만 갱신하는 원자적 upsert.
-- 이길 때마다 total_wins는 항상 +1 되고, best_hp는 이전 기록보다 높을 때만 갱신된다.
create or replace function public.upsert_leaderboard(p_name text, p_hp smallint)
returns setof public.leaderboard
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.leaderboard (name, best_hp, total_wins, first_achieved_at, best_achieved_at, updated_at)
  values (p_name, p_hp, 1, now(), now(), now())
  on conflict (name) do update set
    total_wins = leaderboard.total_wins + 1,
    best_hp = greatest(leaderboard.best_hp, excluded.best_hp),
    best_achieved_at = case
      when excluded.best_hp > leaderboard.best_hp then now()
      else leaderboard.best_achieved_at
    end,
    updated_at = now();

  return query select * from public.leaderboard where name = p_name;
end;
$$;

-- 서버는 service_role 키로 접속하므로 RLS를 켜서 다른 경로(anon 키)로는
-- 아무도 직접 읽고 쓸 수 없게 막아둔다. (읽기는 /api/leaderboard 를 통해서만)
alter table public.leaderboard enable row level security;
