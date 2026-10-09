create extension if not exists pgcrypto;

create table if not exists public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    username text not null,
    created_at timestamptz not null default now(),
    constraint profiles_username_format check (username ~ '^[A-Za-z0-9_]{3,20}$')
);

create unique index if not exists profiles_username_case_insensitive_idx
    on public.profiles (lower(username));

create table if not exists public.competition_answers (
    puzzle_date date primary key,
    answer text not null check (answer ~ '^[a-z]{5}$')
);

create table if not exists public.competition_allowed_guesses (
    word text primary key check (word ~ '^[a-z]{5}$')
);

create table if not exists public.competition_games (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references public.profiles (id) on delete cascade,
    puzzle_date date not null references public.competition_answers (puzzle_date),
    guesses text[] not null default '{}',
    feedback jsonb not null default '[]'::jsonb,
    completed boolean not null default false,
    won boolean not null default false,
    score integer not null default 0 check (score >= 0),
    completed_at timestamptz,
    created_at timestamptz not null default now(),
    unique (user_id, puzzle_date)
);

create index if not exists competition_games_season_idx
    on public.competition_games (puzzle_date, user_id)
    where completed;

create or replace function public.submit_competition_guess(
    p_user_id uuid,
    p_puzzle_date date,
    p_guess text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_game public.competition_games%rowtype;
    v_answer text;
    v_guess_feedback text[];
    v_remaining jsonb := '{}'::jsonb;
    v_letter text;
    v_letter_count integer;
    v_guesses text[];
    v_feedback jsonb;
    v_won boolean;
    v_completed boolean;
    v_score integer := 0;
    v_discovered text[] := '{}';
    v_index integer;
begin
    if p_guess !~ '^[a-z]{5}$' then
        return jsonb_build_object('error', 'Enter a valid five-letter guess.', 'status', 400);
    end if;

    select * into v_game
    from public.competition_games
    where user_id = p_user_id and puzzle_date = p_puzzle_date
    for update;

    if not found then
        return jsonb_build_object('error', 'Start today’s game before submitting a guess.', 'status', 409);
    end if;
    if v_game.completed then
        return jsonb_build_object('error', 'This day’s competition game is already complete.', 'status', 409);
    end if;
    if cardinality(v_game.guesses) >= 6 then
        return jsonb_build_object('error', 'No guesses remain.', 'status', 409);
    end if;
    if not exists (
        select 1 from public.competition_allowed_guesses
        where word = p_guess
    ) then
        return jsonb_build_object('error', 'That word is not in the competition dictionary.', 'status', 400);
    end if;

    select answer into v_answer
    from public.competition_answers
    where puzzle_date = p_puzzle_date;
    if not found then
        return jsonb_build_object('error', 'Today’s puzzle is not available yet.', 'status', 503);
    end if;

    v_guess_feedback := array_fill('absent'::text, array[5]);
    for v_index in 1..5 loop
        v_letter := substr(p_guess, v_index, 1);
        if v_letter = substr(v_answer, v_index, 1) then
            v_guess_feedback[v_index] := 'correct';
        else
            v_letter := substr(v_answer, v_index, 1);
            v_letter_count := coalesce((v_remaining ->> v_letter)::integer, 0);
            v_remaining := jsonb_set(v_remaining, array[v_letter], to_jsonb(v_letter_count + 1), true);
        end if;
    end loop;

    for v_index in 1..5 loop
        if v_guess_feedback[v_index] = 'correct' then
            continue;
        end if;
        v_letter := substr(p_guess, v_index, 1);
        v_letter_count := coalesce((v_remaining ->> v_letter)::integer, 0);
        if v_letter_count > 0 then
            v_guess_feedback[v_index] := 'present';
            v_remaining := jsonb_set(v_remaining, array[v_letter], to_jsonb(v_letter_count - 1), true);
        end if;
    end loop;

    v_guesses := v_game.guesses || p_guess;
    v_feedback := v_game.feedback || jsonb_build_array(to_jsonb(v_guess_feedback));
    v_won := p_guess = v_answer;
    v_completed := v_won or cardinality(v_guesses) >= 6;

    if v_completed and v_won then
        v_score := greatest(1, 7 - cardinality(v_guesses));
    elsif v_completed then
        for v_index in 1..5 loop
            v_letter := substr(v_answer, v_index, 1);
            if not (v_letter = any(v_discovered)) and exists (
                select 1
                from unnest(v_guesses) as submitted(word)
                where position(v_letter in submitted.word) > 0
            ) then
                v_discovered := array_append(v_discovered, v_letter);
            end if;
        end loop;
        v_score := cardinality(v_discovered);
    end if;

    update public.competition_games
    set guesses = v_guesses,
        feedback = v_feedback,
        completed = v_completed,
        won = v_won,
        score = v_score,
        completed_at = case when v_completed then now() else null end
    where id = v_game.id;

    return jsonb_build_object(
        'puzzleDate', p_puzzle_date,
        'guesses', to_jsonb(v_guesses),
        'feedback', v_feedback,
        'completed', v_completed,
        'won', v_won,
        'score', case when v_completed then v_score else null end,
        'maxGuesses', 6
    );
end;
$$;

revoke all on function public.submit_competition_guess(uuid, date, text) from public, anon, authenticated;
grant execute on function public.submit_competition_guess(uuid, date, text) to service_role;

create or replace function public.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
    requested_username text;
begin
    requested_username := coalesce(new.raw_user_meta_data ->> 'username', '');
    if requested_username !~ '^[A-Za-z0-9_]{3,20}$' then
        requested_username := 'player_' || left(replace(new.id::text, '-', ''), 12);
    end if;

    insert into public.profiles (id, username)
    values (new.id, requested_username);
    return new;
end;
$$;

drop trigger if exists on_auth_user_created_profile on auth.users;
create trigger on_auth_user_created_profile
    after insert on auth.users
    for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.competition_answers enable row level security;
alter table public.competition_allowed_guesses enable row level security;
alter table public.competition_games enable row level security;

drop policy if exists "Players can read their own profile" on public.profiles;
create policy "Players can read their own profile"
    on public.profiles for select to authenticated
    using ((select auth.uid()) = id);

drop policy if exists "Players can update their own username" on public.profiles;
create policy "Players can update their own username"
    on public.profiles for update to authenticated
    using ((select auth.uid()) = id)
    with check ((select auth.uid()) = id);

drop policy if exists "Players can read their own games" on public.competition_games;
create policy "Players can read their own games"
    on public.competition_games for select to authenticated
    using ((select auth.uid()) = user_id);

revoke all on public.competition_answers from anon, authenticated;
revoke all on public.competition_allowed_guesses from anon, authenticated;
revoke insert, update, delete on public.competition_games from anon, authenticated;
grant select, update (username) on public.profiles to authenticated;
grant select on public.competition_games to authenticated;
