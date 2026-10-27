# 3–5 minute submission walkthrough

Use the real assignment samples for the recorded upload. The built-in synthetic demo is only for exploring the app before the real files are available.

## Before recording

- Confirm a clean checkout can follow README setup commands.
- Run type checking, synchronization tests, API integration tests, and build.
- Download the provided ego, left wrist, and right wrist sample recordings.
- Upload them in the target browser. Check decoding, duration, dimensions, and seeking.
- Find a shared event, record each camera timestamp, and calculate wrist offsets. Do not infer synchronization from filenames.
- Verify the same event stays aligned near the start, middle, and end after repeated seeks.
- Verify the hosted URL is accessible to the intended reviewer. The current deployment is private; change sharing explicitly if required.
- Record in a clean workspace. If upload time is long, edit out the wait while keeping the upload process and success visible.

## Recording outline

**0:00–0:30 — Problem and library**
“Argus Capture collects ego and wrist recordings into a single episode. The library keeps uploads persistent and supports search, filtering, and review.”
Show the library and create a new episode.

**0:30–1:30 — Actual sample upload**
Name the episode, assign the real sample recordings to their explicit slots, and show extracted metadata. Explain that all three are required and uploads use 8 MiB chunks. Show progress and the completed episode.

**1:30–2:45 — Three-camera review**
Play, pause, seek, restart, and change speed across all streams. Open calibration, explain the shared-event timestamps, and apply the measured wrist offsets. Show the event aligned across the three views. Refresh to demonstrate saved association and calibration.

**2:45–3:30 — Metadata and persistence**
Show filename, duration, dimensions, container, common interval, and metadata export. Explain that originals live in R2 and episode records in D1. Clarify that metadata is read in the browser; server codec/frame-rate probing is a next step.

**3:30–4:15 — Engineering tradeoffs**
Explain approximate browser synchronization, 120 ms drift correction, and buffering behavior. Mention integration coverage for multipart uploads, byte-range seeking, correct association, owner isolation, and deletion. State any actual sample-specific limits discovered during validation.

**4:15–4:30 — Reproduction**
Show README setup and validation commands. Finish with repository and deployment links.

## Final submission

- Publish the source to a GitHub repository and verify the reviewer's access.
- Record a 3–5 minute Loom or video using the actual sample upload workflow.
- Optionally share the deployed app with the reviewer after choosing the intended access policy.
- Email the GitHub and video links, plus the deployment link if shared, to the contact listed in the assignment. No email has been sent by this project.
