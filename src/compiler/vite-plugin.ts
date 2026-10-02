// Vite plugin: `import bundle from 'virtual:content'` compiles content/ at build/dev time.
// Lint errors fail `vite build` and show in the dev overlay, so unvalidated content can't ship
// even if CI is skipped. Editing YAML triggers a full reload.
import { resolve } from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';
import { compile } from './compile.ts';
import { contentFilePaths, loadContentDir } from './load.ts';
import { counts, formatPretty } from './report.ts';

const VIRTUAL_ID = 'virtual:content';
const RESOLVED_ID = '\0virtual:content';

export function contentPlugin(opts: { dir?: string } = {}): Plugin {
  const dir = resolve(opts.dir ?? 'content');
  let server: ViteDevServer | undefined;

  const invalidate = (): void => {
    if (!server) return;
    const mod = server.moduleGraph.getModuleById(RESOLVED_ID);
    if (mod) server.moduleGraph.invalidateModule(mod);
    server.ws.send({ type: 'full-reload' });
  };

  return {
    name: 'whoami-content',
    resolveId(id) {
      return id === VIRTUAL_ID ? RESOLVED_ID : null;
    },
    load(id) {
      if (id !== RESOLVED_ID) return null;
      for (const file of contentFilePaths(dir)) this.addWatchFile(file);
      const { bundle, diagnostics } = compile(loadContentDir(dir));
      const { errors, warnings } = counts(diagnostics);
      if (!bundle || errors) {
        this.error(`Content has ${errors} error(s):\n${formatPretty(diagnostics.filter((d) => d.severity === 'error'))}`);
      }
      if (warnings) this.warn(`Content has ${warnings} warning(s) (npm run content:lint for details)`);
      // JSON.parse of a string literal is faster to load than an equivalent object literal.
      return `export default JSON.parse(${JSON.stringify(JSON.stringify(bundle))});`;
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
