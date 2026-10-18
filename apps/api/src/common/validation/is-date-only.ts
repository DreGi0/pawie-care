import { applyDecorators } from '@nestjs/common';
import { IsISO8601, Matches } from 'class-validator';

/** A calendar date as YYYY-MM-DD that exists (no February 30). Messages in Spanish. */
export function IsDateOnly(): PropertyDecorator {
  return applyDecorators(
    Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Escribe la fecha como AAAA-MM-DD.' }),
    IsISO8601({ strict: true }, { message: 'Esa fecha no existe.' }),
  );
}
