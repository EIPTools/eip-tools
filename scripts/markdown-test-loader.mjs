import { execFileSync } from 'node:child_process';
import ts from 'typescript';

// Node-only SSR harness: CSS has no behavior in server markup.
export async function load(url, context, nextLoad) {
  // Optional immutable HEAD comparison reproduces RED without reverting the
  // working component or touching the parent's already-running dev server.
  if (process.env.MARKDOWN_TEST_BASELINE === '1' && url.endsWith('/components/Markdown.tsx')) {
    const source = execFileSync('git', ['show', 'HEAD:components/Markdown.tsx'], {
      cwd: new URL('../', import.meta.url), encoding: 'utf8',
    });
    const { outputText } = ts.transpileModule(source, {
      compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
    });
    return { format: 'module', source: outputText, shortCircuit: true };
  }
  // Reproduce bundler CJS named-export interop using the real package.
  if (url.includes('/react-copy-to-clipboard/') && url.endsWith('/index.js')) {
    return { format: 'module', source: `import { createRequire } from 'node:module'; const lib = createRequire(import.meta.url)(${JSON.stringify(url)}); export const CopyToClipboard = lib.CopyToClipboard;`, shortCircuit: true };
  }
  if (url.endsWith('/next/link.js')) {
    return { format: 'module', source: `import { createRequire } from 'node:module'; const lib = createRequire(import.meta.url)(${JSON.stringify(url)}); export default lib.default ?? lib;`, shortCircuit: true };
  }
  if (url.endsWith('.css')) return { format: 'module', source: 'export default {};', shortCircuit: true };
  return nextLoad(url, context);
}
