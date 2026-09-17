// SPDX-License-Identifier: Apache-2.0

export { ExitCode } from './exit-codes.js';
export type { ExitCodeValue } from './exit-codes.js';

export { ErrorCode, exitCodeByError } from './codes.js';
export type { ErrorCodeValue } from './codes.js';

export { catalogue, hints } from './hints.js';
export type { CatalogueEntry, CatalogueMatch } from './hints.js';

export { AatError, asAatError, isAatError } from './errors.js';

export {
  NETWORK_NAMES,
  isNetworkName,
  networks,
  requireNetwork,
} from './networks.js';
export type { NetworkEntry, NetworkName } from './networks.js';

export {
  DEFAULT_NETWORK,
  LAYER_ORDER,
  configFromEnv,
  parseConfigObject,
  resolveConfig,
} from './config.js';
export type {
  AatConfig,
  ConfigLayer,
  LayerName,
  PartialConfig,
  Provenance,
  ResolvedConfig,
} from './config.js';

export { fromError, ok, renderHuman, renderJson, withFindings } from './output.js';
export type { CommandResult, Finding } from './output.js';

export { checkRef, makeRefIo, parseRef, upstreamFolderByCommit } from './refs.js';
export type { LineRange, Ref, RefIo } from './refs.js';
