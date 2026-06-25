import { readFileSync } from 'fs';
import { join } from 'path';
import type { SwaggerCustomOptions } from '@nestjs/swagger';

const SWAGGER_UI_KO_JS = readFileSync(
  join(__dirname, 'swagger-ui-ko.js'),
  'utf8',
);

const SWAGGER_UI_CSS = `
  .swagger-ui .topbar { display: none; }
  .swagger-ui .information-container.wrapper { padding: 16px 0 8px; }
  .swagger-ui .info .title { font-size: 1.35rem; font-weight: 600; }
  .swagger-ui .info .description { font-size: 0.9rem; line-height: 1.5; max-width: 52rem; }
  .swagger-ui .info .description p { margin: 0.35em 0; }
  .swagger-ui section.models { display: none !important; }
  .swagger-ui .opblock-tag { border-bottom: 1px solid #2a2a2a; margin: 0; }
  .swagger-ui .opblock-tag small { font-size: 0.8rem; opacity: 0.75; }
  .swagger-ui .opblock { margin: 0 0 8px; border-radius: 6px; box-shadow: none; }
  .swagger-ui .opblock .opblock-summary { padding: 8px 12px; }
  .swagger-ui .opblock-body { padding: 8px 12px 12px; }
  .swagger-ui table tbody tr td:first-of-type { max-width: 9rem; }
  .swagger-ui .btn { border-radius: 4px; }
  .swagger-ui .parameters-col_description input[type=text] { max-width: 100%; }
`;

export const swaggerUiOptions: SwaggerCustomOptions = {
  customSiteTitle: 'Tokenable API 문서',
  customCss: SWAGGER_UI_CSS,
  customJsStr: SWAGGER_UI_KO_JS,
  swaggerOptions: {
    persistAuthorization: true,
    displayRequestDuration: true,
    filter: true,
    docExpansion: 'list',
    defaultModelsExpandDepth: -1,
    defaultModelExpandDepth: 1,
    defaultModelRendering: 'example',
    displayOperationId: false,
    tryItOutEnabled: true,
    syntaxHighlight: { activated: true, theme: 'agate' },
    operationsSorter: 'method',
    requestInterceptor: (req: { credentials?: string }) => {
      req.credentials = 'include';
      return req;
    },
  },
};
