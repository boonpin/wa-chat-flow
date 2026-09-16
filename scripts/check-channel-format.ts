/**
 * Fixtures for the channel formatters.
 *
 * There is no test runner in this project, and the formatter is the one piece
 * here that is pure enough not to need one: text in, text out, no database and
 * no network. Run it after touching `lib/channel/`:
 *
 *   pnpm test:format
 */
import { formatForChannel } from '../lib/channel'

interface Case {
  name: string
  input: string
  expected: string
}

const cases: Case[] = [
  {
    name: 'bold survives the italic rule',
    input: 'That is **really** important',
    expected: 'That is *really* important',
  },
  {
    name: 'underscore bold',
    input: 'That is __really__ important',
    expected: 'That is *really* important',
  },
  {
    name: 'italic',
    input: 'That is *really* important, or _really_ so',
    expected: 'That is _really_ important, or _really_ so',
  },
  {
    name: 'bold italic',
    input: 'It is ***urgent***',
    expected: 'It is *_urgent_*',
  },
  {
    name: 'strikethrough',
    input: 'Was ~~RM99~~ now RM79',
    expected: 'Was ~RM99~ now RM79',
  },
  {
    name: 'snake_case is not italics',
    input: 'Set the field customer_email_address before retrying',
    expected: 'Set the field customer_email_address before retrying',
  },
  {
    name: 'headings become bold lines',
    input: '## Pricing\nOur plans start at RM49.',
    expected: '*Pricing*\nOur plans start at RM49.',
  },
  {
    name: 'emphasis inside a heading does not nest',
    input: '# The **Pro** plan',
    expected: '*The Pro plan*',
  },
  {
    name: 'bullets',
    input: '- First\n- Second\n  - Nested\n* Third',
    expected: '• First\n• Second\n   ◦ Nested\n• Third',
  },
  {
    name: 'numbered list is left alone',
    input: '1. First\n2) Second',
    expected: '1. First\n2. Second',
  },
  {
    name: 'links are unwrapped',
    input: 'See [our pricing](https://example.com/pricing) for details',
    expected: 'See our pricing (https://example.com/pricing) for details',
  },
  {
    name: 'a link whose label is its url is not doubled',
    input: '[https://example.com](https://example.com)',
    expected: 'https://example.com',
  },
  {
    name: 'images keep only the url',
    input: 'Here it is: ![the logo](https://example.com/logo.png)',
    expected: 'Here it is: https://example.com/logo.png',
  },
  {
    name: 'horizontal rules are dropped',
    input: 'Before\n\n---\n\nAfter',
    expected: 'Before\n\nAfter',
  },
  {
    name: 'blockquote is kept, nesting collapses',
    input: '> You asked:\n>> about delivery',
    expected: '> You asked:\n> about delivery',
  },
  {
    name: 'inline code becomes monospace',
    input: 'Run `pnpm dev` first',
    expected: 'Run ```pnpm dev``` first',
  },
  {
    name: 'a code fence is left verbatim',
    input: 'Try:\n```js\nconst a = **1**;\n```',
    expected: 'Try:\n```\nconst a = **1**;\n```',
  },
  {
    name: 'escaped asterisks stay literal',
    input: 'Use \\*this\\* exactly',
    expected: 'Use *this* exactly',
  },
  {
    name: 'a table becomes one block per row',
    input: [
      '| Plan | Price | Seats |',
      '|------|-------|-------|',
      '| Basic | RM49 | 3 |',
      '| Pro | RM99 | 10 |',
    ].join('\n'),
    expected: '*Basic*\nPrice: RM49\nSeats: 3\n\n*Pro*\nPrice: RM99\nSeats: 10',
  },
  {
    name: 'a sentence with a pipe is not a table',
    input: 'Send either A | B and we will sort it out',
    expected: 'Send either A | B and we will sort it out',
  },
  {
    name: 'blank lines collapse',
    input: 'One\n\n\n\nTwo',
    expected: 'One\n\nTwo',
  },
  {
    name: 'plain text is untouched',
    input: 'Hi Kelvin, your order ships tomorrow.',
    expected: 'Hi Kelvin, your order ships tomorrow.',
  },
  {
    name: 'a realistic reply',
    input: [
      '## Delivery options',
      '',
      'We have **two** options for you:',
      '',
      '- *Standard* — 3-5 days, RM5',
      '- *Express* — next day, RM15',
      '',
      'Book at [our site](https://example.com).',
    ].join('\n'),
    expected: [
      '*Delivery options*',
      '',
      'We have *two* options for you:',
      '',
      '• _Standard_ — 3-5 days, RM5',
      '• _Express_ — next day, RM15',
      '',
      'Book at our site (https://example.com).',
    ].join('\n'),
  },
]

let failed = 0

for (const testCase of cases) {
  const actual = formatForChannel('whatsapp', testCase.input)
  if (actual === testCase.expected) {
    console.log(`  ok   ${testCase.name}`)
    continue
  }
  failed++
  console.error(`  FAIL ${testCase.name}`)
  console.error(`       expected: ${JSON.stringify(testCase.expected)}`)
  console.error(`       actual:   ${JSON.stringify(actual)}`)
}

console.log(`\n${cases.length - failed}/${cases.length} passed`)
process.exit(failed === 0 ? 0 : 1)
