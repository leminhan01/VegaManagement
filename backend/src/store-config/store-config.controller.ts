import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
} from '@nestjs/common';
import { StoreConfigService } from './store-config.service';
import { Public } from '../common/decorators/public.decorator';

@Public()
@Controller('store-config')
export class StoreConfigController {
  constructor(private readonly storeConfigService: StoreConfigService) {}

  @Get()
  getAll() {
    return this.storeConfigService.getAll();
  }

  @Get(':key')
  getByKey(@Param('key') key: string) {
    return this.storeConfigService.getByKey(key);
  }

  @Post()
  create(
    @Body() body: { key: string; value: string; label?: string },
  ) {
    return this.storeConfigService.upsert(body.key, body.value, body.label);
  }

  @Put(':key')
  update(
    @Param('key') key: string,
    @Body() body: { value: string; label?: string },
  ) {
    return this.storeConfigService.upsert(key, body.value, body.label);
  }

  @Delete(':key')
  remove(@Param('key') key: string) {
    return this.storeConfigService.remove(key);
  }
}
