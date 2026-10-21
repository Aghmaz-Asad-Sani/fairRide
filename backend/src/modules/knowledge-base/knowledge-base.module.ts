import { Module } from '@nestjs/common';
import { KnowledgeBaseController } from './knowledge-base.controller';

@Module({
  controllers: [KnowledgeBaseController],
})
export class KnowledgeBaseModule {}
