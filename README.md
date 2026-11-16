# Argus Capture

A working three-camera robotics collection platform: create episodes, upload ego and wrist recordings, inspect metadata, and play the three perspectives on a shared timeline.

## Features

- Episode library with search, status filters, sorting, grid/list views, and deletion.
- Explicit egocentric / left wrist / right wrist upload slots. All three roles are required and validated server-side.
- Browser-readable video metadata: original filename, size, duration, resolution, and container/MIME type.
- Durable D1 episode records and R2 original video objects; no video data in localStorage.
- 8 MiB multipart uploads, per-part retries, progress, cancellation, and cleanup after failed uploads.
- Shared play, pause, seek, restart, speed controls, automatic audio alignment, persisted wrist offsets, playback drift correction, and common-overlap playback.
- Byte-range video delivery for efficient seeking. Metadata JSON export.
- Keyboard controls (space, left/right arrows), responsive layouts, and an in-app calibration guide.
- A clearly labeled synthetic 12-second robotics demo with three generated camera perspectives. These are **not** the assignment sample recordings.

## Stack and architecture

React 19 + TypeScript, Vinext/Vite, a Cloudflare Worker API, D1 (SQLite), R2, Drizzle schema migrations, and Lucide icons. The supplied Sites starter supplies framework/hosting glue; collection logic, API validation, upload orchestration, database schema, playback coordination, and UI are authored for this project. Styling uses CSS with DM Sans / Manrope from Google Fonts and system fallbacks.

`app/page.tsx` contains the collection UI and shared playback coordinator. `app/api/[...path]/route.ts` owns episode and upload APIs. `lib/model.ts` defines camera roles, metadata, and overlap calculations. `db/schema.ts` and `drizzle/` define the persistent schema. `public/demo/` contains bundled synthetic assets.

The implementation uses Worker-compatible storage rather than a Python/FFmpeg runtime so the full app can run on hosted Sites. The browser reads video metadata and runs audio alignment in a dedicated worker before uploading. The app stores the original files and persists the alignment decision when all uploads finish.

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

The API integration test uses an isolated Miniflare runtime with real D1/R2 emulation. It checks duplicate camera roles, episode and owner isolation, incomplete finalization, chunk validation, multi-part assembly across an 8 MiB boundary, byte-range delivery, automatic and manual offset persistence, finalization retries, and invalid overlap, cross-origin write rejection, and object cleanup. Its database and bucket are discarded afterward.

The synchronization tests cover overlap calculations, recovery of positive and negative audio offsets, and rejection of silent and ambiguous matches.

## Upload and playback

1. Choose **New episode**, name the episode, and assign one original video to each camera slot.
2. Supported inputs are browser-playable MP4, WebM, and MOV, up to 5 GiB per recording. H.264 MP4 is the most portable choice. MOV is only accepted if the current browser can decode it.
3. Select **Create episode**. The app compares audio events with the egocentric recording, then uploads the originals in 8 MiB parts. Keep the tab open through both stages.
4. Review the shared interval. The episode displays **Automatic · Audio match** after successful alignment or **Needs review** when the match could not be verified. **Adjust offsets** is available for exceptions. Export metadata to retrieve the applied offsets and alignment decision.

`camera_time = episode_time + camera_offset`

The common episode interval is `max(0, -offsets)` through `min(duration - offset)`. The visible timeline starts at zero relative to that interval. The episode info panel exposes its actual ego interval. Example: ego event at 5 s and wrist event at 7 s means a wrist offset of +2 s. Empty shared intervals are rejected.

The coordinator uses a monotonic shared clock and corrects stream drift above 120 ms. Buffering pauses all streams and prompts for manual resume. All streams are muted for consistent autoplay behavior. This is approximate browser synchronization, not frame-accurate or hardware-timestamp synchronization.

## Automatic alignment

The estimator compares audio onsets across five frequency bands at 10 ms intervals. It searches for a distinct correlation peak and checks that the offset agrees across separate portions of the recording. It uses elapsed audio presentation timestamps, so inconsistent device clocks and file creation dates do not affect the estimate. Both wrist tracks must match ego before the app applies either offset.

The headless command uses the same estimator with FFmpeg for audio decoding. It prints a JSON result and exits with status 1 for recordings that need review. A successful result can be passed directly to `POST /api/episodes/{id}/finalize` after the three files have been uploaded.

```sh
node --experimental-strip-types scripts/sync-episode.mjs ego.mp4 left.mp4 right.mp4
```

FFmpeg must be on PATH. Set `FFMPEG` to use a specific executable.

### Argus sample results

The original sample filenames do not encode wrist side in a verified way, so the table identifies each wrist recording by its filename suffix. A positive value means the event is later on the wrist clip's local timeline.

| Egocentric recording | First wrist offset | Second wrist offset | Shared playback |
| --- | --- | --- | ---: |
| `GX010008.MP4` | `013` +1.68 s | `010` +1.35 s | 117.07 s |
| `GX010009.MP4` | `014` +2.99 s | `011` +2.45 s | 174.69 s |

These measurements establish alignment within each recorded trio. A cross-trio test returned `weak-match`. The archive can describe one continuous run even when the three cameras stop and restart around the same time. A failed match does not establish where the second trio starts on the first trio’s clock.

## Handoff for Argus

1. Extract the sample ZIP locally. Group the clips using the two rows above. Confirm left and right assignments against the capture manifest or camera labels.
2. Follow **Reproduce locally** and run `corepack pnpm start` to review the production build on localhost. Create one episode per trio and select the three extracted files. The browser matches the audio, uploads to the local emulator, and opens the synchronized viewer.
3. Use the shared scrubber to review each span. The viewer shows the offset on each camera and exports it with the shared interval in the episode metadata. For automated processing, run the headless command for each trio and retain its JSON alongside the originals.

The current player handles three streams per episode and accepts extracted video files. Showing all six clips on a continuous run timeline requires a known start time for the second trio relative to the first. Use capture logs, a common timecode, or an independently recorded track that overlaps both spans. With that anchor, place the clips on one run timeline and display each stream only where it has footage. If the anchor is unavailable, keep the segment offsets relative to their own egocentric recordings and leave the gap unknown.

For unattended ingestion, run the headless estimator in a background worker after an archive lands in private object storage. Record a versioned manifest with clip identities, offsets, match scores, and review status. Use an idempotent job key so retries preserve one result per archive. Expose playback through authenticated, range-enabled media URLs. Verify the service and storage bindings before offering a hosted link to reviewers.

If a track has no usable audio, this version flags the match for review. A production fallback can use synchronized capture timestamps or hardware timecode. When a shared visual event is visible across views, its frame times provide another anchor. Over a long run, compare multiple anchors to estimate clock drift as well as a start offset.

## Access and data handling

The hosted Site is owner-private. Requests are scoped to the dispatch-provided authenticated user ID. Local unsigned development uses a private-workspace fallback. Do not expose the Worker outside private hosting without adding an explicit authentication requirement for every API path; the fallback is for the current private/local context.

Object keys use generated episode IDs and explicit roles, never user-supplied filenames. Original filenames remain metadata. Mutating requests reject mismatched Origin headers. Deletion removes the episode, completed objects, and known in-progress multipart uploads. Cancellation tries to remove the incomplete episode; if the connection is lost or a tab closes, an incomplete collection may remain and can be deleted from the library. This app does not have resumable uploads across reloads or automated orphan garbage collection.

## Known limits and next steps

- Automatic alignment needs decodable shared audio within the first five minutes of each recording. It estimates a constant offset. Silent clips, ambiguous matches, and inconsistent offsets are flagged for review.
- Frame rate, codec details, audio metadata, and corrupt-file validation need a trusted asynchronous media probe. Browser duration/dimensions are not equivalent to FFprobe output.
- No transcoding, frame stepping, signed direct-to-object-store uploads, or per-frame seek guarantees.
- No concurrent-edit conflict handling, background upload recovery, scheduled orphan cleanup, or per-user quotas beyond per-file limits.
- The library returns the latest 500 episodes; add cursor pagination before production-scale collections.
- An upload is marked ready after all three objects are stored; browser metadata is not independently verified against the media contents on the server.
- Private hosting has been selected. Reviewer access requires an explicit sharing change by the owner.

## AI and third-party tools

Built with ChatGPT/Codex assistance for architecture, implementation, test generation, synthetic asset scripting, and documentation. Third-party runtime dependencies are recorded in package.json and pnpm-lock.yaml. Major used libraries: React, Vinext, Vite, Cloudflare Workers/D1/R2, Drizzle, Lucide React, and Tailwind's CSS processor. Tests use Node's test runner, Miniflare, and esbuild. Google Fonts supplies optional typefaces.

Synthetic assets were generated with the authored `scripts/generate-demo.py` using Pillow, NumPy, and FFmpeg/libx264; they are checked in, so those tools are not needed to run the app. To regenerate them with those tools installed:

```sh
python scripts/generate-demo.py
```
