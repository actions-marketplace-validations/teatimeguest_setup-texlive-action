import * as path from 'path';

import * as core from '@actions/core';
import * as exec from '@actions/exec';
import { keys } from 'ts-transformer-keys';

import * as util from '#/utility';

export namespace Version {
  export function isVersion(version: string): version is Version {
    return keys<Record<Version, unknown>>().includes(version as Version);
  }

  export type Latest = '2022';
  export const LATEST: Version = '2022';
}

// eslint-disable-next-line @typescript-eslint/no-redeclare
export type Version = util.Range<'1996', Version.Latest> | Version.Latest;

export interface Texmf {
  ['TEXDIR']?: string;
  ['TEXMFCONFIG']?: string;
  ['TEXMFVAR']?: string;
  ['TEXMFHOME']?: string;
  ['TEXMFLOCAL']?: string;
  ['TEXMFSYSCONFIG']?: string;
  ['TEXMFSYSVAR']?: string;
}

/**
 * An interface for the `tlmgr` command.
 */
export class Manager {
  constructor(
    private readonly version: Version,
    private readonly prefix: string,
  ) {}

  get conf(): Readonly<{
    texmf: {
      (key: keyof Texmf): Promise<string>;
      (key: keyof Texmf, value: string): Promise<void>;
    };
  }> {
    return new (class {
      texmf(key: keyof Texmf): Promise<string>;
      texmf(key: keyof Texmf, value: string): Promise<void>;
      async texmf(key: keyof Texmf, value?: string): Promise<string | void> {
        if (value === undefined) {
          return (
            await exec.getExecOutput('kpsewhich', ['-var-value', key])
          ).stdout.trim();
        }
        /**
         * `tlmgr conf` is not implemented before 2010.
         */
        if (this.version < '2010') {
          core.exportVariable(key, value);
        } else {
          await exec.exec('tlmgr', ['conf', 'texmf', key, value]);
        }
      }
      constructor(private readonly version: Version) {}
    })(this.version);
  }

  async install(this: void, ...packages: ReadonlyArray<string>): Promise<void> {
    if (packages.length !== 0) {
      await exec.exec('tlmgr', ['install', ...packages]);
    }
  }

  get path(): Readonly<{
    /**
     * Adds the bin directory of TeX Live directly to the PATH.
     * This method does not invoke `tlmgr path add`
     * to avoid to create symlinks in the system directory.
     */
    add: () => Promise<void>;
  }> {
    return {
      add: async () => {
        const binpath = await util.determine(
          path.join(this.prefix, this.version, 'bin', '*'),
        );
        if (binpath === undefined) {
          throw new Error('Unable to locate the bin directory');
        }
        core.addPath(binpath);
      },
    };
  }

  get pinning(): Readonly<{
    add: (
      repo: string,
      pattern: string,
      ...rest: ReadonlyArray<string>
    ) => Promise<void>;
  }> {
    if (this.version < '2013') {
      throw new Error(
        `\`pinning\` action is not implemented in TeX Live ${this.version}`,
      );
    }
    return {
      add: async (repo, pattern, ...rest) => {
        await exec.exec('tlmgr', ['pinning', 'add', repo, pattern, ...rest]);
      },
    };
  }

  get repository(): Readonly<{
    /**
     * @returns `false` if the repository already exists, otherwise `true`.
     */
    add: (repo: string, tag?: string) => Promise<boolean>;
  }> {
    if (this.version < '2012') {
      throw new Error(
        `\`repository\` action is not implemented in TeX Live ${this.version}`,
      );
    }
    return {
      add: async (repo, tag) => {
        const { exitCode, stderr } = await exec.getExecOutput(
          'tlmgr',
          ['repository', 'add', repo, ...(tag === undefined ? [] : [tag])],
          { ignoreReturnCode: true },
        );
        const success = exitCode === 0;
        if (
          /**
           * `tlmgr repository add` returns non-zero status code
           * if the same repository or tag is added again.
           *
           * @todo (Need to make sure that the tagged repo is really tlcontrib?)
           */
          !success &&
          !stderr.includes('repository or its tag already defined')
        ) {
          throw new Error(
            `\`tlmgr\` failed with exit code ${exitCode}: ${stderr}`,
          );
        }
        return success;
      },
    };
  }
}

export function contrib(): URL {
  return new URL('https://mirror.ctan.org/systems/texlive/tlcontrib/');
}

export function historic(version: Version): URL {
  return new URL(
    version < '2010' ? 'tlnet/' : 'tlnet-final/',
    `https://ftp.math.utah.edu/pub/tex/historic/systems/texlive/${version}/`,
  );
}
