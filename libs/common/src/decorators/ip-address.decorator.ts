import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export const IpAddress = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    const xfwd = request.headers['x-forwarded-for'];
    if (Array.isArray(xfwd)) {
      return xfwd[0];
    }
    if (typeof xfwd === 'string') {
      return xfwd.split(',')[0].trim();
    }
    return request.ip ?? null;
  },
);
