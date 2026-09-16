'use client'

import { useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangleIcon,
  Button,
  CheckIcon,
  SendIcon,
  SheetIcon,
  clockTime,
  dayLabel,
} from '@/components/ui'

/**
 * One renderer for every transcript in the product. Inbox and contact history
 * share it, so a message can never mean one thing on one screen and something
 * else on another.
 */
export interface TranscriptMessage {
  id: string
  direction: 'incoming' | 'outgoing'
  senderType: 'customer' | 'ai' | 'human' | 'system'
  messageType: string
  content: string
  status: 'received' | 'processing' | 'sent' | 'failed'
  error: string | null
  createdAt: string
  /** What a model made of an attachment, and how that went. Null for text. */
  mediaSummary?: string | null
  mediaStatus?: string | null
  /**
   * Whether the gateway is still holding the file behind this row.
   *
   * A flag rather than a URL: the file lives on WAHA's internal address behind
   * its API key, so the browser asks this app for it by message id instead.
   */
  hasMedia?: boolean
}

/**
 * The photo itself, where there is one to show.
 *
 * Rendered independently of `mediaStatus`: a bot with image reading switched
 * off still stores the file, and an operator picking that thread up needs to
 * see what the customer sent even though nothing described it.
 *
 * The gateway prunes old media, so a missing file is ordinary rather than
 * exceptional — it collapses to nothing and leaves the description in place,
 * instead of leaving a broken image in the thread.
 */
function MediaThumbnail({ message }: { message: TranscriptMessage }) {
  const [failed, setFailed] = useState(false)

  const viewable = message.messageType === 'image' || message.messageType === 'sticker'
  if (!viewable || !message.hasMedia || failed) return null

  const isSticker = message.messageType === 'sticker'

  return (
    <a
      href={`/api/messages/${message.id}/media`}
      target="_blank"
      rel="noreferrer"
      className="mb-1.5 block"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/api/messages/${message.id}/media`}
        alt={message.mediaSummary?.trim() || 'Photo the customer sent'}
        loading="lazy"
        onError={() => setFailed(true)}
        className={
          isSticker
            ? 'h-24 w-24 object-contain'
            : 'max-h-64 w-auto max-w-full rounded-md border border-line-soft object-contain'
        }
      />
    </a>
  )
}

/**
 * How an attachment is reported to the operator.
 *
 * Shown apart from the message body and never in the same voice, because the
 * two are different claims: the body is what the customer wrote, this is what a
 * model guessed. An operator picking up a thread has to be able to tell which
 * of the two the bot was actually answering.
 */
function mediaNote(message: TranscriptMessage): string | null {
  switch (message.mediaStatus) {
    case 'described':
      return message.mediaSummary?.trim() || null
    case 'pending':
      return 'Not read yet'
    case 'skipped':
      return 'Not read — more attachments arrived at once than the bot reads'
    case 'too_large':
      return 'Not read — the file was too large'
    case 'unsupported':
      return 'Not read — this provider is not set up to read this kind of attachment'
    case 'failed':
      return `Could not be read${message.error ? ` — ${message.error}` : ''}`
    default:
      return null
  }
}

const SENDER_LABEL: Record<TranscriptMessage['senderType'], string | null> = {
  customer: null,
  ai: 'AI',
  human: 'You',
  system: null,
}

/**
 * A system row is an event, not a message, so it sits outside the bubbles.
 *
 * Crucially it is rendered by *type and result*, not painted red on sight: a
 * tool row with `status: sent` is a successful capture, and calling that "an
 * error" was the single most misleading thing in the old Inbox.
 */
function SystemEvent({ message }: { message: TranscriptMessage }) {
  const failed = message.status === 'failed'
  const isTool = message.messageType === 'tool'
  const toolName = message.content.replace(/^Ran tool:\s*/, '') || 'a tool'

  let title: string
  let detail: ReactNode = null
  let tone: 'success' | 'warning' | 'danger' = 'success'

  if (isTool && !failed) {
    title = 'Details captured and synced to the sheet'
    detail = <span className="text-ink-soft">via {toolName}</span>
  } else if (isTool) {
    tone = 'warning'
    title = 'Details captured — sheet sync failed'
    detail = (
      <>
        <span className="text-ink-soft">via {toolName}. </span>
        <span>The details are saved here. {message.error}</span>
      </>
    )
  } else if (failed) {
    tone = 'danger'
    title = 'The AI could not reply'
    detail = message.error ?? 'No reason was recorded.'
  } else {
    title = message.content || 'Event recorded'
  }

  const palette = {
    success: 'border-line bg-inset text-ink-muted',
    warning: 'border-warning/25 bg-warning-bg text-warning',
    danger: 'border-danger/25 bg-danger-bg text-danger',
  }[tone]

  const icon =
    tone === 'success' ? (
      isTool ? <SheetIcon size={13} /> : <CheckIcon size={13} />
    ) : (
      <AlertTriangleIcon size={13} />
    )

  return (
    <div className="flex justify-center px-2">
      <div className={`flex max-w-[36rem] items-start gap-2 rounded-md border px-3 py-2 text-xs leading-4 ${palette}`}>
        <span className="mt-px shrink-0">{icon}</span>
        <span className="min-w-0">
          <span className="font-medium">{title}</span>
          {detail && <span className="block break-words opacity-90">{detail}</span>}
          <time
            dateTime={message.createdAt}
            className="mt-0.5 block opacity-70 tabular-nums"
          >
            {clockTime(message.createdAt)}
          </time>
        </span>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: TranscriptMessage }) {
  const incoming = message.direction === 'incoming'
  const failed = message.status === 'failed'
  const label = SENDER_LABEL[message.senderType]

  // AI is blue, a person is the product's green, the customer is paper white.
  // Nothing here is a status colour — a green bubble does not mean "delivered".
  const tone = incoming
    ? 'bg-panel border border-line text-ink'
    : failed
      ? 'bg-danger-bg border border-danger/25 text-ink'
      : message.senderType === 'ai'
        ? 'bg-ai-bg border border-ai/20 text-ink'
        : 'bg-action text-on-action'

  const onGreen = !incoming && message.senderType === 'human' && !failed
  const metaTone = onGreen ? 'text-white/75' : 'text-ink-soft'
  const reading = mediaNote(message)

  return (
    <div className={`flex px-2 ${incoming ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[85%] min-w-0 rounded-lg px-3 py-2 sm:max-w-[75%] ${tone}`}>
        {label && (
          <p
            className={`mb-0.5 text-xs font-semibold ${
              onGreen ? 'text-white/80' : message.senderType === 'ai' ? 'text-ai' : 'text-ink-muted'
            }`}
          >
            {label}
          </p>
        )}

        <MediaThumbnail message={message} />

        {message.messageType !== 'text' && (
          <p className={`mb-1 text-xs ${metaTone}`}>
            {message.messageType === 'unknown'
              ? 'Unsupported attachment'
              : `${message.messageType.charAt(0).toUpperCase()}${message.messageType.slice(1)} attachment`}
          </p>
        )}

        {message.content ? (
          <p className="text-base leading-6 break-words whitespace-pre-wrap sm:text-sm sm:leading-5">
            {message.content}
          </p>
        ) : reading ? null : (
          <p className={`text-sm italic ${metaTone}`}>No text content</p>
        )}

        {reading && (
          <p
            className={`mt-1 border-l-2 border-current/25 pl-2 text-sm break-words whitespace-pre-wrap italic ${metaTone}`}
          >
            <span className="not-italic">What the AI read: </span>
            {reading}
          </p>
        )}

        <div className={`mt-1 flex items-center justify-end gap-2 text-xs ${metaTone}`}>
          {message.status === 'processing' && <span>Sending…</span>}
          {failed && <span className="font-semibold text-danger">Not sent</span>}
          <time dateTime={message.createdAt} title={new Date(message.createdAt).toLocaleString()} className="tabular-nums">
            {clockTime(message.createdAt)}
          </time>
        </div>

        {failed && message.error && (
          <p className="mt-1 border-t border-danger/20 pt-1 text-xs leading-4 break-words text-danger">
            {message.error}
          </p>
        )}
      </div>
    </div>
  )
}

/**
 * Day separators exist so a long thread stays readable; `sent` never grows a
 * delivery tick, because nothing in the data says a message was delivered.
 */
export function Transcript({
  messages,
  scrollRef,
  header,
  emptyLabel = 'No messages in this conversation yet.',
}: {
  messages: TranscriptMessage[]
  scrollRef?: React.RefObject<HTMLDivElement | null>
  header?: ReactNode
  emptyLabel?: string
}) {
  const groups: { day: string; items: TranscriptMessage[] }[] = []
  for (const message of messages) {
    const day = dayLabel(message.createdAt)
    const last = groups[groups.length - 1]
    if (last && last.day === day) last.items.push(message)
    else groups.push({ day, items: [message] })
  }

  return (
    <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto bg-canvas px-2 py-4 md:px-3">
      {header}
      {messages.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-soft">{emptyLabel}</p>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <section key={group.day}>
              <div className="mb-3 flex items-center gap-3 px-2">
                <span className="h-px flex-1 bg-line" />
                <h3 className="text-xs font-medium text-ink-soft">{group.day}</h3>
                <span className="h-px flex-1 bg-line" />
              </div>
              <div className="space-y-2">
                {group.items.map((message) =>
                  message.senderType === 'system' ? (
                    <SystemEvent key={message.id} message={message} />
                  ) : (
                    <MessageBubble key={message.id} message={message} />
                  )
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Composer. Enter sends, except while an input method editor is composing —
 * without that guard, confirming a Japanese or Chinese candidate sends a
 * half-finished message.
 *
 * A send failure never clears the draft: retyping a lost reply is the worst
 * possible outcome of a flaky connection.
 */
export function Composer({
  value,
  onChange,
  onSend,
  sending,
  disabled,
  disabledReason,
  notice,
  placeholder = 'Type a reply…',
}: {
  value: string
  onChange: (next: string) => void
  onSend: () => void
  sending: boolean
  disabled?: boolean
  disabledReason?: string
  notice?: ReactNode
  placeholder?: string
}) {
  const composing = useRef(false)
  const [rows, setRows] = useState(2)

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key !== 'Enter' || e.shiftKey) return
    if (composing.current || e.nativeEvent.isComposing) return
    e.preventDefault()
    onSend()
  }

  return (
    <div className="shrink-0 border-t border-line bg-panel px-3 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:px-4">
      {notice && <div className="mb-2">{notice}</div>}
      <div className="flex items-end gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Message</span>
          <textarea
            value={value}
            onChange={(e) => {
              onChange(e.target.value)
              setRows(Math.min(6, Math.max(2, e.target.value.split('\n').length)))
            }}
            onCompositionStart={() => {
              composing.current = true
            }}
            onCompositionEnd={() => {
              composing.current = false
            }}
            onKeyDown={handleKeyDown}
            rows={rows}
            disabled={disabled}
            placeholder={disabled ? (disabledReason ?? placeholder) : placeholder}
            className="w-full resize-none rounded-md border border-[var(--input-border)]/70 bg-inset px-3 py-2
              text-base leading-6 text-ink transition-colors placeholder:text-ink-soft
              hover:border-[var(--input-border)] disabled:cursor-not-allowed disabled:opacity-60
              md:text-sm md:leading-5"
          />
        </label>
        <Button
          onClick={onSend}
          pending={sending}
          pendingLabel="Sending…"
          disabled={disabled || !value.trim()}
          size="lg"
          className="shrink-0"
        >
          <SendIcon size={15} />
          Send
        </Button>
      </div>
      <p className="mt-1.5 text-xs text-ink-soft">
        Enter sends · Shift + Enter starts a new line
      </p>
    </div>
  )
}
