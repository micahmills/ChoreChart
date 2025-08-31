-- Enable necessary extensions
create extension if not exists pgcrypto;

-- families
create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

-- users (profile) referencing auth.users
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  family_id uuid references public.families(id) on delete set null,
  name text not null,
  role text not null check (role in ('parent','child')),
  created_at timestamptz not null default now()
);

-- chores
create table if not exists public.chores (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  title text not null,
  type text not null check (type in ('daily','weekly','one-off')),
  due_date date not null,
  assigned_to uuid not null references public.users(id) on delete cascade,
  status text not null check (status in ('pending','done','approved')) default 'pending',
  created_at timestamptz not null default now()
);

-- approvals
create table if not exists public.approvals (
  id uuid primary key default gen_random_uuid(),
  chore_id uuid not null references public.chores(id) on delete cascade,
  approved_by uuid not null references public.users(id) on delete cascade,
  approved_at timestamptz not null default now()
);

-- streaks
create table if not exists public.streaks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  current_streak int not null default 0,
  longest_streak int not null default 0,
  updated_at timestamptz not null default now(),
  unique(user_id)
);

-- View to join streaks with user names and family_id for easy reads
create or replace view public.streaks_view as
select s.user_id, u.name, u.family_id, s.current_streak, s.longest_streak, s.updated_at
from public.streaks s
join public.users u on u.id = s.user_id;

-- Function: update streaks for a user based on new approval
create or replace function public.update_streak_on_approval(_chore_id uuid)
returns void
language plpgsql
security definer
as $$
declare
  v_user uuid;
  v_date date;
  v_prev_date date;
begin
  -- Set chore status to approved if not already
  update public.chores set status = 'approved' where id = _chore_id;

  -- Find assigned user and date approved (truncate to date)
  select c.assigned_to,
         (select date_trunc('day', a.approved_at)::date
            from public.approvals a
           where a.chore_id = _chore_id
           order by a.approved_at desc
           limit 1)
    into v_user, v_date
  from public.chores c
  where c.id = _chore_id;

  if v_user is null or v_date is null then
    return;
  end if;

  -- Ensure streak row exists
  insert into public.streaks(user_id, current_streak, longest_streak)
    values (v_user, 0, 0)
  on conflict (user_id) do nothing;

  -- Determine if yesterday was last updated; if so, increment, else reset to 1
  select date_trunc('day', s.updated_at)::date into v_prev_date
  from public.streaks s
  where s.user_id = v_user;

  if v_prev_date = (v_date - interval '1 day')::date then
    update public.streaks
      set current_streak = current_streak + 1,
          longest_streak = greatest(longest_streak, current_streak + 1),
          updated_at = v_date
      where user_id = v_user;
  elsif v_prev_date = v_date then
    -- same day multiple approvals, no change other than timestamp
    update public.streaks set updated_at = v_date where user_id = v_user;
  else
    update public.streaks
      set current_streak = 1,
          longest_streak = greatest(longest_streak, 1),
          updated_at = v_date
      where user_id = v_user;
  end if;
end;
$$;

-- Trigger on approvals insert to call update_streak_on_approval
create or replace function public.on_approval_after_insert()
returns trigger
language plpgsql
security definer
as $$
begin
  perform public.update_streak_on_approval(new.chore_id);
  return new;
end; $$;

drop trigger if exists trg_approvals_after_insert on public.approvals;
create trigger trg_approvals_after_insert
  after insert on public.approvals
  for each row execute procedure public.on_approval_after_insert();

-- RLS
alter table public.families enable row level security;
alter table public.users enable row level security;
alter table public.chores enable row level security;
alter table public.approvals enable row level security;
alter table public.streaks enable row level security;

-- Helper: get current user's family_id
create or replace function public.current_family_id()
returns uuid language sql stable as $$
  select family_id from public.users where id = auth.uid()
$$;

-- families policies
create policy "families_select_members" on public.families for select
  using (exists (select 1 from public.users u where u.family_id = families.id and u.id = auth.uid()));
create policy "families_insert_any_auth" on public.families for insert
  with check (auth.role() = 'authenticated');
create policy "families_update_by_parents" on public.families for update
  using (exists (select 1 from public.users u where u.family_id = families.id and u.id = auth.uid() and u.role = 'parent'));

-- users policies
create policy "users_self_read_family_read" on public.users for select
  using (id = auth.uid());
create policy "users_insert_self" on public.users for insert
  with check (id = auth.uid());
create policy "users_update_self_or_parent" on public.users for update
  using (id = auth.uid() or (family_id = public.current_family_id() and exists (select 1 from public.users p where p.id = auth.uid() and p.role = 'parent' and p.family_id = users.family_id)));

-- chores policies
create policy "chores_family_select" on public.chores for select
  using (family_id = public.current_family_id());
create policy "chores_parent_insert" on public.chores for insert
  with check (
    family_id = public.current_family_id() and
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'parent' and u.family_id = chores.family_id)
  );
create policy "chores_child_mark_done" on public.chores for update
  using (
    family_id = public.current_family_id() and assigned_to = auth.uid()
  ) with check (
    status in ('pending','done')
  );
create policy "chores_parent_update" on public.chores for update
  using (
    family_id = public.current_family_id() and exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'parent' and u.family_id = chores.family_id)
  );

-- approvals policies
create policy "approvals_family_select" on public.approvals for select
  using (exists (
    select 1 from public.chores c
    where c.id = approvals.chore_id and c.family_id = public.current_family_id()
  ));
create policy "approvals_parent_insert" on public.approvals for insert
  with check (
    exists (select 1 from public.users u where u.id = auth.uid() and u.role = 'parent') and
    exists (select 1 from public.chores c where c.id = approvals.chore_id and c.family_id = public.current_family_id())
  );

-- streaks policies (readable to family, updatable via trigger only)
create policy "streaks_family_select" on public.streaks for select
  using (exists (select 1 from public.users u where u.id = streaks.user_id and u.family_id = public.current_family_id()));
-- No direct insert/update policy for clients; trigger functions update it