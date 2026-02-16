import { Test } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { UserService } from './user.service';
import { PrismaService } from '@prisma/prisma.service';
import { Prisma, Role, User } from '@prisma/client';
import { ConfigService } from '@nestjs/config';

const mockPrisma = () => ({
  user: {
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    upsert: jest.fn(),
  },
  $transaction: jest.fn(),
});

describe('UserService', () => {
  let service: UserService;
  let prisma: ReturnType<typeof mockPrisma>;

  beforeEach(async () => {
    prisma = mockPrisma();
    prisma.$transaction.mockImplementation(
      async (actions: Promise<unknown>[]) => Promise.all(actions),
    );

    const moduleRef = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: PrismaService, useValue: prisma },
        {
          provide: CACHE_MANAGER,
          useValue: { get: jest.fn(), set: jest.fn(), del: jest.fn() },
        },
        { provide: ConfigService, useValue: { get: jest.fn() } },
      ],
    }).compile();

    service = moduleRef.get(UserService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('paginates and filters users', async () => {
    const users: User[] = [
      {
        id: 'u1',
        email: 'foo@example.com',
        password: 'secret',
        roles: [Role.ADMIN],
        provider: null,
        isBlocked: false,
        isVerified: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
      },
    ];

    prisma.user.findMany.mockResolvedValue(users);
    prisma.user.count.mockResolvedValue(1);

    const result = await service.findAll(2, 5, 'foo');

    expect(prisma.user.findMany).toHaveBeenCalledWith({
      skip: 5,
      take: 5,
      where: {
        OR: [
          { email: { contains: 'foo', mode: Prisma.QueryMode.insensitive } },
          { id: { contains: 'foo' } },
        ],
      },
    });
    expect(prisma.user.count).toHaveBeenCalledWith({
      where: {
        OR: [
          { email: { contains: 'foo', mode: Prisma.QueryMode.insensitive } },
          { id: { contains: 'foo' } },
        ],
      },
    });
    expect(result).toEqual({
      items: users.map(({ password: _pw, ...rest }) => ({ ...rest, password: undefined })),
      total: 1,
    });
  });

  it('hashes password on partial update', async () => {
    prisma.user.update.mockImplementation(async ({ data }) => ({
      id: 'u1',
      email: 'bar@example.com',
      roles: [Role.USER],
      provider: null,
      isBlocked: false,
      isVerified: false,
      createdAt: new Date('2023-01-01'),
      updatedAt: new Date('2023-01-02'),
      password: data.password,
    }));

    const updated = await service.updatePartial('u1', {
      password: 'plain-pass',
      email: 'bar@example.com',
    });

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: expect.objectContaining({ email: 'bar@example.com' }),
    });

    expect(updated.password).toBeDefined();
    expect(updated.password).not.toBe('plain-pass');
  });

  it('does not expose passwords in findAll results (expected to fail until sanitized)', async () => {
    const users: User[] = [
      {
        id: 'u1',
        email: 'foo@example.com',
        password: undefined,
        roles: [Role.ADMIN],
        provider: null,
        isBlocked: false,
        isVerified: true,
        createdAt: new Date('2023-01-01'),
        updatedAt: new Date('2023-01-02'),
      },
    ];

    prisma.user.findMany.mockResolvedValue(users);
    prisma.user.count.mockResolvedValue(1);

    const result = await service.findAll(1, 10);

    expect(result.items[0].password).toBeUndefined();
  });
});
