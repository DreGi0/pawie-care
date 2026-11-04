import type { CommandOutput } from '../settings/set-setting.command.js';
import { CaregiverStatus, type PrismaClient } from '../generated/prisma/client.js';
import { normalizeEmail } from '../users/users.service.js';
import { REQUIRED_DOCUMENTS } from './setup-steps.js';

const USAGE = `Uso: pnpm caregivers:approve <correo>

Aprueba el alta del cuidador de esa cuenta (RN-CUI-03). Antes revisa sus documentos en el
bucket: el DUI por los dos lados, la selfie y los antecedentes (RN-CUI-01).

Ejemplo: pnpm caregivers:approve maria@example.com`;

const DOCUMENT_NAMES = {
  ID_DOCUMENT_FRONT: 'DUI (frente)',
  ID_DOCUMENT_BACK: 'DUI (reverso)',
  SELFIE: 'selfie',
  BACKGROUND_CHECK: 'antecedentes',
} as const;

/**
 * `pnpm caregivers:approve`: an admin approves a caregiver's sign-up, which verifies
 * their identity and background (RN-CUI-03, RN-NIV-03). It needs every document
 * (RN-CUI-01), but not the welcome course: searches ask for the course on their own.
 * Returns the exit code. The messages are for the person running it, in Spanish.
 */
export async function approveCaregiverCommand(
  args: string[],
  prisma: PrismaClient,
  output: CommandOutput = console,
): Promise<number> {
  const [email, ...extra] = args;
  if (email === undefined || extra.length > 0 || email.startsWith('-')) {
    output.error(USAGE);
    return 1;
  }

  const profile = await prisma.caregiverProfile.findFirst({
    where: { user: { email: normalizeEmail(email) } },
    select: { userId: true, status: true, documents: { select: { kind: true } } },
  });
  if (!profile) {
    output.error(
      `${email} no tiene perfil de cuidador. Tiene que activar el modo cuidador en la app.`,
    );
    return 1;
  }
  if (profile.status === CaregiverStatus.APPROVED) {
    output.log(`${email} ya estaba aprobado.`);
    return 0;
  }

  const uploaded = new Set(profile.documents.map(({ kind }) => kind));
  const missing = REQUIRED_DOCUMENTS.filter((kind) => !uploaded.has(kind));
  if (missing.length > 0) {
    output.error(
      `${email} todavía no sube: ${missing.map((kind) => DOCUMENT_NAMES[kind]).join(', ')}.`,
    );
    return 1;
  }

  // Only from the status just read, so two runs at once approve it once.
  const { count } = await prisma.caregiverProfile.updateMany({
    where: { userId: profile.userId, status: profile.status },
    data: { status: CaregiverStatus.APPROVED },
  });
  output.log(
    count === 1
      ? `${email} quedó aprobado, con las insignias Identidad verificada y Antecedentes verificados.`
      : `${email} ya estaba aprobado.`,
  );
  return 0;
}
