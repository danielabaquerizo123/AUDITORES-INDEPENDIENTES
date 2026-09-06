import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(3000),
  DATABASE_URL: Joi.string().uri({ scheme: ['postgresql', 'postgres'] }).required(),
  FRONTEND_URL: Joi.string().uri().required(),
  JWT_ACCESS_SECRET: Joi.string().min(32).required(),
  JWT_REFRESH_SECRET: Joi.string().min(32).required(),
  // Redis es opcional en Fase 4: el batch contractual corre en proceso y la
  // aplicación debe arrancar aunque Redis no esté configurado.
  REDIS_HOST: Joi.string().optional(),
  REDIS_PORT: Joi.number().port().default(6379),
  STORAGE_PATH: Joi.string().required(),
});
