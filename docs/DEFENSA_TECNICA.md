# Guía de defensa técnica

## Flujo de dependencias

`src/app` declara rutas y compone proveedores. `src/presentation` solo consume
casos de uso de `src/application`. La capa `src/data` contiene Supabase,
SQLite, caché y sincronización, mientras `src/domain` mantiene los modelos.

## Temas que todos deben poder explicar

1. **Caché de imágenes:** primero se consulta el LRU en RAM y luego el índice de
   disco. Las celdas fuera del viewport abortan la descarga y liberan su URI.
2. **Offline-first:** las acciones se guardan en SQLite por fecha e id. Si
   quedan acciones pendientes, las nuevas se encolan detrás de ellas aunque haya
   conexión, para no adelantarse (`src/data/sync/submitOrQueue.ts`). Se
   reintentan con espera exponencial y, tras cinco fallos, pasan a una bandeja
   recuperable para no bloquear las acciones posteriores.
3. **Conflictos:** likes y seguimientos usan una clave de deduplicación; la
   intención más reciente sustituye a las anteriores. Comentarios y mensajes
   usan UUID para que una repetición sea idempotente: comentarios y likes se
   insertan con `ignoreDuplicates` (`ON CONFLICT DO NOTHING`), porque un
   `ON CONFLICT DO UPDATE` sería rechazado por RLS al no existir política UPDATE.
4. **Privacidad:** Supabase RLS protege posts, imágenes, historias, conexiones,
   likes y comentarios. Las cuentas privadas requieren solicitud y aprobación.
5. **Realtime:** comentarios y mensajes escuchan cambios de PostgreSQL.
   Mensajería también sincroniza typing, entregado, visto y reordena la bandeja.
6. **Navegación:** cada pestaña es un grupo con su propia pila
   (`(feed)`, `(explore)`, `(activity)`, `(profile)`). Post, comentarios, perfil
   y conexiones son rutas compartidas en `(feed,explore,activity,profile)`, así
   que se apilan dentro de la pestaña actual sin ocultar la barra inferior.
   `unstable_settings.anchor` deja la pantalla base de la pestaña debajo de un
   enlace profundo, y `+native-intent.tsx` dirige `friendblast://post/{id}` a
   la pestaña Inicio.
7. **Contadores:** likes, comentarios y "me gusta" propio se calculan en
   PostgreSQL con `get_post_stats` (`security invoker`, respeta RLS). El cliente
   ya no descarga cada fila, que además PostgREST corta en 1000.
8. **Pantallas con Realtime:** chat y comentarios leen la cola pendiente desde
   una referencia (`useRef`), para que un cambio de sincronización no recree la
   suscripción ni descarte los mensajes anteriores ya cargados.

## Pruebas automáticas

`npm test` ejecuta los tests de Jest de `__tests__/`: orden de la cola,
reintentos idempotentes, pilas por pestaña y enlaces profundos.

## Prueba manual obligatoria

- Crear dos usuarios, volver uno privado y comprobar solicitud, rechazo y
  aprobación.
- Crear un comentario, responderlo en varios niveles y observar el hilo desde el
  segundo dispositivo.
- Activar modo avión, crear like, comentario y mensaje, recuperar conexión y
  comprobar el orden de sincronización.
- Abrir `friendblast://post/{uuid}` con la app cerrada y abierta.
- Recorrer historias, mantener pulsado para pausar y confirmar que el estado
  visto persiste al reiniciar.
- Probar un feed largo en una compilación de desarrollo o release física,
  registrar FPS y memoria y confirmar que las descargas desaparecen al salir
  del viewport.

## Limitación del background

La reconexión inmediata se procesa con NetInfo mientras la aplicación está
activa. Las tareas del sistema son diferibles y su hora exacta depende de
Android o iOS; no deben presentarse como ejecución instantánea garantizada.
