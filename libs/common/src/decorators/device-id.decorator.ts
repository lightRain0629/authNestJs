import { ExecutionContext, createParamDecorator } from '@nestjs/common';

export const DeviceId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): string | null => {
    const request = ctx.switchToHttp().getRequest();
    const deviceIdHeader =
      request.headers['x-device-id'] || request.headers['device-id'];
    if (Array.isArray(deviceIdHeader)) {
      return deviceIdHeader[0];
    }
    return deviceIdHeader ?? null;
  },
);
