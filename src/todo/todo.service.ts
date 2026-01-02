import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { Prisma, Todo } from '@prisma/client';
import { CreateTodoDto, UpdateTodoDto } from './dto';

@Injectable()
export class TodoService {
  constructor(private readonly prismaService: PrismaService) {}

  create(userId: string, dto: CreateTodoDto): Promise<Todo> {
    return this.prismaService.todo.create({
      data: {
        title: dto.title,
        userId,
      },
    });
  }

  async findAll(userId: string, page = 1, limit = 10, query?: string) {
    const safePage = Math.max(1, page);
    const safeLimit = Math.max(1, limit);
    const skip = (safePage - 1) * safeLimit;

    const where: Prisma.TodoWhereInput = {
      userId,
      isDeleted: false,
      ...(query
        ? {
            title: {
              contains: query,
              mode: 'insensitive',
            },
          }
        : undefined),
    };

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.todo.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip,
        take: safeLimit,
      }),
      this.prismaService.todo.count({
        where,
      }),
    ]);

    return { items, total };
  }

  async findOne(id: string, userId: string): Promise<Todo> {
    const todo = await this.prismaService.todo.findFirst({
      where: {
        id,
        userId,
        isDeleted: false,
      },
    });

    if (!todo) {
      throw new NotFoundException('Todo was not found');
    }

    return todo;
  }

  async update(id: string, userId: string, dto: UpdateTodoDto): Promise<Todo> {
    await this.findOne(id, userId);
    return this.prismaService.todo.update({
      where: { id },
      data: {
        ...dto,
      },
    });
  }

  async remove(id: string, userId: string): Promise<Todo> {
    await this.findOne(id, userId);
    return this.prismaService.todo.update({
      where: { id },
      data: {
        isDeleted: true,
      },
    });
  }
}
