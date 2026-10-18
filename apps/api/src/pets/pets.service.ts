import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { dateInElSalvador, formatDateOnly, parseDateOnly } from '../common/time/calendar.js';
import { FilesService } from '../files/files.service.js';
import {
  FilePurpose,
  type File,
  type Pet,
  type PetCareNeed,
  Prisma,
  type Species,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CARE_TASK_GROUPS, CARE_TASK_LABELS, canBeOpenEnded } from './care-tasks.js';
import type {
  CareNeedRequest,
  CareNeedResponse,
  PetDetail,
  PetRequest,
  PetResponse,
  VaccinationRequest,
  VaccinationResponse,
  VetInstructionRequest,
  VetInstructionResponse,
} from './pets.dto.js';

const PET_INCLUDE = { species: true, photoFile: true } satisfies Prisma.PetInclude;
const DETAIL_INCLUDE = {
  ...PET_INCLUDE,
  vaccinations: { include: { file: true }, orderBy: { administeredOn: 'desc' } },
  vetInstructions: { include: { file: true }, orderBy: { issuedOn: 'desc' } },
  careNeeds: { orderBy: { startsOn: 'asc' } },
} satisfies Prisma.PetInclude;

type PetWithPhoto = Pet & { species: Species; photoFile: File | null };
type PetWithDetail = Prisma.PetGetPayload<{ include: typeof DETAIL_INCLUDE }>;

/** An owner's pets and what the caregiver needs to know about them (RN-MAS). */
@Injectable()
export class PetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly files: FilesService,
  ) {}

  async list(ownerId: string): Promise<PetResponse[]> {
    const pets = await this.prisma.pet.findMany({
      where: { ownerId, archivedAt: null },
      include: PET_INCLUDE,
      orderBy: { createdAt: 'asc' },
    });
    return Promise.all(pets.map((pet) => this.toResponse(pet)));
  }

  async get(ownerId: string, petId: string): Promise<PetDetail> {
    await this.findOwnPet(ownerId, petId);
    return this.detail(petId);
  }

  async create(ownerId: string, body: PetRequest): Promise<PetDetail> {
    const pet = await this.prisma.pet.create({
      data: { ownerId, ...(await this.petData(ownerId, body)) },
    });
    return this.detail(pet.id);
  }

  /** Replaces every field: optional fields left out are cleared. */
  async replace(ownerId: string, petId: string, body: PetRequest): Promise<PetDetail> {
    await this.findOwnPet(ownerId, petId);
    await this.prisma.pet.update({
      where: { id: petId },
      data: await this.petData(ownerId, body),
    });
    return this.detail(petId);
  }

  /** Archived pets keep their history but disappear from the app and can't be booked. */
  async archive(ownerId: string, petId: string): Promise<void> {
    await this.findOwnPet(ownerId, petId);
    await this.prisma.pet.update({ where: { id: petId }, data: { archivedAt: new Date() } });
  }

  async addVaccination(
    ownerId: string,
    petId: string,
    { name, administeredOn, nextDueOn, fileId }: VaccinationRequest,
  ): Promise<VaccinationResponse> {
    await this.findOwnPet(ownerId, petId);
    const administered = parseDateOnly(administeredOn);
    const nextDue = nextDueOn === undefined ? null : parseDateOnly(nextDueOn);
    if (administered > today()) {
      throw invalidDates('La fecha de la vacuna no puede ser futura.');
    }
    if (nextDue && nextDue <= administered) {
      throw invalidDates('La próxima dosis tiene que ser después de la que ya le pusieron.');
    }
    const file =
      fileId === undefined
        ? null
        : await this.files.requireUploaded(ownerId, fileId, FilePurpose.VACCINATION_RECORD);

    const vaccination = await this.prisma.petVaccination.create({
      data: { petId, name, administeredOn: administered, nextDueOn: nextDue, fileId: file?.id },
      include: { file: true },
    });
    return this.toVaccination(vaccination);
  }

  async removeVaccination(ownerId: string, petId: string, vaccinationId: string): Promise<void> {
    await this.findOwnPet(ownerId, petId);
    const { count } = await this.prisma.petVaccination.deleteMany({
      where: { id: vaccinationId, petId },
    });
    if (count === 0) {
      throw notFound('VACCINATION_NOT_FOUND', 'No encontramos esa vacuna.');
    }
  }

  /** RN-MAS-08 */
  async addVetInstruction(
    ownerId: string,
    petId: string,
    { fileId, issuedOn, vetName, notes }: VetInstructionRequest,
  ): Promise<VetInstructionResponse> {
    await this.findOwnPet(ownerId, petId);
    const issued = parseDateOnly(issuedOn);
    if (issued > today()) {
      throw invalidDates('La fecha de las indicaciones no puede ser futura.');
    }
    const file = await this.files.requireUploaded(ownerId, fileId, FilePurpose.VET_INSTRUCTION);

    const instruction = await this.prisma.vetInstruction.create({
      data: { petId, fileId: file.id, issuedOn: issued, vetName, notes },
      include: { file: true },
    });
    return this.toVetInstruction(instruction);
  }

  /** Instructions that a care need or a booking points to stay. */
  async removeVetInstruction(
    ownerId: string,
    petId: string,
    vetInstructionId: string,
  ): Promise<void> {
    await this.findOwnPet(ownerId, petId);
    try {
      const { count } = await this.prisma.vetInstruction.deleteMany({
        where: { id: vetInstructionId, petId },
      });
      if (count === 0) {
        throw notFound('VET_INSTRUCTION_NOT_FOUND', 'No encontramos esas indicaciones.');
      }
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new ConflictException({
          errorCode: 'VET_INSTRUCTION_IN_USE',
          message:
            'Estas indicaciones respaldan una tarea de cuidado o una reserva. Cambia o borra primero la tarea.',
        });
      }
      throw error;
    }
  }

  async addCareNeed(
    ownerId: string,
    petId: string,
    body: CareNeedRequest,
  ): Promise<CareNeedResponse> {
    await this.findOwnPet(ownerId, petId);
    const need = await this.prisma.petCareNeed.create({
      data: { petId, ...(await this.careNeedData(petId, body)) },
    });
    return toCareNeed(need);
  }

  async replaceCareNeed(
    ownerId: string,
    petId: string,
    careNeedId: string,
    body: CareNeedRequest,
  ): Promise<CareNeedResponse> {
    await this.findOwnPet(ownerId, petId);
    await this.findOwnCareNeed(petId, careNeedId);
    const need = await this.prisma.petCareNeed.update({
      where: { id: careNeedId },
      data: await this.careNeedData(petId, body),
    });
    return toCareNeed(need);
  }

  async removeCareNeed(ownerId: string, petId: string, careNeedId: string): Promise<void> {
    await this.findOwnPet(ownerId, petId);
    await this.findOwnCareNeed(petId, careNeedId);
    await this.prisma.petCareNeed.delete({ where: { id: careNeedId } });
  }

  /**
   * The owner's pets for a search or a booking, with their care needs. Fails if any of
   * them isn't the owner's or is archived.
   */
  async findForBooking(ownerId: string, petIds: readonly string[]) {
    const pets = await this.prisma.pet.findMany({
      where: { id: { in: [...petIds] }, ownerId, archivedAt: null },
      include: { careNeeds: true },
    });
    if (pets.length !== new Set(petIds).size) {
      throw petNotFound();
    }
    return pets;
  }

  private async petData(ownerId: string, body: PetRequest) {
    const species = await this.prisma.species.findUnique({ where: { id: body.speciesId } });
    if (!species) {
      throw new UnprocessableEntityException({
        errorCode: 'UNKNOWN_SPECIES',
        message: 'Elige una especie de la lista.',
      });
    }
    const birthDate = parseDateOnly(body.birthDate);
    if (birthDate > today()) {
      throw invalidDates('La fecha de nacimiento no puede ser futura.');
    }
    const photo =
      body.photoFileId === undefined
        ? null
        : await this.files.requireUploaded(ownerId, body.photoFileId, FilePurpose.PET_PHOTO);

    return {
      name: body.name,
      speciesId: species.id,
      breed: body.breed ?? null,
      birthDate,
      birthDateIsApproximate: body.birthDateIsApproximate ?? false,
      sex: body.sex,
      weightGrams: body.weightGrams ?? null,
      isSterilized: body.isSterilized ?? null,
      temperament: body.temperament ?? null,
      handlingNotes: body.handlingNotes ?? null,
      vetName: body.vetName ?? null,
      vetClinic: body.vetClinic ?? null,
      vetPhone: body.vetPhone ?? null,
      healthConditions: body.healthConditions ?? null,
      medications: body.medications ?? null,
      photoFileId: photo?.id ?? null,
    };
  }

  /**
   * RN-MAS-08 and RN-MAS-09, with clear errors before the database's CHECK constraints
   * get to say no.
   */
  private async careNeedData(petId: string, body: CareNeedRequest) {
    const label = CARE_TASK_LABELS[body.task];
    const group = CARE_TASK_GROUPS[body.task];
    const startsOn = parseDateOnly(body.startsOn);
    const endsOn = body.endsOn === undefined ? null : parseDateOnly(body.endsOn);

    if (endsOn && endsOn < startsOn) {
      throw invalidDates('La fecha de fin no puede ser antes del inicio.');
    }
    if (!endsOn && !canBeOpenEnded(body.task)) {
      throw new UnprocessableEntityException({
        errorCode: 'END_DATE_REQUIRED',
        message: `Indica hasta qué día hay que ${label}.`,
      });
    }
    if (group === 'CLINICAL' && body.vetInstructionId === undefined) {
      throw new UnprocessableEntityException({
        errorCode: 'VET_INSTRUCTIONS_REQUIRED',
        message: `Para ${label} hacen falta las indicaciones escritas del veterinario.`,
      });
    }
    if (group === 'ASSISTANCE' && !body.ownerInstructions) {
      throw new UnprocessableEntityException({
        errorCode: 'OWNER_INSTRUCTIONS_REQUIRED',
        message: `Escribe cómo hay que ${label}.`,
      });
    }
    if (body.vetInstructionId !== undefined) {
      const instruction = await this.prisma.vetInstruction.findFirst({
        where: { id: body.vetInstructionId, petId },
      });
      if (!instruction) {
        throw notFound('VET_INSTRUCTION_NOT_FOUND', 'No encontramos esas indicaciones.');
      }
    }

    return {
      task: body.task,
      startsOn,
      endsOn,
      vetInstructionId: body.vetInstructionId ?? null,
      ownerInstructions: body.ownerInstructions || null,
    };
  }

  private async findOwnPet(ownerId: string, petId: string): Promise<Pet> {
    const pet = await this.prisma.pet.findFirst({
      where: { id: petId, ownerId, archivedAt: null },
    });
    if (!pet) {
      throw petNotFound();
    }
    return pet;
  }

  private async findOwnCareNeed(petId: string, careNeedId: string): Promise<PetCareNeed> {
    const need = await this.prisma.petCareNeed.findFirst({ where: { id: careNeedId, petId } });
    if (!need) {
      throw notFound('CARE_NEED_NOT_FOUND', 'No encontramos esa tarea de cuidado.');
    }
    return need;
  }

  private async detail(petId: string): Promise<PetDetail> {
    const pet: PetWithDetail = await this.prisma.pet.findUniqueOrThrow({
      where: { id: petId },
      include: DETAIL_INCLUDE,
    });
    return Object.assign(await this.toResponse(pet), {
      vaccinations: await Promise.all(pet.vaccinations.map((item) => this.toVaccination(item))),
      vetInstructions: await Promise.all(
        pet.vetInstructions.map((item) => this.toVetInstruction(item)),
      ),
      careNeeds: pet.careNeeds.map(toCareNeed),
    });
  }

  private async toResponse(pet: PetWithPhoto): Promise<PetResponse> {
    return {
      id: pet.id,
      name: pet.name,
      species: { id: pet.species.id, code: pet.species.code, name: pet.species.name },
      breed: pet.breed,
      birthDate: formatDateOnly(pet.birthDate),
      birthDateIsApproximate: pet.birthDateIsApproximate,
      sex: pet.sex,
      weightGrams: pet.weightGrams,
      isSterilized: pet.isSterilized,
      temperament: pet.temperament,
      handlingNotes: pet.handlingNotes,
      vetName: pet.vetName,
      vetClinic: pet.vetClinic,
      vetPhone: pet.vetPhone,
      healthConditions: pet.healthConditions,
      medications: pet.medications,
      photoFileId: pet.photoFileId,
      photoUrl: await this.files.downloadUrl(pet.photoFile),
    };
  }

  private async toVaccination(
    vaccination: PetWithDetail['vaccinations'][number],
  ): Promise<VaccinationResponse> {
    return {
      id: vaccination.id,
      name: vaccination.name,
      administeredOn: formatDateOnly(vaccination.administeredOn),
      nextDueOn: vaccination.nextDueOn ? formatDateOnly(vaccination.nextDueOn) : null,
      fileId: vaccination.fileId,
      fileUrl: await this.files.downloadUrl(vaccination.file),
    };
  }

  private async toVetInstruction(
    instruction: PetWithDetail['vetInstructions'][number],
  ): Promise<VetInstructionResponse> {
    return {
      id: instruction.id,
      issuedOn: formatDateOnly(instruction.issuedOn),
      vetName: instruction.vetName,
      notes: instruction.notes,
      fileId: instruction.fileId,
      fileUrl: await this.files.downloadUrl(instruction.file),
      contentType: instruction.file.contentType,
    };
  }
}

function toCareNeed(need: PetCareNeed): CareNeedResponse {
  return {
    id: need.id,
    task: need.task,
    group: CARE_TASK_GROUPS[need.task],
    startsOn: formatDateOnly(need.startsOn),
    endsOn: need.endsOn ? formatDateOnly(need.endsOn) : null,
    vetInstructionId: need.vetInstructionId,
    ownerInstructions: need.ownerInstructions,
  };
}

function today(): Date {
  return dateInElSalvador(new Date());
}

function notFound(errorCode: string, message: string): NotFoundException {
  return new NotFoundException({ errorCode, message });
}

export function petNotFound(): NotFoundException {
  return notFound('PET_NOT_FOUND', 'No encontramos esa mascota.');
}

function invalidDates(message: string): UnprocessableEntityException {
  return new UnprocessableEntityException({ errorCode: 'INVALID_DATES', message });
}
