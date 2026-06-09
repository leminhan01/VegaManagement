import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StoreConfigService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll() {
    return this.prisma.storeConfig.findMany({
      orderBy: { key: 'asc' },
    });
  }

  async getByKey(key: string) {
    const config = await this.prisma.storeConfig.findUnique({
      where: { key },
    });
    return config;
  }

  async upsert(key: string, value: string, label?: string) {
    return this.prisma.storeConfig.upsert({
      where: { key },
      update: { value, label },
      create: { key, value, label },
    });
  }

  async remove(key: string) {
    return this.prisma.storeConfig.delete({
      where: { key },
    });
  }
}
