/** Build an MCP server instance with the Garmin tools registered against an injected GarminService. */
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import {
  DEFAULT_TOOL_CONTEXT,
  GARMIN_TOOLS,
  interpretHealthMessages,
  type ToolArgs,
  type ToolContext
} from './tools';
import { WORKOUT_TOOLS, type WorkoutToolDeps } from './workout-tools';
import { SEASON_TOOLS, type SeasonToolDeps } from './season-tools';
import type { GarminService } from '../server/interfaces';

/**
 * @param ctx clock + timezone the date-aware tools resolve "today" with (spec 018). Defaults to the
 *            system clock in the app timezone; production passes the container's clock + config.
 * @param season season-goal deps (spec 060). Optional for the same reason `workouts` is: omitting
 *               them keeps the server strictly read-only over Garmin data.
 */
export function createMcpServer(
  garmin: GarminService,
  ctx: ToolContext = DEFAULT_TOOL_CONTEXT,
  workouts?: WorkoutToolDeps,
  season?: SeasonToolDeps
): McpServer {
  const server = new McpServer(
    { name: 'openvitals', version: '0.1.0' },
    {
      instructions:
        "Access to the user's own Garmin Connect data (sleep, steps, HRV, body battery, stress, resting " +
        'heart rate, activities, SpO2, respiration, calories, body composition) — all READ-ONLY. Dates are ' +
        'YYYY-MM-DD and default to today. Use get_metric_range for multi-day trends (max 31 days). For ' +
        'interpreted, plain-language wellness insights use get_readiness (compact score) and get_insights ' +
        '(readiness + trends + anomalies + correlations over a 7/30/90/365-day window), or the ' +
        'interpret_health prompt to have the assistant narrate them. Insights are consumer wellness ' +
        'signals, not medical advice.' +
        (workouts
          ? ' The create_workout / update_workout / delete_workout tools WRITE: they store a structured ' +
            "training session locally and the next sync puts it in the user's Garmin calendar (and so on " +
            'their watch). list_workouts shows those sessions and whether they have reached Garmin yet. ' +
            'Nothing else on the Garmin account is ever modified.'
          : '') +
        (season
          ? ' list_goals / get_goal_plan say what the training is FOR: the races and fitness targets ' +
            'ahead, how far away each is, which phase of the block today falls in, and whether the ' +
            'current trajectory reaches the target. Consult them before advising on any session — the ' +
            'same workout is a good idea in base and a bad one in taper. A goal reported as `at-risk` ' +
            'means the athlete is already building faster than is safe; never advise adding load there, ' +
            'even when they are also behind target. create_goal / delete_goal manage that list.'
          : '')
    }
  );

  for (const tool of GARMIN_TOOLS) {
    // The SDK infers the callback arg type from inputSchema; our handlers take a
    // hand-rolled ToolArgs, so the glue callback is cast to the SDK's expected type.
    const callback = (async (args: Record<string, unknown>) =>
      tool.handler(garmin, args as ToolArgs, ctx)) as never;
    server.registerTool(tool.name, { description: tool.description, inputSchema: tool.inputShape }, callback);
  }

  // Write tools (spec 050) only exist when the caller supplied their deps — a store, an id source and
  // the consent gate. Omitting them keeps the server strictly read-only, which is what every read-path
  // test and the local read facade want.
  if (workouts) {
    for (const tool of WORKOUT_TOOLS) {
      const callback = (async (args: Record<string, unknown>) => tool.handler(workouts, args ?? {})) as never;
      server.registerTool(
        tool.name,
        { description: tool.description, inputSchema: tool.inputShape },
        callback
      );
    }
  }

  // Season goals (spec 060) — read AND write, gated the same way and injected the same way.
  if (season) {
    for (const tool of SEASON_TOOLS) {
      const callback = (async (args: Record<string, unknown>) => tool.handler(season, args ?? {})) as never;
      server.registerTool(
        tool.name,
        { description: tool.description, inputSchema: tool.inputShape },
        callback
      );
    }
  }

  // Prompt: guide the client to call the insights tools and narrate a short, non-medical briefing.
  server.registerPrompt(
    'interpret_health',
    {
      description:
        'Have the assistant call get_readiness/get_insights for a window and give a short, encouraging, ' +
        'non-medical plain-language wellness briefing.',
      argsSchema: { window: z.string().optional() }
    },
    ({ window }) => ({
      messages: interpretHealthMessages(window)
    })
  );

  return server;
}
