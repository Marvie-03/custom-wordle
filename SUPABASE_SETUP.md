# Supabase setup

The training game continues to work without Supabase. Competition mode requires a Supabase project and uses Auth, Postgres, and the `competition` Edge Function. The competition answer is read only by the Edge Function and is never returned to the browser.

## 1. Create and configure the project

1. Create a project at [supabase.com](https://supabase.com/).
2. In **Project Settings → API**, copy the project URL and the **anon/public** key.
3. In **Authentication → Providers**, enable Email and Google as desired. Google OAuth also needs the provider's client ID/secret and the Supabase callback URL configured in the Google developer console.
4. Add the project URL and anon key to `supabase-config.js`. These are public browser values; never put the service-role key in frontend files.

## 2. Apply the database migration

Install the Supabase CLI, authenticate, link the project, then run:

```sh
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

The migration creates user profiles, private answer and guess tables, and one game row per player per UTC puzzle date. RLS prevents browsers from reading answers or writing scores directly. Usernames must be unique and contain 3–20 letters, digits, or underscores. Google sign-in creates a temporary account-derived username; players must change it in Profile before their first competition game.

## 3. Add words and schedule puzzles

The initial seed migration has loaded 507 unique, lowercase, five-letter guesses from the existing training bank into `public.competition_allowed_guesses`. To expand that list later, run `node scripts/export-competition-guesses.js > competition-guesses.csv`; review the generated CSV (`word` column), then import additional entries with the Supabase Table Editor or SQL Editor.

The answer schedule is intentionally separate: schedule exactly one reviewed answer per UTC date in `public.competition_answers`. Prepare answer rows well in advance; the competition function returns an explicit unavailable response if a date has no scheduled answer. Normalize words to lowercase ASCII and check duplicates and spelling before import.

Example SQL for a single scheduled day:

```sql
insert into public.competition_answers (puzzle_date, answer)
values ('2026-11-01', 'apple');

insert into public.competition_allowed_guesses (word)
values ('apple'), ('raise'), ('quiet')
on conflict (word) do nothing;
```

Keep the answer pool human-reviewed for familiarity, spelling, and appropriateness. The allowed-guess dictionary can be substantially larger than the answer schedule.

## 4. Deploy the server function

```sh
supabase functions deploy competition
```

The CLI supplies the project URL and service-role key to the function runtime. Do not expose or commit a service-role key. The function checks the signed-in user, serves only feedback, enforces six guesses, assigns 6–1 points for a win, and awards one point for each distinct answer letter discovered on a loss (zero if no answer letters were found). Leaderboard points are summed across completed daily games for the selected calendar month; ties are broken by wins and then username.

## 5. Run the app

Serve the project over HTTP (not by opening `index.html` directly), then use the sign-in/profile panel to create an account and select a username. Competition resets on the UTC calendar date. Add future puzzle answers before their dates to avoid an unavailable daily game.

## Notes

- Monthly season totals are calculated from dated game records; prior months remain queryable by the function. The initial October daily schedule has been loaded; schedule the next month's answers before that season begins.
- One account can have one game row per puzzle date. Supabase Auth does not prevent a person from creating multiple accounts or sharing answers outside the app.
- Training remains local and continues to use `word-lists.js`; its client-side answer is intentionally independent of competition answers.
