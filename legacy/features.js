// Event Media OS v2 add-ons: Clients, Quote pipeline, Inventory + availability, Receivables ageing + reminders.
(function(){
var FX={clients:[],quotes:[],inventory:[]}, PANES=['fxclients','fxquotes','fxinventory','fxreceivables'];
var TABS=[['fxclients','Clients','ti-address-book'],['fxquotes','Quotes','ti-file-check'],['fxinventory','Inventory','ti-packages'],['fxreceivables','Receivables','ti-clock-dollar']];
var $=function(id){return document.getElementById(id);};
var ws=function(){return gv('sbWorkspace').trim();};
var key=function(){return gv('sbKey').trim();};
function rest(t,q){return sbBase()+'/rest/v1/'+t+(q||'');}
async function send(table,method,body,id){
  var r=await fetch(rest(table,id?'?id=eq.'+encodeURIComponent(id):''),{method:method,headers:sbHeaders(key(),{Prefer:'return=representation'}),body:body?JSON.stringify(body):undefined});
  if(!r.ok)throw new Error(await r.text()||('HTTP '+r.status));
  return method==='DELETE'?null:r.json();
}
function warn(el,e){el.innerHTML='<div class="manager-alert">Could not load. Run <strong>migration-v2.sql</strong> in Supabase first. '+esc(e.message||e)+'</div>';}
function field(id,label,type,extra){return '<div><label>'+label+'</label><input id="'+id+'" type="'+(type||'text')+'" '+(extra||'')+'></div>';}
function card(title,body){return '<div class="manager-card"><div class="manager-card-head"><div class="manager-card-title">'+title+'</div></div><div class="manager-card-body">'+body+'</div></div>';}

// ---------- UI injection ----------
function inject(){
  var mv=$('managerView'); if(!mv||$('managerTab-fxclients'))return;
  var tabs=mv.querySelector('.manager-tabs');
  TABS.forEach(function(t){var b=document.createElement('button');b.className='manager-tab admin-only';b.id='managerTab-'+t[0];b.innerHTML='<i class="ti '+t[2]+'"></i> '+t[1];b.onclick=function(){showManagerPane(t[0]);};tabs.appendChild(b);});
  var html={
  fxclients:card('Clients','<input type="hidden" id="clId"><div class="fx-form">'+field('clName','Client / company *')+field('clContact','Contact person')+field('clEmail','Email','email')+field('clPhone','Phone')+field('clWa','WhatsApp (94…)')+field('clTerms','Payment terms (days)','number','value="30" min="0"')+'<div style="grid-column:1/-1"><label>Address</label><input id="clAddr"></div></div><div class="fx-row"><button class="btn" onclick="fxClientReset()">Clear</button><button class="btn btn-primary" onclick="fxClientSave()"><i class="ti ti-device-floppy"></i> Save client</button></div>')+
    card('Client list &amp; statement','<div id="clList"></div><div id="clStatement"></div>'),
  fxquotes:card('Quotation pipeline','<div id="qMetrics" class="fx-note"></div><div id="qList"></div><div class="fx-note">Convert opens the quotation as a new Invoice with a fresh number. Review it, then press Save.</div>'),
  fxinventory:card('Equipment inventory','<input type="hidden" id="invId"><div class="fx-form">'+field('invName','Equipment name *')+field('invQty','Qty owned','number','value="1" min="0"')+field('invSerial','Serial numbers')+'<div><label>Condition</label><select id="invCond"><option>good</option><option>needs service</option><option>damaged</option><option>retired</option></select></div></div><div class="fx-row"><button class="btn" onclick="fxInvReset()">Clear</button><button class="btn btn-primary" onclick="fxInvSave()"><i class="ti ti-device-floppy"></i> Save item</button></div>')+
    card('Availability check','<div class="fx-form">'+field('avStart','From','date')+field('avEnd','To','date')+'</div><div class="fx-row"><button class="btn btn-info" onclick="fxAvail()">Check availability</button></div><div id="avResult"></div>')+
    card('Inventory list','<div id="invList"></div>'),
  fxreceivables:card('Receivables ageing','<div id="arMetrics" class="manager-grid"></div><div id="arTable"></div>')};
  PANES.forEach(function(p){var d=document.createElement('div');d.id='managerPane-'+p;d.style.display='none';d.innerHTML=html[p];mv.appendChild(d);});
  var orig=window.showManagerPane;
  window.showManagerPane=function(name){
    PANES.forEach(function(p){var e=$('managerPane-'+p),t=$('managerTab-'+p);if(e)e.style.display=p===name?'':'none';if(t)t.classList.toggle('active',p===name);});
    if(PANES.indexOf(name)>=0){['dashboard','invoices','payments','rentals','equipmenthire','finance','reports','database','profiles','admin','setup'].forEach(function(x){var e=$('managerPane-'+x),t=$('managerTab-'+x);if(e)e.style.display='none';if(t)t.classList.remove('active');});
      ({fxclients:loadClients,fxquotes:loadQuotes,fxinventory:loadInventory,fxreceivables:renderAR})[name]();return;}
    orig(name);
  };
  // warn about double-booking when saving an equipment hire
  var origHire=window.saveEquipmentHire;
  window.saveEquipmentHire=async function(){
    try{var item=gv('equipmentHireItem').trim(),s=gv('equipmentHireDate'),e=gv('equipmentHireReturnDate')||s,q=Number(gv('equipmentHireQty')||1);
      if(item&&s){await ensureInv();var c=conflict(item,s,e,q,gv('equipmentHireEditId'));if(c&&!confirm(c+'\n\nSave anyway?'))return;}}catch(x){}
    return origHire();
  };
}

// ---------- Clients ----------
async function loadClients(){var el=$('clList');try{FX.clients=await fetchAll('clients','*','name.asc');renderClients();}catch(e){warn(el,e);}}
async function fetchAll(t,sel,order){var r=await fetch(rest(t,'?workspace_id=eq.'+encodeURIComponent(ws())+'&select='+sel+'&order='+order+'&limit=1000'),{headers:sbHeaders(key())});if(!r.ok)throw new Error(await r.text());return r.json();}
function renderClients(){
  var el=$('clList');if(!FX.clients.length){el.innerHTML='<div class="manager-empty">No clients yet.</div>';return;}
  el.innerHTML='<div class="manager-table-wrap"><table class="manager-table"><thead><tr><th>Client</th><th>Contact</th><th>Phone</th><th>Terms</th><th>Actions</th></tr></thead><tbody>'+FX.clients.map(function(c){return '<tr><td><strong>'+esc(c.name)+'</strong><br><small>'+esc(c.email||'')+'</small></td><td>'+esc(c.contact_person||'')+'</td><td>'+esc(c.phone||'')+'</td><td>'+c.payment_terms_days+'d</td><td><button class="btn btn-sm" onclick="fxClientStatement(\''+c.id+'\')">Statement</button> <button class="btn btn-sm" onclick="fxClientEdit(\''+c.id+'\')">Edit</button> <button class="btn btn-sm" onclick="fxClientDel(\''+c.id+'\')">Delete</button></td></tr>';}).join('')+'</tbody></table></div>';
}
window.fxClientReset=function(){['clId','clName','clContact','clEmail','clPhone','clWa','clAddr'].forEach(function(i){$(i).value='';});$('clTerms').value=30;};
window.fxClientEdit=function(id){var c=FX.clients.find(function(x){return x.id===id;});if(!c)return;$('clId').value=c.id;$('clName').value=c.name;$('clContact').value=c.contact_person||'';$('clEmail').value=c.email||'';$('clPhone').value=c.phone||'';$('clWa').value=c.whatsapp||'';$('clAddr').value=c.address||'';$('clTerms').value=c.payment_terms_days;window.scrollTo(0,0);};
window.fxClientSave=async function(){var n=gv('clName').trim();if(!n){alert('Client name is required.');return;}
  var b={workspace_id:ws(),name:n,contact_person:gv('clContact'),email:gv('clEmail'),phone:gv('clPhone'),whatsapp:gv('clWa'),address:gv('clAddr'),payment_terms_days:Number(gv('clTerms')||30),updated_at:new Date().toISOString()};
  try{var id=gv('clId');await send('clients',id?'PATCH':'POST',b,id);fxClientReset();loadClients();}catch(e){alert('Save failed: '+e.message);}};
window.fxClientDel=async function(id){if(!confirm('Delete this client? Existing documents are not affected.'))return;try{await send('clients','DELETE',null,id);loadClients();}catch(e){alert(e.message);}};
window.fxClientStatement=function(id){
  var c=FX.clients.find(function(x){return x.id===id;});if(!c)return;var nm=c.name.toLowerCase();
  var inv=managerState.invoices.filter(function(x){return String(x.client_name||'').toLowerCase().indexOf(nm)>=0;});
  var rows=inv.map(function(x){var t=Number(x.grand_total||0),p=Math.min(invoicePaidAmount(x),t);return '<tr><td>'+esc(x.doc_number)+'</td><td>'+managerDate(x.issue_date)+'</td><td>'+managerDate(x.due_date)+'</td><td>'+managerMoney(t)+'</td><td>'+managerMoney(p)+'</td><td>'+managerMoney(t-p)+'</td><td>'+statusBadge(invoiceStatus(x))+'</td></tr>';}).join('');
  var bal=inv.reduce(function(a,x){var t=Number(x.grand_total||0);return a+t-Math.min(invoicePaidAmount(x),t);},0);
  $('clStatement').innerHTML='<h3 style="margin:1rem 0 .4rem">Statement of account — '+esc(c.name)+'</h3>'+(rows?'<div class="manager-table-wrap"><table class="manager-table"><thead><tr><th>Invoice</th><th>Issued</th><th>Due</th><th>Total</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>'+rows+'</tbody></table></div><p><strong>Outstanding: '+managerMoney(bal)+'</strong></p><button class="btn btn-sm" onclick="window.print()"><i class="ti ti-printer"></i> Print</button>':'<div class="manager-empty">No invoices matched this client name. Matching uses the saved client name.</div>');
};

// ---------- Quotes ----------
var QS=['draft','sent','accepted','rejected','expired','converted'];
async function loadQuotes(){var el=$('qList');try{FX.quotes=(await fetchAll('invoice_documents','id,doc_number,client_name,event_name,grand_total,due_date,quote_status,converted_to,created_at','created_at.desc&doc_type=eq.Quotation'));renderQuotes();}catch(e){warn(el,e);}}
function renderQuotes(){
  var q=FX.quotes,won=q.filter(function(x){return x.quote_status==='accepted'||x.quote_status==='converted';}),dec=q.filter(function(x){return x.quote_status!=='draft'&&x.quote_status!=='sent';});
  var val=function(a){return a.reduce(function(s,x){return s+Number(x.grand_total||0);},0);};
  $('qMetrics').innerHTML='<strong>'+q.length+'</strong> quotations · open value <strong>'+managerMoney(val(q.filter(function(x){return x.quote_status==='draft'||x.quote_status==='sent';})))+'</strong> · won value <strong>'+managerMoney(val(won))+'</strong> · win rate <strong>'+(dec.length?Math.round(100*won.length/dec.length)+'%':'—')+'</strong>';
  $('qList').innerHTML=q.length?'<div class="manager-table-wrap"><table class="manager-table"><thead><tr><th>Quote</th><th>Client / Event</th><th>Total</th><th>Status</th><th>Actions</th></tr></thead><tbody>'+q.map(function(x){return '<tr><td>'+esc(x.doc_number)+'</td><td>'+esc(x.client_name)+'<br><small>'+esc(x.event_name||'')+'</small></td><td>'+managerMoney(x.grand_total)+'</td><td><select onchange="fxQuoteStatus(\''+x.id+'\',this.value)">'+QS.map(function(s){return '<option'+(s===(x.quote_status||'draft')?' selected':'')+'>'+s+'</option>';}).join('')+'</select>'+(x.converted_to?'<br><small>→ '+esc(x.converted_to)+'</small>':'')+'</td><td><div style="display:flex;gap:4px"><button class="btn btn-sm" onclick="fxReviseQuote(\''+x.id+'\')" title="Create revision from this quotation"><i class="ti ti-git-branch"></i> Revise</button><button class="btn btn-sm btn-primary" onclick="fxConvert(\''+x.id+'\')">Convert to Invoice</button></div></td></tr>';}).join('')+'</tbody></table></div>':'<div class="manager-empty">Save a Quotation from the generator and it appears here.</div>';
}
window.fxQuoteStatus=async function(id,s){try{await send('invoice_documents','PATCH',{quote_status:s},id);loadQuotes();}catch(e){alert(e.message);}};
window.fxReviseQuote=async function(id){
  var q=FX.quotes.find(function(x){return x.id===id;});
  closeManager();await loadSavedDoc(id);
  var curNum=gv('docNum')||(q?q.doc_number:'');
  var revNum=(typeof bumpDocRevision==='function')?bumpDocRevision(curNum):(curNum+'-Rev1');
  document.getElementById('docNum').value=revNum;
  docNumManual=true;
  render();
  alert('Quotation '+(curNum||'')+' loaded as Revision '+revNum+'.\n\nMake your changes (add or remove items) and press Save to keep both versions.');
};
window.fxConvert=async function(id){
  var q=FX.quotes.find(function(x){return x.id===id;});
  closeManager();await loadSavedDoc(id);setDocType('Invoice');
  try{await regenerateDocNum();}catch(e){}
  var n=gv('docNum');document.getElementById('issueDate').value=managerToday();render();
  try{await send('invoice_documents','PATCH',{quote_status:'converted',converted_to:n},id);}catch(e){}
  alert('Quotation '+(q?q.doc_number:'')+' loaded as Invoice '+n+'. Review and press Save.');
};

// ---------- Inventory ----------
async function ensureInv(){if(!FX.inventory.length)FX.inventory=await fetchAll('equipment_inventory','*','name.asc');}
async function loadInventory(){var el=$('invList');try{FX.inventory=await fetchAll('equipment_inventory','*','name.asc');renderInventory();}catch(e){warn(el,e);}}
function renderInventory(){var el=$('invList');el.innerHTML=FX.inventory.length?'<div class="manager-table-wrap"><table class="manager-table"><thead><tr><th>Item</th><th>Owned</th><th>Condition</th><th>Serials</th><th>Actions</th></tr></thead><tbody>'+FX.inventory.map(function(i){return '<tr><td><strong>'+esc(i.name)+'</strong></td><td>'+i.qty_owned+'</td><td>'+esc(i.condition)+'</td><td>'+esc(i.serial_numbers||'')+'</td><td><button class="btn btn-sm" onclick="fxInvEdit(\''+i.id+'\')">Edit</button> <button class="btn btn-sm" onclick="fxInvDel(\''+i.id+'\')">Delete</button></td></tr>';}).join('')+'</tbody></table></div>':'<div class="manager-empty">No inventory yet. Add the equipment you own.</div>';}
window.fxInvReset=function(){['invId','invName','invSerial'].forEach(function(i){$(i).value='';});$('invQty').value=1;};
window.fxInvEdit=function(id){var i=FX.inventory.find(function(x){return x.id===id;});if(!i)return;$('invId').value=i.id;$('invName').value=i.name;$('invQty').value=i.qty_owned;$('invSerial').value=i.serial_numbers||'';$('invCond').value=i.condition;};
window.fxInvSave=async function(){var n=gv('invName').trim();if(!n){alert('Name required.');return;}var id=gv('invId');
  try{await send('equipment_inventory',id?'PATCH':'POST',{workspace_id:ws(),name:n,qty_owned:Number(gv('invQty')||1),serial_numbers:gv('invSerial'),condition:gv('invCond'),updated_at:new Date().toISOString()},id);fxInvReset();loadInventory();}catch(e){alert(e.message);}};
window.fxInvDel=async function(id){if(!confirm('Delete item?'))return;try{await send('equipment_inventory','DELETE',null,id);loadInventory();}catch(e){alert(e.message);}};
function booked(name,s,e,skipId){
  var n=name.toLowerCase();
  return (managerState.equipmentHires||[]).filter(function(h){return h.id!==skipId&&h.hire_status!=='returned'&&h.hire_status!=='cancelled'&&String(h.item_description||'').toLowerCase().indexOf(n)>=0&&h.hire_date<=e&&(h.return_date||h.hire_date)>=s;}).reduce(function(a,h){return a+Number(h.quantity||1);},0);
}
function conflict(item,s,e,q,skipId){
  var it=item.toLowerCase();var inv=FX.inventory.find(function(i){return it.indexOf(i.name.toLowerCase())>=0;});if(!inv)return '';
  var used=booked(inv.name,s,e,skipId);if(used+q>Number(inv.qty_owned))return 'Double-booking risk: you own '+inv.qty_owned+' × '+inv.name+', '+used+' already out/booked in that period, this hire needs '+q+'.';return '';
}
window.fxAvail=async function(){var s=gv('avStart'),e=gv('avEnd')||s;if(!s){alert('Choose a start date.');return;}
  try{await ensureInv();}catch(x){warn($('avResult'),x);return;}
  $('avResult').innerHTML=FX.inventory.length?'<div class="manager-table-wrap"><table class="manager-table"><thead><tr><th>Item</th><th>Owned</th><th>Booked</th><th>Available</th></tr></thead><tbody>'+FX.inventory.filter(function(i){return i.condition!=='retired';}).map(function(i){var b=booked(i.name,s,e),a=Number(i.qty_owned)-b;return '<tr><td>'+esc(i.name)+'</td><td>'+i.qty_owned+'</td><td>'+b+'</td><td class="'+(a>0?'fx-ok':'fx-bad')+'">'+a+'</td></tr>';}).join('')+'</tbody></table></div><div class="fx-note">Bookings are matched by inventory name appearing in the hire description.</div>':'<div class="manager-empty">Add inventory first.</div>';};

// ---------- Receivables ----------
function renderAR(){
  var today=new Date(managerToday()+'T00:00:00'),B={cur:0,d30:0,d60:0,d90:0},rows=[];
  managerState.invoices.forEach(function(x){var t=Number(x.grand_total||0),bal=t-Math.min(invoicePaidAmount(x),t);if(bal<=0.005)return;
    var due=x.due_date?new Date(x.due_date+'T00:00:00'):null,days=due?Math.floor((today-due)/864e5):0,k=days<=0?'cur':days<=30?'d30':days<=60?'d60':'d90';B[k]+=bal;rows.push({x:x,bal:bal,days:days});});
  $('arMetrics').innerHTML=[['Not yet due',B.cur],['1–30 days late',B.d30],['31–60 days late',B.d60],['60+ days late',B.d90]].map(function(m){return '<div class="metric-card"><div class="metric-label">'+m[0]+'</div><div class="metric-value">'+managerMoney(m[1])+'</div></div>';}).join('');
  rows.sort(function(a,b){return b.days-a.days;});
  $('arTable').innerHTML=rows.length?'<div class="manager-table-wrap"><table class="manager-table"><thead><tr><th>Invoice</th><th>Client</th><th>Due</th><th>Days late</th><th>Balance</th><th>Remind</th></tr></thead><tbody>'+rows.map(function(r,i){return '<tr><td>'+esc(r.x.doc_number)+'</td><td>'+esc(r.x.client_name)+'</td><td>'+managerDate(r.x.due_date)+'</td><td class="'+(r.days>0?'fx-bad':'')+'">'+(r.days>0?r.days:'—')+'</td><td>'+managerMoney(r.bal)+'</td><td><button class="btn btn-sm btn-success" onclick="fxRemind('+i+')"><i class="ti ti-brand-whatsapp"></i> WhatsApp</button></td></tr>';}).join('')+'</tbody></table></div>':'<div class="manager-empty">No outstanding invoices.</div>';
  FX.ar=rows;
  if(!FX.clients.length)fetchAll('clients','*','name.asc').then(function(c){FX.clients=c;}).catch(function(){});
}
window.fxRemind=function(i){var r=FX.ar[i];if(!r)return;var nm=String(r.x.client_name||'').toLowerCase();
  var c=FX.clients.find(function(c){return nm.indexOf(c.name.toLowerCase())>=0;});
  var num=((c&&(c.whatsapp||c.phone))||prompt('WhatsApp number (with country code, e.g. 94771234567):')||'').replace(/\D/g,'');if(!num)return;
  var msg='Dear '+((c&&c.contact_person)||r.x.client_name)+',\n\nFriendly reminder: invoice '+r.x.doc_number+' has an outstanding balance of '+managerMoney(r.bal)+(r.x.due_date?' (due '+managerDate(r.x.due_date)+')':'')+'. Kindly arrange payment at your earliest convenience.\n\nThank you,\n'+gv('coName');
  window.open('https://wa.me/'+num+'?text='+encodeURIComponent(msg),'_blank');};

// ---------- Client picker in the document editor ----------
async function addPicker(){
  var f=$('clientName');if(!f||$('fxClientPick'))return;var wrap=f.closest('.field');if(!wrap)return;
  var s=document.createElement('select');s.id='fxClientPick';s.innerHTML='<option value="">Pick saved client…</option>';s.style.marginBottom='6px';
  s.onchange=function(){var c=FX.clients.find(function(x){return x.id===s.value;});if(!c)return;$('clientName').value=c.name;$('clientContact').value=c.contact_person||'';$('clientEmail').value=c.email||'';$('clientAddr').value=c.address||'';render();
    if(c.payment_terms_days&&$('issueDate').value){var d=new Date($('issueDate').value);d.setDate(d.getDate()+c.payment_terms_days);$('dueDate').value=d.toISOString().slice(0,10);render();}};
  wrap.parentNode.insertBefore(s,wrap);
  window.fxRefreshPicker=async function(){try{FX.clients=await fetchAll('clients','*','name.asc');s.innerHTML='<option value="">Pick saved client…</option>'+FX.clients.map(function(c){return '<option value="'+c.id+'">'+esc(c.name)+'</option>';}).join('');}catch(e){}};
  window.fxRefreshPicker();
}
function boot(){inject();addPicker();}
window.addEventListener('DOMContentLoaded',boot);
var t=setInterval(function(){if(typeof PROFILE_CURRENT!=='undefined'&&PROFILE_CURRENT&&PROFILE_CURRENT.active&&typeof isProfileAdmin==='function'&&isProfileAdmin()){clearInterval(t);if(window.fxRefreshPicker)window.fxRefreshPicker();}},1500);
})();
