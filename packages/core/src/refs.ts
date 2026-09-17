// SPDX-License-Identifier: Apache-2.0

/**
 * The pointers used by catalogue entries and skill sources.
 *
 * - `repo`: a path from the repository root, optionally `#Lstart` or
 *   `#Lstart-Lend`.
 * - `upstream`: `agoric-sdk@<commit>:<path>` with the same optional anchor, into
 *   one of the pinned clones under `../upstream/` (docs/PINS.md).
 * - `catalogue`: `catalogue:<CODE>`.
 * - `sharp-edge`: `sharp-edge:<n>`, item n of
 *   docs/context/agoric-devnet-sharp-edges.md.
 */
export type Ref =
  | { readonly kind: 'repo'; readonly path: string; readonly lines?: LineRange }
  | {
      readonly kind: 'upstream';
      readonly commit: string;
      readonly path: string;
      readonly lines?: LineRange;
    }
  | { readonly kind: 'catalogue'; readonly code: string }
  | { readonly kind: 'sharp-edge'; readonly n: number };

export interface LineRange {
  readonly start: number;
  readonly end: number;
}

/** Pinned clone folder under `../upstream/` for each commit refs may name. */
export const upstreamFolderByCommit: Readonly<Record<string, string>> = harden({
  cc25a29: 'agoric-sdk-u23',
  a2a3de9: 'agoric-sdk',
});

const SHARP_EDGE_COUNT = 22;

const parseAnchored = (
  text: string,
): { path: string; lines?: LineRange } | string => {
  const [path = '', anchor, extra] = text.split('#');
  if (path === '' || extra !== undefined) return `malformed path in ${text}`;
  if (anchor === undefined) return { path };
  const m = /^L(\d+)(?:-L(\d+))?$/.exec(anchor);
  if (!m) return `malformed line anchor in ${text}`;
  const start = Number(m[1]);
  const end = Number(m[2] ?? m[1]);
  if (start < 1 || end < start) return `empty line range in ${text}`;
  return { path, lines: { start, end } };
};

/** Parse a ref, or return a string saying why it is malformed. */
export const parseRef = (ref: string): Ref | string => {
  if (ref.startsWith('catalogue:')) {
    const code = ref.slice('catalogue:'.length);
    return /^[A-Z][A-Z0-9_]+$/.test(code)
      ? harden({ kind: 'catalogue', code })
      : `malformed catalogue code in ${ref}`;
  }
  if (ref.startsWith('sharp-edge:')) {
    const n = Number(ref.slice('sharp-edge:'.length));
    return Number.isInteger(n) && n >= 1 && n <= SHARP_EDGE_COUNT
      ? harden({ kind: 'sharp-edge', n })
      : `sharp edge out of range in ${ref}`;
  }
  const upstream = /^agoric-sdk@([0-9a-f]{7}):(.+)$/.exec(ref);
  if (upstream) {
    const [, commit = '', rest = ''] = upstream;
    if (!(commit in upstreamFolderByCommit)) return `unpinned commit in ${ref}`;
    const anchored = parseAnchored(rest);
    return typeof anchored === 'string'
      ? anchored
      : harden({ kind: 'upstream', commit, ...anchored });
  }
  if (ref.startsWith('agoric-sdk@')) return `malformed upstream ref ${ref}`;
  const anchored = parseAnchored(ref);
  return typeof anchored === 'string' ? anchored : harden({ kind: 'repo', ...anchored });
};

/** What `checkRef` needs to look at the world. */
export interface RefIo {
  /** Absolute path of a repository-relative path. */
  readonly repoPath: (path: string) => string;
  /** Absolute path of a path inside a pinned clone, or undefined if absent. */
  readonly upstreamPath: (folder: string, path: string) => string | undefined;
  readonly exists: (absolutePath: string) => boolean;
  readonly lineCount: (absolutePath: string) => number;
  readonly isCatalogueCode: (code: string) => boolean;
}

/**
 * Problems with one ref, empty when it resolves. Upstream refs are checked
 * only when the clone is present, which it is on a developer machine and is
 * not in CI.
 */
export const checkRef = (ref: string, io: RefIo): readonly string[] => {
  const parsed = parseRef(ref);
  if (typeof parsed === 'string') return harden([parsed]);
  const checkFile = (absolute: string, lines: LineRange | undefined) => {
    if (!io.exists(absolute)) return [`${ref} does not exist`];
    if (lines && lines.end > io.lineCount(absolute)) return [`${ref} is past the end of the file`];
    return [];
  };
  switch (parsed.kind) {
    case 'catalogue':
      return harden(io.isCatalogueCode(parsed.code) ? [] : [`${ref} is not a catalogue code`]);
    case 'sharp-edge':
      return harden([]);
    case 'repo':
      return harden(checkFile(io.repoPath(parsed.path), parsed.lines));
    case 'upstream': {
      const folder = upstreamFolderByCommit[parsed.commit] ?? '';
      const absolute = io.upstreamPath(folder, parsed.path);
      return harden(absolute === undefined ? [] : checkFile(absolute, parsed.lines));
    }
    default:
      return harden([`${ref} has an unknown kind`]);
  }
};

/**
 * Build a `RefIo` over a filesystem. The caller passes the two file functions,
 * so this module holds no authority of its own.
 *
 * @param repoRoot absolute path of the repository root; pinned clones are
 *   looked for in `<repoRoot>/../upstream/`.
 */
export const makeRefIo = ({
  repoRoot,
  exists,
  readText,
  isCatalogueCode,
}: {
  readonly repoRoot: string;
  readonly exists: (absolutePath: string) => boolean;
  readonly readText: (absolutePath: string) => string;
  readonly isCatalogueCode: (code: string) => boolean;
}): RefIo => {
  const root = repoRoot.endsWith('/') ? repoRoot : `${repoRoot}/`;
  const upstreamRoot = `${root}../upstream/`;
  return harden({
    repoPath: path => `${root}${path}`,
    upstreamPath: (folder, path) =>
      exists(`${upstreamRoot}${folder}`) ? `${upstreamRoot}${folder}/${path}` : undefined,
    exists,
    lineCount: path => readText(path).split('\n').length,
    isCatalogueCode,
  });
};
