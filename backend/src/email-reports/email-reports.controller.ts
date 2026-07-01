import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { EmailReportsService } from './email-reports.service';
import { CreateEmailReportDto } from './dto/create-email-report.dto';
import { UpdateEmailReportDto } from './dto/update-email-report.dto';

@ApiTags('email-reports')
@ApiBearerAuth('access_token')
@Controller('email-reports')
export class EmailReportsController {
  constructor(private readonly emailReportsService: EmailReportsService) {}

  @Get()
  findAll() {
    return this.emailReportsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.emailReportsService.findOne(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreateEmailReportDto) {
    return this.emailReportsService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEmailReportDto) {
    return this.emailReportsService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string) {
    return this.emailReportsService.remove(id);
  }

  @Patch(':id/toggle')
  toggle(@Param('id') id: string) {
    return this.emailReportsService.toggle(id);
  }

  @Post(':id/send-now')
  sendNow(@Param('id') id: string) {
    return this.emailReportsService.sendNow(id);
  }
}
