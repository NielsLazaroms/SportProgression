import { CanDeactivateFn } from '@angular/router';
import { Observable } from 'rxjs';

/** A page that may hold unsaved edits. */
export interface ConfirmsLeave {
  confirmLeave(): boolean | Observable<boolean>;
}

/**
 * Keeps unsaved template edits from being lost on Back / navigation. Lives
 * apart from the editor page so the routes file does not pull that page into
 * the main bundle.
 */
export const templateEditorLeaveGuard: CanDeactivateFn<ConfirmsLeave> = (page) =>
  page.confirmLeave();
