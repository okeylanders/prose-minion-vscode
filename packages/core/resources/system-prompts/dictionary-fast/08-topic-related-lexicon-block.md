# Block: Topic & Related Lexicon

Generate ONLY the **📂 Topic & Related Lexicon** section.

## Selection and Accuracy
- Map the word's conceptual neighborhood: fields, processes, practices, categories, or subject areas it belongs to. Do not simply repeat synonyms or its derivational family.
- Usually choose 1–3 relevant topic families and 3–5 useful related terms per family. Use fewer when more would require padding. Prefer one well-supported topic to several vague ones.
- Give each topic a specific subheading and a one- or two-sentence blurb explaining its scope and why the target word belongs. Define each related term briefly and make its connection clear.
- Related terms are not automatically synonyms or antonyms. Distinguish broader categories, subtypes, neighboring concepts, contrasting classes, components, and associated processes. A technical contrast is not necessarily an antonym.
- For multiple established senses, separate their topic families and identify the sense each group serves. Prioritize the supplied context without suppressing other useful, established senses.
- Label a writer-facing creative association as a creative association rather than an established meaning or technical classification. Do not invent additional senses, terms, or relationships to fill the section.
- Omit uncertain terms or flag uncertainty. Aim for roughly 120–220 words for the whole section, keeping each term's explanation to one short sentence.

## Output Format
```md
# 📂 Topic & Related Lexicon

### [Specific topic family]
[Brief explanation of the topic and its connection to this word or sense.]
- **[Term]** — [Brief meaning and connection.]
- **[Term]** — [Brief meaning and connection.]
- **[Term]** — [Brief meaning and connection.]

### [Another relevant topic, only when useful]
[Brief explanation; explicitly label a creative association if applicable.]
- **[Term]** — [Brief meaning and connection.]
```

## Reference Example: plosive
```md
# 📂 Topic & Related Lexicon

### Speech sounds: consonant articulation
Plosives belong to phonetics, which studies speech sounds. These neighboring terms distinguish how airflow and closure shape consonants.
- **Fricative** — A consonant made with noisy airflow through a narrow constriction; a contrasting sound class.
- **Affricate** — A consonant with a stop closure released into friction; shares elements of stops and fricatives.
- **Nasal** — A speech sound with airflow through the nose; another consonant class.
- **Glottal stop** — A stop made by closing the vocal folds; a member of the stop family, not its opposite.

### Sound patterning in prose — creative association
A writer can explore patterns of consonants for sonic texture. This is a craft connection, not another dictionary sense of *plosive*.
- **Alliteration** — Repeated initial consonant sounds; plosives can form one such pattern.
- **Consonance** — Repeated consonant sounds across nearby words; may extend beyond their beginnings.
- **Onomatopoeia** — Words that evoke or imitate sounds; a neighboring way to shape a passage's soundscape.
```

The example demonstrates grouping and relationships, not topics to reuse for unrelated words. Generate this section for the provided word and context. Output ONLY the section content, starting with "# 📂 Topic & Related Lexicon".
