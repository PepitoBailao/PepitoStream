import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { AppError } from './errorHandler';

export const validate = (schema: Joi.ObjectSchema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body);
    if (error) {
      throw new AppError(400, error.details[0].message);
    }
    req.body = value;
    next();
  };
};

// Common validation schemas
export const schemas = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).required(),
    username: Joi.string().alphanum().min(3).max(30).required(),
  }),
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
  }),
  search: Joi.object({
    q: Joi.string().required(),
    type: Joi.string().valid('movie', 'series', 'anime'),
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(20),
  }),
  filter: Joi.object({
    language: Joi.array().items(Joi.string()),
    quality: Joi.array().items(Joi.string()),
    minBitrate: Joi.number().min(0),
    maxBitrate: Joi.number().min(0),
    minSize: Joi.number().min(0),
    maxSize: Joi.number().min(0),
    verified: Joi.boolean(),
  }),
};
