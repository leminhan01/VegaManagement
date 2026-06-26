import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStoreBranchDto, UpdateStoreBranchDto } from './dto/store-branch.dto';

@Injectable()
export class StoreBranchService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(isActive?: boolean) {
    const where: Record<string, unknown> = {};
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    return this.prisma.storeBranch.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async findOne(id: string) {
    const branch = await this.prisma.storeBranch.findUnique({ where: { id } });
    if (!branch) {
      throw new NotFoundException(`Không tìm thấy chi nhánh với ID "${id}"`);
    }
    return branch;
  }

  async create(dto: CreateStoreBranchDto) {
    return this.prisma.storeBranch.create({
      data: {
        name: dto.name,
        address: dto.address,
        phone: dto.phone,
        email: dto.email,
        openHours: dto.openHours as any ?? undefined,
        latitude: dto.latitude,
        longitude: dto.longitude,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async update(id: string, dto: UpdateStoreBranchDto) {
    await this.findOne(id);

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.address !== undefined) data.address = dto.address;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.openHours !== undefined) data.openHours = dto.openHours;
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) data.sortOrder = dto.sortOrder;

    return this.prisma.storeBranch.update({
      where: { id },
      data,
    });
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.storeBranch.delete({ where: { id } });
  }

  async toggleActive(id: string) {
    const branch = await this.findOne(id);
    return this.prisma.storeBranch.update({
      where: { id },
      data: { isActive: !branch.isActive },
    });
  }
}
