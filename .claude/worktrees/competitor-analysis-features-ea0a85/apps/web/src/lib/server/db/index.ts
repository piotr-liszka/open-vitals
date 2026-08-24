/**
 * Postgres access (spec 012). `createDb` returns the postgres.js client; `migrate` idempotently
 * applies the schema (CREATE TABLE IF NOT EXISTS) so a fresh container comes up ready.
 *
 * SCOPE (spec 012): `users`, `sessions`, plus the per-user isolation tables `consents`,
 * `mcp_tokens`, and `settings` — every per-user row is keyed by `user_id` and cascades on user delete.
 */
import postgres, { type Sql } from 'postgres';

/**
 * The full schema as a single SQL string, for reference and manual application ONLY.
 *
 * NOTHING RUNS THIS. `migrate` applies `MIGRATIONS` below, statement by statement, and the two are
 * maintained by hand — so a table added here and not there exists in the documentation and nowhere
 * else. Adding a table means editing BOTH.
 */
export const schemaSql = `
CREATE TABLE IF NOT EXISTS users (
  id          text PRIMARY KEY,
  google_sub  text UNIQUE NOT NULL,
  email       text,
  name        text,
  avatar_url  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id          text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

-- DEAD as of spec 071 (the consent/terms model was replaced by plain feature switches). Kept so an
-- in-place upgrade does not have to drop data mid-deploy; nothing reads it. Drop when convenient.
CREATE TABLE IF NOT EXISTS consents (
  user_id       text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_id    text NOT NULL,
  terms_version text NOT NULL,
  accepted_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, feature_id)
);

-- spec 071: per-user feature switches. An explicit false is a real stored value here.
CREATE TABLE IF NOT EXISTS feature_settings (
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  feature_id  text NOT NULL,
  enabled     boolean NOT NULL,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, feature_id)
);

CREATE TABLE IF NOT EXISTS mcp_tokens (
  user_id     text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  token       text UNIQUE NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  user_id     text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data        jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- spec 015: local synced-data store (the app reads from here, never live Garmin)
CREATE TABLE IF NOT EXISTS synced_metric_days (
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric     text NOT NULL,
  day        date NOT NULL,
  data       jsonb,
  synced_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, metric, day)
);

CREATE TABLE IF NOT EXISTS synced_activities (
  user_id           text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id       text NOT NULL,
  sport             text NOT NULL,
  name              text,
  start_time        timestamptz NOT NULL,
  start_time_local  text NOT NULL,
  distance_m        double precision,
  duration_s        double precision,
  moving_s          double precision,
  elevation_gain_m  double precision,
  avg_hr            integer,
  max_hr            integer,
  avg_power         integer,
  max_power         integer,
  norm_power        integer,
  calories          integer,
  training_load     double precision,
  has_gps           boolean NOT NULL DEFAULT false,
  raw               jsonb,
  synced_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, activity_id)
);
CREATE INDEX IF NOT EXISTS synced_activities_user_start_idx ON synced_activities(user_id, start_time_local DESC);
CREATE INDEX IF NOT EXISTS synced_activities_user_sport_idx ON synced_activities(user_id, sport);

CREATE TABLE IF NOT EXISTS synced_activity_streams (
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id text NOT NULL,
  streams     jsonb NOT NULL,
  -- spec 054: version of the best-efforts derivation that produced this activity's effort rows.
  -- NULL = never derived. Reset to NULL whenever the streams are rewritten, so a repaired stream
  -- re-derives. Lives HERE (not as a sentinel effort row) so an activity that legitimately yields no
  -- efforts is still marked done and never retried by the backfill.
  efforts_v   integer,
  synced_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, activity_id)
);

-- spec 054: the all-time best-efforts leaderboard. One row per (user, activity, distance) — an
-- activity contributes at most its own fastest window per distance, so the leaderboard can never be
-- three splits of one workout. Derived data: rebuildable from synced_activity_streams at any time.
CREATE TABLE IF NOT EXISTS synced_activity_best_efforts (
  user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  activity_id     text NOT NULL,
  distance_key    text NOT NULL,
  distance_m      integer NOT NULL,
  duration_s      double precision NOT NULL,
  actual_m        double precision NOT NULL,
  pace_sec_per_km double precision NOT NULL,
  start_s         double precision NOT NULL,
  samples         integer NOT NULL DEFAULT 0,
  sport           text NOT NULL,
  day             date NOT NULL,
  computed_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, activity_id, distance_key)
);
-- The leaderboard read: fastest N for one user + distance key.
CREATE INDEX IF NOT EXISTS synced_activity_best_efforts_rank_idx
  ON synced_activity_best_efforts(user_id, distance_key, duration_s ASC);

CREATE TABLE IF NOT EXISTS synced_weight (
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day        date NOT NULL,
  source     text NOT NULL,
  weight_kg  double precision NOT NULL,
  raw        jsonb,
  synced_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, day, source)
);

-- spec 024: planned workouts / races pulled from Garmin's training calendar
CREATE TABLE IF NOT EXISTS synced_planned_events (
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_id    text NOT NULL,
  day         date NOT NULL,
  time_local  text,
  kind        text NOT NULL,
  title       text,
  sport       text,
  description text,
  duration_s  double precision,
  distance_m  double precision,
  target_load double precision,
  source      text NOT NULL DEFAULT 'garmin',
  synced_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, event_id)
);
CREATE INDEX IF NOT EXISTS synced_planned_events_user_day_idx ON synced_planned_events(user_id, day);

-- spec 050: workouts AUTHORED here (the inverse direction of synced_planned_events, which Garmin
-- owns and the sync replaces wholesale). This table is the source of truth; the push phase projects
-- it onto Garmin and writes the resulting ids back. matched_activity_id is reserved for spec 052.
CREATE TABLE IF NOT EXISTS authored_workouts (
  id                  text PRIMARY KEY,
  user_id             text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day                 date NOT NULL,
  time_local          text,
  sport               text NOT NULL,
  title               text NOT NULL,
  steps               jsonb NOT NULL,
  note                text,
  push_state          text NOT NULL DEFAULT 'pending',
  push_error          text,
  garmin_workout_id   text,
  garmin_schedule_id  text,
  matched_activity_id text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS authored_workouts_user_day_idx ON authored_workouts(user_id, day);
-- One local row per Garmin workout: the guard that makes the push idempotent even if a retry races.
CREATE UNIQUE INDEX IF NOT EXISTS authored_workouts_user_garmin_idx
  ON authored_workouts(user_id, garmin_workout_id) WHERE garmin_workout_id IS NOT NULL;

-- spec 069: the workout LIBRARY — reusable sessions with no date. Deliberately its own table and
-- not a nullable day column on authored_workouts: a row there means "committed to on this day", and
-- making the commitment optional would make every query that reads a plan ask "but is it real?".
-- Scheduling COPIES the steps across, so there is no foreign key back to here on purpose — see the
-- spec: a live link would let a library edit rewrite a session already on the athlete's watch.
CREATE TABLE IF NOT EXISTS workout_templates (
  id         text PRIMARY KEY,
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  sport      text NOT NULL,
  title      text NOT NULL,
  steps      jsonb NOT NULL,
  note       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS workout_templates_user_title_idx ON workout_templates(user_id, title);

-- spec 060: season goals — the only forward-looking rows in the store. Hand-entered, or adopted
-- from a synced planned event (garmin_event_id), which the partial unique index below makes
-- impossible to adopt twice however two imports race.
CREATE TABLE IF NOT EXISTS season_goals (
  id               text PRIMARY KEY,
  user_id          text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day              date NOT NULL,
  sport            text NOT NULL,
  title            text NOT NULL,
  kind             text NOT NULL DEFAULT 'race',
  priority         text NOT NULL DEFAULT 'a',
  distance_m       double precision,
  target_time_s    double precision,
  target_ctl       double precision,
  note             text,
  source           text NOT NULL DEFAULT 'manual',
  garmin_event_id  text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS season_goals_user_day_idx ON season_goals(user_id, day);
CREATE UNIQUE INDEX IF NOT EXISTS season_goals_user_event_idx
  ON season_goals(user_id, garmin_event_id) WHERE garmin_event_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS sync_state (
  user_id            text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source             text NOT NULL,
  cursor             jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_full_sync_at  timestamptz,
  last_sync_at       timestamptz,
  PRIMARY KEY (user_id, source)
);

CREATE TABLE IF NOT EXISTS sync_runs (
  id           text PRIMARY KEY,
  user_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind         text NOT NULL,
  status       text NOT NULL,
  started_at   timestamptz NOT NULL DEFAULT now(),
  finished_at  timestamptz,
  total        integer NOT NULL DEFAULT 0,
  done         integer NOT NULL DEFAULT 0,
  step         text,
  error        text,
  detail       jsonb
);
CREATE INDEX IF NOT EXISTS sync_runs_user_started_idx ON sync_runs(user_id, started_at DESC);
`;

/** Statements applied by `migrate`, in order. */
const MIGRATIONS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS users (
    id          text PRIMARY KEY,
    google_sub  text UNIQUE NOT NULL,
    email       text,
    name        text,
    avatar_url  text,
    created_at  timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sessions (
    id          text PRIMARY KEY,
    user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  timestamptz NOT NULL DEFAULT now(),
    expires_at  timestamptz NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id)`,
  `CREATE TABLE IF NOT EXISTS consents (
    user_id       text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature_id    text NOT NULL,
    terms_version text NOT NULL,
    accepted_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, feature_id)
  )`,
  `CREATE TABLE IF NOT EXISTS mcp_tokens (
    user_id     text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    token       text UNIQUE NOT NULL,
    created_at  timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS settings (
    user_id     text PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    data        jsonb NOT NULL DEFAULT '{}'::jsonb,
    updated_at  timestamptz NOT NULL DEFAULT now()
  )`,
  // spec 015: local synced-data store
  `CREATE TABLE IF NOT EXISTS synced_metric_days (
    user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metric     text NOT NULL,
    day        date NOT NULL,
    data       jsonb,
    synced_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, metric, day)
  )`,
  `CREATE TABLE IF NOT EXISTS synced_activities (
    user_id           text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id       text NOT NULL,
    sport             text NOT NULL,
    name              text,
    start_time        timestamptz NOT NULL,
    start_time_local  text NOT NULL,
    distance_m        double precision,
    duration_s        double precision,
    moving_s          double precision,
    elevation_gain_m  double precision,
    avg_hr            integer,
    max_hr            integer,
    avg_power         integer,
    max_power         integer,
    norm_power        integer,
    calories          integer,
    training_load     double precision,
    has_gps           boolean NOT NULL DEFAULT false,
    raw               jsonb,
    synced_at         timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, activity_id)
  )`,
  `CREATE INDEX IF NOT EXISTS synced_activities_user_start_idx ON synced_activities(user_id, start_time_local DESC)`,
  `CREATE INDEX IF NOT EXISTS synced_activities_user_sport_idx ON synced_activities(user_id, sport)`,
  `CREATE TABLE IF NOT EXISTS synced_activity_streams (
    user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id text NOT NULL,
    streams     jsonb NOT NULL,
    efforts_v   integer,
    synced_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, activity_id)
  )`,
  // Upgrade older stream tables in place (spec 054: best-efforts derivation marker).
  `ALTER TABLE synced_activity_streams ADD COLUMN IF NOT EXISTS efforts_v integer`,
  // spec 054: all-time best efforts (see schemaSql for why the marker is not a sentinel row here).
  `CREATE TABLE IF NOT EXISTS synced_activity_best_efforts (
    user_id         text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    activity_id     text NOT NULL,
    distance_key    text NOT NULL,
    distance_m      integer NOT NULL,
    duration_s      double precision NOT NULL,
    actual_m        double precision NOT NULL,
    pace_sec_per_km double precision NOT NULL,
    start_s         double precision NOT NULL,
    samples         integer NOT NULL DEFAULT 0,
    sport           text NOT NULL,
    day             date NOT NULL,
    computed_at     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, activity_id, distance_key)
  )`,
  `CREATE INDEX IF NOT EXISTS synced_activity_best_efforts_rank_idx
    ON synced_activity_best_efforts(user_id, distance_key, duration_s ASC)`,
  `CREATE TABLE IF NOT EXISTS synced_weight (
    user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day        date NOT NULL,
    source     text NOT NULL,
    weight_kg  double precision NOT NULL,
    raw        jsonb,
    synced_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, day, source)
  )`,
  // spec 024: planned workouts / races from Garmin's training calendar
  `CREATE TABLE IF NOT EXISTS synced_planned_events (
    user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_id    text NOT NULL,
    day         date NOT NULL,
    time_local  text,
    kind        text NOT NULL,
    title       text,
    sport       text,
    description text,
    duration_s  double precision,
    distance_m  double precision,
    target_load double precision,
    source      text NOT NULL DEFAULT 'garmin',
    synced_at   timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, event_id)
  )`,
  `CREATE INDEX IF NOT EXISTS synced_planned_events_user_day_idx ON synced_planned_events(user_id, day)`,
  // spec 050: workouts authored HERE and pushed to Garmin (see schemaSql for why it is its own table)
  `CREATE TABLE IF NOT EXISTS authored_workouts (
    id                  text PRIMARY KEY,
    user_id             text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day                 date NOT NULL,
    time_local          text,
    sport               text NOT NULL,
    title               text NOT NULL,
    steps               jsonb NOT NULL,
    note                text,
    push_state          text NOT NULL DEFAULT 'pending',
    push_error          text,
    garmin_workout_id   text,
    garmin_schedule_id  text,
    matched_activity_id text,
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS authored_workouts_user_day_idx ON authored_workouts(user_id, day)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS authored_workouts_user_garmin_idx
    ON authored_workouts(user_id, garmin_workout_id) WHERE garmin_workout_id IS NOT NULL`,
  // spec 069: the workout LIBRARY — reusable sessions with no date. Its own table rather than a
  // nullable day on authored_workouts, because a row there means "committed to on this day" and
  // making that optional would force every read of a plan to ask "but is it real?". No FK back from
  // authored_workouts on purpose: scheduling COPIES the steps, so a library edit can never rewrite a
  // session already on the athlete's watch.
  `CREATE TABLE IF NOT EXISTS workout_templates (
    id         text PRIMARY KEY,
    user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    sport      text NOT NULL,
    title      text NOT NULL,
    steps      jsonb NOT NULL,
    note       text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS workout_templates_user_title_idx ON workout_templates(user_id, title)`,
  `CREATE TABLE IF NOT EXISTS season_goals (
    id               text PRIMARY KEY,
    user_id          text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day              date NOT NULL,
    sport            text NOT NULL,
    title            text NOT NULL,
    kind             text NOT NULL DEFAULT 'race',
    priority         text NOT NULL DEFAULT 'a',
    distance_m       double precision,
    target_time_s    double precision,
    target_ctl       double precision,
    note             text,
    source           text NOT NULL DEFAULT 'manual',
    garmin_event_id  text,
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS season_goals_user_day_idx ON season_goals(user_id, day)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS season_goals_user_event_idx
    ON season_goals(user_id, garmin_event_id) WHERE garmin_event_id IS NOT NULL`,
  `CREATE TABLE IF NOT EXISTS sync_state (
    user_id            text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    source             text NOT NULL,
    cursor             jsonb NOT NULL DEFAULT '{}'::jsonb,
    last_full_sync_at  timestamptz,
    last_sync_at       timestamptz,
    PRIMARY KEY (user_id, source)
  )`,
  `CREATE TABLE IF NOT EXISTS sync_runs (
    id           text PRIMARY KEY,
    user_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind         text NOT NULL,
    status       text NOT NULL,
    started_at   timestamptz NOT NULL DEFAULT now(),
    finished_at  timestamptz,
    total        integer NOT NULL DEFAULT 0,
    done         integer NOT NULL DEFAULT 0,
    step         text,
    error        text,
    detail       jsonb
  )`,
  // Upgrade older sync_runs tables in place (spec 019: per-phase detail).
  `ALTER TABLE sync_runs ADD COLUMN IF NOT EXISTS detail jsonb`,
  `CREATE INDEX IF NOT EXISTS sync_runs_user_started_idx ON sync_runs(user_id, started_at DESC)`,
  // spec 071: feature switches. A separate table rather than a column on `consents` because the two
  // encode different things — a consent row means "accepted these terms" and its absence means "off",
  // which cannot express a switch that defaults ON and was deliberately turned off.
  `CREATE TABLE IF NOT EXISTS feature_settings (
    user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    feature_id  text NOT NULL,
    enabled     boolean NOT NULL,
    updated_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, feature_id)
  )`
];

/** Build a postgres.js client. Callers own its lifecycle (`sql.end()` on shutdown). */
export function createDb(databaseUrl: string): Sql {
  return postgres(databaseUrl, {
    // Keep types plain; we map rows explicitly in the adapters.
    transform: { undefined: null }
  });
}

/** Apply the schema idempotently. Safe to run on every startup. */
export async function migrate(sql: Sql): Promise<void> {
  for (const statement of MIGRATIONS) {
    await sql.unsafe(statement);
  }
}
