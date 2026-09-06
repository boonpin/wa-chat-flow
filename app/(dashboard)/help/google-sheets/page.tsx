import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Metadata } from 'next'
import {
  Banner,
  LinkButton,
  PageBody,
  PageHeader,
  Panel,
  PanelBody,
  PanelHeader,
} from '@/components/ui'
import { CopyButton } from '../copy-button'

export const metadata: Metadata = { title: 'Connect a Google Sheet' }

/**
 * The script is read from the repository rather than duplicated into this page,
 * so the guide cannot drift from the file that is actually deployed. The path
 * is pinned in next.config.ts under outputFileTracingIncludes.
 */
const SCRIPT_PATH = 'scripts/apps-script/capture.gs'

async function loadScript(): Promise<string | null> {
  try {
    return await readFile(path.join(process.cwd(), SCRIPT_PATH), 'utf8')
  } catch {
    return null
  }
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 border-b border-line-soft px-4 py-4 last:border-0 md:px-5">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-selected text-xs font-semibold text-ink">
        {n}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        <div className="mt-1 space-y-2 text-sm leading-5 text-ink-muted">{children}</div>
      </div>
    </li>
  )
}

export default async function GoogleSheetsGuide() {
  const script = await loadScript()

  return (
    <PageBody width="content">
      <PageHeader
        title="Connect a Google Sheet"
        description="Set this up once per sheet. It takes about five minutes and needs no Google Cloud project."
        back={{ href: '/help', label: 'Help' }}
      />

      <Banner tone="info" title="Why a script and not a sheet link" className="mb-5">
        A shared sheet link cannot be written to — Google’s API always needs an account to write as.
        An Apps Script bound to your sheet gives WA Robot one plain URL to post rows to. That URL is
        a credential: anyone who has it can write rows, which is why a shared secret goes with it.
      </Banner>

      <Panel className="mb-5">
        <PanelHeader title="Steps" />
        <ol className="list-none">
          <Step n={1} title="Open the script editor on your sheet">
            <p>
              In Google Sheets choose <strong>Extensions → Apps Script</strong>. Delete whatever is
              in <code className="font-mono text-xs">Code.gs</code>.
            </p>
          </Step>
          <Step n={2} title="Paste the script">
            <p>Copy the script below into the empty file and save.</p>
          </Step>
          <Step n={3} title="Set your shared secret">
            <p>
              Near the top, replace{' '}
              <code className="rounded-sm bg-inset px-1 py-0.5 font-mono text-xs">CHANGE_ME</code>{' '}
              with a long random value of your own. Save it somewhere safe — you will paste the same
              value into the tool’s <strong>Shared secret</strong> field.
            </p>
          </Step>
          <Step n={4} title="Deploy it as a web app">
            <p>
              Choose <strong>Deploy → New deployment → Web app</strong>, then set{' '}
              <strong>Execute as: Me</strong> and <strong>Who has access: Anyone</strong>. Google
              will ask you to authorise the script the first time.
            </p>
            <p>
              “Anyone” is what makes the URL reachable. The shared secret is what stops anyone who
              finds the URL from writing to your sheet.
            </p>
          </Step>
          <Step n={5} title="Copy the /exec URL">
            <p>
              The deployment gives you a URL ending in{' '}
              <code className="rounded-sm bg-inset px-1 py-0.5 font-mono text-xs">/exec</code>. A URL
              ending in <code className="font-mono text-xs">/dev</code> is the test deployment and
              will not work — check the ending before you paste it.
            </p>
          </Step>
          <Step n={6} title="Paste both values into the tool">
            <p>
              Open the tool, paste the <strong>/exec</strong> URL and the same{' '}
              <strong>shared secret</strong>, and save.
            </p>
            <p>
              Saving stores them. It does not test them — the first real capture is what confirms the
              connection works. If it fails, the details are still saved in WA Robot and you can
              retry from Captures.
            </p>
            <div className="pt-1">
              <LinkButton href="/tools" size="sm" variant="secondary">
                Open Tools
              </LinkButton>
            </div>
          </Step>
        </ol>
      </Panel>

      <Panel>
        <PanelHeader
          title="The script"
          description={`Read from ${SCRIPT_PATH} in this installation.`}
          action={script ? <CopyButton text={script} label="Copy script" /> : undefined}
        />
        <PanelBody>
          {script ? (
            <pre className="max-h-[28rem] overflow-auto rounded-md border border-line bg-inset p-3 font-mono text-xs leading-5 text-ink">
              <code>{script}</code>
            </pre>
          ) : (
            <p className="text-sm text-ink-muted">
              The script file could not be read from this installation. It is in the project
              repository at <code className="font-mono text-xs">{SCRIPT_PATH}</code>.
            </p>
          )}
        </PanelBody>
      </Panel>

      <div className="mt-5 space-y-2 text-sm leading-5 text-ink-muted">
        <p className="font-semibold text-ink">Two things worth knowing</p>
        <p>
          Rows are matched on conversation ID, so a customer who repeats their details updates their
          existing row rather than adding a second one.
        </p>
        <p>
          The script writes values under the column headings your tool defines. Renaming a column
          heading in the tool starts a new column rather than renaming the old one, so previous rows
          keep their original heading.
        </p>
      </div>
    </PageBody>
  )
}
