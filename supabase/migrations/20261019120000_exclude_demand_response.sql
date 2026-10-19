-- Leave demand response (DR, The RIDE paratransit) out of the mode groups; it previously fell through to a null mode_group.
create or replace view ridership_monthly as
select
    case mode
        when 'HR' then 'Subway' when 'LR' then 'Subway'
        when 'MB' then 'Bus' when 'RB' then 'Bus' when 'TB' then 'Bus'
        when 'CR' then 'Commuter rail'
        when 'FB' then 'Ferry'
        end as mode_group,
        month,
        sum(trips) as trips
        from ridership_raw
        where mode <> 'DR'
        group by 1, 2;
