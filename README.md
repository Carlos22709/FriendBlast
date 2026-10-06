# FriendBlast

Red social móvil de fotografías construida con React Native, Expo y TypeScript.

## Configuración

1. Instala las dependencias con npm install.
2. Copia .env.example como .env.
3. Añade la URL y la clave pública de Supabase cuando el backend esté disponible.
4. Ejecuta npm start.

La aplicación puede iniciarse sin credenciales de Supabase durante el Módulo 0.

## Arquitectura

- src/app: rutas y navegación con Expo Router.
- src/presentation: pantallas, componentes, hooks y estilos.
- src/application: casos de uso consumidos por la presentación.
- src/domain: modelos y reglas de negocio.
- src/data: SQLite, Supabase y futuros repositorios.

Las pantallas no consultarán Supabase directamente.

## Backend de Supabase

Las migraciones SQL están en supabase/migrations. Deben ejecutarse en orden desde el SQL Editor de Supabase o mediante Supabase CLI antes de usar cada módulo.

La migración `202610040001_posts.sql` crea las publicaciones y el bucket público `post-images`.

La migración `202610040002_likes_and_comments.sql` añade Me gusta y comentarios.

La migración `202610040003_follow_request_response.sql` permite aceptar o rechazar solicitudes privadas.

La migración `202610040004_privacy_realtime.sql` protege contenido privado y activa comentarios en tiempo real.

Las imágenes remotas pasan por un caché LRU controlado de memoria y disco en `src/data/local/imageCache.ts`.

La migración `202610040005_direct_messages.sql` añade conversaciones privadas, mensajes, estados de lectura y escritura en tiempo real.

La migración `202610040006_stories.sql` añade historias que dejan de mostrarse después de 24 horas.

La migración `202610060002_threaded_comments_and_inbox.sql` añade hilos de
comentarios, refuerza sus políticas y optimiza la bandeja de mensajes.

La guía de pruebas y preguntas para la sustentación está en
`docs/DEFENSA_TECNICA.md`.
