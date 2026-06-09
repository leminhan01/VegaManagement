import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth } from '@nestjs/swagger';
import { createHash } from 'crypto';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { FilterProductsDto } from './dto/filter-products.dto';
import { UpdateStockDto } from './dto/update-stock.dto';

type UploadedProductImage = {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
};

type CloudinaryUploadResponse = {
  secure_url?: string;
  public_id?: string;
  width?: number;
  height?: number;
  format?: string;
  error?: { message?: string };
};

@Controller('products')
@ApiBearerAuth('access_token')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  findAll(@Query() filter: FilterProductsDto) {
    return this.productsService.findAll(filter);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.productsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Post('upload-image')
  @UseInterceptors(FileInterceptor('file'))
  async uploadImage(@UploadedFile() file?: UploadedProductImage) {
    if (!file) {
      throw new BadRequestException('Vui lòng chọn ảnh sản phẩm');
    }

    if (!file.mimetype.startsWith('image/')) {
      throw new BadRequestException('File tải lên phải là hình ảnh');
    }

    const cloudinaryUrl = process.env.CLOUDINARY_URL;
    if (!cloudinaryUrl) {
      throw new BadRequestException('Chưa cấu hình CLOUDINARY_URL');
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(cloudinaryUrl);
    } catch {
      throw new BadRequestException('CLOUDINARY_URL không hợp lệ');
    }

    const cloudName = parsedUrl.hostname;
    const apiKey = parsedUrl.username;
    const apiSecret = parsedUrl.password;
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'vegiflow/products';
    const signature = createHash('sha1')
      .update(`folder=${folder}&timestamp=${timestamp}${apiSecret}`)
      .digest('hex');

    const formData = new FormData();
    formData.append(
      'file',
      `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
    );
    formData.append('api_key', apiKey);
    formData.append('timestamp', String(timestamp));
    formData.append('folder', folder);
    formData.append('signature', signature);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: formData,
      },
    );
    const data = (await res.json()) as CloudinaryUploadResponse;

    if (!res.ok || !data.secure_url) {
      throw new BadRequestException(
        data.error?.message || 'Không tải được ảnh lên Cloudinary',
      );
    }

    return {
      url: data.secure_url,
      publicId: data.public_id,
      width: data.width,
      height: data.height,
      format: data.format,
    };
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Patch(':id/stock')
  updateStock(@Param('id') id: string, @Body() dto: UpdateStockDto) {
    return this.productsService.updateStock(id, dto.stock);
  }
}
