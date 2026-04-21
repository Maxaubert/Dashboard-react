/**
 * Engines the prompt launcher can send queries to.
 *
 * All URLs auto-submit except Claude, which deprecated its `?q=` parameter
 * after a prompt-injection issue. The bundled Tampermonkey userscript
 * (public/claude-prompt.user.js) restores that behaviour on claude.ai.
 */

export type EngineId = 'claude' | 'chatgpt' | 'perplexity' | 'google';

export interface Engine {
  id: EngineId;
  label: string;
  /** True when the engine requires the userscript to actually auto-submit. */
  needsUserscript: boolean;
  buildUrl: (query: string) => string;
}

export const ENGINES: readonly Engine[] = [
  {
    id: 'claude',
    label: 'Claude',
    needsUserscript: true,
    buildUrl: (q) => `https://claude.ai/new?q=${encodeURIComponent(q)}`,
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    // ChatGPT also stopped auto-submitting `?q=` (it now only pre-fills,
    // same as Claude). The bundled userscript handles both hosts.
    needsUserscript: true,
    buildUrl: (q) => `https://chatgpt.com/?q=${encodeURIComponent(q)}&hints=search`,
  },
  {
    id: 'perplexity',
    label: 'Perplexity',
    needsUserscript: false,
    buildUrl: (q) => `https://www.perplexity.ai/search?q=${encodeURIComponent(q)}`,
  },
  {
    id: 'google',
    label: 'Google',
    needsUserscript: false,
    buildUrl: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  },
] as const;

export function buildPromptUrl(engine: EngineId, query: string): string {
  const e = ENGINES.find((x) => x.id === engine);
  if (!e) throw new Error(`Unknown engine: ${engine}`);
  return e.buildUrl(query);
}
