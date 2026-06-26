import { Module } from '@nestjs/common';
import { StoreBranchController } from './store-branch.controller';
import { StoreBranchService } from './store-branch.service';

@Module({
  controllers: [StoreBranchController],
  providers: [StoreBranchService],
  exports: [StoreBranchService],
})
export class StoreBranchModule {}
