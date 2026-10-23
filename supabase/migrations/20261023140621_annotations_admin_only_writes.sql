-- Limit annotation writes to the admin account, not any authenticated user, so turning on
-- sign-ups, anonymous sign-ins or an OAuth provider can't hand out write access.
-- (select auth.uid()) is evaluated once per statement rather than per row.
drop policy "authenticated users can add annotations" on annotations;
drop policy "authenticated users can edit annotations" on annotations;
drop policy "authenticated users can delete annotations" on annotations;

create policy "the admin can add annotations"
    on annotations for insert
    to authenticated
    with check ((select auth.uid()) = '32aef977-fc0c-4384-b5e6-f7bff5413937');

create policy "the admin can edit annotations"
    on annotations for update
    to authenticated
    using ((select auth.uid()) = '32aef977-fc0c-4384-b5e6-f7bff5413937')
    with check ((select auth.uid()) = '32aef977-fc0c-4384-b5e6-f7bff5413937');

create policy "the admin can delete annotations"
    on annotations for delete
    to authenticated
    using ((select auth.uid()) = '32aef977-fc0c-4384-b5e6-f7bff5413937');
