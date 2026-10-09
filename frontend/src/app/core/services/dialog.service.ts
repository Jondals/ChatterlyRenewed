/**
 * src/app/core/services/dialog.service.ts
 * Confirmation and text-entry dialogs that work with promises and replace window.confirm and window.prompt.
 * This service only holds the request; ToastHostComponent draws it.
 */
import { Injectable, signal } from '@angular/core';

/** A question that waits for a yes or a no. */
export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  danger: boolean;
  resolve: (ok: boolean) => void;
}

/** A question that waits for a text (null when cancelled). */
export interface PromptRequest {
  title: string;
  message: string;
  value: string;
  placeholder: string;
  resolve: (value: string | null) => void;
}

/** Promise-based replacement for window.confirm and window.prompt that matches the look of the app. */
@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly confirmRequest = signal<ConfirmRequest | null>(null);
  readonly promptRequest = signal<PromptRequest | null>(null);

  /** Asks the person for a text; resolves with null when they cancel. */
  prompt(title: string, message: string, value = '', placeholder = ''): Promise<string | null> {
    return new Promise<string | null>(
      function (this: DialogService, resolve: (answer: string | null) => void) {
        this.promptRequest.set({
          title,
          message,
          value,
          placeholder,
          resolve: function (this: DialogService, answer: string | null) {
            this.promptRequest.set(null);
            resolve(answer);
          }.bind(this),
        });
      }.bind(this),
    );
  }

  /** Asks a yes or no question; resolves with true when the person confirms. */
  confirm(
    title: string,
    message: string,
    options: { confirmLabel?: string; danger?: boolean } = {},
  ): Promise<boolean> {
    return new Promise<boolean>(
      function (this: DialogService, resolve: (answer: boolean) => void) {
        this.confirmRequest.set({
          title,
          message,
          confirmLabel: options.confirmLabel ?? 'Confirm',
          danger: options.danger ?? false,
          resolve: function (this: DialogService, answer: boolean) {
            this.confirmRequest.set(null);
            resolve(answer);
          }.bind(this),
        });
      }.bind(this),
    );
  }
}
