# Guía de defensa técnica

## Flujo de dependencias

`src/app` declara rutas y compone proveedores. `src/presentation` solo consume
casos de uso de `src/application`. La capa `src/data` contiene Supabase,
SQLite, caché y sincronización, mientras `src/domain` mantiene los modelos.

## Cinco temas que todos deben poder explicar

1. **Caché de imágenes:** primero se consulta el LRU en RAM y luego el índice de
   disco. Las celdas fuera del viewport abortan la descarga y liberan su URI.
2. **Offline-first:** las acciones se guardan en SQLite por fecha e id. Se
   reintentan con espera exponencial y, tras cinco fallos, pasan a una bandeja
   recuperable para no bloquear las acciones posteriores.
3. **Conflictos:** likes y seguimientos usan una clave de deduplicación; la
   intención más reciente sustituye a las anteriores. Comentarios y mensajes
   usan UUID para que una repetición sea idempotente.
4. **Privacidad:** Supabase RLS protege posts, imágenes, historias, conexiones,
   likes y comentarios. Las cuentas privadas requieren solicitud y aprobación.
5. **Realtime:** comentarios y mensajes escuchan cambios de PostgreSQL.
   Mensajería también sincroniza typing, entregado, visto y reordena la bandeja.

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
