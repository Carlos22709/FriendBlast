import { useEffect, useState } from 'react';
import { Image, type ImageProps } from 'react-native';

import { getCachedImage } from '@/application/images';

type CachedImageProps = Omit<ImageProps, 'source'> & {
  active?: boolean;
  cacheKey: string;
  remoteUrl: string;
};

export function CachedImage({
  active = true,
  cacheKey,
  remoteUrl,
  ...imageProps
}: CachedImageProps) {
  const [cachedImage, setCachedImage] = useState<{
    cacheKey: string;
    uri: string;
  } | null>(null);

  useEffect(() => {
    if (!active || !remoteUrl) {
      return;
    }

    let mounted = true;
    const controller = new AbortController();

    void getCachedImage(cacheKey, remoteUrl, controller.signal)
      .then((uri) => {
        if (mounted) {
          setCachedImage({ cacheKey, uri });
        }
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== 'AbortError') {
          console.warn('No se pudo guardar la imagen en caché:', error.message);
        }
      });

    return () => {
      mounted = false;
      controller.abort();
    };
  }, [active, cacheKey, remoteUrl]);

  const localUri =
    active && cachedImage?.cacheKey === cacheKey ? cachedImage.uri : null;
  return <Image {...imageProps} source={localUri ? { uri: localUri } : undefined} />;
}
