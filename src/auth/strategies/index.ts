import { GoogleStrategy } from './google.strategy';
import { JwtStrategy } from './jwt.strategy';
import { YandexStrategy } from './yandex.strategy';

export * from './jwt.strategy';
export const STRATEGIES = [JwtStrategy, GoogleStrategy, YandexStrategy];
