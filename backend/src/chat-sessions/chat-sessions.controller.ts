import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { ChatSessionsService } from './chat-sessions.service';
import { FilterSessionsDto } from './dto/filter-sessions.dto';

@Controller('chat-sessions')
@ApiBearerAuth('access_token')
export class ChatSessionsController {
  constructor(private readonly chatSessionsService: ChatSessionsService) {}

  @Get()
  findAll(@Query() filter: FilterSessionsDto) {
    return this.chatSessionsService.findAll(filter);
  }

  @Get('stats')
  getStats() {
    return this.chatSessionsService.getStats();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.chatSessionsService.findOne(id);
  }
}
