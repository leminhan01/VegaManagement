import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboardStats() {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

    // Lấy ngày đầu tuần (Thứ Hai) và ngày cuối tuần (Chủ Nhật)
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + mondayOffset);
    weekStart.setHours(0, 0, 0, 0);

    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Chạy tất cả query song song
    const [
      currentRevenue,
      previousRevenue,
      totalOrders,
      thisMonthOrders,
      lowStockProducts,
      newCustomers,
      weekOrders,
      recentOrders,
    ] = await Promise.all([
      // Doanh thu tháng này (đơn DELIVERED)
      this.prisma.order.aggregate({
        _sum: { finalAmount: true },
        where: {
          status: 'DELIVERED',
          createdAt: { gte: thisMonthStart, lte: now },
        },
      }),
      // Doanh thu tháng trước
      this.prisma.order.aggregate({
        _sum: { finalAmount: true },
        where: {
          status: 'DELIVERED',
          createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
        },
      }),
      // Tổng đơn hàng
      this.prisma.order.count(),
      // Đơn hàng tháng này
      this.prisma.order.count({
        where: { createdAt: { gte: thisMonthStart, lte: now } },
      }),
      // Sản phẩm tồn kho thấp (stock <= minStock)
      this.prisma.$queryRaw<Array<{ id: string; name: string; stock: number; minStock: number; categoryName: string }>>`
        SELECT p.id, p.name, p.stock, p."minStock", c.name as "categoryName"
        FROM "Product" p
        LEFT JOIN "Category" c ON p."categoryId" = c.id
        WHERE p."isActive" = true AND p.stock <= p."minStock"
        ORDER BY p.stock ASC
        LIMIT 5
      `,
      // Khách hàng mới tháng này
      this.prisma.customer.count({
        where: { createdAt: { gte: thisMonthStart, lte: now } },
      }),
      // Đơn DELIVERED trong tuần này (cho revenueByDay)
      this.prisma.order.findMany({
        where: {
          status: 'DELIVERED',
          createdAt: { gte: weekStart, lte: weekEnd },
        },
        select: { createdAt: true, finalAmount: true },
      }),
      // Đơn hàng gần nhất
      this.prisma.order.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true } },
        },
      }),
    ]);

    // Tính phần trăm thay đổi doanh thu
    const currentRevenueValue = currentRevenue._sum.finalAmount ?? 0;
    const previousRevenueValue = previousRevenue._sum.finalAmount ?? 0;
    const revenueChange =
      previousRevenueValue === 0
        ? (currentRevenueValue > 0 ? 100 : 0)
        : Math.round(
            ((currentRevenueValue - previousRevenueValue) / previousRevenueValue) * 100,
          );

    // Tính phần trăm thay đổi đơn hàng
    const lastMonthOrdersCount = await this.prisma.order.count({
      where: { createdAt: { gte: lastMonthStart, lte: lastMonthEnd } },
    });
    const orderChange =
      lastMonthOrdersCount === 0
        ? (thisMonthOrders > 0 ? 100 : 0)
        : Math.round(
            ((thisMonthOrders - lastMonthOrdersCount) / lastMonthOrdersCount) * 100,
          );

    // Tính doanh thu theo ngày trong tuần
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const dayMap: Record<string, number> = {};
    for (const name of dayNames) {
      dayMap[name] = 0;
    }

    for (const order of weekOrders) {
      const dayName = dayNames[order.createdAt.getDay()];
      dayMap[dayName] += order.finalAmount;
    }

    // Sắp xếp Mon-Sun
    const revenueByDay = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(
      (day) => ({
        day,
        revenue: dayMap[day],
      }),
    );

    return {
      revenue: {
        current: currentRevenueValue,
        previous: previousRevenueValue,
        change: revenueChange,
      },
      orders: {
        total: totalOrders,
        thisMonth: thisMonthOrders,
        change: orderChange,
      },
      lowStockProducts: lowStockProducts.map((p) => ({
        id: p.id,
        name: p.name,
        stock: p.stock,
        minStock: p.minStock,
        category: p.categoryName ?? null,
      })),
      newCustomers,
      revenueByDay,
      recentOrders: recentOrders.map((o) => ({
        id: o.id,
        orderCode: o.orderCode,
        customerName: o.customer.name,
        status: o.status,
        finalAmount: o.finalAmount,
        createdAt: o.createdAt,
      })),
    };
  }

  async getInventoryValueReport() {
    const products = await this.prisma.product.findMany({
      where: { isActive: true },
      select: {
        id: true,
        name: true,
        sku: true,
        stock: true,
        price: true,
        category: { select: { id: true, name: true } },
      },
      orderBy: { stock: 'desc' },
    });

    const byCategory = new Map<
      string,
      { categoryId: string | null; categoryName: string; stock: number; value: number }
    >();

    for (const product of products) {
      const key = product.category?.id ?? 'uncategorized';
      const current = byCategory.get(key) ?? {
        categoryId: product.category?.id ?? null,
        categoryName: product.category?.name ?? 'Chưa phân loại',
        stock: 0,
        value: 0,
      };
      current.stock += product.stock;
      current.value += product.stock * product.price;
      byCategory.set(key, current);
    }

    return {
      totalValue: products.reduce((sum, item) => sum + item.stock * item.price, 0),
      totalStock: products.reduce((sum, item) => sum + item.stock, 0),
      byCategory: Array.from(byCategory.values()).sort((a, b) => b.value - a.value),
      topProducts: products
        .map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          stock: product.stock,
          value: product.stock * product.price,
          category: product.category?.name ?? null,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10),
    };
  }

  async getExpirationReport(daysThreshold = 30) {
    const now = new Date();
    const threshold = new Date(now);
    threshold.setDate(now.getDate() + daysThreshold);

    const batches = await this.prisma.productBatch.findMany({
      where: {
        remainingQty: { gt: 0 },
        expirationDate: { not: null },
      },
      include: {
        product: { select: { id: true, name: true, sku: true, unit: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
      orderBy: { expirationDate: 'asc' },
    });

    const expired = batches.filter(
      (batch) => batch.expirationDate && batch.expirationDate < now,
    );
    const expiringSoon = batches.filter(
      (batch) =>
        batch.expirationDate &&
        batch.expirationDate >= now &&
        batch.expirationDate <= threshold,
    );

    return {
      daysThreshold,
      expiredCount: expired.length,
      expiringSoonCount: expiringSoon.length,
      expiredQuantity: expired.reduce((sum, batch) => sum + batch.remainingQty, 0),
      expiringSoonQuantity: expiringSoon.reduce(
        (sum, batch) => sum + batch.remainingQty,
        0,
      ),
      batches: [...expired, ...expiringSoon].map((batch) => ({
        ...batch,
        daysUntilExpiration: batch.expirationDate
          ? Math.ceil((batch.expirationDate.getTime() - now.getTime()) / 86400000)
          : null,
      })),
    };
  }

  async getStockMovementReport(days = 30) {
    const since = new Date();
    since.setDate(since.getDate() - days);

    const movements = await this.prisma.stockMovement.findMany({
      where: { createdAt: { gte: since } },
      include: {
        product: { select: { id: true, name: true, sku: true } },
        batch: { select: { id: true, batchCode: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    const byType = movements.reduce<Record<string, number>>((acc, movement) => {
      acc[movement.type] = (acc[movement.type] ?? 0) + movement.quantity;
      return acc;
    }, {});

    const byDay = new Map<string, { day: string; in: number; out: number; adjustment: number }>();
    for (const movement of movements) {
      const day = movement.createdAt.toISOString().slice(0, 10);
      const current = byDay.get(day) ?? { day, in: 0, out: 0, adjustment: 0 };
      if (movement.type === 'IN') current.in += movement.quantity;
      if (movement.type === 'OUT') current.out += movement.quantity;
      if (movement.type === 'ADJUSTMENT') current.adjustment += movement.quantity;
      byDay.set(day, current);
    }

    return {
      days,
      totalMovements: movements.length,
      byType,
      byDay: Array.from(byDay.values()),
      recentMovements: movements.slice(-20).reverse(),
    };
  }

  async getBatchReport() {
    const batches = await this.prisma.productBatch.findMany({
      include: {
        product: { select: { id: true, name: true, sku: true } },
        supplier: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true, code: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const byStatus = batches.reduce<Record<string, number>>((acc, batch) => {
      acc[batch.status] = (acc[batch.status] ?? 0) + 1;
      return acc;
    }, {});

    return {
      totalBatches: batches.length,
      activeQuantity: batches
        .filter((batch) => batch.status === 'ACTIVE')
        .reduce((sum, batch) => sum + batch.remainingQty, 0),
      consumedQuantity: batches.reduce(
        (sum, batch) => sum + (batch.initialQuantity - batch.remainingQty),
        0,
      ),
      byStatus,
      recentBatches: batches.slice(0, 20),
    };
  }

  async getAdvancedInventoryReport() {
    const [inventoryValue, expiration, movement, batch] = await Promise.all([
      this.getInventoryValueReport(),
      this.getExpirationReport(30),
      this.getStockMovementReport(30),
      this.getBatchReport(),
    ]);

    return {
      inventoryValue,
      expiration,
      movement,
      batch,
      generatedAt: new Date(),
    };
  }
}
