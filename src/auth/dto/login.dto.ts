import { IsEmail, IsString, MinLength, Validate } from "class-validator";

export class LoginDto {
    @IsEmail()
    email: string;
    @IsString()
    @MinLength(6)
    password: string;
}