import * as ts from 'typescript';
import { CodeChange, StaticValidationResult, ValidationIssue } from '../types';

// Files an agent must never regenerate — overwriting these breaks the repo.
const PROTECTED_BASENAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
]);

// The coordinator appends this marker when it truncates oversized context; if it
// shows up inside generated file content, the file was cut off mid-stream.
const TRUNCATION_MARKER = '... [truncated]';

const TS_LIKE_EXTENSIONS = new Set(['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx', '.mjs', '.cjs']);

// Cap diagnostics per file so a single malformed file can't flood the report.
const MAX_SYNTAX_ISSUES_PER_FILE = 5;

function extname(basename: string): string {
  const dot = basename.lastIndexOf('.');
  return dot === -1 ? '' : basename.slice(dot).toLowerCase();
}

/**
 * Deterministic, dependency-free validation of generated files. Runs no untrusted
 * code and resolves no imports — it only checks the artifacts themselves for the
 * failure modes LLMs actually produce: malformed JSON, syntax errors, empty or
 * truncated content, and unsafe paths. Real ground truth to back the DevOps verdict.
 */
export function validateChanges(changes: CodeChange[]): StaticValidationResult {
  const issues: ValidationIssue[] = [];

  for (const change of changes) {
    const path = (change?.path ?? '').trim();
    const content = change?.content ?? '';

    if (!path) {
      issues.push({ path: '(missing)', severity: 'error', message: 'Generated change has no file path.' });
      continue;
    }

    const normalized = path.replace(/\\/g, '/');
    const segments = normalized.split('/');
    const basename = segments[segments.length - 1] ?? '';

    // Path safety — must stay inside the repo and not clobber lockfiles.
    if (normalized.startsWith('/') || segments.includes('..')) {
      issues.push({ path, severity: 'error', message: 'Path escapes the repository root.' });
    }
    if (PROTECTED_BASENAMES.has(basename)) {
      issues.push({ path, severity: 'error', message: 'Generated file would overwrite a dependency lockfile.' });
    }

    // Content presence.
    if (!content.trim()) {
      issues.push({ path, severity: 'error', message: 'File content is empty.' });
      continue;
    }
    if (content.includes(TRUNCATION_MARKER)) {
      issues.push({ path, severity: 'error', message: 'File content appears truncated (contains a truncation marker).' });
    }

    // Type-specific syntax checks.
    const ext = extname(basename);
    if (ext === '.json') {
      try {
        JSON.parse(content);
      } catch (err) {
        issues.push({ path, severity: 'error', message: `Invalid JSON: ${err instanceof Error ? err.message : 'parse failed'}` });
      }
    } else if (TS_LIKE_EXTENSIONS.has(ext)) {
      issues.push(...checkSyntax(path, content, ext));
    }
  }

  const ok = !issues.some((issue) => issue.severity === 'error');
  return { ok, issues, filesChecked: changes.length };
}

/**
 * Single-file syntax check via the TypeScript transpiler. `transpileModule` parses
 * and emits without resolving imports, so it surfaces real syntax errors without
 * the "cannot find module" noise a full typecheck against an absent repo would give.
 */
function checkSyntax(path: string, content: string, ext: string): ValidationIssue[] {
  const isJsx = ext === '.tsx' || ext === '.jsx';
  const compilerOptions: ts.CompilerOptions = {
    target: ts.ScriptTarget.ESNext,
    module: ts.ModuleKind.ESNext,
    isolatedModules: false,
    noResolve: true,
  };
  // Only set `jsx` for JSX files — passing the key with an undefined value makes
  // the transpiler emit a spurious "--jsx option must be..." diagnostic on every
  // plain .ts/.js file.
  if (isJsx) {
    compilerOptions.jsx = ts.JsxEmit.Preserve;
  }

  const output = ts.transpileModule(content, {
    fileName: path,
    reportDiagnostics: true,
    compilerOptions,
  });

  return (output.diagnostics ?? [])
    .filter((d) => d.category === ts.DiagnosticCategory.Error)
    .slice(0, MAX_SYNTAX_ISSUES_PER_FILE)
    .map((d) => ({
      path,
      severity: 'error' as const,
      message: ts.flattenDiagnosticMessageText(d.messageText, '\n'),
    }));
}

/** Human/LLM-readable summary of static results, for the DevOps prompt and logs. */
export function formatStaticResults(result: StaticValidationResult): string {
  if (result.filesChecked === 0) {
    return 'No code files were generated, so there was nothing to statically validate.';
  }
  if (result.ok) {
    return `All ${result.filesChecked} generated file(s) passed static checks (syntax, JSON validity, content presence, path safety).`;
  }
  const errors = result.issues.filter((i) => i.severity === 'error');
  const lines = errors.map((i) => `- ${i.path}: ${i.message}`).join('\n');
  return `Static validation found ${errors.length} error(s) across ${result.filesChecked} generated file(s):\n${lines}`;
}
