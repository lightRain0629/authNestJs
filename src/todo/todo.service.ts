import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@prisma/prisma.service';
import { Todo } from '@prisma/client';
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

  findAll(userId: string): Promise<Todo[]> {
    return this.prismaService.todo.findMany({
      where: {
        userId,
        isDeleted: false,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
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
