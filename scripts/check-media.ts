/**
 * Fixtures for the attachment rules.
 *
 * Two pure pieces, and the two where being wrong is expensive: what wakes a
 * reply (`lib/messaging/triage.ts`) and what the model is told about a file
 * (`lib/ai/media-render.ts`). Neither needs a database, a key or a network.
 * Run it after touching either:
 *
 *   pnpm test:media
 */
import { normalizeIncomingMessage } from '../lib/wa/normalize'
import { isDecorationOnly, triageIncoming } from '../lib/messaging/triage'
import { renderRow, renderSkipped, type MessageRow } from '../lib/ai/media-render'
import type { IncomingMessage, MessageType } from '../lib/wa/types'

let failed = 0

function check(name: string, actual: unknown, expected: unknown): void {
  const a = JSON.stringify(actual)
  const b = JSON.stringify(expected)
  if (a === b) {
    console.log(`  ok   ${name}`)
    return
  }
  failed++
  console.error(`  FAIL ${name}`)
  console.error(`       expected: ${b}`)
  console.error(`       actual:   ${a}`)
}

function incoming(patch: Partial<IncomingMessage> & { type: MessageType }): IncomingMessage {
  return {
    provider: 'waha',
    sessionId: 'default',
    providerMessageId: 'abc',
    chatId: '60123456789@c.us',
    phone: '60123456789',
    timestamp: new Date(),
    ...patch,
  }
}

function row(patch: Partial<MessageRow>): MessageRow {
  return {
    id: 'm1',
    conversationId: 'c1',
    contactId: 'k1',
    provider: 'waha',
    providerMessageId: null,
    direction: 'incoming',
    senderType: 'customer',
    messageType: 'text',
    content: '',
    status: 'received',
    error: null,
    mediaUrl: null,
    mediaMime: null,
    mediaSummary: null,
    mediaStatus: null,
    toolInvocationId: null,
    createdAt: new Date().toISOString(),
    ...patch,
  }
}

// ─── What wakes a reply ───────────────────────────────────────────────────────

console.log('\ntriage')

check('text is answered', triageIncoming(incoming({ type: 'text', text: 'hi' })).action, 'answer')
check('empty text is not', triageIncoming(incoming({ type: 'text', text: '   ' })).action, 'ignore')
check('photos are answered', triageIncoming(incoming({ type: 'image' })).action, 'answer')
check('voice notes are answered', triageIncoming(incoming({ type: 'audio' })).action, 'answer')
check('video is answered, to decline it', triageIncoming(incoming({ type: 'video' })).action, 'answer')
check('documents are answered, to decline them', triageIncoming(incoming({ type: 'document' })).action, 'answer')
check('unknown is ignored', triageIncoming(incoming({ type: 'unknown' })).action, 'ignore')
check(
  'a named sticker is answered',
  triageIncoming(incoming({ type: 'sticker', stickerName: 'thank you' })).action,
  'answer'
)
check(
  'an unnamed sticker is ignored',
  triageIncoming(incoming({ type: 'sticker' })).action,
  'ignore'
)

console.log('\nemoji')

check('a lone thumbs-up is decoration', isDecorationOnly('👍'), true)
check('several emoji are decoration', isDecorationOnly('😀😀 ❤️'), true)
check('a flag is decoration', isDecorationOnly('🇲🇾'), true)
check('emoji with words is not', isDecorationOnly('👍 thanks!'), false)
check('plain words are not', isDecorationOnly('thanks'), false)
// The one that matters: `\p{Emoji_Component}` matches bare digits, and an order
// number going unanswered is a customer going unanswered.
check('an order number is not decoration', isDecorationOnly('881234'), false)
check('a bare question mark is not decoration', isDecorationOnly('?'), false)

// ─── What the model is told ───────────────────────────────────────────────────

console.log('\nrendering')

check(
  'a described photo reads as content',
  renderRow(row({ messageType: 'image', mediaStatus: 'described', mediaSummary: 'A receipt for RM250.' }), {
    pending: true,
  }),
  '[Photo] A receipt for RM250.'
)
check(
  'a caption stays the customer’s own words',
  renderRow(
    row({
      messageType: 'image',
      content: 'is this right?',
      mediaStatus: 'described',
      mediaSummary: 'A receipt for RM250.',
    }),
    { pending: true }
  ),
  'is this right?\n[Photo] A receipt for RM250.'
)
check(
  'a transcribed voice note reads as content',
  renderRow(row({ messageType: 'audio', mediaStatus: 'described', mediaSummary: 'Has my order shipped?' }), {
    pending: true,
  }),
  '[Voice note] Has my order shipped?'
)
check(
  'a named sticker reads as what it says',
  renderRow(row({ messageType: 'sticker', mediaStatus: 'described', mediaSummary: 'thank you' }), {
    pending: true,
  }),
  '[Sticker: thank you]'
)
check(
  'an unsupported photo asks for words instead',
  renderRow(row({ messageType: 'image', mediaStatus: 'unsupported' }), { pending: true }),
  '[The customer sent a photo. You cannot see photos. Say so briefly, then ask them to describe it in words, or offer to pass the chat to a colleague who can look at it.]'
)
check(
  'an unsupported video offers a person',
  renderRow(row({ messageType: 'video', mediaStatus: 'unsupported' }), { pending: true }),
  '[The customer sent a video. You cannot watch videos. Say so briefly and offer to pass the chat to a colleague who can watch it.]'
)
check(
  'too large is distinguishable from broken',
  renderRow(row({ messageType: 'image', mediaStatus: 'too_large' }), { pending: true }),
  '[The customer sent a photo that was too large to open. Say so briefly and ask them to send a smaller one.]'
)
// The instruction must not survive into history, or the bot apologises for the
// same unreadable video on every turn for the rest of the conversation.
check(
  'history drops the instruction',
  renderRow(row({ messageType: 'video', mediaStatus: 'unsupported' }), { pending: false }),
  '[The customer sent a video, which you could not watch.]'
)
check(
  'an ignored sticker says nothing at all',
  renderRow(row({ messageType: 'sticker', mediaStatus: 'ignored' }), { pending: true }),
  null
)
check(
  'a capped photo says nothing on its own',
  renderRow(row({ messageType: 'image', mediaStatus: 'skipped' }), { pending: true }),
  null
)
check(
  'a described row with no summary is a failure, not a refusal',
  renderRow(row({ messageType: 'image', mediaStatus: 'described', mediaSummary: '  ' }), {
    pending: true,
  }),
  '[The customer sent a photo that could not be opened. Say so briefly and ask them to send it again.]'
)

console.log('\ncap')

check(
  'nothing capped, nothing said',
  renderSkipped([row({ messageType: 'image', mediaStatus: 'described', mediaSummary: 'x' })]),
  null
)
check(
  'capped photos are counted once, not apologised for four times',
  renderSkipped([
    row({ id: 'a', messageType: 'image', mediaStatus: 'described', mediaSummary: 'x' }),
    row({ id: 'b', messageType: 'image', mediaStatus: 'skipped' }),
    row({ id: 'c', messageType: 'image', mediaStatus: 'skipped' }),
  ]),
  '[2 further photos (only the 4 most recent were read) arrived but were not read. If your answer depends on them, say that you could only check the ones you were shown.]'
)
check(
  'a mixed burst counts each kind on its own',
  renderSkipped([
    row({ id: 'a', messageType: 'image', mediaStatus: 'skipped' }),
    row({ id: 'b', messageType: 'audio', mediaStatus: 'skipped' }),
    row({ id: 'c', messageType: 'audio', mediaStatus: 'skipped' }),
  ]),
  '[1 further photo (only the 4 most recent were read), and 2 further voice notes (only the 3 most recent were read) arrived but were not read. If your answer depends on them, say that you could only check the ones you were shown.]'
)

// ─── What the webhook is understood to have said ──────────────────────────────

console.log('\nnormalising')

const MEDIA_URL = 'http://localhost:3000/api/files/s/false_1@lid_ABC.jpeg'

async function normalized(payload: Record<string, unknown>) {
  return normalizeIncomingMessage(
    { event: 'message', session: 's', payload: { id: 'x', from: '60123456789@c.us', ...payload } },
    async () => null
  )
}

async function normalising() {
  const caption = await normalized({
    type: 'image',
    body: 'is this the right part?',
    media: { url: MEDIA_URL, mimetype: 'image/jpeg' },
  })
  check('a real caption survives', caption?.text, 'is this the right part?')
  check('the file is carried through', caption?.media?.url, MEDIA_URL)

  // WAHA puts a base64 thumbnail in `body` on some engines. Shown in the Inbox
  // as the customer's words it is gibberish; sent to the model it is a few
  // hundred tokens a turn that say nothing.
  const thumbnail = await normalized({
    type: 'image',
    body: '/9j/4AAQSkZJRgABAQAAAQABAAD/2wCEAAQFBQkGCQkJCQkKCA'.repeat(4),
    media: { url: MEDIA_URL, mimetype: 'image/jpeg' },
  })
  check('a base64 thumbnail is not a caption', thumbnail?.text, undefined)

  const urlBody = await normalized({
    type: 'image',
    body: MEDIA_URL,
    media: { url: MEDIA_URL, mimetype: 'image/jpeg' },
  })
  check('the file’s own URL is not a caption', urlBody?.text, undefined)

  const longCaption = await normalized({
    type: 'image',
    body: 'this is a genuinely long caption that a person actually typed out by hand and it runs well past one hundred characters',
    media: { url: MEDIA_URL, mimetype: 'image/jpeg' },
  })
  check('a long written caption is kept', longCaption?.text !== undefined, true)

  const ptt = await normalized({
    type: 'ptt',
    media: { url: 'http://localhost:3000/api/files/s/v.oga', mimetype: 'audio/ogg; codecs=opus' },
  })
  check('a push-to-talk note is audio', ptt?.type, 'audio')

  const sticker = await normalized({ type: 'sticker' })
  check('a sticker is not an image', sticker?.type, 'sticker')

  const video = await normalized({ type: 'video' })
  check('a video is not an image', video?.type, 'video')

  // An unrecognised label must not turn a perfectly readable photo into
  // `unknown`; the bytes are the more reliable witness.
  const oddLabel = await normalized({
    type: 'somethingNew',
    media: { url: MEDIA_URL, mimetype: 'image/jpeg' },
  })
  check('an unknown label falls back to the MIME type', oddLabel?.type, 'image')

  console.log(`\n${failed === 0 ? 'all passed' : `${failed} failed`}`)
  process.exit(failed === 0 ? 0 : 1)
}

void normalising()
