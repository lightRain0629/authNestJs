import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateTodoDto {
  @ApiProperty({
    description: 'Short description of the task',
    minLength: 1,
    maxLength: 255,
    example: 'Finish NestJS CRUD feature',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;
}
