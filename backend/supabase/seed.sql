-- Seed data for GymJam.
-- Re-runnable: existing gyms (matched by name) are left alone.

insert into gyms (name, location)
values
    ('PureGym Manchester',  'Manchester, UK'),
    ('The Gym Group',       'Manchester, UK'),
    ('Fitness First',       'Manchester, UK')
on conflict do nothing;
