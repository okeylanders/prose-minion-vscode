"""Cut Chapter I of the Gutenberg Alice and set its dialogue in curly double quotes.

The Project Gutenberg text quotes dialogue with single quotes, which the shared
dialogue matcher deliberately ignores (they collide with apostrophes). This
sets them as a US edition would, so the board's dialogue lane has speech to
show. Apostrophes between letters stay apostrophes.

Usage: python3 -I alice_chapter.py <alice.txt> <out.md> [<chapter-number>]
"""
import re
import sys

source, out = sys.argv[1], sys.argv[2]
number = int(sys.argv[3]) if len(sys.argv) > 3 else 1
romans = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII']
text = open(source, encoding='utf-8').read().replace('\r\n', '\n')
start = text.index(f'CHAPTER {romans[number - 1]}.')
end = text.index(f'CHAPTER {romans[number]}.') if number < 12 else text.index('THE END')
chapter = text[start:end].strip()

# Reflow: Gutenberg wraps lines at ~70 columns; join lines inside a paragraph.
paragraphs = [' '.join(line.strip() for line in block.split('\n') if line.strip())
              for block in re.split(r'\n\s*\n', chapter)]
paragraphs = [p for p in paragraphs if p]


def curl(paragraph: str) -> str:
    # An apostrophe between letters (don't, Dinah'll) stays an apostrophe.
    # A quote mark at a word's start opens; one after punctuation or a word's
    # end, followed by a space, punctuation or the end, closes.
    chars = list(paragraph)
    out_chars = []
    for i, c in enumerate(chars):
        if c != "'":
            out_chars.append(c)
            continue
        before = chars[i - 1] if i > 0 else ' '
        after = chars[i + 1] if i + 1 < len(chars) else ' '
        if before.isalpha() and after.isalpha():
            out_chars.append('’')
        elif (before.isspace() or before in '(—-') and (after.isalpha() or after in '—-'):
            out_chars.append('“')
        elif before in ',.!?;:—-)' or (before.isalpha() and after in ',.!?;:)'):
            # A closing quote; a stray closer with nothing open is ignored by the matcher.
            out_chars.append('”')
        else:
            out_chars.append('’')
    return ''.join(out_chars)


title, body = paragraphs[0], paragraphs[1:]
heading = title.replace('CHAPTER ', 'Chapter ').replace('. ', ': ', 1)
lines = ['# ' + heading, ''] + [curl(p) + '\n' for p in body]
open(out, 'w', encoding='utf-8').write('\n'.join(lines).rstrip() + '\n')
words = sum(len(p.split()) for p in body)
print(f'{len(body)} paragraphs, {words} words -> {out}')
