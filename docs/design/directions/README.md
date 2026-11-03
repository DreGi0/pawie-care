# Etapa D: dirección Placas

Mockups de la dirección elegida para el nuevo design system, el 2026-11-02. Son HTML estático de 390 × 844, sin JS, y cada uno tiene su captura al lado (`.png`, a 2x). Se abren en el navegador; las fuentes vienen de Google Fonts.

Los mockups usan Atkinson Hyperlegible para el texto y ponen el agujero en todas las placas. La app usa Lexend y solo la placa del nivel lleva agujero: ver [docs/design/README.md](../README.md#design-system-placas).

Los tokens, los componentes y las reglas están en [docs/design/README.md](../README.md#design-system-placas). La app los usa desde la parte 2 de la etapa D.

| Pantalla                        | Mockup                                    | Captura                                 |
| ------------------------------- | ----------------------------------------- | --------------------------------------- |
| Main (buscar)                   | [main.html](placas/main.html)             | [main.png](placas/main.png)             |
| Perfil del cuidador             | [perfil.html](placas/perfil.html)         | [perfil.png](placas/perfil.png)         |
| CuiInicio (nivel y solicitudes) | [cui-inicio.html](placas/cui-inicio.html) | [cui-inicio.png](placas/cui-inicio.png) |

## Datos

- **Del seed:** Daniela busca una visita para Toby el martes 3 a las 4:00 p. m. en San Salvador. A esa hora salen 5 cuidadores, ordenados por calificación (RN-RES-10). El perfil es de Valeria (Súper Cuidador). CuiInicio es de Andrea, que es Confiable y tiene 14 servicios y ninguna certificación, así que le falta 1 servicio y 2 certificaciones para Pro (RN-NIV-02).
- **Precios del siguiente nivel (RN-CUI-17):** salen de los rangos de RN-PRE-01. El seed no tiene paseos, así que Main muestra visitas.
- **Fotos:** son ilustraciones planas de relleno, sin personas reales, hasta que existan las fotos del seed.

## Descartada: Bitácora

También se exploró "Bitácora", la app como el diario de la mascota: fondo blanco, Young Serif, fotos grandes y líneas de tiempo verticales, con bandas de color en lugar de tarjetas. Se eligió Placas por dos razones: sus placas muestran el diferencial de Pawie, que son los cuidadores verificados con nivel, y sus colores de servicio sirven también en la agenda, las solicitudes y los precios. La línea de tiempo vertical queda como idea para el seguimiento del servicio (etapa 10).
