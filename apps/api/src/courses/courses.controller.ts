import { Body, Controller, Get, Post } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import type { AuthenticatedUser } from '../auth/authenticated-user.js';
import { CurrentUser } from '../auth/current-user.decorator.js';
import { ErrorResponse } from '../common/errors/error-response.dto.js';
import {
  CourseAttemptRequest,
  CourseAttemptResponse,
  WelcomeCourseResponse,
} from './courses.dto.js';
import { CoursesService } from './courses.service.js';

const NOT_FOUND = {
  type: ErrorResponse,
  description:
    '`CAREGIVER_PROFILE_NOT_FOUND`: la cuenta no ha activado el modo cuidador. `COURSE_NOT_FOUND`: el seed no cargó el curso.',
};

@ApiTags('courses')
@ApiBearerAuth()
@Controller('courses')
export class CoursesController {
  constructor(private readonly courses: CoursesService) {}

  @Get('welcome')
  @ApiOperation({
    summary: 'Curso de bienvenida',
    description: 'RN-CUI-02. Los módulos y las preguntas del examen, sin las respuestas.',
  })
  @ApiOkResponse({ type: WelcomeCourseResponse })
  @ApiNotFoundResponse(NOT_FOUND)
  welcome(@CurrentUser() user: AuthenticatedUser): Promise<WelcomeCourseResponse> {
    return this.courses.welcomeCourse(user.id);
  }

  @Post('welcome/attempts')
  @ApiOperation({
    summary: 'Enviar el examen del curso de bienvenida',
    description:
      'RN-CUI-02. La API lo califica y guarda el intento. Aprueba con la nota mínima de §15, y se puede repetir.',
  })
  @ApiCreatedResponse({ type: CourseAttemptResponse })
  @ApiNotFoundResponse(NOT_FOUND)
  @ApiUnprocessableEntityResponse({
    type: ErrorResponse,
    description: '`INVALID_ANSWERS`: no responde cada pregunta una vez, con una de sus opciones.',
  })
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Body() body: CourseAttemptRequest,
  ): Promise<CourseAttemptResponse> {
    return this.courses.submitWelcomeExam(user.id, body);
  }
}
