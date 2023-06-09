import { writeFile } from 'node:fs/promises';
import { platform } from 'node:os';
import path from 'node:path';
import { env } from 'node:process';

import { Expose, Type } from 'class-transformer';
import type { PickProperties, Writable } from 'ts-essentials';
import { keys } from 'ts-transformer-keys';

import type { Version } from '#/texlive';
import type { Texmf } from '#/texmf';
import { Serializable, mkdtemp } from '#/utility';

export class Profile extends Serializable implements Texmf {
  readonly version: Version;

  constructor(options: {
    readonly version: Version;
    readonly prefix: string;
    readonly texdir?: string | undefined;
    readonly texuserdir?: string | undefined;
  }) {
    super();
    this.version = options.version;
    // `scheme-infraonly` was first introduced in TeX Live 2016.
    this.selected_scheme = `scheme-${
      this.version.number < 2016 ? 'minimal' : 'infraonly'
    }`;
    if (options.texdir !== undefined) {
      this.withTexdir(options.texdir);
    } else {
      this.withPrefix(options.prefix);
    }
    if (options.texuserdir !== undefined) {
      this.withTexuserdir(options.texuserdir);
    } else {
      this.withPortable();
    }
    this.instopt_adjustrepo = this.version.isLatest();
  }

  /* eslint-disable @typescript-eslint/prefer-readonly-parameter-types */
  private withPrefix(this: Writable<this>, prefix: string): void {
    (this as this).withTexdir(path.join(prefix, this.version.toString()));
    this.TEXMFLOCAL = env['TEXLIVE_INSTALL_TEXMFLOCAL']
      ?? path.join(prefix, 'texmf-local');
  }

  private withTexdir(this: Writable<this>, texdir: string): void {
    this.TEXDIR = texdir;
    this.TEXMFLOCAL = path.join(texdir, 'texmf-local');
    this.TEXMFSYSCONFIG = path.join(texdir, 'texmf-config');
    this.TEXMFSYSVAR = path.join(texdir, 'texmf-var');
  }

  private withTexuserdir(this: Writable<this>, texuserdir: string): void {
    this.TEXMFHOME = path.join(texuserdir, 'texmf');
    this.TEXMFCONFIG = path.join(texuserdir, 'texmf-config');
    this.TEXMFVAR = path.join(texuserdir, 'texmf-var');
  }

  private withPortable(this: Writable<this>): void {
    this.TEXMFHOME = env['TEXLIVE_INSTALL_TEXMFHOME'] ?? this.TEXMFLOCAL;
    this.TEXMFCONFIG = env['TEXLIVE_INSTALL_TEXMFCONFIG']
      ?? this.TEXMFSYSCONFIG;
    this.TEXMFVAR = env['TEXLIVE_INSTALL_TEXMFVAR'] ?? this.TEXMFSYSVAR;
  }
  /* eslint-enable */

  async *open(): AsyncGenerator<string, void, void> {
    for await (const tmp of mkdtemp()) {
      const target = path.join(tmp, 'texlive.profile');
      await writeFile(target, this.toString());
      yield target;
    }
  }

  override toString(): string {
    const plain = this.toPlain({
      version: this.version.number,
      groups: [platform()],
    });
    return Object.entries(plain).map((entry) => entry.join(' ')).join('\n');
  }

  @Expose()
  readonly selected_scheme: string;

  @Expose()
  readonly TEXDIR!: string;
  @Expose()
  readonly TEXMFLOCAL!: string;
  @Expose()
  readonly TEXMFSYSCONFIG!: string;
  @Expose()
  readonly TEXMFSYSVAR!: string;
  @Expose()
  readonly TEXMFHOME!: string;
  @Expose()
  readonly TEXMFCONFIG!: string;
  @Expose()
  readonly TEXMFVAR!: string;

  @Expose({ since: 2017 })
  readonly instopt_adjustpath: boolean = false;
  @Expose({ since: 2017 })
  readonly instopt_adjustrepo: boolean;
  @Expose({ since: 2017 })
  readonly tlpdbopt_autobackup: boolean = false;
  @Expose({ since: 2017 })
  readonly tlpdbopt_install_docfiles: boolean = false;
  @Expose({ since: 2017 })
  readonly tlpdbopt_install_srcfiles: boolean = false;

  // Options for Windows
  @Expose({ since: 2017, groups: ['win32'] })
  readonly tlpdbopt_desktop_integration: boolean = false;
  @Expose({ since: 2017, groups: ['win32'] })
  readonly tlpdbopt_file_assocs: boolean = false;
  @Expose({ since: 2017, groups: ['win32'] })
  readonly tlpdbopt_w32_multi_user: boolean = false;

  // Removed option
  @Expose({ since: 2012, until: 2017, groups: ['win32'] })
  readonly option_menu_integration: boolean = false;

  // Old option names
  @Expose({ until: 2009 })
  get option_symlinks(): boolean {
    return this.instopt_adjustpath;
  }
  @Expose({ since: 2009, until: 2017 })
  get option_path(): boolean {
    return this.instopt_adjustpath;
  }
  @Expose({ since: 2011, until: 2017 })
  get option_adjustrepo(): boolean {
    return this.instopt_adjustrepo;
  }
  @Expose({ until: 2017 })
  get option_autobackup(): boolean {
    return this.tlpdbopt_autobackup;
  }
  @Expose({ until: 2017 })
  get option_doc(): boolean {
    return this.tlpdbopt_install_docfiles;
  }
  @Expose({ until: 2017 })
  get option_src(): boolean {
    return this.tlpdbopt_install_srcfiles;
  }
  @Expose({ since: 2009, until: 2017, groups: ['win32'] })
  get option_desktop_integration(): boolean {
    return this.tlpdbopt_desktop_integration;
  }
  @Expose({ until: 2017, groups: ['win32'] })
  get option_file_assocs(): boolean {
    return this.tlpdbopt_file_assocs;
  }
  @Expose({ since: 2009, until: 2017, groups: ['win32'] })
  get option_w32_multi_user(): boolean {
    return this.tlpdbopt_w32_multi_user;
  }

  static {
    for (const key of keys<PickProperties<Profile, boolean>>()) {
      Type(() => Number)(Profile.prototype, key);
    }
  }
}
