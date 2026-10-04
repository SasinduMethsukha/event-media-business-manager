import { store } from '../../state/store.js';

export function dashboardViewModel() {
  const { data } = store.get();
  const invoices = data.invoices || [];
  const payments = data.payments || [];
  const expenses = data.expenses || [];

  return {
    revenue: invoices.reduce((s, x) => s + Number(x.grand_total || 0), 0),
    collected: payments.reduce((s, x) => s + Number(x.amount || 0), 0),
    expenses: expenses.reduce((s, x) => s + Number(x.amount || 0), 0),
    clients: (data.clients || []).length,
    events: (data.events || []).length
  };
}
