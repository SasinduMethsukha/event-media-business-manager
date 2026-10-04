import { repository } from '../api/repository.js';
export const financeService = {
  invoices: repository('invoice_documents'),
  payments: repository('invoice_payments'),
  receipts: repository('payment_receipts'),
  expenses: repository('other_expenses'),
  rentals: repository('equipment_rentals')
};
