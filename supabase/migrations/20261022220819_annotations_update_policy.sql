-- Let the admin edit annotations in place (insert and delete are in 20261022113612_annotations.sql).
create policy "authenticated users can edit annotations"
    on annotations for update
    to authenticated
    using (true)
    with check (true);
