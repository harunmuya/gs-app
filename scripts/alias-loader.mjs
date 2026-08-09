/**
 * Resolve the `@/` path alias when running app modules under plain Node.
 *
 * jsconfig maps `@/*` to `src/*`, which Next understands and Node does not. The
 * verification scripts import real application modules on purpose: testing a
 * copy of the logic proves nothing about the code that ships.
 *
 *   node --import ./scripts/alias-loader.mjs scripts/verify-quota-enforcement.mjs
 */
import { register } from 'node:module';
import { pathToFileURL } from 'node:url';

register('./alias-resolver.mjs', pathToFileURL(`${import.meta.dirname}/`));
