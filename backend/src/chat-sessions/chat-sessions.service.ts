import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FilterSessionsDto } from './dto/filter-sessions.dto';
import {
  getPaginationParams,
  createPaginatedResult,
  PaginationParams,
} from '../common/utils/pagination.util';

@Injectable()
export class ChatSessionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filter: FilterSessionsDto) {
    const { page, limit } = getPaginationParams(filter);

    const where: Record<string, unknown> = {};
    if (filter.platform) where.platform = filter.platform;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;

    const [data, total] = await Promise.all([
      this.prisma.chatSession.findMany({
        where,
        include: {
          customer: {
            select: { name: true, phone: true },
          },
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.chatSession.count({ where }),
    ]);

    const params: PaginationParams = { page, limit, sort: 'updatedAt', order: 'desc' };
    return createPaginatedResult(data, total, params);
  }

  async findOne(id: string) {
    return this.prisma.chatSession.findUnique({
      where: { id },
      include: {
        customer: true,
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });
  }

  async getStats() {
    const [totalSessions, activeSessions, totalMessages, zaloCount, messengerCount] =
      await Promise.all([
        this.prisma.chatSession.count(),
        this.prisma.chatSession.count({ where: { isActive: true } }),
        this.prisma.chatMessage.count(),
        this.prisma.chatSession.count({ where: { platform: 'ZALO' } }),
        this.prisma.chatSession.count({ where: { platform: 'MESSENGER' } }),
      ]);

    return {
      totalSessions,
      activeSessions,
      totalMessages,
      byPlatform: {
        ZALO: zaloCount,
        MESSENGER: messengerCount,
      },
    };
  }
}
