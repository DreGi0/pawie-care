import { z } from 'zod';

// Form errors in Spanish, also for the API's schemas from @pawie/api-client/zod. Zod's
// Spanish locale covers every case, but reads stiffly ("Inválido dirección de correo
// electrónico"), so the errors people meet most get our own wording.
export function configureZod(): void {
  z.config(z.locales.es());
  z.config({
    customError: (issue) => {
      if (issue.code === 'invalid_format' && issue.format === 'email') {
        return 'Escribe un correo válido, como tu@correo.com.';
      }
      if (issue.code === 'too_small' && issue.origin === 'string') {
        return Number(issue.minimum) <= 1
          ? 'Completa este campo.'
          : `Escribe al menos ${issue.minimum} caracteres.`;
      }
      if (issue.code === 'too_big' && issue.origin === 'string') {
        return `Escribe como máximo ${issue.maximum} caracteres.`;
      }
      return undefined;
    },
  });
}
