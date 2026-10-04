import { repository } from './repository.js';

const resources = {
  invoices: repository('invoice_documents'),
  payments: repository('payment_receipts'),
  expenses: repository('other_expenses'),
  clients: repository('clients'),
  events: repository('events')
};

export async function loadDashboardData(workspaceId) {
  const [invoices,payments,expenses,clients,events] = await Promise.all([
    resources.invoices.list({workspaceId,select:'id,doc_type,grand_total,amount_paid,payment_status,issue_date,created_at',limit:2000}),
    resources.payments.list({workspaceId,select:'id,invoice_id,amount,payment_date,created_at',limit:2000}),
    resources.expenses.list({workspaceId,select:'id,amount,expense_date,created_at',limit:2000}),
    resources.clients.list({workspaceId,select:'id,name,created_at',limit:2000}),
    resources.events.list({workspaceId,select:'id,name,event_date,status,budget_revenue,budget_cost,created_at',limit:2000})
  ]);
  return {invoices,payments,expenses,clients,events};
}
