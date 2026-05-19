/**
 * Public surface of the UI primitives. Modal handles non-trivial behavior
 * (focus trap, escape, backdrop) and Toast is the app-wide notification
 * channel. All other styling lives inline in pages.
 */
export { Modal } from './Modal';
export { ToastProvider, useToast } from './Toast';
