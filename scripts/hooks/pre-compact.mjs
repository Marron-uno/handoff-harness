#!/usr/bin/env node
// PreCompact: state lives on disk, so compaction only gets logged. SessionStart (source=compact)
// re-injects the current brief afterwards.
import { bootstrap } from "./_common.mjs";
const ctx = await bootstrap();
if (!ctx.active) process.exit(0);
ctx.event({ type: "note", text: `compaction (${ctx.input.trigger ?? "unknown"})`, stage: ctx.state.stage, slice: ctx.state.slice?.id ?? null });
process.exit(0);
