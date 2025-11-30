import {
  INestApplication,
  CanActivate,
  ExecutionContext,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtAuthGuard } from '../src/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../src/auth/guards/role.guard';
import { ThrottlerGuard } from '@nestjs/throttler';
import { Provider, Role, User } from '@prisma/client';

const mockPrisma = () => ({
  user: {
    findMany: jest.fn(),
    count: jest.fn(),
  },
  $transaction: jest.fn(),
});

const adminUser = {
  id: 'admin-id',
  email: 'admin@test.com',
  roles: [Role.ADMIN],
};

const allowAllGuard = (setUser = false): CanActivate => ({
  canActivate: (ctx: ExecutionContext) => {
    if (setUser) {
      const req = ctx.switchToHttp().getRequest();
      req.user = adminUser;
    }
    return true;
  },
});

describe('UserController (e2e)', () => {
  let app: INestApplication;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeAll(async () => {
    prisma = mockPrisma();
    prisma.$transaction.mockImplementation((actions: Promise<unknown>[]) =>
      Promise.all(actions),
    );

    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .overrideGuard(JwtAuthGuard)
      .useValue(allowAllGuard(true))
      .overrideGuard(RolesGuard)
      .useValue(allowAllGuard())
      .overrideGuard(ThrottlerGuard)
      .useValue(allowAllGuard())
      .compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/user/all returns paginated users with filter', async () => {
    const now = new Date();
    const users: User[] = [
      {
        id: 'user-1',
        email: 'foo@example.com',
        password: 'secret',
        roles: [Role.ADMIN],
        provider: Provider.GOOGLE,
        isBlocked: false,
        isVerified: true,
        createdAt: now,
        updatedAt: now,
      },
    ];

    prisma.user.findMany.mockResolvedValue(users);
    prisma.user.count.mockResolvedValue(1);

    await request(app.getHttpServer())
      .get('/api/user/all?page=1&limit=1&query=foo')
      .set('Authorization', 'Bearer test')
      .expect(200)
      .expect(({ body }) => {
        expect(body.count).toBe(1);
        expect(body.current_page).toBe(1);
        expect(body.total_pages).toBe(1);
        expect(Array.isArray(body.results)).toBe(true);
        expect(body.results[0]).not.toHaveProperty('password');
        expect(prisma.user.findMany).toHaveBeenCalledWith({
          skip: 0,
          take: 1,
          where: {
            OR: [
              { email: { contains: 'foo', mode: 'insensitive' } },
              { id: { contains: 'foo' } },
            ],
          },
        });
        expect(prisma.user.count).toHaveBeenCalledWith({
          where: {
            OR: [
              { email: { contains: 'foo', mode: 'insensitive' } },
              { id: { contains: 'foo' } },
            ],
          },
        });
      });
  });
});
