# Epic: Workshop Cache Usage Evidence

**Status:** Implementation complete; live provider and editor-tab checks pending
**Priority:** Medium
**Created:** 2026-09-23
**Branch:** `feat/workshop-cache-usage-badge`
**Decision:** Extend the proposed [cache visibility ADR](../../../docs/adr/2026-08-06-context-cache-token-visibility.md) with a response-local first slice. The context bar continues to represent context-window occupancy.

## Goal

Show whether OpenRouter reported a prompt-cache read for a completed Workshop response, using the response's own measured usage. This gives the writer evidence about actual cache use before changing cache policy or adding cumulative cache colors to the context bar.

## Scope

One sprint: [01 — Capture and show cache usage](sprints/01-capture-and-show-cache-usage.md).

## Follow-up boundary

This epic does not turn on provider-specific caching, set session affinity, or promise a hit on the next request. The parked Anthropic cache-policy proposal remains separate. A future context-bar split can use the same measured fields after its window-occupancy design is resolved.
