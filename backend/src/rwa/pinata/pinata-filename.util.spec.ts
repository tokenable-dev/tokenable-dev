import { safeIpfsUploadFilename } from './pinata-filename.util';

describe('safeIpfsUploadFilename', () => {
  it('flattens slash in card name so Pinata pins a single file, not a directory', () => {
    expect(safeIpfsUploadFilename('PIKACHU/GREY FELT HAT', 'jpeg')).toBe(
      'GREY FELT HAT.jpeg',
    );
  });

  it('strips path separators from uploaded filenames', () => {
    expect(safeIpfsUploadFilename('folder/card.png', 'png')).toBe('card.png');
  });
});
