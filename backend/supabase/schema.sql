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

-- Coordinates for the Squad Map (members' home gyms plotted on a map). Nullable
-- so older rows / un-geocoded gyms simply don't render a pin.
alter table gyms add column if not exists latitude double precision;
alter table gyms add column if not exists longitude double precision;

create table if not exists users (
    id uuid primary key default gen_random_uuid(),
    device_id text not null unique,
    display_name text not null default 'Anonymous',
    -- Chosen pixel-art avatar id (see frontend avatar catalog). NULL ⇒ initials.
    avatar text,
    elo integer not null default 0 check (elo >= 0),
    streak integer not null default 0 check (streak >= 0),
    gym_id uuid references gyms(id) on delete set null,
    -- Opt-in live location sharing (Snap-Maps style); broadcast to the user's
    -- group only while share_location is true and the fix is recent.
    share_location boolean not null default false,
    latitude double precision,
    longitude double precision,
    location_updated_at timestamptz,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

-- Additive migrations for existing deployments.
alter table users add column if not exists avatar text;
-- New users start at 0 ELO (Beginner) rather than the old 1000 default.
alter table users alter column elo set default 0;
alter table users add column if not exists share_location boolean not null default false;
alter table users add column if not exists latitude double precision;
alter table users add column if not exists longitude double precision;
alter table users add column if not exists location_updated_at timestamptz;

-- Auth-based account migration: link Supabase auth.users to app users.
alter table users add column if not exists auth_user_id uuid unique;
create index if not exists users_auth_user_id_idx on users(auth_user_id);

-- Unique username handle (displayed as #tag). Lowercase, 3–20 chars.
alter table users add column if not exists tag text unique;

-- How many times the user has changed their tag (capped at 1 change after initial set).
alter table users add column if not exists tag_changes integer not null default 0;

-- Make device_id optional so OAuth-only accounts can be created without it.
alter table users alter column device_id drop not null;

-- Mocked wallet for money-stake groups. Stored in PENCE (integer) to mirror the
-- integer ELO math and avoid floating-point drift. `money` is the current
-- deposited balance; `money_week_change` is the net delta from the most recent
-- Sunday pot payout (drives the Wallet's "this week" stat).
alter table users add column if not exists money integer not null default 0;
alter table users add column if not exists money_week_change integer not null default 0;

create table if not exists groups (
    id uuid primary key default gen_random_uuid(),
    -- Groups are global (decoupled from gyms). gym_id is retained only as an
    -- optional "origin" hint and no longer gates group visibility.
    gym_id uuid references gyms(id) on delete set null,
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
    -- The member whose turn it currently is to set the upcoming week's pot
    -- rules. The role rotates weekly through the membership; this column mirrors
    -- the computed rotation so it is directly queryable.
    current_rule_setter_id uuid references users(id) on delete set null,
    -- Whether the group's pot is denominated in ELO or real (mocked) money.
    -- Money groups are private-only. For money groups the per-week stake is
    -- £1–£20 and `weekly_stake_elo` / pot `stake_per_miss` hold PENCE.
    stake_type text not null default 'elo' check (stake_type in ('elo', 'money')),
    created_at timestamptz not null default now()
);

-- Decouple groups from gyms on existing deployments: gym_id is now optional so
-- groups are global and a user's home gym no longer gates eligibility.
alter table groups alter column gym_id drop not null;
alter table groups add column if not exists stake_type text not null default 'elo'
    check (stake_type in ('elo', 'money'));

-- Idempotent column additions for existing deployments.
alter table groups add column if not exists default_required_pledges smallint
    not null default 3 check (default_required_pledges between 1 and 7);
alter table groups add column if not exists default_stake_per_miss integer
    not null default 100 check (default_stake_per_miss >= 0);
alter table groups add column if not exists current_rule_setter_id uuid
    references users(id) on delete set null;

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
        check (state in ('unselected', 'planned', 'locked', 'checked-in', 'missed', 'rescheduled')),
    checked_in_at timestamptz,
    unique (plan_id, day_of_week)
);

-- Allow the 'rescheduled' state on existing deployments (a missed day that was
-- excused for "unforeseen circumstances" — either moved to next week or settled
-- with a 50% penalty when next week was full).
alter table plan_days drop constraint if exists plan_days_state_check;
alter table plan_days add constraint plan_days_state_check
    check (state in ('unselected', 'planned', 'locked', 'checked-in', 'missed', 'rescheduled'));

-- Weekly pot conditions for a group. Each week, one member (the "setter",
-- rotated by joined_at order) decides required_pledges + stake_per_miss.
-- Frozen once is_finalized = true (when the setter locks their own plan or
-- the week starts).
create table if not exists pot_conditions (
    group_id uuid not null references groups(id) on delete cascade,
    week_start date not null,
    setter_user_id uuid references users(id) on delete set null,
    required_pledges smallint not null
        check (required_pledges between 1 and 7),
    stake_per_miss integer not null
        check (stake_per_miss >= 0),
    is_finalized boolean not null default false,
    -- Pot currency for THIS week ('elo' or 'money'). Stored per-week so changing
    -- a group's stake type only affects future weeks — the current week keeps the
    -- type it started with. Defaults to 'elo'; seeded from the group at creation.
    stake_type text not null default 'elo' check (stake_type in ('elo', 'money')),
    -- The first week after a group is created is a no-stakes "practice" week.
    is_practice boolean not null default false,
    -- Set once the week's pot has been paid out (see settle_due_weeks below),
    -- so a finished week is distributed exactly once no matter how many times
    -- it's revisited (e.g. the dev clock stepping back and forth over it).
    is_settled boolean not null default false,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    primary key (group_id, week_start)
);

-- Backfill for existing deployments (the create-table above is skipped if the
-- table already exists, so add the columns explicitly).
alter table pot_conditions
    add column if not exists is_practice boolean not null default false;
alter table pot_conditions
    add column if not exists is_settled boolean not null default false;
alter table pot_conditions
    add column if not exists stake_type text not null default 'elo'
        check (stake_type in ('elo', 'money'));
-- Backfill existing per-week rows from the group's current type (one-time; the
-- column defaults to 'elo' which would otherwise mislabel existing money pots).
update pot_conditions pc
    set stake_type = g.stake_type
    from groups g
    where pc.group_id = g.id and pc.stake_type = 'elo' and g.stake_type = 'money';

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

-- Nudges: a member pokes another member to get to the gym. Used both to
-- surface "X nudged you" in the activity feed and to rate-limit the button
-- (at most one from→to nudge per hour).
create table if not exists nudges (
    id uuid primary key default gen_random_uuid(),
    group_id uuid not null references groups(id) on delete cascade,
    from_user_id uuid not null references users(id) on delete cascade,
    to_user_id uuid not null references users(id) on delete cascade,
    created_at timestamptz not null default now()
);
create index if not exists nudges_to_idx   on nudges(to_user_id, created_at desc);
create index if not exists nudges_pair_idx on nudges(from_user_id, to_user_id, created_at desc);

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
-- RPC: atomic money increment (pence) used by money-pot settlement.
-- Clamps at 0 so a balance can never go negative.
------------------------------------------------------------
create or replace function add_money(p_user_id uuid, p_delta integer)
returns users
language plpgsql
as $$
declare
    updated users;
begin
    update users
       set money = greatest(0, money + p_delta)
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
alter table nudges              disable row level security;
alter table dev_clock           disable row level security;
 