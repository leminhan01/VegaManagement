import { PartialType } from '@nestjs/mapped-types';
import { CreateEmailReportDto } from './create-email-report.dto';

export class UpdateEmailReportDto extends PartialType(CreateEmailReportDto) {}
