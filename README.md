# Argus Capture

A working three-camera robotics collection platform: create episodes, upload ego and wrist recordings, inspect metadata, and play the three perspectives on a shared calibrated timeline.

## Features

- Episode library with search, status filters, sorting, grid/list views, and deletion.
- Explicit egocentric / left wrist / right wrist upload slots. All three roles are required and validated server-side.
- Browser-readable video metadata: original filename, size, duration, resolution, and container/MIME type.
- Durable D1 episode records and R2 original video objects; no video data in localStorage.
- 8 MiB multipart uploads, per-part retries, progress, cancellation, and cleanup after failed uploads.
- Shared play, pause, seek, restart, speed controls, manual persisted wrist offsets, drift correction, and common-overlap playback.
- Byte-range video delivery for efficient seeking. Metadata JSON export.
- Keyboard controls (space, left/right arrows), responsive layouts, and an in-app calibration guide.
- A clearly labeled synthetic 12-second robotics demo with three generated camera perspectives. These are **not** the assignment sample recordings.

## Stack and architecture

React 19 + TypeScript, Vinext/Vite, a Cloudflare Worker API, D1 (SQLite), R2, Drizzle schema migrations, and Lucide icons. The supplied Sites starter supplies framework/hosting glue; collection logic, API validation, upload orchestration, database schema, playback coordination, and UI are authored for this project. Styling uses CSS with DM Sans / Manrope from Google Fonts and system fallbacks.

`app/page.tsx` contains the collection UI and shared playback coordinator. `app/api/[...path]/route.ts` owns episode and upload APIs. `lib/model.ts` defines camera roles, metadata, and overlap calculations. `db/schema.ts` and `drizzle/` define the persistent schema. `public/demo/` contains bundled synthetic assets.

The implementation uses Worker-compatible storage rather than a Python/FFmpeg runtime so the full app can run on hosted Sites. Metadata is read in the browser before uploading. No codec conversion or server media probe runs in production.

## Reproduce locally

Prerequisites: Node.js 22.13 or newer, Corepack/pnpm, and Git. Use the committed `pnpm-lock.yaml`. No cloud account is needed for local D1/R2 emulation.

```sh
corepack enable
corepack pnpm install --frozen-lockfile
corepack pnpm build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_ancient_harpoon.sql
corepack pnpm dev
```

Open the localhost URL printed by the development server (normally port 5173). Apply the initial database migration once for a fresh local database; do not replay it against an already initialized database. Local state lives under ignored `.wrangler/state`. Stop the dev process before deleting/resetting that state.

To preview the production build locally, run `corepack pnpm start` after building and initializing the database. To change schema, edit `db/schema.ts`, run `corepack pnpm db:generate`, inspect the generated SQL, and apply only new migrations in order. Hosted and local storage are separate.

The tracked `.openai/hosting.json` declares DB and BUCKET bindings and the private hosted Site identity. The supported Sites publishing workflow builds a Worker, provisions storage, and applies schema migrations. Cloning the repository alone does not grant publication rights to the existing Site. Never commit credentials, local runtime state, or assignment videos.

## Validation

```sh
corepack pnpm exec tsc --noEmit
node --experimental-strip-types --test tests/synchronization.test.mjs
node tests/api.integration.mjs
corepack pnpm build
```

The API integration test uses an isolated Miniflare runtime with real D1/R2 emulation. It checks duplicate camera roles, episode and owner isolation, incomplete finalization, chunk validation, multi-part assembly across an 8 MiB boundary, byte-range delivery, offset persistence and invalid overlap, cross-origin write rejection, and object cleanup. Its database and bucket are discarded afterward.

The five synchronization tests check aligned and unequal durations, positive and negative offsets, nonoverlapping recordings, and valid camera timestamps throughout the shared interval.

Type checking, the production build, synchronization tests, and API integration tests passed during implementation. Browser QA could not run in the authoring environment because its managed preview service was unavailable. Actual Argus sample validation and the final recorded walkthrough remain submission checks; the included synthetic episode is not evidence of sample alignment.

## Upload and playback

1. Choose **New episode**, name the episode, and assign one original video to each camera slot.
2. Supported inputs are browser-playable MP4, WebM, and MOV, up to 5 GiB per recording. H.264 MP4 is the most portable choice. MOV is only accepted if the current browser can decode it.
3. Keep the tab open during collection. Each file is split into 8 MiB R2 parts and uploaded sequentially. Failed parts retry up to three times. The episode becomes ready only after all three objects finish.
4. Find the same visual event in ego and wrist videos. In **Calibrate offsets**, set each wrist offset to `wrist_event_time - ego_event_time`. Ego is fixed at zero.
5. Review with shared controls. Export metadata to preserve the calibration alongside the original recording metadata.

`camera_time = episode_time + camera_offset`

The common episode interval is `max(0, -offsets)` through `min(duration - offset)`. The visible timeline starts at zero relative to that interval. The episode info panel exposes its actual ego interval. Example: ego event at 5 s and wrist event at 7 s means a wrist offset of +2 s. Empty shared intervals are rejected.

The coordinator uses a monotonic shared clock and corrects stream drift above 120 ms. Buffering pauses all streams and prompts for manual resume. All streams are muted for consistent autoplay behavior. This is approximate browser synchronization, not frame-accurate or hardware-timestamp synchronization.

## Access and data handling

The hosted Site is owner-private. Requests are scoped to the dispatch-provided authenticated user ID. Local unsigned development uses a private-workspace fallback. Do not expose the Worker outside private hosting without adding an explicit authentication requirement for every API path; the fallback is for the current private/local context.

Object keys use generated episode IDs and explicit roles, never user-supplied filenames. Original filenames remain metadata. Mutating requests reject mismatched Origin headers. Deletion removes the episode, completed objects, and known in-progress multipart uploads. Cancellation tries to remove the incomplete episode; if the connection is lost or a tab closes, an incomplete collection may remain and can be deleted from the library. This app does not have resumable uploads across reloads or automated orphan garbage collection.

## Known limits and next steps

- No automatic timestamp/audio/visual alignment; offsets require manual calibration.
- Frame rate, codec details, audio metadata, and corrupt-file validation need a trusted asynchronous media probe. Browser duration/dimensions are not equivalent to FFprobe output.
- No transcoding, frame stepping, signed direct-to-object-store uploads, or per-frame seek guarantees.
- No concurrent-edit conflict handling, background upload recovery, scheduled orphan cleanup, or per-user quotas beyond per-file limits.
- The library returns the latest 500 episodes; add cursor pagination before production-scale collections.
- An upload is marked ready after all three objects are stored; browser metadata is not independently verified against the media contents on the server.
- Private hosting has been selected. Reviewer access requires an explicit sharing change by the owner.

Prioritize real sample alignment/codec checks, browser QA, a server media-processing queue, and recoverable uploads before expanding features.

## AI and third-party tools

Built with ChatGPT/Codex assistance for architecture, implementation, test generation, synthetic asset scripting, and documentation. Third-party runtime dependencies are recorded in package.json and pnpm-lock.yaml. Major used libraries: React, Vinext, Vite, Cloudflare Workers/D1/R2, Drizzle, Lucide React, and Tailwind's CSS processor. Tests use Node's test runner, Miniflare, and esbuild. Google Fonts supplies optional typefaces.

Synthetic assets were generated with the authored `scripts/generate-demo.py` using Pillow, NumPy, and FFmpeg/libx264; they are checked in, so those tools are not needed to run the app. To regenerate them with those tools installed:

```sh
python scripts/generate-demo.py
```

No actual Argus recordings are bundled. See `DEMO_SCRIPT.md` for a suggested 3–5 minute recording and final submission checklist.
