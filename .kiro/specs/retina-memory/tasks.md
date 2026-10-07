# Implementation Plan: Retina Memory

## Overview

Implement a full-stack AI assistive application for blind and visually impaired users. The backend is a Python FastAPI service with three endpoints (`/capture`, `/query`, `/detect`), a JSON circular-buffer memory store, and a Gemini 1.5 Flash vision client. The frontend is a React (Vite) app with voice I/O via the Web Speech API, a haptic compass via the Vibration API, and a dark-mode accessible UI.

Tasks are ordered so each step builds on the previous one. Backend core modules come first (they are pure functions that can be tested in isolation), then API wiring, then the frontend, then integration and polish.

---

## Tasks

- [x] 1. Scaffold project structure
  - Create `retina-memory/backend/` with `main.py`, `api.py`, `db.py`, `memory.py`, `vision.py`, `intent.py`, `response.py`, and an empty `memory.json`.
  - Create `retina-memory/frontend/` as a Vite React app (`npm create vite@latest frontend -- --template react`).
  - Add `retina-memory/backend/requirements.txt` pinning `fastapi`, `uvicorn[standard]`, `pydantic`, `httpx`, `hypothesis`, `pytest`, `pytest-asyncio`.
  - Add `retina-memory/frontend/package.json` dependencies: `fast-check`, `vitest`, `@testing-library/react`, `@testing-library/jest-dom`.
  - Create `retina-memory/backend/.env.example` with `VISION_PROVIDER=dummy`, `GEMINI_API_KEY=`, `MAX_ENTRIES=100`.
  - _Requirements: 1.1, 2.2, 7.1_

- [x] 2. Implement backend data models
  - [x] 2.1 Define the `Observation` Pydantic model in `backend/models.py`
    - Fields: `object: str`, `color: str`, `position: Literal["left","center","right"]`, `location: str`, `timestamp: datetime`, `confidence: float | None = None`.
    - Add a `model_config` with `json_encoders` so `datetime` serialises to ISO 8601 UTC strings.
    - _Requirements: 2.1, 7.2_

  - [ ]* 2.2 Write property test for Observation serialization round-trip (Property 10)
    - **Property 10: Observation Serialization Round-Trip**
    - Use `hypothesis` with a custom `observation_strategy()` that generates valid `Observation` instances.
    - Assert `Observation.model_validate_json(obs.model_dump_json()) == obs` for 100 examples.
    - **Validates: Requirements 2.1, 7.2**

- [x] 3. Implement the Memory Store (`backend/memory.py` and `backend/db.py`)
  - [x] 3.1 Implement `JSONMemoryStore` with circular buffer
    - Implement `write_observations(observations: list[Observation]) -> None` — appends to `memory.json`, evicts oldest when `len > MAX_ENTRIES`, uses atomic write (temp file + rename).
    - Implement `query_observations(object_name: str) -> Observation | None` — returns the most recent entry matching `object_name` (case-insensitive).
    - Implement `clear_all() -> None` — overwrites `memory.json` with `{"version":1,"entries":[]}`.
    - Implement `get_recent(limit: int = 20) -> list[Observation]` — returns the last `limit` entries.
    - Define `MemoryStore` abstract base class in `db.py`; `JSONMemoryStore` extends it.
    - _Requirements: 2.2, 2.4, 2.5, 7.1, 7.2_

  - [ ]* 3.2 Write property test for Observation round-trip fidelity (Property 1)
    - **Property 1: Observation Round-Trip Fidelity**
    - Write an observation to a temp `JSONMemoryStore`, query by `object` name, assert all fields match.
    - **Validates: Requirements 2.6**

  - [ ]* 3.3 Write property test for circular buffer capacity invariant (Property 2)
    - **Property 2: Circular Buffer Capacity Invariant**
    - Generate lists of 101–200 observations, write all, assert `len(store.get_all()) == 100` and retained entries are the last 100 written.
    - **Validates: Requirements 2.4, 2.5**

  - [ ]* 3.4 Write unit tests for Memory Store (`backend/tests/test_memory.py`)
    - Test write/read round-trip with a single observation.
    - Test `clear_all` empties the store.
    - Test `get_recent` respects the `limit` parameter.
    - _Requirements: 2.2, 2.4, 7.1_

- [x] 4. Implement the Vision Model client (`backend/vision.py`)
  - [x] 4.1 Implement `parse_vision_response(raw: str) -> list[Observation]`
    - Parse the raw LLM JSON string; return an empty list (not an exception) for any malformed input.
    - Validate each item has required fields and a valid `position` enum value; discard invalid items.
    - _Requirements: 2.1, 2.3_

  - [ ]* 4.2 Write property test for malformed LLM response rejection (Property 3)
    - **Property 3: Malformed LLM Response Rejection**
    - Use `hypothesis` `st.text()` to generate arbitrary strings; assert `parse_vision_response` always returns a `list` and never raises.
    - **Validates: Requirements 2.3**

  - [x] 4.3 Implement `GeminiVisionClient` and `DummyVisionClient`
    - `GeminiVisionClient.analyze_image(image_bytes: bytes) -> list[Observation]`: POST to Gemini 1.5 Flash with the structured prompt; enforce 10-second timeout; raise `VisionTimeoutError` on expiry.
    - `DummyVisionClient.analyze_image(image_bytes: bytes) -> list[Observation]`: return a fixed list of 3 sample observations (wallet, keys, phone).
    - Select client via `VISION_PROVIDER` env var (`gemini` | `dummy`).
    - _Requirements: 1.3, 1.5_

  - [ ]* 4.4 Write unit tests for vision parser (`backend/tests/test_vision_parser.py`)
    - Test valid LLM JSON parses to correct `Observation` list.
    - Test missing required field discards the item.
    - Test invalid `position` value discards the item.
    - Test empty string returns empty list.
    - _Requirements: 2.1, 2.3_

- [x] 5. Implement the Intent Router (`backend/intent.py`)
  - [x] 5.1 Implement `classify_intent(query: str) -> Literal["memory_lookup", "live_vision"]`
    - Pure function; keyword matching (case-insensitive).
    - Memory-lookup keywords: `where did i leave`, `where is my`, `have you seen my`, `find my`, `where are my`.
    - Live-vision keywords: `what is this`, `what am i holding`, `describe`, `what do you see`, `what's in front`.
    - Default to `memory_lookup` for unmatched queries.
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 5.2 Write property test for intent classification totality (Property 4)
    - **Property 4: Intent Classification Totality**
    - Use `hypothesis` `st.text(min_size=1)`; assert result is always `"memory_lookup"` or `"live_vision"`.
    - **Validates: Requirements 6.4**

  - [ ]* 5.3 Write property test for memory-lookup keyword routing (Property 5)
    - **Property 5: Memory Lookup Keywords Always Route to Memory**
    - Generate strings that contain at least one memory-lookup keyword; assert classification is always `"memory_lookup"`.
    - **Validates: Requirements 6.1**

  - [ ]* 5.4 Write property test for live-vision keyword routing (Property 6)
    - **Property 6: Live Vision Keywords Always Route to Live Vision**
    - Generate strings containing a live-vision keyword and no memory-lookup keywords; assert classification is `"live_vision"`.
    - **Validates: Requirements 6.2**

  - [ ]* 5.5 Write unit tests for Intent Router (`backend/tests/test_intent.py`)
    - Test each memory-lookup keyword phrase routes correctly.
    - Test each live-vision keyword phrase routes correctly.
    - Test empty-ish / unrecognised query defaults to `memory_lookup`.
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

- [x] 6. Implement the Response Formatter (`backend/response.py`)
  - [x] 6.1 Implement `format_memory_response(observation: Observation | None, object_name: str) -> str`
    - Found: `"I last saw your {object} {relative_time} {position_phrase}."` — include `location` if available.
    - Not found: `"I couldn't find your {object} recently. I haven't seen it in the last 24 hours."`
    - Implement `relative_time(ts: datetime) -> str` helper (e.g., "5 minutes ago", "2 hours ago").
    - Pure function; no I/O.
    - _Requirements: 3.4, 3.5_

  - [ ]* 6.2 Write property test for response completeness (Property 7)
    - **Property 7: Natural Language Response Completeness**
    - For any generated `Observation`, assert the response is non-empty, contains the object name, and contains a time expression.
    - **Validates: Requirements 3.4**

  - [ ]* 6.3 Write property test for not-found response (Property 8)
    - **Property 8: Not-Found Response Is Non-Empty and Informative**
    - For any object name string, call `format_memory_response(None, name)` and assert the result is non-empty and contains the object name.
    - **Validates: Requirements 3.5**

  - [ ]* 6.4 Write unit tests for Response Formatter (`backend/tests/test_response.py`)
    - Test found response contains object name, relative time, and position phrase.
    - Test not-found response contains object name and is non-empty.
    - Test `relative_time` returns correct strings for seconds, minutes, and hours.
    - _Requirements: 3.4, 3.5_

- [x] 7. Checkpoint — backend pure functions
  - Ensure all backend unit tests and property tests pass (`pytest backend/tests/`).
  - Ask the user if any questions arise before proceeding to API wiring.

- [x] 8. Implement FastAPI application and API endpoints (`backend/main.py`, `backend/api.py`)
  - [x] 8.1 Set up `main.py`
    - Create `FastAPI` app instance; configure CORS to allow the Vite dev origin (`http://localhost:5173`).
    - On startup, initialise the `JSONMemoryStore` (create `memory.json` if absent).
    - Include the router from `api.py`.
    - _Requirements: 1.1, 7.1_

  - [x] 8.2 Implement `POST /capture`
    - Accept `CaptureRequest` (`image: str` base64 JPEG).
    - Decode base64, call `vision_client.analyze_image()`, write observations to memory store.
    - Return `CaptureResponse` (`observations`, `model_used`, `processing_time_ms`).
    - On `VisionTimeoutError`: return HTTP 504 with detail; do not write partial observations.
    - _Requirements: 1.3, 1.5, 2.1, 2.2_

  - [x] 8.3 Implement `POST /query`
    - Accept `QueryRequest` (`query: str`).
    - Call `classify_intent`; for `memory_lookup` call `query_observations` then `format_memory_response`; for `live_vision` capture a new frame (or return a prompt to the frontend to send one).
    - Return `QueryResponse` (`intent`, `response_text`, `observation`).
    - _Requirements: 3.2, 3.3, 3.4, 3.5, 6.1, 6.2, 6.3_

  - [x] 8.4 Implement `POST /detect`
    - Accept `DetectRequest` (`image: str`, `target_object: str`).
    - Decode base64, call `vision_client.analyze_image()`, find the observation matching `target_object`.
    - Return `DetectResponse` (`position`, `confidence`); return `position: "not_found"` if no match.
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ]* 8.5 Write integration tests for API endpoints (`backend/tests/test_api_*.py`)
    - `test_api_capture.py`: POST a fixture base64 image to `/capture`; assert response shape and that observations appear in the store.
    - `test_api_query.py`: Seed the store, POST a memory-lookup query, assert `response_text` contains the object name.
    - `test_api_detect.py`: POST a fixture image to `/detect`; assert `position` is one of the valid enum values.
    - _Requirements: 1.3, 3.3, 4.2_

- [x] 9. Checkpoint — backend API
  - Run `uvicorn backend.main:app --reload` and manually verify all three endpoints respond.
  - Ensure all integration tests pass.
  - Ask the user if any questions arise before starting the frontend.

- [x] 10. Implement frontend core utilities and types (`frontend/src/`)
  - [x] 10.1 Define shared TypeScript types
    - Create `frontend/src/types.ts` with `Observation`, `CaptureResponse`, `QueryResponse`, `DetectResponse` interfaces matching the API schemas.
    - _Requirements: 2.1_

  - [x] 10.2 Implement API client module (`frontend/src/api.ts`)
    - `captureFrame(imageBase64: string): Promise<CaptureResponse>`
    - `queryMemory(query: string): Promise<QueryResponse>`
    - `detectObject(imageBase64: string, targetObject: string): Promise<DetectResponse>`
    - Use `fetch`; throw typed errors on non-2xx responses.
    - Read base URL from `import.meta.env.VITE_API_URL` (default `http://localhost:8000`).
    - _Requirements: 1.3, 3.3, 4.2_

  - [x] 10.3 Implement `VoiceOutput` utility module (`frontend/src/voiceOutput.ts`)
    - Wrap `window.speechSynthesis.speak()`; queue utterances; do not interrupt a speaking response.
    - Export `speak(text: string, rate?: number): void` and `cancelAll(): void`.
    - Fall back to `console.warn` when `speechSynthesis` is unavailable.
    - _Requirements: 3.4, 3.7, 8.5_

- [x] 11. Implement `CameraFeed` component (`frontend/src/components/CameraFeed.jsx`)
  - Request `getUserMedia({ video: { facingMode: "environment" } })`.
  - Render a `<video>` element (muted, autoPlay, playsInline); optionally hidden via a `hidden` prop.
  - Expose `captureFrame(): string` (returns base64 JPEG via `<canvas>`).
  - On permission denied: call `onError("Camera permission required")`.
  - _Requirements: 1.1, 1.4_

- [x] 12. Implement `VoiceInput` component (`frontend/src/components/VoiceInput.jsx`)
  - Wrap `window.SpeechRecognition` / `webkitSpeechRecognition`.
  - Emit `onTranscript(text: string)` when recognition completes.
  - Fall back to a `<textarea>` + submit button when speech recognition is unavailable.
  - Accessible: `aria-label="Voice input"`, visible focus ring.
  - _Requirements: 3.1, 8.1, 8.2_

- [x] 13. Implement `StatusIndicator` component (`frontend/src/components/StatusIndicator.jsx`)
  - Accept `mode: "scanning" | "listening" | "thinking" | "idle"` prop.
  - Display large, high-contrast text and an animated icon for each mode.
  - Include an `aria-live="polite"` region that announces mode changes to screen readers.
  - _Requirements: 8.1, 8.2_

- [x] 14. Implement `ObjectList` component (`frontend/src/components/ObjectList.jsx`)
  - Accept `observations: Observation[]` prop.
  - Render each item with object name, position badge, and relative timestamp.
  - Use large text, high-contrast colours (≥ 4.5:1 contrast ratio), and `role="list"` / `role="listitem"`.
  - _Requirements: 2.1, 8.1_

- [x] 15. Implement `ScanButton` component (`frontend/src/components/ScanButton.jsx`)
  - Render a "Scan Now" button with minimum 48×48 px touch target.
  - `aria-label="Scan now"`.
  - Emit `onClick` to trigger an immediate capture outside the timer cycle.
  - _Requirements: 1.1, 8.1_

- [x] 16. Implement `HapticCompass` component (`frontend/src/components/HapticCompass.jsx`)
  - [x] 16.1 Implement haptic guidance session logic
    - Accept `targetObject: string` and `cameraRef` props.
    - When active, send frames to `/detect` at ~10 fps using `setInterval`.
    - Call `navigator.vibrate(150)` when `position === "center"`.
    - Repeat vibration pulses at 500 ms intervals while continuously detected.
    - Stop vibration when position is not `center`.
    - After 60 seconds without detection, call `onTimeout()` and speak a notification.
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.7_

  - [x] 16.2 Implement visual fallback for devices without Vibration API
    - Detect `typeof navigator.vibrate !== "function"`.
    - When vibration is unavailable, pulse a `<div>` with a CSS animation instead.
    - _Requirements: 4.8_

  - [x] 16.3 Write property test for haptic trigger logic (Property 9)
    - **Property 9: Haptic Trigger Only on Center Detection**
    - Use `fast-check` `fc.constantFrom("left","center","right","not_found")` to drive a simulated detection sequence.
    - Assert `navigator.vibrate` is called if and only if `position === "center"`.
    - **Validates: Requirements 4.3**

  - [ ]* 16.4 Write unit tests for `HapticCompass` (`frontend/src/components/HapticCompass.test.jsx`)
    - Test vibration called on `center` detection.
    - Test vibration NOT called on `left`, `right`, `not_found`.
    - Test visual fallback renders when `navigator.vibrate` is absent.
    - _Requirements: 4.3, 4.8_

- [x] 17. Implement `DemoMode` component (`frontend/src/components/DemoMode.jsx`)
  - Load pre-seeded `Observation` fixtures from `frontend/src/fixtures/demoObservations.ts`.
  - Simulate the scanning loop using the fixture data (no real camera or API calls).
  - Activate via `?demo=true` query parameter or a "Demo Mode" toggle button.
  - _Requirements: 8.1_

- [x] 18. Implement root `App.jsx` and wire all components together
  - Manage global state: `mode`, `observations`, `hapticTarget`, `speechRate`.
  - Start the 5-second scanning timer on mount; call `cameraRef.captureFrame()` → `captureFrame()` API → update `observations`.
  - Implement battery check: call `navigator.getBattery()` on mount; switch to 30-second interval when level ≤ 0.15; speak notification once.
  - Wire `VoiceInput.onTranscript` → `queryMemory()` API → `speak(response_text)`.
  - Wire `HapticCompass` activation from `QueryResponse` when intent is `memory_lookup` and user confirms guidance.
  - Render `StatusIndicator`, `CameraFeed`, `ObjectList`, `ScanButton`, `VoiceInput`, `HapticCompass`, `DemoMode`.
  - _Requirements: 1.1, 1.6, 3.1, 3.4, 4.1, 8.4_

- [x] 19. Apply dark mode and accessibility styling
  - Set `color-scheme: dark` in `index.css`; use CSS custom properties for all colours.
  - Verify all text meets WCAG 1.4.3 (≥ 4.5:1 contrast ratio).
  - Ensure all interactive elements have `aria-label` or visible text labels.
  - Ensure all interactive elements have a minimum 48×48 px touch target (WCAG 2.5.5).
  - Add `role` and `aria-*` attributes to dynamic regions (`aria-live="polite"` for status changes).
  - Verify full keyboard navigation (Tab order, visible focus rings).
  - _Requirements: 8.1, 8.2, 8.3_

- [x] 20. Checkpoint — frontend components
  - Run `npm run test -- --run` in `frontend/` and ensure all component tests pass.
  - Visually verify dark mode renders correctly and all components are accessible.
  - Ask the user if any questions arise before integration testing.

- [x] 21. Frontend–backend integration and end-to-end wiring
  - [x] 21.1 Configure Vite proxy for local development
    - Add `server.proxy` in `vite.config.ts` to forward `/api/*` to `http://localhost:8000`.
    - Update `api.ts` base URL to use the proxy path in development.
    - _Requirements: 1.3_

  - [x] 21.2 Implement demo mode fixture seeding
    - Create `frontend/src/fixtures/demoObservations.ts` with at least 10 realistic `Observation` entries (wallet, keys, phone, glasses, remote, etc.).
    - Ensure `DemoMode` uses these fixtures to populate `ObjectList` and simulate query responses.
    - _Requirements: 8.1_

  - [ ]* 21.3 Write integration tests for full scan → query flow (`frontend/src/App.test.jsx`)
    - Mock the API client; simulate a scan cycle that returns observations; simulate a voice query; assert `speak` is called with a response containing the object name.
    - _Requirements: 1.3, 3.4_

- [x] 22. Final checkpoint — full stack
  - Run `pytest backend/tests/` and confirm all backend tests pass.
  - Run `npm run test -- --run` in `frontend/` and confirm all frontend tests pass.
  - Start backend (`uvicorn backend.main:app`) and frontend (`npm run dev`) and verify the demo mode flow end-to-end.
  - Ask the user if any questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP.
- Each task references specific requirements for traceability.
- Checkpoints (tasks 7, 9, 20, 22) ensure incremental validation at natural boundaries.
- Property tests (Properties 1–10) validate universal correctness guarantees; unit tests validate specific examples and edge cases.
- The `DummyVisionClient` (`VISION_PROVIDER=dummy`) allows full backend development and testing without a Gemini API key.
- Demo mode (`?demo=true`) allows full frontend development and testing without a running backend