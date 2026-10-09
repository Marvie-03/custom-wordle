import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const maxGuesses = 6;

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function utcDate() {
  return new Date().toISOString().slice(0, 10);
}

async function getGame(admin: ReturnType<typeof createClient>, userId: string, puzzleDate: string) {
  const { data, error } = await admin
    .from("competition_games")
    .select("guesses, feedback, completed, won, score")
    .eq("user_id", userId)
    .eq("puzzle_date", puzzleDate)
    .maybeSingle();
  if (error) throw error;
  return data;
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (request.method !== "POST") return response({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return response({ error: "Sign in to play competition." }, 401);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) {
    console.error("Competition function is missing Supabase environment variables.");
    return response({ error: "Competition is temporarily unavailable." }, 500);
  }

  const authClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false },
  });
  const { data: { user }, error: authError } = await authClient.auth.getUser();
  if (authError || !user) return response({ error: "Your session is invalid. Sign in again." }, 401);
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    const payload = await request.json();
    const action = payload.action;
    const today = utcDate();

    if (action === "leaderboard") {
      const season = typeof payload.season === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(payload.season)
        ? payload.season
        : today.slice(0, 7);
      const start = `${season}-01`;
      const endDate = new Date(Date.UTC(Number(season.slice(0, 4)), Number(season.slice(5, 7)), 1))
        .toISOString().slice(0, 10);
      const { data, error } = await admin.rpc("get_competition_leaderboard", {
        p_season_start: start,
        p_season_end: endDate,
        p_user_id: user.id,
      });
      if (error) throw error;
      const entries = (data ?? []).map((entry) => ({
        rank: entry.rank,
        username: entry.username,
        points: entry.points,
        wins: entry.wins,
        games: entry.games,
        isYou: entry.is_you,
      }));
      return response({ season, entries });
    }

    if (action !== "start" && action !== "guess") {
      return response({ error: "Unsupported competition action." }, 400);
    }

    if (action === "start") {
      const { data: answerRow, error: answerError } = await admin
        .from("competition_answers")
        .select("puzzle_date")
        .eq("puzzle_date", today)
        .maybeSingle();
      if (answerError) throw answerError;
      if (!answerRow) return response({ error: "Today's puzzle is not available yet." }, 503);

      let game = await getGame(admin, user.id, today);
      if (!game) {
        const { error } = await admin
          .from("competition_games")
          .insert({ user_id: user.id, puzzle_date: today });
        if (error && error.code !== "23505") throw error;
        game = await getGame(admin, user.id, today);
      }
      if (!game) throw new Error("The game could not be loaded.");

      return response({
        puzzleDate: today,
        guesses: game.guesses,
        feedback: game.feedback,
        completed: game.completed,
        won: game.won,
        score: game.completed ? game.score : null,
        maxGuesses,
      });
    }

    const guess = typeof payload.guess === "string" ? payload.guess.toLowerCase() : "";
    const { data: result, error: submitError } = await admin.rpc("submit_competition_guess", {
      p_user_id: user.id,
      p_puzzle_date: today,
      p_guess: guess,
    });
    if (submitError) throw submitError;
    if (result.error) return response({ error: result.error }, result.status);
    return response(result);
  } catch (error) {
    console.error("Competition request failed:", error);
    return response({ error: "The competition request could not be completed." }, 500);
  }
});
