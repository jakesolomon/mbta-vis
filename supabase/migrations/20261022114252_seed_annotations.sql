-- The chart's starting annotations (previously hardcoded in lib/events.ts).
-- Later ones are added by the admin through the site.
insert into annotations (date, end_date, label, mode_group, detail) values
    ('2020-03-10', null,         'COVID-19',             null,            'Massachusetts declares a state of emergency; ridership collapses'),
    ('2022-08-19', '2022-09-18', 'Orange Line shutdown', 'Subway',        '30-day full Orange Line shutdown for track and signal work'),
    ('2022-12-12', null,         'GLX Medford',          'Subway',        'Green Line Extension opens the Medford/Tufts branch'),
    ('2023-07-05', '2023-08-31', 'Free Blue Line',       'Subway',        'Sumner Tunnel closed; Blue Line fares free'),
    ('2025-03-24', null,         'South Coast Rail',     'Commuter rail', 'Commuter rail service to Fall River and New Bedford begins');
