# Requirements Document

## Introduction

Retina Memory is an AI-powered assistive mobile application for blind and visually impaired users. It passively scans the user's environment using the device camera, builds a time-stamped memory of object locations, and allows users to query that memory through voice to find items they have set down. A haptic compass feature guides users toward a target object by vibrating when the camera is pointed at the object's last known location. The system solves the "object permanence" problem — the inability to glance around a room to locate misplaced items — without requiring any active user interaction during scanning.

## Glossary

- **Scanner**: The background service that periodically captures images and sends them to the Vision Model for analysis.
- **Vision_Model**: The cloud-based multimodal AI model (e.g., Gemini 1.5 Flash) that analyzes images and returns structured object-location data.
- **Memory_Store**: The local persistent storage layer (JSON file or embedded vector database) that holds all time-stamped object observations.
- **Query_Engine**: The component that searches the Memory_Store in response to a user voice query and returns the most recent matching observation.
- **Voice_Input**: The speech-to-text component (e.g., Faster-Whisper) that transcribes the user's spoken queries and commands.
- **Voice_Output**: The text-to-speech component (e.g., ElevenLabs or Edge-TTS) that speaks responses back to the user.
- **Haptic_Compass**: The component that controls device vibration to guide the user toward a target object's last known position.
- **Object_Detector**: The lightweight on-device model (e.g., YOLO) used during active haptic guidance to detect whether the target object is in the camera frame.
- **Wake_Word_Detector**: The always-on audio component that listens for the activation phrase and triggers the Voice_Input pipeline.
- **Intent_Router**: The component that classifies a transcribed query as either a memory lookup ("Where is X?") or a live vision request ("What is this?").
- **Observation**: A single record containing an object name, its rough spatial position (left, center, right), and the timestamp when it was seen.
- **Target_Object**: The object the user is actively trying to locate during a haptic guidance session.

---

## Requirements

### Requirement 1: Passive Background Scanning

**User Story:** As a blind user, I want the app to silently scan my surroundings while I go about my day, so that I do not have to remember to point the camera at things or interact with the app.

#### Acceptance Criteria

1. WHILE the Scanner is active, THE Scanner SHALL capture a camera image at a configurable interval not exceeding 5 seconds.
2. WHILE the Scanner is active, THE Scanner SHALL operate without producing any audio output or requiring user interaction.
3. WHEN an image is captured, THE Scanner SHALL send the image to the Vision_Model with a prompt requesting a list of all distinct visible objects and their rough spatial positions (left, center, or right).
4. IF the device camera is unavailable or permission is denied, THEN THE Scanner SHALL log the error and suspend scanning until the camera becomes available.
5. IF the Vision_Model returns an error or times out after 10 seconds, THEN THE Scanner SHALL discard the failed frame and resume scanning on the next interval without crashing.
6. WHILE the Scanner is active and the device battery level is below 15%, THE Scanner SHALL increase the capture interval to 30 seconds to conserve power.

---

### Requirement 2: Structured Object Observation

**User Story:** As a blind user, I want the app to record what it sees in a structured way, so that object locations can be reliably retrieved later.

#### Acceptance Criteria

1. WHEN the Vision_Model returns a result, THE Scanner SHALL parse the response into one or more Observations, each containing: object name (string), spatial position (one of: left, center, right), and an ISO 8601 timestamp.
2. THE Memory_Store SHALL persist each Observation to local storage within 1 second of receipt.
3. IF the Vision_Model response cannot be parsed into the required structure, THEN THE Scanner SHALL log the malformed response and discard it without writing a partial Observation.
4. THE Memory_Store SHALL retain Observations for a minimum of 24 hours from the time of capture.
5. THE Memory_Store SHALL store a minimum of 10,000 Observations without degrading query response time beyond 500 milliseconds.
6. FOR ALL valid Observations written to the Memory_Store, THE Memory_Store SHALL return an equivalent Observation when queried by the same object name and timestamp (round-trip property).

---

### Requirement 3: Voice Query Interface

**User Story:** As a blind user, I want to ask "Where did I leave my keys?" using my voice, so that I can find items without needing to touch the screen.

#### Acceptance Criteria

1. WHEN the Wake_Word_Detector recognizes the configured wake phrase, THE Voice_Input SHALL begin transcribing the user's spoken query.
2. WHEN transcription is complete, THE Intent_Router SHALL classify the query as either a memory lookup or a live vision request within 500 milliseconds.
3. WHEN the Intent_Router classifies a query as a memory lookup, THE Query_Engine SHALL search the Memory_Store for the most recent Observation matching the queried object name.
4. WHEN a matching Observation is found, THE Voice_Output SHALL speak a response including the object name, its spatial position, and a human-readable relative time (e.g., "5 minutes ago") within 2 seconds of the query being classified.
5. IF no matching Observation is found in the Memory_Store, THEN THE Voice_Output SHALL inform the user that the object has not been seen, rather than returning silence or an error tone.
6. WHEN the Intent_Router classifies a query as a live vision request, THE Scanner SHALL capture an image immediately and THE Voice_Output SHALL speak the Vision_Model's description within 3 seconds.
7. THE Voice_Output SHALL complete each spoken response before accepting a new wake word activation.

---

### Requirement 4: Haptic Compass Guidance

**User Story:** As a blind user, I want the phone to vibrate when I am pointing the camera at where my target object was last seen, so that I can physically navigate to it without needing to hear constant audio instructions.

#### Acceptance Criteria

1. WHEN the user requests haptic guidance for a Target_Object, THE Haptic_Compass SHALL activate and THE Object_Detector SHALL begin processing the live camera feed.
2. WHILE the Haptic_Compass is active, THE Object_Detector SHALL analyze each camera frame to determine whether the Target_Object is present in the center region of the frame.
3. WHEN the Target_Object is detected in the center region of the frame, THE Haptic_Compass SHALL trigger a short vibration pulse of 100–200 milliseconds duration.
4. WHILE the Target_Object is continuously detected in the center region, THE Haptic_Compass SHALL repeat vibration pulses at intervals of 500 milliseconds.
5. WHEN the Target_Object is no longer detected in the center region, THE Haptic_Compass SHALL cease vibration within one frame processing cycle.
6. WHEN the user confirms they have found the Target_Object (via voice command "found it" or equivalent), THE Haptic_Compass SHALL deactivate and THE Object_Detector SHALL stop processing.
7. IF the Haptic_Compass has been active for 60 seconds without the Target_Object being detected, THEN THE Voice_Output SHALL notify the user that the object was not found in the current area and offer to continue or cancel.
8. WHERE the device does not support haptic feedback, THE Haptic_Compass SHALL fall back to an audio tone of distinct frequency as a directional cue.

---

### Requirement 5: Wake Word Detection

**User Story:** As a blind user, I want to activate the assistant hands-free using a spoken phrase, so that I never need to touch the screen.

#### Acceptance Criteria

1. WHILE the app is running in the foreground or background, THE Wake_Word_Detector SHALL continuously listen for the configured wake phrase.
2. WHEN the wake phrase is detected, THE Wake_Word_Detector SHALL activate the Voice_Input pipeline within 300 milliseconds.
3. THE Wake_Word_Detector SHALL operate without sending audio data to any external server.
4. IF the Wake_Word_Detector produces a false positive, THEN THE Voice_Input SHALL time out after 5 seconds of silence and return to the listening state without speaking an error.
5. THE Wake_Word_Detector SHALL maintain a false positive rate below one activation per 10 minutes of ambient audio in a typical indoor environment.

---

### Requirement 6: Intent Routing

**User Story:** As a blind user, I want the assistant to understand whether I am asking about something I saw before or something in front of me right now, so that I get the right kind of answer.

#### Acceptance Criteria

1. WHEN a transcribed query contains a phrase indicating past location (e.g., "where did I leave", "where is my", "have you seen my"), THE Intent_Router SHALL classify it as a memory lookup.
2. WHEN a transcribed query contains a phrase indicating present observation (e.g., "what is this", "what am I holding", "describe what you see"), THE Intent_Router SHALL classify it as a live vision request.
3. IF a transcribed query does not match either classification pattern, THEN THE Intent_Router SHALL default to a memory lookup and THE Voice_Output SHALL inform the user of the interpretation before responding.
4. THE Intent_Router SHALL produce a classification for every non-empty transcription it receives.

---

### Requirement 7: Memory Persistence and Privacy

**User Story:** As a blind user, I want my object memory to survive app restarts and to remain private on my device, so that I can rely on it across sessions and trust that my home environment is not shared.

#### Acceptance Criteria

1. THE Memory_Store SHALL persist all Observations to on-device local storage so that data survives app termination and device restart.
2. THE Memory_Store SHALL store no raw images; only structured Observation records (object name, position, timestamp) SHALL be persisted.
3. WHEN the user issues a "clear memory" voice command, THE Memory_Store SHALL delete all stored Observations within 2 seconds and THE Voice_Output SHALL confirm deletion.
4. THE Memory_Store SHALL not transmit Observation data to any external server or third-party service.
5. WHERE the device operating system supports encrypted storage, THE Memory_Store SHALL store Observations in an encrypted container.

---

### Requirement 8: Accessibility and Onboarding

**User Story:** As a blind user, I want to set up and configure the app entirely through voice and audio feedback, so that I do not need sighted assistance to get started.

#### Acceptance Criteria

1. THE App SHALL provide a spoken onboarding tutorial that guides the user through granting camera, microphone, and notification permissions using only audio prompts.
2. WHEN a required permission is denied, THE App SHALL speak a description of why the permission is needed and how to grant it, without displaying a visual-only dialog as the sole feedback mechanism.
3. THE App SHALL expose all configuration options (scan interval, wake phrase, voice speed) through voice commands in addition to any visual UI.
4. WHEN the app is launched for the first time, THE App SHALL speak a welcome message and begin the onboarding tutorial automatically.
5. THE Voice_Output speech rate SHALL be configurable between 0.5× and 2.0× normal speed to accommodate different user preferences.
