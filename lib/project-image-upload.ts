const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

type ImageFile = Pick<File, 'type' | 'size' | 'arrayBuffer'>;

export async function prepareProjectImageUpload(file: ImageFile) {
  const extension = IMAGE_EXTENSIONS[file.type];
  if (!extension) {
    throw new Error('Bitte wählen Sie ein Bild im Format JPG, PNG, WebP oder GIF aus.');
  }
  if (file.size === 0) {
    throw new Error('Die ausgewählte Bilddatei ist leer. Bitte wählen Sie das Bild erneut aus.');
  }
  if (file.size > MAX_IMAGE_SIZE) {
    throw new Error('Das Bild darf maximal 10 MB groß sein.');
  }

  let body: ArrayBuffer;
  try {
    body = await file.arrayBuffer();
  } catch {
    throw new Error('Das Bild konnte nicht gelesen werden. Bitte wählen Sie es erneut aus.');
  }
  if (body.byteLength === 0) {
    throw new Error('Das Bild enthält keine lesbaren Daten. Bitte wählen Sie es erneut aus.');
  }

  return { body, contentType: file.type, extension };
}
