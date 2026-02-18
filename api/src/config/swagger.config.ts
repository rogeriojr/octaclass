import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Octoclass MDM API',
      version: '2.0.0',
      description: 'API MDM: dispositivos, políticas, comandos e atividade em tempo real. Swagger em /api-docs.',
      contact: {
        name: 'Octoclass Team',
        email: 'support@octoclass.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:3005',
        description: 'Development server'
      },
      {
        url: 'https://api.octoclass.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'JWT token obtido via /api/auth/login'
        }
      },
      schemas: {
        Device: {
          type: 'object',
          required: ['id'],
          properties: {
            id: {
              type: 'string',
              description: 'ID único do dispositivo',
              example: 'Android_BE2A.250530.026.D1'
            },
            name: {
              type: 'string',
              description: 'Nome amigável do dispositivo',
              example: 'Tablet Sala 101'
            },
            model: {
              type: 'string',
              description: 'Modelo do dispositivo',
              example: 'Samsung Galaxy Tab A8'
            },
            osVersion: {
              type: 'string',
              description: 'Versão do Android',
              example: '13.0'
            },
            status: {
              type: 'string',
              enum: ['online', 'offline', 'locked'],
              description: 'Status atual do dispositivo'
            },
            lastSeen: {
              type: 'number',
              description: 'Timestamp da última conexão',
              example: 1771214400000
            },
            currentUrl: {
              type: 'string',
              description: 'URL atual sendo acessada',
              example: 'https://classroom.google.com'
            },
            batteryLevel: {
              type: 'number',
              minimum: 0,
              maximum: 100,
              description: 'Nível de bateria (%)',
              example: 85
            },
            brightness: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Nível de brilho (0-1)',
              example: 0.7
            },
            policies: {
              type: 'object',
              properties: {
                blockedDomains: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Domínios bloqueados',
                  example: ['facebook.com', 'instagram.com']
                },
                allowedApps: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Apps permitidos',
                  example: ['com.google.android.apps.classroom']
                },
                screenshotInterval: {
                  type: 'number',
                  description: 'Intervalo de screenshots (ms)',
                  example: 60000
                },
                kioskMode: {
                  type: 'boolean',
                  description: 'Modo kiosk ativado',
                  example: true
                }
              }
            }
          }
        },
        Command: {
          type: 'object',
          required: ['type'],
          properties: {
            type: {
              type: 'string',
              description: 'Tipo de comando',
              enum: ['LOCK_SCREEN', 'UNLOCK_SCREEN', 'LAUNCH_APP', 'SET_BRIGHTNESS', 'VOLUME', 'GET_PRINT', 'REBOOT', 'ALERT', 'POLICY_CHANGE', 'START_KIOSK', 'STOP_KIOSK'],
              example: 'LOCK_SCREEN'
            },
            payload: {
              type: 'object',
              description: 'Dados do comando (ex.: requirePin, packageName, url)',
              example: { requirePin: true }
            }
          }
        },
        Screenshot: {
          type: 'object',
          properties: {
            id: { type: 'string', description: 'ID do screenshot' },
            deviceId: { type: 'string', description: 'ID do dispositivo' },
            imageUrl: { type: 'string', description: 'URL ou base64 da imagem' },
            timestamp: {
              type: 'number',
              description: 'Timestamp da captura'
            },
            currentUrl: {
              type: 'string',
              description: 'URL sendo acessada no momento'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Mensagem de erro'
            },
            details: {
              type: 'string',
              description: 'Detalhes adicionais'
            }
          }
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./src/routes/*.ts']
};

export const swaggerSpec = swaggerJsdoc(options);
