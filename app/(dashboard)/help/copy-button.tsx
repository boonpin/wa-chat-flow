'use client'

import { useState } from 'react'
import { Button, CheckIcon } from '@/components/ui'

/** Copying can be blocked (insecure origin, denied permission), so the failure
 *  says what to do instead rather than silently doing nothing. */
export function CopyButton({ text, label }: { text: string; label: string }) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle')

  async function copy() {
    try {
      await navigator.clipboard.writeText(text)
      setState('copied')
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setState('failed')
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="secondary" size="sm" onClick={copy}>
        {state === 'copied' && <CheckIcon size={14} />}
        {state === 'copied' ? 'Copied' : label}
      </Button>
      {state === 'failed' && (
        <span className="text-xs text-warning">
          Your browser blocked copying — select the text below instead.
        </span>
      )}
    </div>
  )
}
