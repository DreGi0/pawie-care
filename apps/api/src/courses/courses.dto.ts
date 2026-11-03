import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

export class CourseQuestionResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: '¿Quién compra el alimento de la mascota?' })
  prompt: string;

  @ApiProperty({
    type: [String],
    description: 'Las opciones, en orden. La respuesta se envía con su índice.',
  })
  options: string[];
}

export class CourseModuleResponse {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ type: 'integer', example: 1 })
  position: number;

  @ApiProperty({ example: 'Reglas de la plataforma' })
  title: string;

  @ApiProperty({ description: 'La lección, en párrafos separados por una línea en blanco.' })
  body: string;

  @ApiProperty({ type: [CourseQuestionResponse], description: 'Sin la respuesta correcta.' })
  questions: CourseQuestionResponse[];
}

/** RN-CUI-02: the welcome course, its modules and the exam questions. */
export class WelcomeCourseResponse {
  @ApiProperty({ example: 'Curso de bienvenida' })
  title: string;

  @ApiProperty({
    type: 'integer',
    example: 8000,
    description: 'Nota mínima para aprobar, en puntos básicos (RN-CUI-02).',
  })
  passingScoreBp: number;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Cuándo lo aprobó. Null si todavía no.',
  })
  passedAt: string | null;

  @ApiProperty({ type: [CourseModuleResponse] })
  modules: CourseModuleResponse[];
}

export class ExamAnswer {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  questionId: string;

  @ApiProperty({ type: 'integer', minimum: 0, description: 'Índice de la opción elegida.' })
  @IsInt()
  @Min(0)
  @Max(20)
  option: number;
}

export class CourseAttemptRequest {
  @ApiProperty({ type: [ExamAnswer], description: 'Una respuesta para cada pregunta.' })
  @IsArray()
  @ArrayMaxSize(200)
  @ArrayUnique((answer: ExamAnswer) => answer.questionId)
  @ValidateNested({ each: true })
  @Type(() => ExamAnswer)
  answers: ExamAnswer[];
}

export class CourseAttemptResponse {
  @ApiProperty({
    type: 'integer',
    example: 8333,
    description: 'Respuestas correctas en puntos básicos, redondeadas hacia abajo.',
  })
  scoreBp: number;

  @ApiProperty()
  passed: boolean;

  @ApiProperty({ type: 'integer', example: 10 })
  correctCount: number;

  @ApiProperty({ type: 'integer', example: 12 })
  questionCount: number;

  @ApiProperty({ type: 'integer', example: 8000 })
  passingScoreBp: number;

  @ApiProperty({
    type: [String],
    format: 'uuid',
    description: 'Las preguntas que falló, sin decir cuál era la respuesta.',
  })
  incorrectQuestionIds: string[];

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Cuándo aprobó el curso, con este intento o con uno anterior.',
  })
  passedAt: string | null;
}
