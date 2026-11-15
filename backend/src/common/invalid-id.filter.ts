import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { QueryFailedError } from 'typeorm';

/** PostgreSQL "invalid_text_representation", e.g. 'abc' for a uuid column. */
const INVALID_TEXT = '22P02';

/**
 * PostgreSQL refuses to compare a uuid column with text that is not a uuid,
 * where other databases simply find nothing. An id like that in a URL can
 * never point at a record, so answer 404 instead of a server error.
 */
@Catch(QueryFailedError)
export class InvalidIdFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionsHandler');

  catch(exception: QueryFailedError, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();
    const code = (exception.driverError as { code?: string } | undefined)?.code;
    if (code === INVALID_TEXT) {
      res
        .status(HttpStatus.NOT_FOUND)
        .json({ statusCode: HttpStatus.NOT_FOUND, message: 'Not Found' });
      return;
    }
    this.logger.error(exception.message, exception.stack);
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}
