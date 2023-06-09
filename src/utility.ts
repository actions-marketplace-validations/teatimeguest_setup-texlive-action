import fs from 'node:fs/promises';
import path from 'node:path';
import { env } from 'node:process';

import * as cache from '@actions/cache';
import * as core from '@actions/core';
import { rmRF } from '@actions/io';
import { extractTar, extractZip } from '@actions/tool-cache';
import { type ClassTransformOptions, instanceToPlain } from 'class-transformer';

import * as log from '#/log';

export interface IterableIterator<T, TReturn = unknown, TNext = undefined>
  extends Iterator<T, TReturn, TNext>
{
  [Symbol.iterator](): IterableIterator<T, TReturn, TNext>;
}

export abstract class Serializable {
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  toPlain(options?: ClassTransformOptions): object {
    return instanceToPlain(this, { strategy: 'excludeAll', ...options });
  }

  toJSON(): object {
    return this.toPlain();
  }
}

/**
 * Extracts files from an archive.
 *
 * @returns Path to the directory containing the files.
 */
export async function extract(
  archive: string,
  kind: 'zip' | 'tgz',
): Promise<string> {
  switch (kind) {
    case 'tgz': {
      return await extractTar(archive, undefined, ['xz', '--strip=1']);
    }
    case 'zip': {
      const parent = await extractZip(archive);
      try {
        return await uniqueChild(parent);
      } catch (cause) {
        throw new Error('Unable to locate unzipped subdirectory', { cause });
      }
    }
  }
}

export async function uniqueChild(parent: string): Promise<string> {
  const [child, ...rest] = await fs.readdir(parent);
  if (child === undefined) {
    throw new Error(`${parent} has no entries`);
  }
  if (rest.length > 0) {
    throw new Error(`${parent} has multiple entries`);
  }
  return path.join(parent, child);
}

export function getInput(name: string, options?: {
  readonly type?: typeof String;
}): string | undefined;
export function getInput(name: string, options: {
  readonly type?: typeof String;
  readonly default: string;
}): string;
export function getInput(name: string, options: {
  readonly type: typeof Boolean;
}): boolean;

export function getInput(name: string, options?: {
  readonly type?: typeof String | typeof Boolean;
  readonly default?: string;
}): string | boolean | undefined {
  switch (options?.type) {
    case Boolean: {
      return core.getBooleanInput(name);
    }
    default: {
      const input = core.getInput(name);
      return input === '' ? options?.default : input;
    }
  }
}

export async function saveCache(
  target: string,
  primaryKey: string,
): Promise<void> {
  try {
    await cache.saveCache([target], primaryKey);
    log.info(`${target} saved with cache key: ${primaryKey}`);
  } catch (error) {
    if (error instanceof cache.ReserveCacheError) {
      log.info(error.message);
    } else {
      log.warn('Failed to save to cache', { cause: error });
    }
  }
}

export async function restoreCache(
  target: string,
  primaryKey: string,
  // eslint-disable-next-line @typescript-eslint/prefer-readonly-parameter-types
  restoreKeys: Array<string>,
): Promise<string | undefined> {
  let key: string | undefined;
  try {
    key = await cache.restoreCache([target], primaryKey, restoreKeys);
    if (key !== undefined) {
      log.info(`${target} restored from cache with key: ${key}`);
    } else {
      log.info('Cache not found');
    }
  } catch (cause) {
    log.warn('Failed to restore cache', { cause });
  }
  return key;
}

export function tmpdir(): string {
  return env.RUNNER_TEMP;
}

export async function* mkdtemp(): AsyncGenerator<string, void, void> {
  const tmp = await fs.mkdtemp(path.join(tmpdir(), 'setup-texlive-'));
  try {
    yield tmp;
  } finally {
    await rmRF(tmp);
  }
}
