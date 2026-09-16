import type { ChannelFormatter } from './types'

/**
 * Markdown → WhatsApp's own markup.
 *
 * WhatsApp has four inline styles and nothing else: `*bold*`, `_italic_`,
 * `~strike~` and ```` ```monospace``` ````. No headings, no tables, no links, no
 * nested lists. A model that answers with `## Pricing` and a three-column table
 * has those delivered as literal hashes and pipes, which is what this file is
 * for. Anything WhatsApp cannot show is flattened into something a person can
 * still read rather than dropped — a table the customer cannot parse is worse
 * than one they never see, but a missing answer is worse than both.
 *
 * This module is the ONLY place that knows WhatsApp's markup.
 */

/**
 * Markup we have already decided on, parked on characters no rule matches.
 *
 * Without this, converting `**bold**` to `*bold*` hands the italic rule a pair
 * of single asterisks to eat, and the bold arrives italic. Every rule below
 * writes sentinels and only the last step turns them into characters, so no
 * rule can ever re-read another's output.
 */
const BOLD = '\u0001'
const ITALIC = '\u0002'
const STRIKE = '\u0003'

/** Text held out of the transform entirely — code spans and escaped punctuation. */
const TOKEN = /\u0000(\d+)\u0000/g

const HORIZONTAL_RULE = /^ {0,3}([-*_])(?:[ \t]*\1){2,}[ \t]*$/
const HEADING = /^ {0,3}(#{1,6})[ \t]+(.*?)[ \t]*#*[ \t]*$/
const BLOCKQUOTE = /^ {0,3}>[ \t]?(.*)$/
const BULLET = /^([ \t]*)[-*+][ \t]+(.*)$/
const ORDERED = /^([ \t]*)(\d{1,3})[.)][ \t]+(.*)$/

class WhatsAppFormatter implements ChannelFormatter {
  readonly guidance =
    'You are replying in a WhatsApp chat. Write plain conversational text, the way a person types ' +
    'on their phone. Do not use Markdown: no headings, no tables, no bracketed links — write a URL ' +
    'on its own instead. Keep it short, and prefer a sentence to a list.'

  render(markdown: string): string {
    const held: string[] = []

    let text = markdown.replace(/\r\n?/g, '\n')
    text = holdEscapes(text, held)
    text = holdCode(text, held)
    text = renderBlocks(text)
    text = renderInline(text)
    text = toWhatsAppMarkup(text)
    text = tidy(text)

    // Last, so nothing above can rewrite the inside of a code block.
    return release(text, held)
  }
}

export const whatsAppFormatter: ChannelFormatter = new WhatsAppFormatter()

// ─── Holding pen ──────────────────────────────────────────────────────────────

function hold(value: string, held: string[]): string {
  held.push(value)
  return `\u0000${held.length - 1}\u0000`
}

function release(text: string, held: string[]): string {
  return text.replace(TOKEN, (whole, index: string) => held[Number(index)] ?? whole)
}

/**
 * `\*` means the author wanted an asterisk, not emphasis. Held before anything
 * reads it, so the emphasis rules never see the pair.
 */
function holdEscapes(text: string, held: string[]): string {
  return text.replace(/\\([\\`*_{}[\]()#+\-.!~>|])/g, (_, char: string) => hold(char, held))
}

/**
 * Code is quoted verbatim, so it sits out every rule below — a snippet full of
 * underscores would otherwise come back in italics.
 */
function holdCode(text: string, held: string[]): string {
  // Fences first: the inline rule would otherwise chop a block into pieces at
  // the first backtick pair it found inside.
  const fenced = text.replace(/```[^\n]*\n([\s\S]*?)```/g, (_, body: string) =>
    hold('```\n' + body.replace(/\s+$/, '') + '\n```', held)
  )
  // WhatsApp has no single-backtick span; three backticks is monospace inline too.
  return fenced.replace(/`([^`\n]+)`/g, (_, code: string) => hold('```' + code + '```', held))
}

// ─── Block level ──────────────────────────────────────────────────────────────

function renderBlocks(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []

  for (let i = 0; i < lines.length; i++) {
    // A pipe alone proves nothing — a sentence may contain one. The divider row
    // is what makes it a table, so look ahead before committing to flattening.
    if (lines[i].includes('|') && isDivider(lines[i + 1] ?? '')) {
      const rows: string[][] = []
      let j = i + 2
      while (j < lines.length && lines[j].includes('|')) rows.push(cells(lines[j++]))
      out.push(...flattenTable(cells(lines[i]), rows))
      i = j - 1
      continue
    }

    out.push(renderBlockLine(lines[i]))
  }

  return out.join('\n')
}

function renderBlockLine(line: string): string {
  // Before the bullet rule, which would otherwise read `- - -` as a list item.
  if (HORIZONTAL_RULE.test(line)) return ''

  const heading = line.match(HEADING)
  // A heading is the only thing here that is bold because of its shape rather
  // than because the author asked for bold. Emphasis inside one is dropped:
  // WhatsApp cannot nest a style inside itself, and `*The *Pro* plan*` on the
  // wire renders as stray asterisks rather than as anything emphasised.
  if (heading) {
    const label = stripEmphasis(heading[2])
    return label ? `${BOLD}${label}${BOLD}` : ''
  }

  const quote = line.match(BLOCKQUOTE)
  // WhatsApp renders one level of `>` and nothing deeper, so nesting collapses.
  if (quote) return `> ${quote[1].replace(/^(?:[ \t]*>)+[ \t]?/, '')}`

  const bullet = line.match(BULLET)
  if (bullet) {
    const depth = depthOf(bullet[1])
    return `${'   '.repeat(depth)}${depth === 0 ? '•' : '◦'} ${bullet[2]}`
  }

  const ordered = line.match(ORDERED)
  // Numbers survive as typed; only `1)` is normalised, since WhatsApp shows the
  // digits literally either way.
  if (ordered) return `${'   '.repeat(depthOf(ordered[1]))}${ordered[2]}. ${ordered[3]}`

  return line
}

/**
 * Drops emphasis delimiters, leaving the words.
 *
 * Only delimiters actually hugging a word go: `5 * 3` in a heading is
 * multiplication, and deleting that asterisk would change what the line says.
 */
function stripEmphasis(text: string): string {
  return text.replace(/(\*{1,3}|_{1,3}|~~)(?=\S)/g, '').replace(/(?<=\S)(\*{1,3}|_{1,3}|~~)/g, '')
}

/** Two spaces per level, capped — WhatsApp indents nothing on its own. */
function depthOf(indent: string): number {
  return Math.min(Math.floor(indent.replace(/\t/g, '  ').length / 2), 2)
}

function isDivider(line: string): boolean {
  return line.includes('|') && line.includes('-') && /^[\s|:-]+$/.test(line)
}

function cells(line: string): string[] {
  return line
    .replace(/^[ \t]*\|/, '')
    .replace(/\|[ \t]*$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

/**
 * A table becomes one labelled block per row.
 *
 * The first column is almost always the thing each row is *about* — a plan
 * name, a product — so it becomes the heading and the rest read as its details.
 * Columns kept side by side would wrap into nonsense on a phone.
 */
function flattenTable(headers: string[], rows: string[][]): string[] {
  const out: string[] = []

  for (const row of rows) {
    if (row.every((cell) => !cell)) continue

    const [first, ...rest] = row
    if (first) out.push(`${BOLD}${first}${BOLD}`)

    rest.forEach((cell, index) => {
      if (!cell) return
      const label = headers[index + 1]
      out.push(label ? `${label}: ${cell}` : cell)
    })

    out.push('')
  }

  return out
}

// ─── Inline ───────────────────────────────────────────────────────────────────

function renderInline(text: string): string {
  return (
    text
      // An image carries nothing WhatsApp can show inline, but the URL stays tappable.
      .replace(/!\[[^\]]*\]\(([^)\s]+)[^)]*\)/g, '$1')
      // WhatsApp auto-links a bare URL, so the label keeps its meaning beside one.
      .replace(/\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (_, label: string, url: string) =>
        !label || label === url ? url : `${label} (${url})`
      )
      .replace(/<((?:https?|mailto):[^>\s]+)>/g, '$1')
      // Widest delimiter first: `***x***` read as bold would leave a stray pair.
      .replace(/\*\*\*(?=\S)([^\n]*?\S)\*\*\*/g, `${BOLD}${ITALIC}$1${ITALIC}${BOLD}`)
      .replace(/___(?=\S)([^\n]*?\S)___/g, `${BOLD}${ITALIC}$1${ITALIC}${BOLD}`)
      .replace(/\*\*(?=\S)([^\n]*?\S)\*\*/g, `${BOLD}$1${BOLD}`)
      .replace(/__(?=\S)([^\n]*?\S)__/g, `${BOLD}$1${BOLD}`)
      .replace(/\*(?=\S)([^*\n]*?\S)\*/g, `${ITALIC}$1${ITALIC}`)
      // Guarded on both sides, or `snake_case_name` arrives in italics.
      .replace(/(?<![A-Za-z0-9_])_(?=\S)([^_\n]*?\S)_(?![A-Za-z0-9_])/g, `${ITALIC}$1${ITALIC}`)
      .replace(/~~(?=\S)([^\n]*?\S)~~/g, `${STRIKE}$1${STRIKE}`)
  )
}

/**
 * Sentinels → the characters WhatsApp reads.
 *
 * Doubled sentinels collapse first. They come from bold inside a heading, where
 * the shape and the author both asked for bold; WhatsApp cannot nest one style
 * twice, and `**text**` on the wire shows a literal asterisk pair.
 */
function toWhatsAppMarkup(text: string): string {
  return text
    .replace(/\u0001{2,}/g, BOLD)
    .replace(/\u0002{2,}/g, ITALIC)
    .replace(/\u0003{2,}/g, STRIKE)
    .replace(/\u0001/g, '*')
    .replace(/\u0002/g, '_')
    .replace(/\u0003/g, '~')
}

/** Removed rules and flattened tables leave holes; close them up. */
function tidy(text: string): string {
  return text
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
