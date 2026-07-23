import { PaymentProcess } from '@vendure/core';

declare module '@vendure/core' {
  interface PaymentStates {
    Pending: never;
  }
}

/**
 * Custom payment state machine for CLINK Lightning payments.
 *
 * @description
 * Defines the `Pending` payment state and transitions:
 * - `Created → Pending` (when offer is generated)
 * - `Pending → Settled` (when payment is confirmed)
 * - `Pending → Error` (on failure)
 * - `Pending → Cancelled` (on expiry)
 *
 * @category PaymentProcess
 */
export const ClinkPaymentProcess: PaymentProcess<'Pending'> = {
  transitions: {
    Created: {
      to: ['Pending', 'Error', 'Cancelled', 'Authorized', 'Settled', 'Declined'],
    },
    Pending: {
      to: ['Settled', 'Error', 'Cancelled'],
      mergeStrategy: 'merge',
    },
  },
};
