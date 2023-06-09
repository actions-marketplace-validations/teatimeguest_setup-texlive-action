import fs from 'node:fs/promises';
import os from 'node:os';

import { dedent } from 'ts-dedent';

import * as tlpkg from '#/texlive/tlpkg';
import { Version } from '#/texlive/version';

const v = (spec: unknown) => new Version(`${spec}`);

jest.unmock('#/texlive/tlpkg');

describe('check', () => {
  it('detects forcible removal of packages', () => {
    expect(() =>
      tlpkg.check(
        'TeXLive::TLUtils::check_file_and_remove: '
          + 'checksums differ for /tmp/path/to/foo.tar.xz:\n'
          + 'TeXLive::TLUtils::check_file_and_remove: ...',
      )
    )
      .toThrow('The checksum of package foo did not match.');
  });
});

describe('tlpdb', () => {
  // editorconfig-checker-disable
  const db = dedent`
    name 00texlive.config
    category Package
    depend minrelease/2016
    depend release/2022

    name texlive.infra
    category TLCore
    revision 63645
    shortdesc basic TeX Live infrastructure
    containersize 351180
    docfiles size=139
     README
    runfiles size=320
     LICENSE.CTAN

    name texlive.infra.universal-darwin
    category TLCore
    revision 62358
    shortdesc universal-darwin files of texlive.infra
    containersize 308304
    binfiles arch=universal-darwin size=246
     bin/universal-darwin/mktexlsr
     bin/universal-darwin/tlmgr
     tlpkg/installer/lz4/lz4.universal-darwin
     tlpkg/installer/xz/xz.universal-darwin

    name scheme-basic
    category Scheme
    revision 54191
    shortdesc basic scheme (plain and latex)
    relocated 1
    depend collection-basic
    depend collection-latex
    containersize 440

    name la\\
    tex#comment
    category Package
    revision 61232
    shortdesc A TeX macro package that defines LaTeX
    depend latexconfig
    depend luatex
    depend pdftex
    containersize 221228
    catalogue-contact-home http://www.latex-project.org/
    catalogue-license lppl1.3c
    catalogue-topics format
    catalogue-version 2021-11-15 PL1

    name hyperref
    category Package
    revision 62142
    shortdesc Extensive support for hypertext in LaTeX
    catalogue-contact-bugs https://github.com/latex3/hyperref/issues
    catalogue-contact-home https://github.com/latex3/hyperref
    catalogue-ctan /macros/latex/contrib/hyperref
    catalogue-license lppl1.3
    catalogue-topics hyper pdf-feat adobe-distiller form-fillin etex
    catalogue-version 7.00n
  `;
  // editorconfig-checker-enable
  const collect = async <T>(gen: AsyncGenerator<T>): Promise<Array<T>> => {
    const a = [];
    for await (const item of gen) {
      a.push(item);
    }
    return a;
  };

  it('strips comments and escaped line breaks', async () => {
    await expect(collect(tlpkg.tlpdb(db))).resolves.toContainEqual(
      expect.objectContaining({
        name: 'latex',
        version: '2021-11-15 PL1',
        revision: '61232',
      }),
    );
  });

  it('lists texlive.infra', async () => {
    await expect(collect(tlpkg.tlpdb(db))).resolves.toContainEqual(
      expect.objectContaining({
        name: 'texlive.infra',
        version: undefined,
        revision: '63645',
      }),
    );
  });

  it('does not list schemes and collections', async () => {
    await expect(collect(tlpkg.tlpdb(db))).resolves.not.toContainEqual(
      expect.objectContaining({ name: 'scheme-basic' }),
    );
  });

  it('does not list architecture-specific packages', async () => {
    await expect(collect(tlpkg.tlpdb(db))).resolves.not.toContainEqual(
      expect.objectContaining({ name: 'texlive.infra.universal-darwin' }),
    );
  });

  it('does not list texlive metadata', async () => {
    await expect(collect(tlpkg.tlpdb(db))).resolves.not.toContainEqual(
      expect.objectContaining({ name: '00texlive.config' }),
    );
  });

  it('lists normal packages', async () => {
    await expect(collect(tlpkg.tlpdb(db))).resolves.toContainEqual(
      expect.objectContaining({
        name: 'hyperref',
        version: '7.00n',
        revision: '62142',
      }),
    );
  });
});

describe('patch', () => {
  const TEXDIR = '<TEXDIR>';

  it.each<[NodeJS.Platform, Version]>([
    ['linux', v`2009`],
    ['linux', v`2010`],
    ['win32', v`2009`],
    ['win32', v`2010`],
  ])(
    'applies a patch for tlpkg/TeXLive/TLWinGoo.pm on (%s %s)',
    async (platform, version) => {
      jest.mocked(os.platform).mockReturnValue(platform);
      await expect(tlpkg.patch({ TEXDIR, version })).toResolve();
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('TLWinGoo.pm'),
        'utf8',
      );
    },
  );

  it('applies a patch for tlpkg/tlperl/lib/Encode/Alias.pm', async () => {
    jest.mocked(os.platform).mockReturnValue('win32');
    await expect(tlpkg.patch({ TEXDIR, version: v`2015` })).toResolve();
    expect(fs.readFile).toHaveBeenCalledWith(
      expect.stringContaining('Alias.pm'),
      'utf8',
    );
  });

  it.each<[NodeJS.Platform, Version]>([
    ['win32', v`2008`],
    ['win32', v`2011`],
    ['win32', v`2014`],
    ['win32', v`2017`],
    ['darwin', v`2017`],
    ['darwin', v`2018`],
    ['darwin', v`2019`],
  ])(
    'applies a patch tlpkg/TeXLive/TLUtils.pm (%s %s)',
    async (platform, version) => {
      jest.mocked(os.platform).mockReturnValue(platform);
      await expect(tlpkg.patch({ TEXDIR, version })).toResolve();
      expect(fs.readFile).toHaveBeenCalledWith(
        expect.stringContaining('TLUtils.pm'),
        'utf8',
      );
    },
  );
});
