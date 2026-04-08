import { Response } from "express";

export interface ApiResponseBody<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T | null;
  timestamp: string;
}

export class ApiResponse {
  /* Generic success response.*/
  static success<T>(
    res: Response,
    statusCode: number,
    message: string,
    data?: T
  ): Response<ApiResponseBody<T>> {
    return res.status(statusCode).json({
      success: true,
      statusCode,
      message,
      data: data ?? null,
      timestamp: new Date().toISOString(),
    });
  }

  /** 200 OK */
  static ok<T>(res: Response, message: string, data?: T) {
    return this.success(res, 200, message, data);
  }

  /** 201 Created */
  static created<T>(res: Response, message: string, data?: T) {
    return this.success(res, 201, message, data);
  }

  /** 204 No Content (still sends JSON for consistency) */
  static noContent(res: Response, message: string) {
    return this.success(res, 200, message);
  }
}
