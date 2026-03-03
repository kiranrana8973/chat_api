import { IsString, IsNotEmpty, IsIn, IsOptional } from 'class-validator';

export class CompleteProfileDto {
  @IsIn(['male', 'female', 'other'])
  gender: string;

  @IsString()
  @IsNotEmpty()
  batch: string;

  @IsOptional()
  @IsString()
  fname?: string;

  @IsOptional()
  @IsString()
  lname?: string;
}
