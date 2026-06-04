-- GymJam database schema
-- Run this in the Supabase SQL editor (Project → SQL Editor → New query) and execute.
-- It is idempotent — safe to re-run.

------------------------------------------------------------
-- Tables
------------------------------------------------------------

create table if not exists gyms (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    location text,
    created_at timestamptz not null default now()
);

create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    device_id text not null unique,
    display_name text not null default 'Anonymous',
    elo integer not null default 1000 check (elo >= 0),
    streak integer not null default 0 check (streak >= 0),
    gym_id uuid references gyms(id) on delete set null,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table if not exists groups (
    id uuid primary key default gen_random_uuid(),
    gym_id uuid not null references gyms(id) on delete cascade,
    name text not null,
    weekly_stake_elo integer not null default 500 check (weekly_stake_elo >= 0),
    join_type text not null default 'open' check (join_type in ('open', 'request')),
    leader_id uuid references users(id) on delete set null,
    -- Leader-chosen baseline pot conditions, persisted on the group itself so
    -- the values survive even if writes to pot_conditions silently fail.
    default_required_pledges smallint not null default 3
        check (default_required_pledges between 1 and 7),
    default_stake_per_miss integer not null default 100
        check (default_stake_per_miss >= 0),
    created_at timestamptz not null default now()
);

-- Idempotent column additions for existing deployments.
alter table groups add column if not exists default_required_pledges smallint
    not null default 3 check (default_required_pledges between 1 and 7);
alter table groups add column if not exists default_stake_per_miss integer
    not null default 100 check (default_stake_per_miss >= 0);

create table if not exists group_memberships (
    id uuid primary key default gen_random_uuid(),
    group_id uuid not null references groups(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    role text not null default 'member' check (role in ('member', 'leader')),
    joined_at timestamptz not null default now(),
    -- Dev-clock week the membership began (Monday). Used to treat the current
    -- week as no-stakes "practice" for mid-week joiners who missed its lock.
    joined_week_start date,
    unique (group_id, user_id),
    -- A user belongs to at most one group at a time.
    unique (user_id)
);

-- Additive migration for existing deployments. NULL on legacy rows means
-- "established member" — never treated as a mid-week joiner.
alter table group_memberships
    add column if not exists joined_week_start date;

create table if not exists join_requests (
    id uuid primary key default gen_random_uuid(),
    group_id uuid not null references groups(id) on delete cascade,
    user_id uuid not null references users(id) on delete cascade,
    status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
    created_at timestamptz not null default now(),
    resolved_at timestamptz
);

-- Prevent duplicate *pending* requests for the same (group, user).
create unique index if not exists join_requests_one_pending
    on join_requests(group_id, user_id)
    where status = 'pending';

create table if not exists weekly_plans (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references users(id) on delete cascade,
    group_id uuid references groups(id) on delete set null,
    week_start date not null,
    is_locked boolean not null default false,
    locked_at timestamptz,
    stake_elo integer not null default 0 check (stake_elo >= 0),
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    unique (user_id, week_start)
);

create table if not exists plan_days (
    id uuid primary key default gen_random_uuid(),
    plan_id uuid not null references weekly_plans(id) on delete cascade,
    day_of_week smallint not null check (day_of_week between 0 and 6),
    state text not null default 'unselected'
        check (state in ('unselected', 'planned', 'locked', 'checked-in', 'missed')),
    checked_in_at timestamptz,
    unique (plan_id, day_of_week)
);

-- Weekly pot conditions for a group. Each week, one member (the "setter",
-- rotated by joined_at order) decides required_pledges + stake_per_miss.
-- Frozen once is_finalized = true (when the setter locks their own plan or
-- the week starts).
create table if not exists pot_conditions (
    group_id uuid not null references groups(id) on delete cascade,
    week_start date not null,
    setter_user_id uuid references users(id) on delete set null,
    required_pledges smallint not null default 3
        check (required_pledges between 1 and 7),
    stake_per_miss integer not null default 100
        check (stake_per_miss >= 0),
    is_finalized boolean not null default false,
    -- The first week after a group is created is a no-stakes "practice" week.
    is_practice boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (group_id, week_start)
);

-- Backfill for existing deployments (the create-table above is skipped if the
-- table already exists, so add the column explicitly).
alter table pot_conditions
    add column if not exists is_practice boolean not null default false;

-- (pot_conditions_updated_at trigger is created in the triggers section below,
--  after set_updated_at() is defined.)

-- Decorative gym-space items placed by users into a 3x3 grid (slots 0..8).
create table if not exists user_room_items (
    user_id uuid not null references users(id) on delete cascade,
    item_id text not null,
    slot smallint not null check (slot between 0 and 8),
    primary key (user_id, item_id)
);

-- A slot can only hold one item per user.
create unique index if not exists user_room_items_unique_slot
    on user_room_items(user_id, slot);

-- Single-row development clock. `offset_days` shifts the app's notion of "today"
-- forward (in whole weeks) so the week-by-week flow can be demoed on demand.
create table if not exists dev_clock (
    id boolean primary key default true check (id),
    offset_days integer not null default 0
);
insert into dev_clock (id, offset_days) values (true, 0)
    on conflict (id) do nothing;

------------------------------------------------------------
-- Indexes
------------------------------------------------------------
create index if not exists users_device_id_idx       on users(device_id);
create index if not exists groups_gym_id_idx          on groups(gym_id);
create index if not exists memberships_user_idx       on group_memberships(user_id);
create index if not exists memberships_group_idx      on group_memberships(group_id);
create index if not exists join_requests_group_idx    on join_requests(group_id);
create index if not exists plans_user_week_idx        on weekly_plans(user_id, week_start);
create index if not exists plans_group_week_idx       on weekly_plans(group_id, week_start);
create index if not exists plan_days_plan_idx         on plan_days(plan_id);

------------------------------------------------------------
-- updated_at triggers
------------------------------------------------------------
create or replace function set_updated_at() returns trigger as $$
begin
    new.updated_at := now();
    return new;
end;
$$ language plpgsql;

drop trigger if exists users_updated_at on users;
create trigger users_updated_at
    before update on users
    for each row execute function set_updated_at();

drop trigger if exists weekly_plans_updated_at on weekly_plans;
create trigger weekly_plans_updated_at
    before update on weekly_plans
    for each row execute function set_updated_at();

drop trigger if exists pot_conditions_updated_at on pot_conditions;
create trigger pot_conditions_updated_at
    before update on pot_conditions
    for each row execute function set_updated_at();

------------------------------------------------------------
-- RPC: atomic ELO increment used by check-ins
------------------------------------------------------------
create or replace function add_elo(p_user_id uuid, p_delta integer)
returns users
language plpgsql
as $$
declare
    updated users;
begin
    update users
       set elo = elo + p_delta
     where id = p_user_id
    returning * into updated;
    return updated;
end;
$$;

------------------------------------------------------------
-- RLS
-- The FastAPI backend uses the service role key and bypasses RLS,
-- so we disable RLS on all app tables for now. Tighten when adding
-- direct-from-client Supabase access.
------------------------------------------------------------
alter table users               disable row level security;
alter table gyms                disable row level security;
alter table groups              disable row level security;
alter table group_memberships   disable row level security;
alter table join_requests       disable row level security;
alter table weekly_plans        disable row level security;
alter table plan_days           disable row level security;
alter table pot_conditions      disable row level security;
alter table user_room_items     disable row level security;
alter table dev_clock           disable row level security;
