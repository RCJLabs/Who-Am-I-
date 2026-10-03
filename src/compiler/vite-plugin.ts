// Vite plugin: `import index, { loaders } from 'virtual:content'` compiles content/ at build/dev
// time. The index is the bundle without topics' items; `loaders[domain]()` imports that domain's
// topics from `virtual:content/<domain>`, which Rollup emits as a chunk of its own.
// Lint errors fail `vite build` and show in the dev overlay, so unvalidated content can't ship
// even if CI is skipped. Editing YAML triggers a full reload.
import { resolve } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { splitBundle, type SplitBundle } from '../engine/bundle-split.ts';
import { compile } from './compile.ts';
import { contentFilePaths, loadContentDir } from './load.ts';
import { counts, formatPretty } from './report.ts';

const VIRTUAL_ID = 'virtual:content';
const RESOLVED_ID = '\0virtual:content';

/** Chunk file name for a domain's content, so it's recognizable in the network panel. */
export function contentChunkName(facadeModuleId: string | null): string | null {
  return facadeModuleId?.startsWith(`${RESOLVED_ID}/`) ? `content-${facadeModuleId.slice(RESOLVED_ID.length + 1)}` : null;
}

// JSON.parse of a string literal is faster to load than an equivalent object literal.
const jsonModule = (value: unknown): string => `export default JSON.parse(${JSON.stringify(JSON.stringify(value))});`;

function indexModule({ index, domains }: SplitBundle): string {
  const loaders = Object.keys(domains).map((d) => `  ${JSON.stringify(d)}: () => import(${JSON.stringify(`${VIRTUAL_ID}/${d}`)}),`);
  return `${jsonModule(index)}\nexport const loaders = {\n${loaders.join('\n')}\n};\n`;
}

export function contentPlugin(opts: { dir?: string } = {}): Plugin {
  const dir = resolve(opts.dir ?? 'content');
  let server: ViteDevServer | undefined;
  // Compiled once and shared by the index and every domain module.
  let split: SplitBundle | null = null;

  const invalidate = (): void => {
    split = null;
    if (!server) return;
    for (const [id, mod] of server.moduleGraph.idToModuleMap) {
      if (id === RESOLVED_ID || id.startsWith(`${RESOLVED_ID}/`)) server.moduleGraph.invalidateModule(mod);
    }
    server.ws.send({ type: 'full-reload' });
  };

  return {
    name: 'whoami-content',
    buildStart() {
      split = null;
    },
    resolveId(id) {
      return id === VIRTUAL_ID || id.startsWith(`${VIRTUAL_ID}/`) ? `\0${id}` : null;
    },
    load(id) {
      if (id !== RESOLVED_ID && !id.startsWith(`${RESOLVED_ID}/`)) return null;
      for (const file of contentFilePaths(dir)) this.addWatchFile(file);
      if (!split) {
        const { bundle, diagnostics } = compile(loadContentDir(dir));
        const { errors, warnings } = counts(diagnostics);
        if (!bundle || errors) {
          this.error(`Content has ${errors} error(s):\n${formatPretty(diagnostics.filter((d) => d.severity === 'error'))}`);
        }
        if (warnings) this.warn(`Content has ${warnings} warning(s) (npm run content:lint for details)`);
        split = splitBundle(bundle);
      }
      if (id === RESOLVED_ID) return indexModule(split);
      const domain = id.slice(RESOLVED_ID.length + 1);
      const topics = split.domains[domain];
      if (!topics) this.error(`No topics in domain '${domain}'`);
      return jsonModule(topics);
    },
    configureServer(s) {
      server = s;
      s.watcher.add(dir);
      const onChange = (file: string): void => {
        if (resolve(file).startsWith(dir)) invalidate();
      };
      s.watcher.on('add', onChange);
      s.watcher.on('unlink', onChange);
      s.watcher.on('change', onChange);
    },
  };
}
