-- end_date makes an annotation a span (drawn as a shaded band); detail is the longer text
-- for the tooltip, the narrow-screen list and the data table.
alter table annotations
    add column end_date date check (end_date > date),
    add column detail   text check (length(trim(detail)) > 0);
