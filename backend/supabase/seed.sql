-- Seed data for GymJam.
-- Re-runnable: existing gyms (matched by name) are left alone.

insert into gyms (name, location)
values
    ('PureGym Manchester',  'Manchester, UK'),
    ('The Gym Group',       'Manchester, UK'),
    ('Fitness First',       'Manchester, UK'),
    ('PureGym London Bridge', 'London, UK'),
    ('The Gym Group Bristol', 'Bristol, UK'),
    ('Edinburgh Fitness Club', 'Edinburgh, UK'),
    ('Cardiff Central Gym',  'Cardiff, UK'),
    ('Leeds Strength & Conditioning', 'Leeds, UK')
on conflict do nothing;

-- Backfill coordinates (members' home gyms are plotted on the Squad Map — these
-- are approximate city-centre coordinates, keyed by name so re-running is safe).
update gyms set latitude = 53.4808, longitude = -2.2426 where name = 'PureGym Manchester' and latitude is null;
update gyms set latitude = 53.4831, longitude = -2.2447 where name = 'The Gym Group' and latitude is null;
update gyms set latitude = 53.4794, longitude = -2.2453 where name = 'Fitness First' and latitude is null;
update gyms set latitude = 51.5050, longitude = -0.0865 where name = 'PureGym London Bridge' and latitude is null;
update gyms set latitude = 51.4545, longitude = -2.5879 where name = 'The Gym Group Bristol' and latitude is null;
update gyms set latitude = 55.9533, longitude = -3.1883 where name = 'Edinburgh Fitness Club' and latitude is null;
update gyms set latitude = 51.4816, longitude = -3.1791 where name = 'Cardiff Central Gym' and latitude is null;
update gyms set latitude = 53.8008, longitude = -1.5491 where name = 'Leeds Strength & Conditioning' and latitude is null;
