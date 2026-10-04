// Event Media OS v3: Events, Crew, Payables ledger, Files, P&L + Tax, Audit log, Tax presets.
(function(){
var X={events:[],crew:[],assign:[],payouts:[],files:[],audit:[]};
var P=[['fx2events','Events','ti-calendar-event'],['fx2crew','Crew','ti-users-group'],['fx2payables','Payables','ti-cash-banknote'],['fx2files','Files','ti-paperclip'],['fx2pl','P&L / Tax','ti-chart-line'],['fx2audit','Audit','ti-list-search']];
var $=function(i){return document.getElementById(i);}, ws=function(){return gv('sbWorkspace').trim();}, key=function(){return gv('sbKey').trim();};
var rest=function(t,q){return sbBase()+'/rest/v1/'+t+(q||'');};
var N=function(v){return Number(v||0);}, sum=function(a,f){return a.reduce(function(s,x){return s+N(f(x));},0);};
var low=function(v){return String(v||'').trim().toLowerCase();};
async function get(t,order,extra){var r=await fetch(rest(t,'?workspace_id=eq.'+encodeURIComponent(ws())+'&select=*&order='+order+'&limit=1000'+(extra||'')),{headers:sbHeaders(key())});if(!r.ok)throw new Error(await r.text());return r.json();}
async function send(t,m,b,id){var r=await fetch(rest(t,id?'?id=eq.'+encodeURIComponent(id):''),{method:m,headers:sbHeaders(key(),{Prefer:'return=representation'}),body:b?JSON.stringify(b):undefined});if(!r.ok)throw new Error(await r.text()||('HTTP '+r.status));return m==='DELETE'?null:r.json();}
function warn(el,e){el.innerHTML='<div class="manager-alert">Could not load. Run <strong>migration-v3.sql</strong> in Supabase first. '+esc(e.message||e)+'</div>';}
function f(id,l,t,x){return '<div><label>'+l+'</label><input id="'+id+'" type="'+(t||'text')+'" '+(x||'')+'></div>';}
function card(t,b,r){return '<div class="manager-card"><div class="manager-card-head"><div class="manager-card-title">'+t+'</div>'+(r||'')+'</div><div class="manager-card-body">'+b+'</div></div>';}
function tbl(h,rows,empty){return rows.length?'<div class="manager-table-wrap"><table class="manager-table"><thead><tr>'+h.map(function(x){return '<th>'+x+'</th>';}).join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>':'<div class="manager-empty">'+empty+'</div>';}
var btn=function(l,fn,c){return '<button class="btn btn-sm '+(c||'')+'" onclick="'+fn+'">'+l+'</button>';};
var M=function(n){return managerMoney(n);};

// ---------- injection ----------
function inject(){
  var mv=$('managerView');if(!mv||$('managerTab-fx2events'))return;var tabs=mv.querySelector('.manager-tabs');
  P.forEach(function(t){var b=document.createElement('button');b.className='manager-tab admin-only';b.id='managerTab-'+t[0];b.innerHTML='<i class="ti '+t[2]+'"></i> '+t[1];b.onclick=function(){showManagerPane(t[0]);};tabs.appendChild(b);});
  var H={
  fx2events:card('Event / project','<input type="hidden" id="evId"><div class="fx-form">'+f('evName','Event name *')+f('evClient','Client')+f('evDate','Start date','date')+f('evEnd','End date','date')+f('evLoc','Location')+f('evBR','Budget revenue','number','min="0" value="0"')+f('evBC','Budget cost','number','min="0" value="0"')+'<div><label>Status</label><select id="evStatus"><option>planned</option><option>confirmed</option><option>in progress</option><option>completed</option><option>cancelled</option></select></div></div><div class="fx-row"><button class="btn" onclick="fx2EvReset()">Clear</button><button class="btn btn-primary" onclick="fx2EvSave()">Save event</button></div>')+card('Budget vs actual','<div id="evList"></div>'),
  fx2crew:card('Crew member','<input type="hidden" id="crId"><div class="fx-form">'+f('crName','Name *')+f('crRole','Role')+f('crPhone','Phone')+f('crRate','Day rate','number','min="0" value="0"')+'</div><div class="fx-row"><button class="btn btn-primary" onclick="fx2CrewSave()">Save crew member</button></div><div id="crList"></div>')+
    card('Assign crew to event','<div class="fx-form"><div><label>Crew *</label><select id="asCrew" onchange="fx2AsRate()"></select></div>'+f('asEvent','Event *','text','list="fxEventList"')+f('asDate','Date','date')+f('asDays','Days','number','min="0.5" step="0.5" value="1"')+f('asRate','Rate / day','number','min="0"')+'</div><div class="fx-row"><button class="btn btn-primary" onclick="fx2AssignSave()">Assign</button></div><div id="asList"></div>'),
  fx2payables:card('Supplier payables (rentals with balance due)','<div id="pbList"></div>')+card('Payment ledger (crew + supplier)','<div id="pbLedger"></div>'),
  fx2files:card('Attachments','<div class="fx-form">'+f('flEvent','Attach to event','text','list="fxEventList"')+'<div><label>Category</label><select id="flCat"><option>Expense receipt</option><option>Contract</option><option>Signed quotation</option><option>Supplier invoice</option><option>Other</option></select></div><div><label>File</label><input type="file" id="flFile"></div></div><div class="fx-row"><button class="btn btn-primary" onclick="fx2Upload()"><i class="ti ti-upload"></i> Upload</button></div><div id="flList"></div>'),
  fx2pl:card('Profit &amp; loss (last 12 months, accrual)','<div id="plChart"></div><div id="plTable"></div>','<button class="btn btn-sm" onclick="fx2PlCsv()"><i class="ti ti-download"></i> CSV for accountant</button>')+card('Tax summary (tax collected on invoices)','<div id="taxTable"></div><div class="fx-note">Tax is derived from each saved invoice\'s tax setting. Proforma invoices are excluded.</div>'),
  fx2audit:card('Audit log (latest 300)','<div id="auList"></div>','<button class="btn btn-sm" onclick="fx2LoadAudit()"><i class="ti ti-refresh"></i> Refresh</button>')};
  P.forEach(function(p){var d=document.createElement('div');d.id='managerPane-'+p[0];d.style.display='none';d.innerHTML=H[p[0]];mv.appendChild(d);});
  var prev=window.showManagerPane;
  window.showManagerPane=function(name){
    var mine=P.some(function(p){return p[0]===name;});
    if(mine){document.querySelectorAll('[id^="managerPane-"]').forEach(function(e){e.style.display=e.id==='managerPane-'+name?'':'none';});document.querySelectorAll('[id^="managerTab-"]').forEach(function(e){e.classList.toggle('active',e.id==='managerTab-'+name);});
      ({fx2events:loadEvents,fx2crew:loadCrew,fx2payables:loadPay,fx2files:loadFiles,fx2pl:renderPL,fx2audit:fx2LoadAudit})[name]();return;}
    P.forEach(function(p){var e=$('managerPane-'+p[0]);if(e)e.style.display='none';});prev(name);
  };
}

// ---------- event name suggestions ----------
function eventList(){
  var dl=$('fxEventList');if(!dl){dl=document.createElement('datalist');dl.id='fxEventList';document.body.appendChild(dl);}
  var names={};X.events.forEach(function(e){names[e.name]=1;});(managerState.invoices||[]).forEach(function(i){if(i.event_name)names[i.event_name]=1;});
  dl.innerHTML=Object.keys(names).map(function(n){return '<option value="'+esc(n)+'">';}).join('');
  ['eventName','rentalEvent','expenseEvent','equipmentHireEvent','paymentReceiptEvent'].forEach(function(i){var e=$(i);if(e)e.setAttribute('list','fxEventList');});
}

// ---------- Events ----------
async function loadEvents(){var el=$('evList');try{var r=await Promise.all([get('events','event_date.desc.nullslast'),get('crew_assignments','created_at.desc')]);X.events=r[0];X.assign=r[1];eventList();renderEvents();}catch(e){warn(el,e);}}
function actual(name){var m=function(v){return low(v)===low(name);};
  var inv=managerState.invoices.filter(function(x){return m(x.event_name)&&x.doc_type!=='Proforma Invoice';});
  var rev=sum(inv,function(x){return x.grand_total;})+sum(managerState.equipmentHires.filter(function(h){return m(h.event_name)&&h.hire_status!=='cancelled';}),function(h){return h.amount;});
  var cost=sum(managerState.rentals.filter(function(r){return m(r.event_name)&&r.status!=='cancelled';}),function(r){return r.amount;})+sum(managerState.expenses.filter(function(x){return m(x.event_name);}),function(x){return x.amount;})+sum(X.assign.filter(function(a){return m(a.event_name);}),function(a){return a.amount;});
  var due=sum(inv,function(x){var t=N(x.grand_total);return t-Math.min(invoicePaidAmount(x),t);});
  return {rev:rev,cost:cost,due:due};}
function renderEvents(){
  $('evList').innerHTML=tbl(['Event','Dates','Revenue (bud → actual)','Cost (bud → actual)','Margin','Owed to us','Status',''],X.events.map(function(e){var a=actual(e.name),mg=a.rev-a.cost;
    return '<tr><td><strong>'+esc(e.name)+'</strong><br><small>'+esc(e.client_name||'')+' '+esc(e.location||'')+'</small></td><td>'+managerDate(e.event_date)+(e.end_date?' – '+managerDate(e.end_date):'')+'</td><td>'+M(e.budget_revenue)+' → '+M(a.rev)+'</td><td class="'+(a.cost>N(e.budget_cost)&&N(e.budget_cost)>0?'fx-bad':'')+'">'+M(e.budget_cost)+' → '+M(a.cost)+'</td><td class="'+(mg>=0?'fx-ok':'fx-bad')+'">'+M(mg)+(a.rev?' ('+Math.round(100*mg/a.rev)+'%)':'')+'</td><td>'+M(a.due)+'</td><td>'+esc(e.status)+'</td><td>'+btn('Edit',"fx2EvEdit('"+e.id+"')")+' '+btn('Delete',"fx2EvDel('"+e.id+"')")+'</td></tr>';}),'No events yet. Add one above; documents are matched to it by event name.');}
window.fx2EvReset=function(){['evId','evName','evClient','evDate','evEnd','evLoc'].forEach(function(i){$(i).value='';});$('evBR').value=0;$('evBC').value=0;};
window.fx2EvEdit=function(id){var e=X.events.find(function(x){return x.id===id;});if(!e)return;$('evId').value=e.id;$('evName').value=e.name;$('evClient').value=e.client_name||'';$('evDate').value=e.event_date||'';$('evEnd').value=e.end_date||'';$('evLoc').value=e.location||'';$('evBR').value=e.budget_revenue;$('evBC').value=e.budget_cost;$('evStatus').value=e.status;window.scrollTo(0,0);};
window.fx2EvSave=async function(){var n=gv('evName').trim();if(!n){alert('Event name required.');return;}var id=gv('evId');
  try{await send('events',id?'PATCH':'POST',{workspace_id:ws(),name:n,client_name:gv('evClient'),event_date:gv('evDate')||null,end_date:gv('evEnd')||null,location:gv('evLoc'),budget_revenue:N(gv('evBR')),budget_cost:N(gv('evBC')),status:gv('evStatus'),updated_at:new Date().toISOString()},id);fx2EvReset();loadEvents();}catch(e){alert(e.message);}};
window.fx2EvDel=async function(id){if(!confirm('Delete this event record? Linked documents are kept.'))return;try{await send('events','DELETE',null,id);loadEvents();}catch(e){alert(e.message);}};

// ---------- Crew ----------
async function loadCrew(){try{var r=await Promise.all([get('crew_members','name.asc'),get('crew_assignments','assign_date.desc'),get('payouts','paid_date.desc','&kind=eq.crew')]);X.crew=r[0];X.assign=r[1];X.payouts=r[2];eventList();renderCrew();}catch(e){warn($('crList'),e);}}
function crewPaid(id){return sum(X.payouts.filter(function(p){return p.kind==='crew'&&p.ref_id===id;}),function(p){return p.amount;});}
function renderCrew(){
  $('asCrew').innerHTML='<option value="">Select…</option>'+X.crew.map(function(c){return '<option value="'+c.id+'">'+esc(c.name)+(c.role?' ('+esc(c.role)+')':'')+'</option>';}).join('');
  $('crList').innerHTML=tbl(['Name','Role','Phone','Day rate',''],X.crew.map(function(c){return '<tr><td>'+esc(c.name)+'</td><td>'+esc(c.role||'')+'</td><td>'+esc(c.phone||'')+'</td><td>'+M(c.day_rate)+'</td><td>'+btn('Edit',"fx2CrewEdit('"+c.id+"')")+' '+btn('Delete',"fx2CrewDel('"+c.id+"')")+'</td></tr>';}),'No crew yet.');
  $('asList').innerHTML='<h3 style="margin:1rem 0 .4rem">Assignments &amp; payouts</h3>'+tbl(['Event','Crew','Date','Days × rate','Amount','Paid','Balance',''],X.assign.map(function(a){var p=crewPaid(a.id),b=N(a.amount)-p;return '<tr><td>'+esc(a.event_name)+'</td><td>'+esc(a.crew_name)+'</td><td>'+managerDate(a.assign_date)+'</td><td>'+a.days+' × '+M(a.rate)+'</td><td>'+M(a.amount)+'</td><td>'+M(p)+'</td><td class="'+(b>0.005?'fx-bad':'fx-ok')+'">'+M(b)+'</td><td>'+(b>0.005?btn('Pay',"fx2CrewPay('"+a.id+"')",'btn-success')+' ':'')+btn('Delete',"fx2AsDel('"+a.id+"')")+'</td></tr>';}),'No assignments yet.');
}
window.fx2CrewEdit=function(id){var c=X.crew.find(function(x){return x.id===id;});if(!c)return;$('crId').value=c.id;$('crName').value=c.name;$('crRole').value=c.role||'';$('crPhone').value=c.phone||'';$('crRate').value=c.day_rate;};
window.fx2CrewSave=async function(){var n=gv('crName').trim();if(!n){alert('Name required.');return;}var id=gv('crId');
  try{await send('crew_members',id?'PATCH':'POST',{workspace_id:ws(),name:n,role:gv('crRole'),phone:gv('crPhone'),day_rate:N(gv('crRate'))},id);['crId','crName','crRole','crPhone'].forEach(function(i){$(i).value='';});$('crRate').value=0;loadCrew();}catch(e){alert(e.message);}};
window.fx2CrewDel=async function(id){if(!confirm('Delete crew member? Past assignments are kept.'))return;try{await send('crew_members','DELETE',null,id);loadCrew();}catch(e){alert(e.message);}};
window.fx2AsRate=function(){var c=X.crew.find(function(x){return x.id===gv('asCrew');});if(c)$('asRate').value=c.day_rate;};
window.fx2AssignSave=async function(){var c=X.crew.find(function(x){return x.id===gv('asCrew');}),ev=gv('asEvent').trim();if(!c||!ev){alert('Choose a crew member and event.');return;}
  var d=N(gv('asDays')||1),r=N(gv('asRate'));try{await send('crew_assignments','POST',{workspace_id:ws(),event_name:ev,crew_id:c.id,crew_name:c.name,assign_date:gv('asDate')||managerToday(),days:d,rate:r,amount:d*r});loadCrew();}catch(e){alert(e.message);}};
window.fx2AsDel=async function(id){if(!confirm('Delete this assignment?'))return;try{await send('crew_assignments','DELETE',null,id);loadCrew();}catch(e){alert(e.message);}};
async function pay(kind,ref,party,ev,max){var a=N(prompt('Payment amount (balance '+M(max)+'):',max.toFixed(2)));if(!(a>0))return false;
  var m=prompt('Method (Cash / Bank Transfer / Cheque):','Bank Transfer')||'';var rf=prompt('Reference (optional):','')||'';
  await send('payouts','POST',{workspace_id:ws(),kind:kind,ref_id:ref,party:party,event_name:ev,amount:a,paid_date:managerToday(),method:m,reference:rf});return a;}
window.fx2CrewPay=async function(id){var a=X.assign.find(function(x){return x.id===id;});if(!a)return;try{if(await pay('crew',id,a.crew_name,a.event_name,N(a.amount)-crewPaid(id)))loadCrew();}catch(e){alert(e.message);}};

// ---------- Payables (supplier ledger) ----------
async function loadPay(){try{X.payouts=await get('payouts','paid_date.desc');eventList();renderPay();}catch(e){warn($('pbList'),e);}}
function renderPay(){
  var rows=managerState.rentals.filter(function(r){return r.status!=='cancelled'&&N(r.amount)-N(r.amount_paid)>0.005;}).sort(function(a,b){return String(a.return_date||'9999').localeCompare(String(b.return_date||'9999'));});
  $('pbList').innerHTML=tbl(['Supplier','Item / Event','Due / return','Cost','Paid','Balance',''],rows.map(function(r){var b=N(r.amount)-N(r.amount_paid),late=r.return_date&&r.return_date<managerToday();return '<tr><td>'+esc(r.supplier_name)+'</td><td>'+esc(r.item_description)+'<br><small>'+esc(r.event_name||'')+'</small></td><td class="'+(late?'fx-bad':'')+'">'+managerDate(r.return_date)+'</td><td>'+M(r.amount)+'</td><td>'+M(r.amount_paid)+'</td><td>'+M(b)+'</td><td>'+btn('Add payment',"fx2SupPay('"+r.id+"')",'btn-success')+'</td></tr>';}),'No supplier balances outstanding.');
  $('pbLedger').innerHTML=tbl(['Date','Type','Payee','Event','Amount','Method','Reference'],X.payouts.map(function(p){return '<tr><td>'+managerDate(p.paid_date)+'</td><td>'+esc(p.kind)+'</td><td>'+esc(p.party||'')+'</td><td>'+esc(p.event_name||'')+'</td><td>'+M(p.amount)+'</td><td>'+esc(p.method||'')+'</td><td>'+esc(p.reference||'')+'</td></tr>';}),'No payments recorded yet.');
}
window.fx2SupPay=async function(id){var r=managerState.rentals.find(function(x){return x.id===id;});if(!r)return;
  try{var a=await pay('supplier',id,r.supplier_name,r.event_name,N(r.amount)-N(r.amount_paid));if(a){var np=N(r.amount_paid)+a;await send('equipment_rentals','PATCH',{amount_paid:np},id);r.amount_paid=np;loadPay();}}catch(e){alert(e.message);}};

// ---------- Files ----------
async function loadFiles(){try{X.files=await get('attachments','created_at.desc');eventList();renderFiles();}catch(e){warn($('flList'),e);}}
function renderFiles(){$('flList').innerHTML=tbl(['File','Event','Category','Size','Added',''],X.files.map(function(a){return '<tr><td>'+esc(a.file_name)+'</td><td>'+esc(a.event_name||'')+'</td><td>'+esc(a.category||'')+'</td><td>'+Math.round(N(a.size)/1024)+' KB</td><td>'+String(a.created_at).slice(0,10)+'</td><td>'+btn('Open',"fx2Open('"+a.id+"')")+' '+btn('Delete',"fx2FileDel('"+a.id+"')")+'</td></tr>';}),'No files yet.');}
window.fx2Upload=async function(){var fl=$('flFile').files[0];if(!fl){alert('Choose a file.');return;}if(fl.size>10*1024*1024){alert('Max 10 MB per file.');return;}
  var path=ws()+'/'+Date.now()+'-'+fl.name.replace(/[^A-Za-z0-9._-]/g,'_');
  try{var r=await fetch(sbBase()+'/storage/v1/object/attachments/'+path,{method:'POST',headers:sbHeaders(key(),{'Content-Type':fl.type||'application/octet-stream'}),body:fl});if(!r.ok)throw new Error(await r.text());
    await send('attachments','POST',{workspace_id:ws(),event_name:gv('flEvent').trim(),category:gv('flCat'),file_name:fl.name,path:path,size:fl.size});$('flFile').value='';loadFiles();}catch(e){alert('Upload failed (run migration-v3.sql?): '+e.message);}};
window.fx2Open=async function(id){var a=X.files.find(function(x){return x.id===id;});if(!a)return;try{var r=await fetch(sbBase()+'/storage/v1/object/sign/attachments/'+a.path,{method:'POST',headers:sbHeaders(key()),body:JSON.stringify({expiresIn:600})});if(!r.ok)throw new Error(await r.text());var j=await r.json();window.open(sbBase()+'/storage/v1'+j.signedURL,'_blank');}catch(e){alert(e.message);}};
window.fx2FileDel=async function(id){var a=X.files.find(function(x){return x.id===id;});if(!a||!confirm('Delete '+a.file_name+'?'))return;try{await fetch(sbBase()+'/storage/v1/object/attachments/'+a.path,{method:'DELETE',headers:sbHeaders(key())});await send('attachments','DELETE',null,id);loadFiles();}catch(e){alert(e.message);}};

// ---------- P&L and tax ----------
var PL=[];
function taxOf(x){try{var s=x.snapshot&&x.snapshot.form;if(!s||!s.taxEnabled)return 0;var v=N(s.taxVal),g=N(x.grand_total);return s.taxMode==='amt'?v:g-g/(1+v/100);}catch(e){return 0;}}
async function renderPL(){
  try{X.assign=await get('crew_assignments','created_at.desc');}catch(e){}
  var now=new Date(),mons=[];for(var i=11;i>=0;i--){var d=new Date(now.getFullYear(),now.getMonth()-i,1);mons.push(d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0'));}
  var inM=function(v,m){return String(v||'').slice(0,7)===m;};
  PL=mons.map(function(m){var inv=managerState.invoices.filter(function(x){return x.doc_type!=='Proforma Invoice'&&inM(x.issue_date||x.created_at,m);});
    var rev=sum(inv,function(x){return x.grand_total;})+sum(managerState.equipmentHires.filter(function(h){return h.hire_status!=='cancelled'&&inM(h.hire_date,m);}),function(h){return h.amount;});
    var rc=sum(managerState.rentals.filter(function(r){return r.status!=='cancelled'&&inM(r.rent_date,m);}),function(r){return r.amount;}),ex=sum(managerState.expenses.filter(function(e){return inM(e.expense_date,m);}),function(e){return e.amount;}),cr=sum(X.assign.filter(function(a){return inM(a.assign_date,m);}),function(a){return a.amount;});
    var tax=sum(inv,taxOf);return {m:m,rev:rev,rent:rc,exp:ex,crew:cr,cost:rc+ex+cr,profit:rev-rc-ex-cr,tax:tax,net:sum(inv,function(x){return x.grand_total;})-tax};});
  var mx=Math.max.apply(null,PL.map(function(p){return Math.max(p.rev,p.cost);}).concat([1])),W=720,H=230,bw=(W-40)/12,svg='<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;max-width:'+W+'px" role="img" aria-label="Monthly revenue and cost">';
  PL.forEach(function(p,i){var x=30+i*bw,h1=170*p.rev/mx,h2=170*p.cost/mx;svg+='<rect x="'+(x+3)+'" y="'+(190-h1)+'" width="'+(bw/2-4)+'" height="'+h1+'" fill="var(--accent)"/><rect x="'+(x+bw/2)+'" y="'+(190-h2)+'" width="'+(bw/2-4)+'" height="'+h2+'" fill="#888"/><text x="'+(x+bw/2)+'" y="208" font-size="10" text-anchor="middle" fill="var(--text2)">'+p.m.slice(5)+'</text>';});
  svg+='<text x="30" y="226" font-size="11" fill="var(--text2)">■ Revenue (accent)   ■ Cost (grey) — peak '+M(mx)+'</text></svg>';
  $('plChart').innerHTML=svg;
  $('plTable').innerHTML=tbl(['Month','Revenue','Rentals','Expenses','Crew','Profit'],PL.map(function(p){return '<tr><td>'+p.m+'</td><td>'+M(p.rev)+'</td><td>'+M(p.rent)+'</td><td>'+M(p.exp)+'</td><td>'+M(p.crew)+'</td><td class="'+(p.profit>=0?'fx-ok':'fx-bad')+'">'+M(p.profit)+'</td></tr>';}),'No data.');
  $('taxTable').innerHTML=tbl(['Month','Invoiced (incl. tax)','Tax collected','Net of tax'],PL.map(function(p){return '<tr><td>'+p.m+'</td><td>'+M(p.net+p.tax)+'</td><td>'+M(p.tax)+'</td><td>'+M(p.net)+'</td></tr>';}),'No data.');
}
window.fx2PlCsv=function(){var rows=[['Month','Revenue','Rentals','Expenses','Crew','Profit','Tax collected']].concat(PL.map(function(p){return [p.m,p.rev,p.rent,p.exp,p.crew,p.profit,p.tax.toFixed(2)];}));
  var a=document.createElement('a');a.href=URL.createObjectURL(new Blob([rows.map(function(r){return r.join(',');}).join('\n')],{type:'text/csv'}));a.download='profit-and-loss.csv';a.click();};

// ---------- Audit log ----------
window.fx2LoadAudit=async function(){try{X.audit=await get('audit_log','created_at.desc','&limit=300'.replace('&limit=300',''));
  $('auList').innerHTML=tbl(['When','User','Action','Table','Record','Details'],X.audit.slice(0,300).map(function(a){return '<tr><td>'+String(a.created_at).replace('T',' ').slice(0,16)+'</td><td>'+esc(a.user_email||'')+'</td><td>'+esc(a.action)+'</td><td>'+esc(a.table_name)+'</td><td><small>'+esc(String(a.record_id||'').slice(0,8))+'</small></td><td><small>'+esc(String(a.details||'').slice(0,160))+'</small></td></tr>';}),'No entries yet.');}catch(e){warn($('auList'),e);}};
var _f=window.fetch.bind(window),AU={POST:'create',PATCH:'update',DELETE:'delete'};
window.fetch=async function(u,o){var r=await _f(u,o);
  try{var m=o&&String(o.method||'').toUpperCase();if(AU[m]&&typeof u==='string'&&u.indexOf('/rest/v1/')>0&&r.ok&&typeof PROFILE_CURRENT!=='undefined'&&PROFILE_CURRENT&&PROFILE_CURRENT.active){
    var t=u.split('/rest/v1/')[1].split('?')[0];if(t==='audit_log'||t==='invoice_app_state')return r;
    var id=(u.match(/[?&]id=eq\.([^&]+)/)||[])[1]||'',d='';if(typeof o.body==='string'){try{var b=JSON.parse(o.body);delete b.snapshot;delete b.workspace_id;d=JSON.stringify(b).slice(0,500);}catch(e){}}
    _f(rest('audit_log'),{method:'POST',headers:sbHeaders(key()),body:JSON.stringify({workspace_id:ws(),user_email:PROFILE_CURRENT.email||PROFILE_CURRENT.full_name||'',action:AU[m],table_name:t,record_id:decodeURIComponent(id),details:d})}).catch(function(){});}}catch(e){}
  return r;};

// ---------- Tax presets in the document editor ----------
function taxPresets(){try{return JSON.parse(localStorage.getItem('emx:taxPresets'))||[{label:'VAT',pct:18}];}catch(e){return [{label:'VAT',pct:18}];}}
function taxUI(){var tf=$('taxFields');if(!tf||$('fxTaxPreset'))return;var w=document.createElement('div');w.style.cssText='display:flex;gap:4px;margin:6px 0';
  w.innerHTML='<select id="fxTaxPreset" style="flex:1"></select><button type="button" class="btn btn-sm" title="Save current label/value as a preset" id="fxTaxSave"><i class="ti ti-device-floppy"></i></button>';tf.parentNode.insertBefore(w,tf);
  var fill=function(){$('fxTaxPreset').innerHTML='<option value="">Tax preset…</option>'+taxPresets().map(function(p,i){return '<option value="'+i+'">'+esc(p.label)+' '+p.pct+'%</option>';}).join('');};fill();
  $('fxTaxPreset').onchange=function(){var p=taxPresets()[this.value];if(!p)return;$('taxEnabled').checked=true;toggleField('taxFields',true);$('taxLabel').value=p.label;$('taxMode').value='pct';$('taxVal').value=p.pct;render();};
  $('fxTaxSave').onclick=function(){var l=gv('taxLabel').trim(),v=N(gv('taxVal'));if(!l||gv('taxMode')!=='pct'||!(v>=0)){alert('Set a label and a percentage value first.');return;}var a=taxPresets().filter(function(p){return p.label!==l||p.pct!==v;});a.push({label:l,pct:v});localStorage.setItem('emx:taxPresets',JSON.stringify(a));fill();};}

function boot(){inject();taxUI();eventList();}
window.addEventListener('DOMContentLoaded',boot);
})();
