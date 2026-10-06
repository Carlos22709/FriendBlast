import { redirectDeepLinkPath } from '@/presentation/navigation/deepLinks';

describe('redirectDeepLinkPath', () => {
  it.each([
    ['friendblast://post/abc-123', '/(feed)/post/abc-123'],
    ['friendblast:///post/abc-123', '/(feed)/post/abc-123'],
    ['/post/abc-123', '/(feed)/post/abc-123'],
    ['friendblast://post/abc-123?ref=share', '/(feed)/post/abc-123?ref=share'],
  ])('abre %s en la pestaña Inicio', (path, expected) => {
    expect(redirectDeepLinkPath(path)).toBe(expected);
  });

  it.each([
    ['/profile/user-1'],
    ['friendblast://messages'],
    ['exp+friendblast://expo-development-client/?url=http%3A%2F%2F10.0.2.2%3A8081'],
  ])('deja %s sin cambios', (path) => {
    expect(redirectDeepLinkPath(path)).toBe(path);
  });
});
