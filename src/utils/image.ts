import { getImage } from "../db/repositories";

const imageUrlCache = new Map<string, string>();
const pendingImageUrls = new Map<string, Promise<string | undefined>>();

export async function getImageUrl(imageId?: string): Promise<string | undefined> {
  if (!imageId) {
    return undefined;
  }

  const cachedUrl = imageUrlCache.get(imageId);
  if (cachedUrl) {
    return cachedUrl;
  }

  const pendingUrl = pendingImageUrls.get(imageId);
  if (pendingUrl) {
    return pendingUrl;
  }

  const nextUrl = getImage(imageId)
    .then((image) => {
      if (!image) {
        return undefined;
      }

      const objectUrl = URL.createObjectURL(image.blob);
      imageUrlCache.set(imageId, objectUrl);
      return objectUrl;
    })
    .finally(() => {
      pendingImageUrls.delete(imageId);
    });

  pendingImageUrls.set(imageId, nextUrl);
  return nextUrl;
}

export function revokeImageUrls(): void {
  for (const objectUrl of imageUrlCache.values()) {
    URL.revokeObjectURL(objectUrl);
  }

  imageUrlCache.clear();
  pendingImageUrls.clear();
}
