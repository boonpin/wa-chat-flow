import Link from 'next/link'
import { Panel, PanelHeader } from '@/components/ui'
import { HELP_TASKS } from '@/lib/help/content'

export function HelpTasks({ section }: { section: 'using' | 'setup' }) {
  const tasks = HELP_TASKS.filter((task) => task.section === section)
  return (
    <>
      {tasks.map((task) => (
        <Panel key={task.title}>
          <PanelHeader title={task.title} />
          <ol className="space-y-3 p-4 md:p-5">
            {task.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-inset text-xs font-semibold text-ink-muted">
                  {i + 1}
                </span>
                <span className="min-w-0 text-sm leading-5 text-ink">
                  {step.text}{' '}
                  {step.href && (
                    <Link
                      href={step.href}
                      aria-label={`Open: ${step.text}`}
                      className="font-medium text-action hover:underline"
                    >
                      Open
                    </Link>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </Panel>
      ))}
    </>
  )
}
