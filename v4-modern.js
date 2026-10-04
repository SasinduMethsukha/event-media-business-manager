
/* Event Media OS v4 — unified dashboard and progress analytics */
(function(){
  'use strict';

  function esc4(v){
    return typeof esc==='function' ? esc(v) : String(v==null?'':v).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});
  }
  function num(v){return Number(v||0);}
  function money(v){return typeof managerMoney==='function' ? managerMoney(v) : num(v).toLocaleString();}
  function monthKey(d){
    if(!d)return '';
    var s=String(d);
    return s.length>=7?s.slice(0,7):'';
  }
  function monthsBack(n){
    var a=[],d=new Date();
    d.setDate(1);
    for(var i=n-1;i>=0;i--){
      var x=new Date(d.getFullYear(),d.getMonth()-i,1);
      a.push({key:x.toISOString().slice(0,7),label:x.toLocaleDateString(undefined,{month:'short'})});
    }
    return a;
  }
  function yearOf(d){return d?String(d).slice(0,4):'';}

  function sumsForMonths(){
    var st=window.managerState||{};
    var ms=monthsBack(12);
    var map={};
    ms.forEach(function(m){map[m.key]={revenue:0,collected:0,cost:0};});
    (st.invoices||[]).forEach(function(x){
      if(x.doc_type!=='Invoice' && x.doc_type!=='Proforma Invoice')return;
      var k=monthKey(x.issue_date||x.created_at);
      if(map[k])map[k].revenue+=num(x.grand_total);
    });
    (st.paymentReceipts||[]).forEach(function(x){
      var k=monthKey(x.payment_date||x.receipt_date||x.created_at);
      if(map[k])map[k].collected+=num(x.amount);
    });
    (st.payments||[]).forEach(function(x){
      var k=monthKey(x.payment_date||x.created_at);
      if(map[k])map[k].collected+=num(x.amount);
    });
    (st.rentals||[]).forEach(function(x){
      var k=monthKey(x.rent_date||x.created_at);
      if(map[k])map[k].cost+=num(x.amount);
    });
    (st.expenses||[]).forEach(function(x){
      var k=monthKey(x.expense_date||x.created_at);
      if(map[k])map[k].cost+=num(x.amount);
    });
    return ms.map(function(m){return Object.assign({key:m.key,label:m.label},map[m.key]);});
  }

  function pathFor(rows,key,w,h,pad,max){
    var usableW=w-pad*2, usableH=h-pad*2;
    return rows.map(function(r,i){
      var x=pad+(rows.length===1?usableW/2:(i/(rows.length-1))*usableW);
      var y=pad+usableH-(num(r[key])/Math.max(max,1))*usableH;
      return (i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1);
    }).join(' ');
  }

  function lineChart(rows){
    var w=760,h=225,p=28,max=1;
    rows.forEach(function(r){max=Math.max(max,r.revenue,r.collected);});
    max*=1.12;
    var grid='',labels='',dots='';
    [0,.25,.5,.75,1].forEach(function(v){
      var y=p+(h-p*2)-(v*(h-p*2));
      grid+='<line class="v4-gridline" x1="'+p+'" y1="'+y+'" x2="'+(w-p)+'" y2="'+y+'"/>';
    });
    rows.forEach(function(r,i){
      var x=p+(i/(rows.length-1))*(w-p*2);
      labels+='<text class="v4-axis" x="'+x+'" y="'+(h-7)+'" text-anchor="middle">'+esc4(r.label)+'</text>';
      if(i%2===0){
        var y=p+(h-p*2)-(num(r.revenue)/Math.max(max,1))*(h-p*2);
        dots+='<circle class="v4-dot" cx="'+x+'" cy="'+y+'" r="3"/>';
      }
    });
    return '<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Monthly revenue and collected trend">'+
      grid+labels+
      '<path class="v4-line-revenue" d="'+pathFor(rows,'revenue',w,h,p,max)+'"/>'+
      '<path class="v4-line-collected" d="'+pathFor(rows,'collected',w,h,p,max)+'"/>'+dots+'</svg>';
  }

  function barChart(rows){
    var w=520,h=225,p=26,max=1;
    rows.forEach(function(r){max=Math.max(max,r.revenue);});
    var innerW=w-p*2, slot=innerW/rows.length, bars='',labels='';
    rows.forEach(function(r,i){
      var bh=(num(r.revenue)/Math.max(max,1))*(h-p*2);
      var bw=Math.max(8,slot*.58),x=p+i*slot+(slot-bw)/2,y=h-p-bh;
      bars+='<rect class="v4-bar" x="'+x.toFixed(1)+'" y="'+y.toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+Math.max(1,bh).toFixed(1)+'" rx="3"/>';
      labels+='<text class="v4-axis" x="'+(x+bw/2).toFixed(1)+'" y="'+(h-7)+'" text-anchor="middle">'+esc4(r.label)+'</text>';
    });
    return '<svg viewBox="0 0 '+w+' '+h+'" role="img" aria-label="Monthly revenue bars"><line class="v4-gridline" x1="'+p+'" y1="'+(h-p)+'" x2="'+(w-p)+'" y2="'+(h-p)+'"/>'+bars+labels+'</svg>';
  }

  function currentYearRows(){
    var st=window.managerState||{},year=String(new Date().getFullYear()),rows=[];
    for(var m=0;m<12;m++){
      var d=new Date(Number(year),m,1);
      var k=year+'-'+String(m+1).padStart(2,'0');
      rows.push({key:k,label:d.toLocaleDateString(undefined,{month:'short'}),revenue:0});
    }
    (st.invoices||[]).forEach(function(x){
      if(x.doc_type!=='Invoice' && x.doc_type!=='Proforma Invoice')return;
      var k=monthKey(x.issue_date||x.created_at),r=rows.find(function(a){return a.key===k;});
      if(r)r.revenue+=num(x.grand_total);
    });
    return rows;
  }

  function renderV4(){
    var pane=document.getElementById('managerPane-dashboard');
    if(!pane)return;
    var old=document.getElementById('v4Dashboard');
    if(old)old.remove();

    var rows=sumsForMonths(),yrRows=currentYearRows();
    var thisMonth=rows[rows.length-1],year=String(new Date().getFullYear());
    var ytd=yrRows.reduce(function(s,r){return s+r.revenue;},0);
    var defaultMonthly=Math.max(1,Math.round(Math.max.apply(null,rows.map(function(r){return r.revenue;}))*1.1));
    var monthlyTarget=Number(localStorage.getItem('eventmedia:v4:monthlyTarget')||defaultMonthly);
    var annualTarget=Number(localStorage.getItem('eventmedia:v4:annualTarget')||Math.max(monthlyTarget*12,1));
    var pct=Math.min(100,Math.round(ytd/Math.max(annualTarget,1)*100));

    var root=document.createElement('div');
    root.id='v4Dashboard';
    root.className='v4-dashboard';
    root.innerHTML=
      '<div class="v4-dashboard-head">'+
        '<div><div class="v4-kicker">Business overview</div><div class="v4-title">Performance, cash flow & progress</div></div>'+
        '<div class="v4-controls">'+
          '<label class="v4-kicker" for="v4MonthlyTarget">Monthly target</label><input class="v4-target" id="v4MonthlyTarget" type="number" min="0" step="1000" value="'+monthlyTarget+'">'+
          '<label class="v4-kicker" for="v4AnnualTarget">Year target</label><input class="v4-target" id="v4AnnualTarget" type="number" min="0" step="1000" value="'+annualTarget+'">'+
        '</div>'+
      '</div>'+
      '<div class="v4-progress-card">'+
        '<div><div class="v4-progress-title">'+year+' revenue progress</div><div class="v4-progress-meta">'+money(ytd)+' of '+money(annualTarget)+' annual target</div><div class="v4-progress-track"><div class="v4-progress-fill" style="width:'+pct+'%"></div></div></div>'+
        '<div class="v4-progress-value">'+pct+'%</div>'+
      '</div>'+
      '<div class="v4-chart-grid">'+
        '<div class="v4-chart-card"><div class="v4-chart-title">12-month revenue trend</div><div class="v4-chart-sub">Billed versus collected, using the saved business records.</div><div class="v4-svg-wrap">'+lineChart(rows)+'</div><div class="v4-legend"><span><i class="v4-dotkey"></i>Revenue billed</span><span><i class="v4-dotkey muted"></i>Cash collected</span></div></div>'+
        '<div class="v4-chart-card"><div class="v4-chart-title">Year-to-date revenue</div><div class="v4-chart-sub">'+year+' monthly performance.</div><div class="v4-svg-wrap">'+barChart(yrRows)+'</div></div>'+
      '</div>'+
      '<div class="v4-year-grid">'+
        '<div class="v4-chart-card"><div class="v4-chart-title">Monthly target tracker</div><div class="v4-chart-sub">Current month versus your target.</div><div class="v4-list" style="margin-top:18px">'+
          rows.slice(-6).map(function(r){var p=Math.min(100,Math.round(r.revenue/Math.max(monthlyTarget,1)*100));return '<div class="v4-row"><div class="v4-row-label">'+esc4(r.label)+'</div><div class="v4-row-track"><div class="v4-row-fill" style="width:'+p+'%"></div></div><div class="v4-row-value">'+p+'%</div></div>';}).join('')+
        '</div></div>'+
        '<div class="v4-chart-card"><div class="v4-chart-title">Event pipeline</div><div class="v4-chart-sub">Live status counts from your event register.</div><div class="v4-status-grid" style="margin-top:18px">'+
          ['planned','confirmed','in progress','completed'].map(function(s){var c=((window.__v4Events||[]).filter(function(e){return String(e.status||'').toLowerCase()===s;}).length);return '<div class="v4-status"><b>'+c+'</b><span>'+esc4(s)+'</span></div>';}).join('')+
        '</div></div>'+
      '</div>';

    pane.insertBefore(root,pane.firstChild);

    var mt=document.getElementById('v4MonthlyTarget'),at=document.getElementById('v4AnnualTarget');
    if(mt)mt.onchange=function(){localStorage.setItem('eventmedia:v4:monthlyTarget',String(Math.max(0,num(this.value))));renderV4();};
    if(at)at.onchange=function(){localStorage.setItem('eventmedia:v4:annualTarget',String(Math.max(0,num(this.value))));renderV4();};
  }

  async function refresh(){
    var st=window.managerState||{};
    window.__v4Events=window.__v4Events||[];
    try{
      if(typeof sbBase==='function' && typeof sbHeaders==='function' && typeof gv==='function' && gv('sbWorkspace')){
        var url=sbBase()+'/rest/v1/events?workspace_id=eq.'+encodeURIComponent(gv('sbWorkspace'))+'&select=status&limit=1000';
        var r=await fetch(url,{headers:sbHeaders(gv('sbKey').trim())});
        if(r.ok) window.__v4Events=await r.json();
      }
    }catch(e){}
    renderV4();
  }

  function install(){
    if(typeof window.renderManagerDashboard==='function' && !window.renderManagerDashboard.__v4){
      var original=window.renderManagerDashboard;
      function wrapped(){original.apply(this,arguments);refresh();}
      wrapped.__v4=true;
      window.renderManagerDashboard=wrapped;
    }
    // The v3 event module owns its state privately; discover event statuses from the DOM data when available.
    setTimeout(function(){refresh();},250);
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',install);else install();
})();
