# Fotos del seed

`pnpm db:seed` sube las imágenes de esta carpeta al bucket y se las asigna a los cuidadores y a las mascotas del dueño de demo. Usa imágenes genéricas o ilustraciones, no fotos de personas reales.

- **Cuidadores:** `caregivers/<parte del correo antes de la @>.<jpg|jpeg|png|webp>`. Por ejemplo, `caregivers/valeria.martinez.jpg`. Los correos están en [src/seed/caregivers.ts](../src/seed/caregivers.ts).
- **Mascotas del dueño de demo:** `pets/<nombre en minúsculas y sin tildes>.<jpg|jpeg|png|webp>`: `pets/toby.jpg`, `pets/nala.jpg` y `pets/rocky.jpg`.

Si falta una imagen, ese cuidador o esa mascota queda sin foto. Puedes correr el seed las veces que quieras: cada imagen reemplaza la anterior del mismo nombre.
