import { redirectDeepLinkPath } from '@/presentation/navigation/deepLinks';

export function redirectSystemPath({ path }: { path: string; initial: boolean }) {
  try {
    return redirectDeepLinkPath(path);
  } catch {
    // Nunca debe fallar aquí: si algo sale mal, se abre la ruta original.
    return path;
  }
}
