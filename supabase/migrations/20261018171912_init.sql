create table ridership_raw (
    mode   text not null,
    tos    text not null,
    month  date not null,
    trips  bigint not null,
    primary key (mode, tos, month)
);

create view ridership_monthly as
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
        group by 1, 2;

create view ridership_vs_2019 as
select m.mode_group, m.month, m.trips,
       m.trips::numeric / b.trips as pct_of_2019
from ridership_monthly m
         join ridership_monthly b
              on b.mode_group = m.mode_group
                  and b.month = make_date(2019, extract(month from m.month)::int, 1);
