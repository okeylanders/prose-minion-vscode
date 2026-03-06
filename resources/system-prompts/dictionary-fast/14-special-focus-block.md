# Block: Special Focus

Generate ONLY the context-driven **Special Focus** section.

## When To Use
- If context is provided, directly answer the writer's question, concern, or use case.
- If the context includes a comparison request, explain the distinctions and give a recommendation.
- If no meaningful context is provided, return a short section that says no special focus was requested and briefly points the user back to the core entry.

## Output Format
```md
## **Special Focus: [brief context label]**
- [Targeted guidance tied to the provided context]
- [Optional comparison, layering advice, or usage recommendation]
- [One or more custom examples if helpful]
```

## Style Notes
- Be concrete and context-aware.
- Treat the context as a writing problem to solve, not just background information.
- Favor practical recommendation over abstract summary.
- If sound, tone, or texture is part of the request, compare candidate words directly.

Generate this section for the provided word and context. Output ONLY the section content, starting with `## **Special Focus:`.
