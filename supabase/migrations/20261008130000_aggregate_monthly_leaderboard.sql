create or replace function public.get_competition_leaderboard(
    p_season_start date,
    p_season_end date,
    p_user_id uuid
)
returns table (
    rank integer,
    username text,
    points integer,
    wins integer,
    games integer,
    is_you boolean
)
language sql
stable
security definer
set search_path = ''
as $$
    with totals as (
        select
            p.id as user_id,
            p.username,
            sum(g.score)::integer as points,
            count(*) filter (where g.won)::integer as wins,
            count(*)::integer as games
        from public.competition_games as g
        join public.profiles as p on p.id = g.user_id
        where g.completed
          and g.puzzle_date >= p_season_start
          and g.puzzle_date < p_season_end
        group by p.id, p.username
    ),
    ranked as (
        select
            row_number() over (
                order by points desc, wins desc, lower(username), user_id
            )::integer as place,
            username,
            points,
            wins,
            games,
            user_id
        from totals
    )
    select
        place,
        username,
        points,
        wins,
        games,
        user_id = p_user_id
    from ranked
    where place <= 100 or user_id = p_user_id
    order by place;
$$;

revoke all on function public.get_competition_leaderboard(date, date, uuid) from public, anon, authenticated;
grant execute on function public.get_competition_leaderboard(date, date, uuid) to service_role;
