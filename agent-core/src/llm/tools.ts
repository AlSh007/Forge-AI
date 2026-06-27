import { RepoAccess } from '../types';
import { LLMTool, ToolDispatcher } from './client';

// Bound tool-result sizes so a large file or wide listing can't blow the context
// budget the coordinator works hard to stay under.
const MAX_FILE_CHARS = 12_000;
const MAX_LISTED_FILES = 300;
const MAX_SEARCH_RESULTS = 100;

/** Read/search tools exposing the target repository to an agent. */
export const REPO_TOOLS: LLMTool[] = [
  {
    type: 'function',
    function: {
      name: 'read_file',
      description:
        'Read the full contents of a file from the target repository by its path. Use this to inspect the actual code you will modify before writing changes.',
      parameters: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            description: 'Repository-relative file path, e.g. "src/index.ts".',
          },
        },
        required: ['path'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'list_files',
      description: 'List all file paths in the target repository.',
      parameters: { type: 'object', properties: {} },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_files',
      description: 'Find repository file paths whose path contains the given substring (case-insensitive).',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Substring to match against file paths.' },
        },
        required: ['query'],
      },
    },
  },
];

/** Maps a tool name + arguments to a call on the injected RepoAccess. */
export function makeRepoDispatcher(repo: RepoAccess): ToolDispatcher {
  return async (name, args) => {
    switch (name) {
      case 'read_file': {
        const path = typeof args.path === 'string' ? args.path.trim() : '';
        if (!path) return 'Error: "path" is required.';
        const content = await repo.readFile(path);
        if (content == null) return `File not found: ${path}`;
        return content.length > MAX_FILE_CHARS
          ? content.slice(0, MAX_FILE_CHARS) + '\n... [truncated]'
          : content;
      }
      case 'list_files': {
        const files = await repo.listFiles();
        if (files.length === 0) return '(repository is empty)';
        const shown = files.slice(0, MAX_LISTED_FILES).join('\n');
        return files.length > MAX_LISTED_FILES
          ? `${shown}\n... (${files.length - MAX_LISTED_FILES} more)`
          : shown;
      }
      case 'search_files': {
        const query = typeof args.query === 'string' ? args.query.trim() : '';
        if (!query) return 'Error: "query" is required.';
        const matches = await repo.searchFiles(query);
        if (matches.length === 0) return `No files matching "${query}".`;
        const shown = matches.slice(0, MAX_SEARCH_RESULTS).join('\n');
        return matches.length > MAX_SEARCH_RESULTS
          ? `${shown}\n... (${matches.length - MAX_SEARCH_RESULTS} more)`
          : shown;
      }
      default:
        return `Error: unknown tool "${name}".`;
    }
  };
}
