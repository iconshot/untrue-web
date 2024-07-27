import { Emitter } from "untrue";

export class ErrorHandler {
  static handle(error: any) {
    queueMicrotask(() => {
      throw error;
    });
  }
}

Emitter.onError = (error) => {
  ErrorHandler.handle(error);
};
