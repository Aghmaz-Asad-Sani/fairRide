import { INestApplication, RequestMethod } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { KnowledgeBaseController } from '../src/modules/knowledge-base/knowledge-base.controller';

describe('Project knowledge base page (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [KnowledgeBaseController],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1', {
      exclude: [{ path: 'knowledge-base', method: RequestMethod.GET }],
    });
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves the bilingual stakeholder and technical guide outside the API prefix', async () => {
    const response = await request(app.getHttpServer() as App)
      .get('/knowledge-base')
      .expect(200)
      .expect('Content-Type', /text\/html/);
    expect(response.text).toContain('data-audience="business"');
    expect(response.text).toContain('data-audience="technical"');
    expect(response.text).toContain('data-language="ur"');
    expect(response.text).toContain('Safepay gateway');
    expect(response.text).toContain('Socket.IO');
    expect(response.text).toContain('/api/docs');
  });
});
