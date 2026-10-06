const APP_SCHEME = 'friendblast://';
const POST_LINK = /^\/+post\/([^/?#]+)(.*)$/;

/**
 * Las pantallas compartidas existen en las cuatro pestañas, y un enlace en frío
 * abriría la primera en orden alfabético (Actividad). Los enlaces a posts se
 * dirigen a la pestaña Inicio nombrando su grupo de forma explícita.
 */
export function redirectDeepLinkPath(path: string) {
  const pathname = path.startsWith(APP_SCHEME) ? `/${path.slice(APP_SCHEME.length)}` : path;
  const match = POST_LINK.exec(pathname);

  if (!match) {
    return path;
  }

  const [, postId, rest] = match;
  return `/(feed)/post/${postId}${rest}`;
}
