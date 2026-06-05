import {
  Injectable,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

interface JwtPayload {
  sub: string;
  username: string;
  role: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validate admin credentials against database
   */
  async validateUser(username: string, password: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { username },
    });

    if (!admin) {
      return null;
    }

    const isPasswordValid = await bcrypt.compare(password, admin.passwordHash);
    if (!isPasswordValid) {
      return null;
    }

    // Return admin data without passwordHash
    const { passwordHash: _, ...result } = admin;
    return result;
  }

  /**
   * Login: generate access token (15min) + refresh token (7d)
   */
  async login(loginDto: LoginDto) {
    const user = await this.validateUser(loginDto.username, loginDto.password);

    if (!user) {
      throw new UnauthorizedException('Tên đăng nhập hoặc mật khẩu không hợp lệ');
    }

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };

    const accessToken = this.generateAccessToken(payload);
    const refreshToken = this.generateRefreshToken(payload);

    this.logger.log(`Admin "${user.username}" đăng nhập thành công`);

    return {
      accessToken,
      refreshToken,
      user,
    };
  }

  /**
   * Refresh token: verify refresh token and issue new access token
   */
  async refreshToken(refreshTokenDto: RefreshTokenDto) {
    try {
      const payload = this.jwtService.verify<JwtPayload>(
        refreshTokenDto.refreshToken,
        {
          secret: this.configService.get<string>('JWT_SECRET'),
        },
      );

      const newPayload: JwtPayload = {
        sub: payload.sub,
        username: payload.username,
        role: payload.role,
      };

      const accessToken = this.generateAccessToken(newPayload);

      return { accessToken };
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ hoặc đã hết hạn');
    }
  }

  private generateAccessToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '15m',
    });
  }

  private generateRefreshToken(payload: JwtPayload): string {
    return this.jwtService.sign(payload, {
      secret: this.configService.get<string>('JWT_SECRET'),
      expiresIn: '7d',
    });
  }
}
