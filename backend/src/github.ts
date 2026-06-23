import { RepoContext } from 'forgeai-agent-core';

const GITHUB_API = 'https://api.github.com';

const KEY_FILE_PATTERNS = [
  'package.json',
  'tsconfig.json',
  'prisma/schema.prisma',
  'src/index.ts',
  'src/app.ts',
  'src/main.ts',
  'README.md',
];

const MAX_FILE_BYTES = 40_000;
const MAX_KEY_FILES = 20;

export interface GitHubPR {
  url: string;
  number: number;
}

function parseRepoUrl(url: string): { owner: string; repo: string } {
  const match = url.match(/github\.com\/([^/]+)\/([^/\s]+?)(?:\.git)?$/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  const parts = url.replace(/\.git$/, '').split('/');
  return { owner: parts[parts.length - 2] ?? '', repo: parts[parts.length - 1] ?? '' };
}

async function ghFetch<T>(
  path: string,
  headers: Record<string, string>,
  options?: { method?: string; body?: unknown }
): Promise<T> {
  const res = await fetch(`${GITHUB_API}${path}`, {
    method: options?.method ?? 'GET',
    headers: options?.body
      ? { ...headers, 'Content-Type': 'application/json' }
      : headers,
    body: options?.body ? JSON.stringify(options.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw Object.assign(new Error(`GitHub API ${res.status}: ${text}`), { status: res.status });
  }

  return res.json() as Promise<T>;
}

export class GitHubService {
  private readonly headers: Record<string, string>;

  constructor(token: string) {
    this.headers = {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'ForgeAI',
    };
  }

  async fetchRepoContext(repositoryUrl: string): Promise<RepoContext> {
    const { owner, repo } = parseRepoUrl(repositoryUrl);

    const tree = await ghFetch<{ tree: Array<{ path: string; type: string; size?: number }> }>(
      `/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
      this.headers
    );

    const blobs = tree.tree.filter((f) => f.type === 'blob');
    const structure = blobs.map((f) => f.path).join('\n');

    const candidates = blobs.filter(
      (f) =>
        KEY_FILE_PATTERNS.some((p) => f.path === p || f.path.endsWith('/' + p)) ||
        (f.path.startsWith('src/') && (f.size ?? 0) < MAX_FILE_BYTES)
    );
    const toFetch = candidates.slice(0, MAX_KEY_FILES);

    const keyFiles: Record<string, string> = {};
    await Promise.all(
      toFetch.map(async (file) => {
        try {
          const data = await ghFetch<{ content: string }>(
            `/repos/${owner}/${repo}/contents/${file.path}`,
            this.headers
          );
          keyFiles[file.path] = Buffer.from(data.content, 'base64')
            .toString('utf-8')
            .slice(0, MAX_FILE_BYTES);
        } catch {
          // Skip unreadable files
        }
      })
    );

    let framework: string | undefined;
    let dependencies: string[] = [];
    const pkgJson = keyFiles['package.json'];
    if (pkgJson) {
      try {
        const pkg = JSON.parse(pkgJson) as {
          dependencies?: Record<string, string>;
          devDependencies?: Record<string, string>;
        };
        dependencies = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
        if (dependencies.includes('next')) framework = 'Next.js';
        else if (dependencies.includes('express')) framework = 'Express';
        else if (dependencies.includes('react')) framework = 'React';
        else if (dependencies.includes('fastify')) framework = 'Fastify';
      } catch {
        // ignore malformed package.json
      }
    }

    return { structure, keyFiles, framework, dependencies };
  }

  /** Fetch a single file's contents on demand. Returns null if it doesn't exist. */
  async readFile(repositoryUrl: string, path: string): Promise<string | null> {
    const { owner, repo } = parseRepoUrl(repositoryUrl);
    try {
      const data = await ghFetch<{ content?: string; encoding?: string }>(
        `/repos/${owner}/${repo}/contents/${path}`,
        this.headers
      );
      if (!data.content) return null;
      return Buffer.from(data.content, 'base64').toString('utf-8');
    } catch (err) {
      if ((err as { status?: number }).status === 404) return null;
      throw err;
    }
  }

  /** List every file path in the repository (blobs only). */
  async listFiles(repositoryUrl: string): Promise<string[]> {
    const { owner, repo } = parseRepoUrl(repositoryUrl);
    const tree = await ghFetch<{ tree: Array<{ path: string; type: string }> }>(
      `/repos/${owner}/${repo}/git/trees/HEAD?recursive=1`,
      this.headers
    );
    return tree.tree.filter((f) => f.type === 'blob').map((f) => f.path);
  }

  async getDefaultBranch(repositoryUrl: string): Promise<string> {
    const { owner, repo } = parseRepoUrl(repositoryUrl);
    const data = await ghFetch<{ default_branch: string }>(
      `/repos/${owner}/${repo}`,
      this.headers
    );
    return data.default_branch;
  }

  async createBranch(repositoryUrl: string, branchName: string): Promise<void> {
    const { owner, repo } = parseRepoUrl(repositoryUrl);
    const defaultBranch = await this.getDefaultBranch(repositoryUrl);

    const ref = await ghFetch<{ object: { sha: string } }>(
      `/repos/${owner}/${repo}/git/refs/heads/${defaultBranch}`,
      this.headers
    );

    await ghFetch(`/repos/${owner}/${repo}/git/refs`, this.headers, {
      method: 'POST',
      body: { ref: `refs/heads/${branchName}`, sha: ref.object.sha },
    });
  }

  async commitFiles(
    repositoryUrl: string,
    branchName: string,
    files: Array<{ path: string; content: string }>,
    message: string
  ): Promise<void> {
    const { owner, repo } = parseRepoUrl(repositoryUrl);

    for (const file of files) {
      let existingSha: string | undefined;
      try {
        const existing = await ghFetch<{ sha: string }>(
          `/repos/${owner}/${repo}/contents/${file.path}?ref=${branchName}`,
          this.headers
        );
        existingSha = existing.sha;
      } catch (err) {
        if ((err as { status?: number }).status !== 404) throw err;
      }

      const body: Record<string, string> = {
        message,
        content: Buffer.from(file.content).toString('base64'),
        branch: branchName,
      };
      if (existingSha) body.sha = existingSha;

      await ghFetch(`/repos/${owner}/${repo}/contents/${file.path}`, this.headers, {
        method: 'PUT',
        body,
      });
    }
  }

  async createPullRequest(
    repositoryUrl: string,
    branchName: string,
    title: string,
    body: string
  ): Promise<GitHubPR> {
    const { owner, repo } = parseRepoUrl(repositoryUrl);
    const defaultBranch = await this.getDefaultBranch(repositoryUrl);

    const pr = await ghFetch<{ html_url: string; number: number }>(
      `/repos/${owner}/${repo}/pulls`,
      this.headers,
      { method: 'POST', body: { title, body, head: branchName, base: defaultBranch } }
    );

    return { url: pr.html_url, number: pr.number };
  }
}

export function createGitHubService(): GitHubService | null {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return null;
  return new GitHubService(token);
}
