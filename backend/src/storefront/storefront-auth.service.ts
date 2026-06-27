import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterCustomerDto } from './dto/register-customer.dto';
import { LoginCustomerDto } from './dto/login-customer.dto';
import { RefreshCustomerDto } from './dto/refresh-customer.dto';
import type { Customer } from '@prisma/client';

interface CustomerJwtPayload {
  sub: string;
  phone: string;
  role: 'customer';
}

type PublicCustomer = Omit<Customer, 'passwordHash'>;

@Injectable()
export class StorefrontAuthService {
  private readonly logger = new Logger(StorefrontAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /** Đăng ký tài khoản khách hàng từ storefront. */
  async register(dto: RegisterCustomerDto) {
    const existing = await this.prisma.customer.findUnique({
      where: { phone: dto.phone },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('Số điện thoại đã được đăng ký');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const customer = await this.prisma.customer.create({
      data: {
        name: dto.name,
        phone: dto.phone,
        passwordHash,
        source: 'STOREFRONT',
        group: 'REGULAR',
      },
    });

    this.logger.log(`Khách hàng đăng ký mới: ${customer.phone}`);
    return this.buildAuthResponse(customer);
  }

  /** Đăng nhập khách hàng storefront (chỉ chấp nhận source=STOREFRONT có mật khẩu). */
  async login(dto: LoginCustomerDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { phone: dto.phone },
    });

    const isValid =
      customer &&
      customer.source === 'STOREFRONT' &&
      customer.passwordHash &&
      (await bcrypt.compare(dto.password, customer.passwordHash));

    if (!isValid || !customer) {
      // Thông báo chung để không rò rỉ SĐT có tồn tại hay không.
      throw new UnauthorizedException('Số điện thoại hoặc mật khẩu không đúng');
    }

    return this.buildAuthResponse(customer);
  }

  /** Làm mới access token từ refresh token. */
  async refresh(dto: RefreshCustomerDto) {
    try {
      const payload = this.jwtService.verify<CustomerJwtPayload>(
        dto.refreshToken,
        { secret: this.configService.get<string>('CUSTOMER_JWT_SECRET') },
      );
      const accessToken = this.generateAccessToken({
        sub: payload.sub,
        phone: payload.phone,
        role: 'customer',
      });
      return { accessToken };
    } catch {
      throw new UnauthorizedException(
        'Phiên đăng nhập không hợp lệ hoặc đã hết hạn',
      );
    }
  }

  /** Lấy profile khách (không trả passwordHash). */
  async getProfile(customerId: string): Promise<PublicCustomer> {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
    });
    if (!customer) {
      throw new UnauthorizedException('Tài khoản không tồn tại');
    }
    return this.stripPassword(customer);
  }

  private async buildAuthResponse(customer: Customer) {
    const payload: CustomerJwtPayload = {
      sub: customer.id,
      phone: customer.phone,
      role: 'customer',
    };
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
      customer: this.stripPassword(customer),
    };
  }

  private generateAccessToken(payload: CustomerJwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('CUSTOMER_JWT_SECRET'),
      expiresIn: '15m',
    });
  }

  private generateRefreshToken(payload: CustomerJwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('CUSTOMER_JWT_SECRET'),
      expiresIn: '7d',
    });
  }

  private stripPassword(customer: Customer): PublicCustomer {
    const { passwordHash: _removed, ...publicCustomer } = customer;
    return publicCustomer;
  }
}
