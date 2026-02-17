---

description: "Task list for Transport-Connector Architecture Refactor"
---

# Tasks: Transport-Connector Architecture Refactor

**Input**: Design documents from `/specs/001-transport-connector-refactor/`
**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/api-surface.md

**Tests**: Required by constitution (Principle III: Test Excellence). Test-first approach within each phase.

**Organization**: Tasks grouped by user story. US1 and US2 are sequential dependencies (US2 builds on US1's connector changes). US3 and US4 can proceed after US2.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- All source: `packages/event-hub/src/`
- Tests colocated: `packages/event-hub/src/*.spec.ts`

## Phase 1: Setup

**Purpose**: Type-level changes that all subsequent phases depend on

- [X] T001 Export MessageHandler type and add ISinkTransport interface in `packages/event-hub/src/transport.ts`. Move `MessageHandler<T>` from private type alias to exported type. Add new `ISinkTransport<T>` interface extending `ITransport` with `send(data: T): Promise<void>`. See contracts/api-surface.md for exact signatures.
- [X] T002 [P] Verify existing tests still pass after type additions by running `pnpm --filter event-hub run test:ci`. No test should break since these are additive type exports only.

---

## Phase 2: Foundational — BaseTransport Refactor

**Purpose**: Refactor BaseTransport to support multiple listeners via observable pattern. This BLOCKS all user story work.

**CRITICAL**: No user story work can begin until this phase is complete.

### Tests for BaseTransport Refactor

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T003 Write tests for BaseTransport listener management in `packages/event-hub/src/transport.spec.ts`. Test: addListener adds handler to set, removeListener removes by reference, adding same handler twice is no-op (Set semantics), removing non-existent handler is no-op, listeners set is initially empty. Update the existing TestBaseTransport mock class to remove `exposePipeline()` and add `exposeListeners()`.
- [X] T004 Write test verifying BaseTransport no longer exposes usePipeline in `packages/event-hub/src/transport.spec.ts`. Verify that `usePipeline` method does not exist on the class (property check).

### Implementation for BaseTransport Refactor

- [X] T005 Refactor BaseTransport in `packages/event-hub/src/transport.ts`. Remove `pipeline` property and `usePipeline()` method. Remove `Pipeline` import if no longer needed at transport level. Add `protected listeners: Set<MessageHandler<T>>` initialized in constructor. Add public `addListener(handler: MessageHandler<T>): void` and `removeListener(handler: MessageHandler<T>): void` methods. Change type parameter from `<TInput, TOutput = TInput>` to `<T>`. See data-model.md BaseTransport section for full specification.
- [X] T006 Run tests to verify BaseTransport changes pass: `pnpm --filter event-hub run test:ci`. Fix any remaining test failures from the refactor.

**Checkpoint**: BaseTransport has listener management, no pipeline. Existing SourceTransport/SinkTransport tests will be failing (expected — they depend on old API).

---

## Phase 3: User Story 1 — Shared Transport with Multiple Connectors (Priority: P1)

**Goal**: Multiple connectors can attach to a single transport and independently receive broadcast data.

**Independent Test**: Create one mock transport, attach two connectors to different channels, broadcast data, verify both channels receive it.

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T007 [US1] Write tests for SourceTransport broadcast in `packages/event-hub/src/transport.spec.ts`. Replace existing SourceTransport tests. Test: broadcast calls all listeners, broadcast with no listeners is no-op, broadcast isolates listener errors (one listener throwing does not prevent others from receiving), broadcast requires connected state. Update TestSourceTransport to use single generic `<T>`, remove `exposeMessageHandler`, add `exposeBroadcast()` that calls `this.broadcast(data)`.
- [X] T008 [US1] Write tests for simplified SinkTransport in `packages/event-hub/src/transport.spec.ts`. Replace existing SinkTransport tests. Test: send calls sendMessage directly without pipeline processing, send throws when not connected. Update TestSinkTransport to use single generic `<T>`, remove pipeline-related tests.
- [X] T009 [US1] Write tests for concrete SourceConnector in `packages/event-hub/src/connector.spec.ts`. Replace existing SourceConnector tests. Test: can instantiate directly (not abstract), connect attaches listener to transport, connect establishes transport connection if not already connected, connect reuses existing transport connection, disconnect removes listener but does NOT disconnect transport, received data published to correct EventHub channel, multiple connectors on same transport all receive data. Use mock transport that extends SourceTransport with exposable broadcast.
- [X] T010 [US1] Write tests for concrete SinkConnector in `packages/event-hub/src/connector.spec.ts`. Replace existing SinkConnector tests. Test: can instantiate directly (not abstract), connect subscribes to EventHub channel, connect establishes transport connection if not already connected, disconnect unsubscribes from EventHub but does NOT disconnect transport, EventHub events forwarded to transport via send.
- [X] T011 [US1] Write integration test for multi-connector data flow in `packages/event-hub/src/connector.spec.ts`. Test: two source connectors sharing one transport route data to different EventHub channels simultaneously. Verify both channels receive the broadcast data independently.

### Implementation for User Story 1

- [X] T012 [US1] Refactor SourceTransport in `packages/event-hub/src/transport.ts`. Change from `<TInput, TOutput>` to `<T>`. Remove `_onDataHandler`, `onData()`, and `messageHandler()`. Add `protected async broadcast(data: T): Promise<void>` that iterates all listeners and calls each, isolating errors per listener. See data-model.md SourceTransport section.
- [X] T013 [US1] Refactor SinkTransport in `packages/event-hub/src/transport.ts`. Change from `<TInput, TOutput>` to `<T>`. Remove pipeline processing from `send()` — it should just call `checkConnected()` then `sendMessage(data)`. Make SinkTransport implement `ISinkTransport<T>`. Update `sendMessage` signature to match single generic. See data-model.md SinkTransport section.
- [X] T014 [US1] Refactor SourceConnector to concrete class in `packages/event-hub/src/connector.ts`. Remove `abstract` keyword. Change transport type from `SourceTransport<TInput, TOutput>` to `SourceTransport<TInput>`. Add private `handler?: MessageHandler<TInput>` field. Rewrite `connect()`: create handler that publishes raw data to EventHub channel, call `transport.addListener(handler)`, call `transport.connect()` if not already connected. Make connect idempotent (remove old handler before adding new). Rewrite `disconnect()`: call `transport.removeListener(handler)` only — do NOT call `transport.disconnect()`.
- [X] T015 [US1] Refactor SinkConnector to concrete class in `packages/event-hub/src/connector.ts`. Remove `abstract` keyword. Change transport type from `SinkTransport<TInput, TOutput>` to `ISinkTransport<TOutput>`. Rewrite `connect()`: subscribe to EventHub channel, forward events to transport via `send()`, call `transport.connect()` if not already connected. Rewrite `disconnect()`: unsubscribe from EventHub only — do NOT call `transport.disconnect()`.
- [X] T016 [US1] Run tests to verify US1 changes: `pnpm --filter event-hub run test:ci`. All transport and connector tests should pass. Existing EventHub, Channel, and Pipeline tests must still pass (zero regressions).

**Checkpoint**: Multiple connectors share one transport. Data flows raw (no transformation). Transport stays connected when individual connectors disconnect.

---

## Phase 4: User Story 2 — Connector-Owned Pipelines (Priority: P2)

**Goal**: Each connector owns an optional Pipeline and applies it independently, enabling different transformations per route on a shared transport.

**Independent Test**: Two connectors on same transport with different pipelines produce different outputs from identical input.

### Tests for User Story 2

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T017 [US2] Write tests for SourceConnector.use(pipeline) in `packages/event-hub/src/connector.spec.ts`. Test: use() returns `this` for chaining, pipeline is applied to data before publishing to EventHub, connector without pipeline publishes raw data unchanged, two connectors with different pipelines on same transport produce different outputs.
- [X] T018 [US2] Write tests for SinkConnector.use(pipeline) in `packages/event-hub/src/connector.spec.ts`. Test: use() returns `this` for chaining, pipeline is applied to data received from EventHub before sending to transport, connector without pipeline sends raw data unchanged.
- [X] T019 [US2] Write tests for pipeline error handling in `packages/event-hub/src/connector.spec.ts`. Test: pipeline returning `{ success: false }` silently drops data (no publish/send, no error thrown), pipeline returning `{ success: true, data: undefined }` silently drops data, pipeline throwing exception is caught and does not propagate to transport or other connectors.

### Implementation for User Story 2

- [X] T020 [US2] Add pipeline support to SourceConnector in `packages/event-hub/src/connector.ts`. Add `private pipeline?: Pipeline<TInput, TOutput>` field. Add `use(pipeline: Pipeline<TInput, TOutput>): this` method. Update handler in `connect()` to apply pipeline if present: process data, check success, check data not null/undefined, then publish. Wrap in try/catch for pipeline exceptions. See contracts/api-surface.md for behavioural contracts.
- [X] T021 [US2] Add pipeline support to SinkConnector in `packages/event-hub/src/connector.ts`. Add `private pipeline?: Pipeline<TInput, TOutput>` field. Add `use(pipeline: Pipeline<TInput, TOutput>): this` method. Update subscription callback in `connect()` to apply pipeline if present before sending to transport. Wrap in try/catch for pipeline exceptions. Add Pipeline import to connector.ts.
- [X] T022 [US2] Run tests to verify US2 changes: `pnpm --filter event-hub run test:ci`. All connector pipeline tests should pass. Previous US1 tests must still pass.

**Checkpoint**: Each connector independently transforms data with its own pipeline. Two connectors on same transport produce different outputs.

---

## Phase 5: User Story 3 — Hub-to-Hub Federation via In-Memory Transport (Priority: P3)

**Goal**: InMemoryTransport enables connecting separate EventHub instances for federated event routing.

**Independent Test**: Two hubs connected via InMemoryTransport exchange events bidirectionally with filtering.

### Tests for User Story 3

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T023 [P] [US3] Write tests for InMemoryTransport in `packages/event-hub/src/in-memory-transport.spec.ts`. Test: connect sets connected state, disconnect sets disconnected state and clears listeners, send broadcasts data to all listeners, send throws when not connected, send with no listeners is no-op, implements ISinkTransport interface (type-check).
- [X] T024 [US3] Write tests for hub-to-hub federation in `packages/event-hub/src/in-memory-transport.spec.ts`. Test: unidirectional hub A → hub B via SinkConnector + InMemoryTransport + SourceConnector, bidirectional federation with filtering pipelines, events filtered by connector pipeline (only matching events forwarded), disconnected transport stops forwarding.

### Implementation for User Story 3

- [X] T025 [US3] Create InMemoryTransport in `packages/event-hub/src/in-memory-transport.ts`. Extends `SourceTransport<T>`, implements `ISinkTransport<T>`. Default generic `T = unknown`. `connect()` sets `_connected = true`. `disconnect()` sets `_connected = false` and clears listeners. `send(data)` calls `checkConnected()` then `broadcast(data)`. See data-model.md InMemoryTransport section.
- [X] T026 [US3] Run tests to verify US3 changes: `pnpm --filter event-hub run test:ci`. InMemoryTransport and federation tests should pass. All previous tests must still pass.

**Checkpoint**: Two EventHub instances communicate bidirectionally through InMemoryTransport with filtering.

---

## Phase 6: User Story 4 — Simplified Transport API (Priority: P4)

**Goal**: Verify that the transport base class requires only connect, disconnect, and broadcast — no pipeline or routing knowledge.

**Independent Test**: A minimal custom transport subclass passes all connector integration tests.

### Tests for User Story 4

- [X] T027 [US4] Write verification test for minimal transport API in `packages/event-hub/src/transport.spec.ts`. Create a MinimalTestTransport that extends SourceTransport, implements only connect/disconnect/broadcast (no pipeline, no routing). Connect it to a SourceConnector with a pipeline. Verify data flows correctly through the connector's pipeline. This proves the transport API is minimal and the connector handles all transformation logic.

### Implementation for User Story 4

> No implementation needed — US4 is achieved by US1 transport refactor. This phase is verification only.

- [X] T028 [US4] Run the minimal transport verification test: `pnpm --filter event-hub run test:ci`. Confirm the test passes.

**Checkpoint**: Custom transport requires only connect, disconnect, and broadcast. All transformation is handled by connectors.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Update exports, verify full coverage, ensure clean build

- [X] T029 Update public API exports in `packages/event-hub/src/index.ts`. Add exports for: `InMemoryTransport`, `ISinkTransport`, `MessageHandler`, `SourceConnector`, `SinkConnector` (re-export from connector.ts). Verify all existing exports remain. See data-model.md Public API Surface section.
- [X] T030 Run full test suite with coverage: `pnpm --filter event-hub run test:ci`. Verify 100% coverage target on all modified/new files. Document any modules at 90% with rationale per constitution Principle III.
- [X] T031 [P] Run linter: `pnpm --filter event-hub run lint`. Fix any lint errors introduced by the refactor.
- [X] T032 Verify existing EventHub, Channel, and Pipeline tests are unmodified and passing (SC-005 zero regression check). Run `pnpm --filter event-hub run test -- --testPathPattern="(event-hub|channel|pipeline).spec"`.
- [X] T033 Verify transport.ts contains zero references to Pipeline types (SC-006). Inspect the final transport.ts to confirm no Pipeline import or usage remains.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — BLOCKS all user stories
- **US1 (Phase 3)**: Depends on Phase 2 — foundational transport refactor
- **US2 (Phase 4)**: Depends on Phase 3 — builds on concrete connectors from US1
- **US3 (Phase 5)**: Depends on Phase 4 — uses connectors with pipeline support
- **US4 (Phase 6)**: Depends on Phase 3 — verifies transport API simplification
- **Polish (Phase 7)**: Depends on all user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependencies on other stories
- **US2 (P2)**: Depends on US1 — adds pipeline to connectors created in US1
- **US3 (P3)**: Depends on US2 — uses pipeline-owning connectors for filtering
- **US4 (P4)**: Depends on US1 — verifies transport simplification from US1; can run in parallel with US2/US3

### Within Each User Story

- Tests MUST be written and FAIL before implementation
- Transport changes before connector changes (within US1)
- Connector structure before pipeline integration (US1 → US2)
- Run test suite after each implementation task
- Story complete before moving to next priority

### Parallel Opportunities

- T001 and T002 can run in parallel (different concerns)
- T003 and T004 can run in parallel (different test files conceptually, same file practically — sequential recommended)
- T007 and T008 can run in parallel (different describe blocks in transport.spec.ts)
- T009, T010, T011 can run in parallel (different describe blocks in connector.spec.ts)
- T012 and T013 are in the same file — sequential within transport.ts
- T014 and T015 are in the same file — sequential within connector.ts
- T023 is in a NEW file — can run in parallel with T017-T019
- T029 and T031 can run in parallel (different files)
- US4 (Phase 6) can run in parallel with US3 (Phase 5) since US4 only depends on US1

---

## Parallel Example: User Story 1

```bash
# Write transport tests in parallel (different describe blocks):
Task: "T007 - SourceTransport broadcast tests in transport.spec.ts"
Task: "T008 - SinkTransport simplified send tests in transport.spec.ts"

# Write connector tests in parallel (different describe blocks):
Task: "T009 - SourceConnector concrete tests in connector.spec.ts"
Task: "T010 - SinkConnector concrete tests in connector.spec.ts"
Task: "T011 - Multi-connector integration test in connector.spec.ts"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (types)
2. Complete Phase 2: Foundational (BaseTransport refactor)
3. Complete Phase 3: User Story 1 (transport observable + concrete connectors)
4. **STOP and VALIDATE**: Multiple connectors share one transport, data flows
5. This alone delivers the core value: shared transports with N:1 connector relationship

### Incremental Delivery

1. Setup + Foundational → Types and BaseTransport ready
2. US1 → Multi-connector transport sharing works (MVP!)
3. US2 → Each connector applies its own pipeline independently
4. US3 → Hub-to-hub federation via InMemoryTransport
5. US4 → Verification that transport API is minimal
6. Polish → Exports updated, full coverage, clean lint
7. Each story adds capability without breaking previous stories

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- All source paths relative to repository root: `packages/event-hub/src/`
- Test command: `pnpm --filter event-hub run test:ci`
- Single test file: `pnpm --filter event-hub run test -- --testPathPattern=<pattern>`
- Commit after each phase checkpoint
- This is a breaking change — will require major version bump per constitution
