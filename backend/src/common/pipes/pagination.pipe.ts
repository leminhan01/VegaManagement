import { PipeTransform, Injectable } from '@nestjs/common';
import { getPaginationParams, PaginationParams } from '../utils/pagination.util';

/**
 * Pipe that transforms query parameters into typed PaginationParams.
 * Usage: @Query() new PaginationPipe()
 */
@Injectable()
export class PaginationPipe implements PipeTransform {
  transform(value: Record<string, unknown>): PaginationParams {
    return getPaginationParams(value);
  }
}
