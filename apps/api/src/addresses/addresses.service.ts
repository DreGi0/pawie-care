import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import type { Address, District } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import type { AddressRequest, AddressResponse } from './addresses.dto.js';

/**
 * The owner's addresses. A booking keeps a copy of the one it uses (RN-CTA-04), so
 * editing or deleting an address never changes a booking.
 */
@Injectable()
export class AddressesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string): Promise<AddressResponse[]> {
    const addresses = await this.prisma.address.findMany({
      where: { userId },
      include: { district: true },
      orderBy: { createdAt: 'asc' },
    });
    return addresses.map(toResponse);
  }

  async create(userId: string, body: AddressRequest): Promise<AddressResponse> {
    const address = await this.prisma.address.create({
      data: { userId, ...(await this.addressData(body)) },
      include: { district: true },
    });
    return toResponse(address);
  }

  /** Replaces every field: leaving out the details clears them. */
  async replace(userId: string, addressId: string, body: AddressRequest): Promise<AddressResponse> {
    await this.findOwn(userId, addressId);
    const address = await this.prisma.address.update({
      where: { id: addressId },
      data: await this.addressData(body),
      include: { district: true },
    });
    return toResponse(address);
  }

  async remove(userId: string, addressId: string): Promise<void> {
    await this.findOwn(userId, addressId);
    await this.prisma.address.delete({ where: { id: addressId } });
  }

  /** One of the user's addresses, with its district. */
  async findOwn(userId: string, addressId: string): Promise<Address & { district: District }> {
    const address = await this.prisma.address.findFirst({
      where: { id: addressId, userId },
      include: { district: true },
    });
    if (!address) {
      throw new NotFoundException({
        errorCode: 'ADDRESS_NOT_FOUND',
        message: 'No encontramos esa dirección.',
      });
    }
    return address;
  }

  private async addressData({ label, street, details, districtId }: AddressRequest) {
    const district = await this.prisma.district.findUnique({ where: { id: districtId } });
    if (!district) {
      throw new UnprocessableEntityException({
        errorCode: 'UNKNOWN_DISTRICT',
        message: 'Elige un distrito de la lista.',
      });
    }
    return { label, street, details: details || null, districtId: district.id };
  }
}

function toResponse(address: Address & { district: District }): AddressResponse {
  return {
    id: address.id,
    label: address.label,
    street: address.street,
    details: address.details,
    district: {
      id: address.district.id,
      slug: address.district.slug,
      name: address.district.name,
    },
  };
}
