import { addPath } from '@actions/core';

import { Path } from '#/texlive/tlmgr/path';
import { uniqueChild } from '#/utility';

jest.unmock('#/texlive/tlmgr/path');

describe('add', () => {
  const path = new Path({ TEXDIR: '<TEXDIR>' });

  it('adds the bin directory to the PATH', async () => {
    jest.mocked(uniqueChild).mockResolvedValueOnce('<path>');
    await path.add();
    expect(uniqueChild).toHaveBeenCalledWith('<TEXDIR>/bin');
    expect(addPath).toHaveBeenCalledWith('<path>');
  });

  it('fails as the bin directory cannot be located', async () => {
    jest.mocked(uniqueChild).mockImplementationOnce(() => {
      throw new Error();
    });
    await expect(path.add()).rejects.toThrow(
      "Unable to locate TeX Live's binary directory",
    );
  });
});
