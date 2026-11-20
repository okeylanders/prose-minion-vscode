# Feature: Help Explains Using an OpenAI or Claude Account Through OpenRouter's BYOK

**Date Identified:** 2026-11-20
**Status:** Idea. Small: one new help section, drafted below. Until [Model Providers](../feature-model-providers/README.md) adds direct connections, this is the answer.
**Priority:** Medium. A persona asked "can I use my Claude account?" has no section to answer from.
**Origin:** Okey, 2026-11-20

## In Okey's words

> If a user asks how they can use their OpenAI or Claude account, we could
> make mention of the BYOK in OpenRouter until we get the other providers
> added.

## The gap

- **Prose Minion connects only through OpenRouter.** The help reference
  says to add an OpenRouter API key (`overview.md`, "Settings and models").
- **Nothing covers the common question:** "I already pay OpenAI or
  Anthropic, so can I use that?"
- **OpenRouter's BYOK (Bring Your Own Key)** is the answer for now. A
  writer adds their OpenAI or Anthropic API key in OpenRouter, and
  OpenRouter sends that provider's requests with it.

## Facts checked (2026-11-20, OpenRouter's own pages)

- **The provider bills the writer** for those requests.
- **OpenRouter charges a small fee** (5% of the equivalent OpenRouter cost)
  beyond a free allowance. That allowance has changed at least once: first
  1 million requests a month (October 2025), then a plan-dependent
  allowance by cost. **So the help text quotes no numbers.** It points to
  OpenRouter's page instead.
- **The writer chooses** whether OpenRouter falls back to its own capacity
  when their key runs out or fails, or uses only their key.
- **BYOK needs an API key** from the provider's developer platform. A
  ChatGPT or Claude subscription is not an API key: subscriptions and API
  billing are separate. This is the point most writers will trip on.

## Draft section

For `packages/core/resources/help/overview.md`, after "Settings and models".
The heading uses the writer's words, so `help.search` finds it for
"Claude account", "OpenAI" or "BYOK".

```markdown
## Using your OpenAI or Claude account

Prose Minion reaches its models through OpenRouter, so it always needs an OpenRouter API key. To have requests for OpenAI or Anthropic (Claude) models billed to your own account with that company, add that company's API key to OpenRouter's Bring Your Own Key (BYOK) settings. OpenRouter then sends those requests with your key, and the provider bills you for them. OpenRouter may charge a small fee for BYOK use beyond a free allowance, and its terms change, so check [OpenRouter's BYOK guide](https://openrouter.ai/docs/guides/overview/auth/byok) for the current ones. There you also choose whether OpenRouter falls back to its own capacity when your key runs out or fails.

BYOK needs an API key from the provider's developer platform: OpenAI's API platform or Anthropic's Console. A ChatGPT or Claude subscription is not an API key, and it can't be used this way.

Then choose that provider's models in Prose Minion's Settings as usual, such as an `anthropic/…` or `openai/…` model ID.
```

## Completion Criteria

- [ ] The section is in `overview.md`, and `help.search` finds it for
      "Claude account", "OpenAI key" and "BYOK" (test or fixture search).
- [ ] It names no fee, allowance or price, and links OpenRouter's guide.
- [ ] `helpReferenceSync.test.ts` passes, and no existing section id
      changes.
- [ ] When [Model Providers](../feature-model-providers/README.md) ships,
      this section is rewritten for direct connections.

## Related Files

- `packages/core/resources/help/overview.md` ("Settings and models")
- `packages/core/resources/help/index.json`
- `packages/core/src/__tests__/architecture/helpReferenceSync.test.ts`

## Sources

- [BYOK, OpenRouter docs](https://openrouter.ai/docs/guides/overview/auth/byok)
- [October 2025 BYOK platform fee update](https://openrouter.ai/blog/announcements/1-million-free-byok-requests-per-month/)
