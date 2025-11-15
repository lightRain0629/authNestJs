import { ApiProperty } from '@nestjs/swagger';
import { Todo } from '@prisma/client';

export class TodoResponse implements Todo {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  title: string;

  @ApiProperty({ default: false })
  isCompleted: boolean;

  @ApiProperty({ default: false })
  isDeleted: boolean;

  @ApiProperty({ format: 'uuid' })
  userId: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt: Date;

  constructor(todo: Todo) {
    Object.assign(this, todo);
  }
}
