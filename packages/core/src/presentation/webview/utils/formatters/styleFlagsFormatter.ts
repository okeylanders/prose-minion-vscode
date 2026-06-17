/**
 * Style Flags Formatter
 * Formats style flag analysis results
 */

interface StyleFlag {
  type: string;
  count: number;
  examples: string[];
}

interface StyleFlagsData {
  flags?: StyleFlag[];
  summary?: string;
}

/**
 * Formats style flags as markdown
 * @param metrics Style flags data
 * @returns Formatted markdown string
 */
export function formatStyleFlagsAsMarkdown(metrics: StyleFlagsData): string {
  if (!metrics || !metrics.flags || !Array.isArray(metrics.flags)) {
    return '';
  }

  let markdown = '# 🚩 Style Flags\n\n';
  markdown += '---\n\n';

  // Add summary if available
  if (metrics.summary) {
    markdown += `> **Summary:** ${metrics.summary}\n\n`;
  }

  // Map flag types to emoji icons
  const flagIcons: Record<string, string> = {
    'Adverbs (-ly words)': '🔤',
    'Passive Voice': '👻',
    'Weak Verbs': '💪',
    'Filler Words': '🗑️',
    'Repetitive Words': '🔄',
    'Clichés': '💭'
  };

  metrics.flags.forEach((flag: StyleFlag) => {
    const icon = flagIcons[flag.type] || '•';
    markdown += `## ${icon} ${flag.type}\n\n`;
    markdown += `**Count:** ${flag.count}\n\n`;

    if (flag.examples && flag.examples.length > 0) {
      markdown += `**Examples:**\n`;
      flag.examples.forEach((example: string) => {
        markdown += `- \`${example}\`\n`;
      });
      markdown += '\n';
    }
  });

  return markdown;
}
