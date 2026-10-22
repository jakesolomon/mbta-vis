-- Chart annotations, added by the admin through the site (so not reproducible: don't reset them away).
-- mode_group is null for an event that applies to every mode.
create table annotations (
    id          bigint generated always as identity primary key,
    date        date not null,
    label       text not null check (length(trim(label)) > 0),
    mode_group  text check (mode_group in ('Subway', 'Bus', 'Commuter rail', 'Ferry')),
    created_at  timestamptz not null default now()
);

-- Anyone can read; only signed-in users can add or remove.
-- Sign-ups are disabled, so "authenticated" means the admin account created in the dashboard.
alter table annotations enable row level security;

create policy "annotations are publicly readable"
    on annotations for select
    to anon, authenticated
    using (true);

create policy "authenticated users can add annotations"
    on annotations for insert
    to authenticated
    with check (true);

create policy "authenticated users can delete annotations"
    on annotations for delete
    to authenticated
    using (true);
