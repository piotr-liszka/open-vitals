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
-- spec 094: google_sub is OPTIONAL (a password-only account never signs in with Google); email is
-- the required, unique Google auto-link key; username is the required, unique local sign-in handle,
-- separate from email; password_hash is null for a Google-only account; is_admin gates onboarding +
-- the admin area. username/email are normalized to lowercase in the repo layer, not by a DB CITEXT
-- extension.
CREATE TABLE IF NOT EXISTS users (
  id            text PRIMARY KEY,
  google_sub    text UNIQUE,
  email         text UNIQUE NOT NULL,
  username      text UNIQUE NOT NULL,
  password_hash text,
  is_admin      boolean NOT NULL DEFAULT false,
  name          text,
  avatar_url    text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- spec 094: session provenance (user_agent/ip_address) for the self-service "active sessions" list.
-- Nullable — rows minted before this column existed simply render nothing for these two fields.
CREATE TABLE IF NOT EXISTS sessions (
  id          text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user_agent  text,
  ip_address  text,
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
-- spec 072: has_value answers "does this day hold a real reading", which "data IS NOT NULL" does
-- not: Garmin returns a present daily-summary object with every field null for a day it has nothing
-- for. Deliberately NULLABLE with no default — NULL means "written before this column existed, not
-- yet classified" and reads fall back to "data IS NOT NULL" for those, so upgrading does not blank
-- everyone's coverage until they re-sync.
CREATE TABLE IF NOT EXISTS synced_metric_days (
  user_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  metric     text NOT NULL,
  day        date NOT NULL,
  data       jsonb,
  has_value  boolean,
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
  -- spec 081: Garmin's own workoutId, i.e. the SCHEDULED workout this activity was executed from.
  -- A first-class column rather than a raw->>'workoutId' probe at each call site, so the two store
  -- adapters do not each grow their own jsonb dialect for one field. NULL is the normal case: the id
  -- only appears when the session was started off the watch's scheduled list.
  garmin_workout_id text,
  raw               jsonb,
  synced_at         timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, activity_id)
);
CREATE INDEX IF NOT EXISTS synced_activities_user_start_idx ON synced_activities(user_id, start_time_local DESC);
CREATE INDEX IF NOT EXISTS synced_activities_user_sport_idx ON synced_activities(user_id, sport);
CREATE INDEX IF NOT EXISTS synced_activities_user_workout_idx
  ON synced_activities(user_id, garmin_workout_id) WHERE garmin_workout_id IS NOT NULL;

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
-- it onto Garmin and writes the resulting ids back.
--
-- matched_activity_id is UNUSED and deliberately not dropped (spec 081). "Was this session done" is
-- now derived on READ, by matching garmin_workout_id against synced_activities — a stored copy would
-- leave a stale "done" behind when the activity is deleted or re-synced. The column is the right
-- home for a MANUAL override ("no, THIS activity was that session"), which is its own spec if it is
-- ever wanted. (It used to say "reserved for spec 052"; 052 answered the question differently.)
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
  -- spec 092: true once a createWorkout call has sent this row's CURRENT title/steps/note/sport to
  -- Garmin and no edit has invalidated that since. False at creation and false again the moment any
  -- content-affecting field changes — see spec 092 for why a bare garmin_workout_id can no longer be
  -- trusted to mean "safe to just re-schedule".
  content_pushed      boolean NOT NULL DEFAULT false,
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

-- spec 073: the athlete's OWN plan, remembered between conversations. Holds targets and rules only —
-- the week's sessions are the authored_workouts rows falling inside it, so there is one answer to
-- "what am I doing on Tuesday" rather than two that drift.
-- goal_id is SET NULL, not CASCADE: deleting a race must never silently delete eight weeks of plan.
CREATE TABLE IF NOT EXISTS training_blocks (
  id          text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  goal_id     text REFERENCES season_goals(id) ON DELETE SET NULL,
  name        text NOT NULL,
  start_day   date NOT NULL,
  weeks       integer NOT NULL,
  paces       jsonb NOT NULL DEFAULT '{}'::jsonb,
  constraints jsonb NOT NULL DEFAULT '[]'::jsonb,
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS training_blocks_user_start_idx ON training_blocks(user_id, start_day);

-- Per-week targets. A week with no row is a real week with nothing set yet, which is why this is a
-- side table and not an array column: the athlete fills weeks in as the block is written.
CREATE TABLE IF NOT EXISTS training_block_weeks (
  block_id         text NOT NULL REFERENCES training_blocks(id) ON DELETE CASCADE,
  week_number      integer NOT NULL,
  phase            text,
  volume_target_km double precision,
  focus            text,
  note             text,
  PRIMARY KEY (block_id, week_number)
);

-- spec 062: the subjective journal — the only data here a device did not produce.
-- activity_id NULL means the row is about the DAY (soreness, mood); a set id means it is about that
-- SESSION, which is where RPE belongs. NULLS NOT DISTINCT (Postgres 15+) is what makes "one day row
-- per day" a constraint rather than a convention: under the default NULLS DISTINCT, every day-level
-- upsert would insert another row instead of correcting the one already there.
-- No foreign key to synced_activities on purpose: an RPE outlives the activity row it describes, the
-- same way spec 060's goal outlives the planned event it was imported from.
CREATE TABLE IF NOT EXISTS journal_entries (
  id          text PRIMARY KEY,
  user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  day         date NOT NULL,
  activity_id text,
  rpe         integer,
  soreness    integer,
  location    text,
  mood        integer,
  note        text,
  illness     boolean NOT NULL DEFAULT false,
  injury      boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_user_day_activity_idx
  ON journal_entries(user_id, day, activity_id) NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS journal_entries_user_day_idx ON journal_entries(user_id, day);

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
    has_value  boolean,
    synced_at  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, metric, day)
  )`,
  // spec 072: classify a day as holding a real reading or not. NULLABLE on purpose — see schemaSql.
  `ALTER TABLE synced_metric_days ADD COLUMN IF NOT EXISTS has_value boolean`,
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
  // spec 081: the scheduled workout an activity was executed from — the hard link between a plan and
  // what was done. See schemaSql for why it is a column and not a jsonb probe.
  `ALTER TABLE synced_activities ADD COLUMN IF NOT EXISTS garmin_workout_id text`,
  /*
   * Backfill from the rows ALREADY stored: `raw` has always kept the upstream payload verbatim, so
   * every activity ever synced already carries the id if Garmin sent one — history links up without
   * re-syncing anything.
   *
   * Idempotent by construction, which matters because this runs on every boot: the `IS NULL` guard
   * makes the second run touch zero rows, and the `jsonb_typeof` guards mean a row whose payload has
   * no usable id is skipped rather than rewritten to the same NULL forever. Only `number`/`string`
   * are accepted — `->>` on an object or array would otherwise store the serialised JSON as an id.
   */
  `UPDATE synced_activities
      SET garmin_workout_id = raw->>'workoutId'
    WHERE garmin_workout_id IS NULL
      AND jsonb_typeof(raw) = 'object'
      AND jsonb_typeof(raw->'workoutId') IN ('number', 'string')
      AND length(raw->>'workoutId') > 0`,
  `CREATE INDEX IF NOT EXISTS synced_activities_user_workout_idx
    ON synced_activities(user_id, garmin_workout_id) WHERE garmin_workout_id IS NOT NULL`,
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
  // spec 092: whether the row's CURRENT content has actually been sent to Garmin — see schemaSql for
  // the full reasoning. Defaulted false so every pre-existing pushed row is treated as "unknown
  // whether it matches Garmin" and gets a delete+recreate on its next push, which is safe either way.
  `ALTER TABLE authored_workouts ADD COLUMN IF NOT EXISTS content_pushed boolean NOT NULL DEFAULT false`,
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
  )`,
  // spec 073: training blocks — the athlete's own plan, remembered between conversations.
  `CREATE TABLE IF NOT EXISTS training_blocks (
    id          text PRIMARY KEY,
    user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    goal_id     text REFERENCES season_goals(id) ON DELETE SET NULL,
    name        text NOT NULL,
    start_day   date NOT NULL,
    weeks       integer NOT NULL,
    paces       jsonb NOT NULL DEFAULT '{}'::jsonb,
    constraints jsonb NOT NULL DEFAULT '[]'::jsonb,
    note        text,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE INDEX IF NOT EXISTS training_blocks_user_start_idx ON training_blocks(user_id, start_day)`,
  `CREATE TABLE IF NOT EXISTS training_block_weeks (
    block_id         text NOT NULL REFERENCES training_blocks(id) ON DELETE CASCADE,
    week_number      integer NOT NULL,
    phase            text,
    volume_target_km double precision,
    focus            text,
    note             text,
    PRIMARY KEY (block_id, week_number)
  )`,
  // spec 062: the subjective journal. See schemaSql for why NULLS NOT DISTINCT is load-bearing.
  `CREATE TABLE IF NOT EXISTS journal_entries (
    id          text PRIMARY KEY,
    user_id     text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    day         date NOT NULL,
    activity_id text,
    rpe         integer,
    soreness    integer,
    location    text,
    mood        integer,
    note        text,
    illness     boolean NOT NULL DEFAULT false,
    injury      boolean NOT NULL DEFAULT false,
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS journal_entries_user_day_activity_idx
    ON journal_entries(user_id, day, activity_id) NULLS NOT DISTINCT`,
  `CREATE INDEX IF NOT EXISTS journal_entries_user_day_idx ON journal_entries(user_id, day)`,

  // spec 094: google_sub becomes OPTIONAL — a user can now exist with a password only, never having
  // signed in with Google.
  `ALTER TABLE users ALTER COLUMN google_sub DROP NOT NULL`,

  // spec 094: username is the local sign-in handle, separate from email. Backfilled to the internal
  // id for any pre-existing row — an ugly but ALWAYS-unique placeholder — so the NOT NULL + UNIQUE
  // constraints below never fail an in-place upgrade. An admin renames these from /admin/users once
  // one exists.
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS username text`,
  `UPDATE users SET username = id WHERE username IS NULL`,
  `ALTER TABLE users ALTER COLUMN username SET NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users(username)`,

  // spec 094: email is the Google auto-link key, so it must be required + unique. Spec 012's OIDC
  // scope has always requested `email`, so this backfill is defense-in-depth, not an expected path —
  // but it keeps `migrate()` from ever failing outright on a row a future bug left without one.
  `UPDATE users SET email = id || '@unknown.local' WHERE email IS NULL`,
  `ALTER TABLE users ALTER COLUMN email SET NOT NULL`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users(email)`,

  `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash text`,
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false`,

  // spec 094: session provenance for the self-service "active sessions" list (My Account). Nullable —
  // rows minted before this column existed simply render nothing for these two fields.
  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_agent text`,
  `ALTER TABLE sessions ADD COLUMN IF NOT EXISTS ip_address text`
];

/** Build a postgres.js client. Callers own its lifecycle (`sql.end()` on shutdown). */
export function createDb(databaseUrl: string): Sql {
  return postgres(databaseUrl, {
    // Keep types plain; we map rows explicitly in the adapters.
    transform: { undefined: null }
  });
}

/**
 * Advisory-lock key for `migrate`. Arbitrary but FIXED — every migrator must pick the same number
 * for the lock to mean anything.
 */
const MIGRATION_LOCK = 4_155_072_015;

/**
 * Apply the schema idempotently. Safe to run on every startup, and safe to run CONCURRENTLY: the
 * `IF NOT EXISTS` clauses do not make these statements race-proof — two migrators arriving together
 * both see the table missing and both create it, and the loser gets a raw `pg_type_typname_nsp_index`
 * duplicate-key error rather than a no-op. An advisory lock on one reserved connection serializes
 * them, so the second migrator waits and then finds the schema already there.
 *
 * Deliberately NOT one big transaction: each `CREATE`/`ALTER` takes ACCESS EXCLUSIVE on its table,
 * and holding every one of those until a single commit deadlocks against ordinary reads and writes
 * running meanwhile. Statement by statement, each lock is gone the moment its statement is.
 */
export async function migrate(sql: Sql): Promise<void> {
  const conn = await sql.reserve();
  try {
    await conn`SELECT pg_advisory_lock(${MIGRATION_LOCK})`;
    try {
      for (const statement of MIGRATIONS) {
        await conn.unsafe(statement);
      }
    } finally {
      await conn`SELECT pg_advisory_unlock(${MIGRATION_LOCK})`;
    }
  } finally {
    // Back to the pool. A connection that died instead takes its advisory lock with it.
    conn.release();
  }
}
