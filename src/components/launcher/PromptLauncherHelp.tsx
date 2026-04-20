import { Modal } from '@/components/ui';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Instructions shown from the `?` affordance on PromptLauncher.
 *
 * ChatGPT / Perplexity / Google work with no setup. Claude needs a one-time
 * Tampermonkey + userscript install because claude.ai has no auto-submit URL.
 */
export function PromptLauncherHelp({ open, onOpenChange }: Props) {
  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Sending prompts to Claude"
      variant="standard"
      size="lg"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontSize: '0.85rem', lineHeight: 1.5 }}>
        <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)' }}>
          ChatGPT, Perplexity and Google accept a query directly in the URL and
          submit automatically. Claude doesn't — so for Claude specifically
          we install a tiny one-time browser script that does the last step
          for you.
        </p>

        <Step n={1} title="Install Tampermonkey">
          <p style={{ margin: 0 }}>
            Tampermonkey is a browser extension that runs user-made scripts on
            specific sites. Pick your browser:
          </p>
          <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
            <HelpLink href="https://addons.mozilla.org/firefox/addon/tampermonkey/">
              Firefox
            </HelpLink>
            <HelpLink href="https://chromewebstore.google.com/detail/tampermonkey/dhdgffkkebhmkfjojejmpbldmpobfkfo">
              Chrome / Edge
            </HelpLink>
            <HelpLink href="https://apps.apple.com/app/tampermonkey/id1482490089">
              Safari
            </HelpLink>
          </div>
        </Step>

        <Step n={2} title="Install the Claude auto-submit script">
          <p style={{ margin: 0 }}>
            Click the link below. Tampermonkey will open an install prompt — click
            <strong> Install</strong>.
          </p>
          <div style={{ marginTop: 8 }}>
            <a
              href="/claude-prompt.user.js"
              target="_blank"
              rel="noreferrer noopener"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: '#7c3aed',
                color: '#fff',
                padding: '8px 14px',
                borderRadius: 8,
                fontSize: '0.82rem',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Install userscript ↗
            </a>
          </div>
        </Step>

        <Step n={3} title="Try it">
          <p style={{ margin: 0 }}>
            Pick <strong>Claude</strong> in the engine dropdown, type a prompt, hit
            <strong> Go</strong>. A claude.ai tab will open, the prompt will be
            typed in for you and sent automatically.
          </p>
        </Step>

        <p style={{ margin: 0, color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem' }}>
          If nothing happens on claude.ai, open the browser console and look for
          <code> [claude-prompt-from-url] </code> messages — probably the site's
          DOM changed and the script's selectors need updating.
        </p>
      </div>
    </Modal>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', gap: 10 }}>
      <div
        aria-hidden
        style={{
          flex: '0 0 auto',
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '0.72rem',
          fontWeight: 700,
          marginTop: 1,
        }}
      >
        {n}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ color: '#fff', fontWeight: 600, marginBottom: 4 }}>{title}</div>
        <div style={{ color: 'rgba(255,255,255,0.7)' }}>{children}</div>
      </div>
    </div>
  );
}

function HelpLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      style={{
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 6,
        padding: '6px 10px',
        color: 'rgba(255,255,255,0.85)',
        fontSize: '0.78rem',
        textDecoration: 'none',
      }}
    >
      {children}
    </a>
  );
}
