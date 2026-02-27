import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Express, RequestHandler } from 'express';
import config from '../config/index.js';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'Debate Platform API',
      version: '1.0.0',
      description: 'Production API documentation for Debate backend',
      contact: {
        name: 'API Support',
        email: 'support@debate.com',
      },
    },
    servers: [
      {
        url: config.app.apiUrl || 'http://localhost:3000',
        description: 'Development server',
      },
    ],
  },
  apis: ['./src/docs/openapi.yaml'],
};

const specs = swaggerJsdoc(options);

export function setupSwagger(app: Express, options?: { guard?: RequestHandler }): void {
  const guard = options?.guard;

  if (guard) {
    app.use('/api-docs', guard, swaggerUi.serve, swaggerUi.setup(specs, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Debate Platform API',
      swaggerOptions: {
        persistAuthorization: true,
      },
    }));
  } else {
    app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, {
      customCss: '.swagger-ui .topbar { display: none }',
      customSiteTitle: 'Debate Platform API',
      swaggerOptions: {
        persistAuthorization: true,
      },
    }));
  }

  if (guard) {
    app.get('/api-docs.json', guard, (_req, res) => {
      res.json(specs);
    });
    return;
  }

  app.get('/api-docs.json', (_req, res) => {
    res.json(specs);
  });
}
