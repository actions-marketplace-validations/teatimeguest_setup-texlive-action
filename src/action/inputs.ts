import { readFile } from 'node:fs/promises';

import { isFeatureAvailable as isCacheAvailable } from '@actions/cache';
import type { MarkWritable } from 'ts-essentials';

import { Env } from '#/action/env';
import * as log from '#/log';
import { Version, dependsTxt } from '#/texlive';
import { getInput } from '#/utility';

export interface Inputs {
  readonly cache: boolean;
  readonly packages: ReadonlySet<string>;
  readonly prefix: string;
  readonly texdir?: string | undefined;
  readonly tlcontrib: boolean;
  readonly updateAllPackages: boolean;
  readonly version: Version;
}

export namespace Inputs {
  export async function load(): Promise<Inputs> {
    const version = await Version.resolve(
      getInput('version', { default: 'latest' }),
    );
    const env = Env.load(version);
    const inputs = {
      cache: getInput('cache', { type: Boolean }),
      packages: await loadPackageList(),
      prefix: getInput('prefix', { default: env.TEXLIVE_INSTALL_PREFIX }),
      texdir: getInput('texdir'),
      tlcontrib: getInput('tlcontrib', { type: Boolean }),
      updateAllPackages: getInput('update-all-packages', { type: Boolean }),
      version,
    };
    validate(inputs);
    return inputs;
  }

  function validate(
    this: void,
    /* eslint-disable-next-line
      @typescript-eslint/prefer-readonly-parameter-types */
    inputs: MarkWritable<Inputs, 'cache' | 'tlcontrib' | 'updateAllPackages'>,
  ): void {
    if (inputs.cache && !isCacheAvailable()) {
      log.warn('Caching is disabled because cache service is not available');
      inputs.cache = false;
    }
    if (!inputs.version.isLatest()) {
      if (inputs.tlcontrib) {
        log.warn('`tlcontrib` is currently ignored for older versions');
        inputs.tlcontrib = false;
      }
      if (inputs.updateAllPackages) {
        log.info('`update-all-packages` is ignored for older versions');
        inputs.updateAllPackages = false;
      }
    }
  }

  async function loadPackageList(this: void): Promise<Set<string>> {
    const packages = [];
    for await (const { name } of loadDependsTxt()) {
      packages.push(name);
    }
    return new Set(packages.sort());
  }

  async function* loadDependsTxt(
    this: void,
  ): AsyncIterable<dependsTxt.Dependency> {
    const inline = getInput('packages');
    if (inline !== undefined) {
      yield* dependsTxt.parse(inline);
    }
    const file = getInput('package-file');
    if (file !== undefined) {
      yield* dependsTxt.parse(await readFile(file, 'utf8'));
    }
  }
}
