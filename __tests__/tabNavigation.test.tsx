/// <reference types="node" />
import { readdirSync } from 'fs';
import { join, relative } from 'path';

import { act } from '@testing-library/react-native';
import { router, Stack } from 'expo-router';
import { renderRouter } from 'expo-router/testing-library';

const APP_DIR = 'src/app';

// Los iconos cargan fuentes con expo-asset, que Jest no resuelve; no afectan a
// la estructura de navegación que se prueba aquí.
jest.mock('@/presentation/components/TabIcon', () => ({ TabIcon: () => null }));

// Usa el árbol real de src/app y sus layouts de pestañas. Solo se reemplazan
// las pantallas (que dependen de Supabase y SQLite) y el layout raíz (que monta
// los proveedores de sesión) por componentes vacíos. Los archivos especiales
// como +native-intent no son rutas y se dejan fuera, igual que hace la app.
function listRouteKeys(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return listRouteKeys(path);
    }
    return [relative(APP_DIR, path).replace(/\\/g, '/').replace(/\.tsx?$/, '')];
  });
}

function EmptyScreen() {
  return null;
}

function RootStack() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

function loadRoute(key: string) {
  if (key === '_layout') {
    return RootStack;
  }
  if (key.endsWith('_layout')) {
    return require(`../${APP_DIR}/${key}`);
  }
  return EmptyScreen;
}

const routes = Object.fromEntries(
  listRouteKeys(APP_DIR)
    .filter((key) => !key.startsWith('+'))
    .map((key) => [key, loadRoute(key)]),
);

// En @testing-library/react-native 14 el render es asíncrono: renderRouter
// devuelve la promesa con los métodos de consulta del router añadidos, así que
// se espera la promesa y se exponen sus métodos en un objeto que no sea thenable.
async function renderApp(initialUrl: string) {
  const rendered = renderRouter(routes, { initialUrl });
  await rendered;
  return { getSegments: () => rendered.getSegments() };
}

async function push(href: Parameters<typeof router.push>[0]) {
  await act(async () => {
    router.push(href);
  });
}

describe('pila de navegación por pestaña', () => {
  it('abre un perfil desde Explorar sin salir de la pestaña Explorar', async () => {
    const app = await renderApp('/explore');

    await push('/profile/user-1');

    expect(app.getSegments()).toEqual(['(tabs)', '(explore)', 'profile', '[userId]']);
  });

  it('abre los comentarios de un post sin saltar a la pestaña Inicio', async () => {
    const app = await renderApp('/activity');

    await push('/post/post-1');
    await push('/comments/post-1');

    expect(app.getSegments()).toEqual(['(tabs)', '(activity)', 'comments', '[postId]']);
  });

  it('un enlace profundo a un post abre la publicación en la pestaña Inicio', async () => {
    const app = await renderApp('/(feed)/post/post-1');

    expect(app.getSegments()).toEqual(['(tabs)', '(feed)', 'post', '[postId]']);

    await act(async () => {
      router.back();
    });

    expect(app.getSegments()).toEqual(['(tabs)', '(feed)', 'feed']);
  });

  it('abre las conexiones de un perfil dentro de la pestaña Perfil', async () => {
    const app = await renderApp('/profile');

    await push('/connections/user-1/followers');

    expect(app.getSegments()).toEqual(['(tabs)', '(profile)', 'connections', '[userId]', '[kind]']);
  });
});
