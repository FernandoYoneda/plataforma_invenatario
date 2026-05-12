import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

type HttpResponse = {
  status: (statusCode: number) => {
    json: (body: unknown) => void;
  };
};

type HttpRequest = {
  url?: string;
};

type ExceptionResponse = {
  message?: string | string[];
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<HttpResponse>();
    const request = ctx.getRequest<HttpRequest>();
    const { statusCode, message } = this.resolveException(exception);

    response.status(statusCode).json({
      statusCode,
      message,
      timestamp: new Date().toISOString(),
      path: request.url ?? '',
    });
  }

  private resolveException(exception: unknown) {
    if (exception instanceof HttpException) {
      const response = exception.getResponse();

      return {
        statusCode: exception.getStatus(),
        message: this.getHttpExceptionMessage(response, exception.message),
      };
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      return this.resolvePrismaKnownError(exception);
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Erro interno do servidor',
    };
  }

  private getHttpExceptionMessage(
    response: string | object,
    fallback: string,
  ): string | string[] {
    if (typeof response === 'string') {
      return response;
    }

    const maybeResponse = response as ExceptionResponse;
    return maybeResponse.message ?? fallback;
  }

  private resolvePrismaKnownError(
    exception: Prisma.PrismaClientKnownRequestError,
  ) {
    switch (exception.code) {
      case 'P2002':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Ja existe um registro com os dados informados',
        };
      case 'P2025':
        return {
          statusCode: HttpStatus.NOT_FOUND,
          message: 'Registro nao encontrado',
        };
      case 'P2003':
        return {
          statusCode: HttpStatus.CONFLICT,
          message: 'Operacao viola relacionamentos existentes',
        };
      default:
        return {
          statusCode: HttpStatus.BAD_REQUEST,
          message: 'Erro ao processar dados no banco',
        };
    }
  }
}
