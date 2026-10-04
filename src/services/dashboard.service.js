import { loadDashboardData } from '../api/dashboard.repository.js';

const money = value => Number(value || 0);
const monthKey = value => value ? String(value).slice(0,7) : '';

export async function getDashboardModel(workspaceId) {
  const data = await loadDashboardData(workspaceId);
  const invoices = data.invoices.filter(x => ['Invoice','Proforma Invoice'].includes(x.doc_type));
  const revenue = invoices.reduce((s,x)=>s+money(x.grand_total),0);
  const collected = data.payments.reduce((s,x)=>s+money(x.amount),0);
  const expenses = data.expenses.reduce((s,x)=>s+money(x.amount),0);

  const months = [];
  const now = new Date();
  for(let i=11;i>=0;i--){
    const d = new Date(now.getFullYear(),now.getMonth()-i,1);
    const key = d.toISOString().slice(0,7);
    months.push({
      key,
      label:d.toLocaleDateString(undefined,{month:'short'}),
      revenue:0,
      collected:0,
      expenses:0
    });
  }

  invoices.forEach(x=>{
    const row=months.find(m=>m.key===monthKey(x.issue_date||x.created_at));
    if(row) row.revenue += money(x.grand_total);
  });
  data.payments.forEach(x=>{
    const row=months.find(m=>m.key===monthKey(x.payment_date||x.created_at));
    if(row) row.collected += money(x.amount);
  });
  data.expenses.forEach(x=>{
    const row=months.find(m=>m.key===monthKey(x.expense_date||x.created_at));
    if(row) row.expenses += money(x.amount);
  });

  const currentYear = String(now.getFullYear());
  const yearToDate = months.filter(m=>m.key.startsWith(currentYear))
    .reduce((s,m)=>s+m.revenue,0);

  return {
    data,
    totals:{revenue,collected,expenses,profit:revenue-expenses,clients:data.clients.length,events:data.events.length},
    months,
    yearToDate
  };
}
