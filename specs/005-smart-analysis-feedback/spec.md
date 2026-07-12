# Specification: Smart Analysis Generation Feedback

**Feature Branch**: `005-smart-analysis-feedback`
**Created**: 2026-07-12
**Status**: Implemented, pending manual validation

## User Scenarios and Testing

### User Story 1 - See an accepted generation request (Priority: P1)

When a user chooses `Generate Smart Chapters`, the existing Smart control appears immediately even when no chapters exist yet. It shows a pulsing amber diamond while work is queued or running.

**Independent Test**: Open an unindexed video, request Smart Chapters, and verify the Smart control appears before the first result is written.

### User Story 2 - Understand the outcome (Priority: P2)

The Smart control and Smart Analysis block show a short state: queued, analysing, ready, or failed. No inaccurate percentage is displayed.

**Independent Test**: Observe an active job transition from queued to running to ready; verify the control becomes the normal green Smart control when chapters load.

## Requirements

- **FR-001**: Player controls MUST render a Smart status control for queued, running, or failed jobs even when no Smart Chapter segment exists.
- **FR-002**: Queued and running jobs MUST use a pulsing amber diamond and an accurate short label.
- **FR-003**: A failed job MUST use a discreet red diamond and expose its error through the control tooltip.
- **FR-004**: When segments exist, the normal Smart filter/navigation controls MUST remain unchanged.
- **FR-005**: The video detail page MUST show a concise Smart Analysis status while a job is active.
- **FR-006**: Existing toast notifications remain supplementary feedback, not the only feedback.
