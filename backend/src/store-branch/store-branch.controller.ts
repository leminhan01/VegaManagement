import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { StoreBranchService } from './store-branch.service';
import { CreateStoreBranchDto, UpdateStoreBranchDto } from './dto/store-branch.dto';

@Controller('store-branches')
export class StoreBranchController {
  constructor(private readonly storeBranchService: StoreBranchService) {}

  @Get()
  findAll(@Query('isActive') isActive?: string) {
    const active = isActive === 'true' ? true : isActive === 'false' ? false : undefined;
    return this.storeBranchService.findAll(active);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.storeBranchService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateStoreBranchDto) {
    return this.storeBranchService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateStoreBranchDto) {
    return this.storeBranchService.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.storeBranchService.remove(id);
  }

  @Patch(':id/toggle')
  toggleActive(@Param('id') id: string) {
    return this.storeBranchService.toggleActive(id);
  }
}
