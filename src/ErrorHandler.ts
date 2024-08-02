import { Emitter } from "untrue";

export class ErrorHandler {
  static handle(error: any): void {
    queueMicrotask((): void => {
      throw error;
    });
  }
}

Emitter.onError = (error): void => {
  ErrorHandler.handle(error);
};
