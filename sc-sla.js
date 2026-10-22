// Official calendar references (reviewed 2026-10-22):
// https://www.indaiatuba.sp.gov.br/comunicacao/imprensa/noticias/34924/prefeitura-divulga-decretos-de-feriados-e-pontos-facultativos-de-2026-
// https://sapl.indaiatuba.sp.leg.br/pysc/download_norma_pysc?cod_norma=8271&texto_original=1
// https://www.ribeiraopreto.sp.gov.br/portal/principal/feriados
// https://prefeitura.sp.gov.br/web/gestao/w/calendario_2026
// https://www.legiscidade.recife.pe.gov.br/lei/09777/
// https://www.alerj.rj.gov.br/Visualizar/Noticia/80212
// https://alerjln1.alerj.rj.gov.br/contlei.nsf/f25edae7e64db53b032564fe005262ef/063f7c027766eab48325744a007a4ab0?OpenDocument
// https://bomjardim.pe.gov.br/noticia/6-de-marco-data-magna/

/* SC SLA v1 — calendars reviewed 2026-10-22. No public-service optional days. */
const SC_SLA_CITIES={'Phal Ind':'Indaiatuba','Phal SPO':'São Paulo','Pharmabag':'Ribeirão Preto','Clinutri':'Recife','Nutriente':'Rio de Janeiro'};
const SC_SLA_DAY=86400000,SC_SLA_HOLIDAYS=new Map();
function scDay(value){
 if(value===null||value===undefined||value==='')return null;
 if(typeof value==='number')return Number.isInteger(value)?value:null;
 let y,m,d,match;
 if(typeof value==='string'&&(match=value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s.*)?$/))){d=+match[1];m=+match[2];y=+match[3];}
 else if(typeof value==='string'&&(match=value.match(/^(\d{4})-(\d{2})-(\d{2})$/))){y=+match[1];m=+match[2];d=+match[3];}
 else{const date=new Date(value);if(isNaN(date))return null;const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(date);const p=Object.fromEntries(parts.map(x=>[x.type,x.value]));y=+p.year;m=+p.month;d=+p.day;}
 if(y<1900||y>2200)return null;const date=new Date(Date.UTC(y,m-1,d));return date.getUTCFullYear()===y&&date.getUTCMonth()===m-1&&date.getUTCDate()===d?Math.floor(date/SC_SLA_DAY):null;
}
function scTodayDay(){return scDay(new Date());}
function scDateBR(day){if(day===null)return 'Sem aprovação';const d=new Date(day*SC_SLA_DAY);return String(d.getUTCDate()).padStart(2,'0')+'/'+String(d.getUTCMonth()+1).padStart(2,'0')+'/'+d.getUTCFullYear();}
function scEaster(y){const a=y%19,b=Math.floor(y/100),c=y%100,d=Math.floor(b/4),e=b%4,f=Math.floor((b+8)/25),g=Math.floor((b-f+1)/3),h=(19*a+b-d-g+15)%30,i=Math.floor(c/4),k=c%4,l=(32+2*e+2*i-h-k)%7,m=Math.floor((a+11*h+22*l)/451),n=h+l-7*m+114;return Math.floor(Date.UTC(y,Math.floor(n/31)-1,n%31+1)/SC_SLA_DAY);}
function scHolidaySet(company,year){
 const cache=company+'|'+year;if(SC_SLA_HOLIDAYS.has(cache))return SC_SLA_HOLIDAYS.get(cache);
 const set=new Set(),add=(m,d)=>set.add(Math.floor(Date.UTC(year,m-1,d)/SC_SLA_DAY));
 [[1,1],[4,21],[5,1],[9,7],[10,12],[11,2],[11,15],[12,25]].forEach(x=>add(...x));
 if(year>=2024||company==='Nutriente'||(year>=2023&&['Phal Ind','Phal SPO','Pharmabag'].includes(company)))add(11,20);
 const easter=scEaster(year);set.add(easter-2);
 if(['Phal Ind','Phal SPO','Pharmabag'].includes(company)){add(7,9);set.add(easter+60);}
 if(company==='Phal Ind'){add(2,2);if(year>=2026)add(12,9);}
 if(company==='Phal SPO')add(1,25);
 if(company==='Pharmabag'){add(1,20);add(6,19);}
 if(company==='Clinutri'){add(3,6);add(6,24);add(7,16);add(12,8);}
 if(company==='Nutriente'){add(1,20);add(4,23);set.add(easter-47);if(year>=2026)set.add(easter+60);}
 SC_SLA_HOLIDAYS.set(cache,set);return set;
}
function scIsBusinessDay(day,company){if(day===null||!SC_SLA_CITIES[company])return false;const date=new Date(day*SC_SLA_DAY),dow=date.getUTCDay();return dow!==0&&dow!==6&&!scHolidaySet(company,date.getUTCFullYear()).has(day);}
function scAddBusinessDays(start,n,company){if(start===null||!SC_SLA_CITIES[company])return null;let day=start,count=0;while(count<n){day++;if(scIsBusinessDay(day,company))count++;}return day;}
function scBusinessBetween(start,end,company){if(start===null||end===null||end<start||end-start>36500||!SC_SLA_CITIES[company])return null;let n=0;for(let day=start+1;day<=end;day++)if(scIsBusinessDay(day,company))n++;return n;}
function scSlaDue(r){return scAddBusinessDays(scDay(r.aprovacao),5,r.empresa);}
function scSlaDueDate(r){const d=scSlaDue(r);if(d===null)return null;const civil=new Date(d*SC_SLA_DAY);return new Date(civil.getUTCFullYear(),civil.getUTCMonth(),civil.getUTCDate());}
function scSlaElapsed(r,end=scTodayDay()){return scBusinessBetween(scDay(r.aprovacao),end,r.empresa);}
function scRankCompare(a,b){const ua=a.urgent===true?1:0,ub=b.urgent===true?1:0;return ub-ua||(scDay(a.aprovacao)??Infinity)-(scDay(b.aprovacao)??Infinity)||String(a.sc).localeCompare(String(b.sc),'pt-BR',{numeric:true})||String(a.item).localeCompare(String(b.item),'pt-BR',{numeric:true})||String(a.empresa).localeCompare(String(b.empresa));}
function scIssueRecords(data,orders){
 const rows=new Map(data.map(r=>[[r.empresa,r.sc,r.item].join('|'),r])),out=new Map();
 for(const order of orders){const items=Array.isArray(order.sourceItems)&&order.sourceItems.length?order.sourceItems:(order.sourceSC?[{sc:order.sourceSC,item:order.sourceItem}]:[]);
 for(const item of items){const key=[order.company,item.sc,item.item].join('|'),r=rows.get(key);if(!r)continue;
 const issue=scDay(item.pcIssuedAt||item.addedAt||order.issuedAt),approval=scDay(r.aprovacao),days=scBusinessBetween(approval,issue,r.empresa),due=scSlaDue(r);
 if(issue===null||approval===null||days===null||due===null)continue;
 const type=item.additionOrigin?'direta':(['cotacao','direta'].includes(item.purchaseType)?item.purchaseType:(['cotacao','direta'].includes(order.purchaseType)?order.purchaseType:'unknown'));
 const record={r,order,item,issue,approval,days,due,type,onTime:issue<=due};
 if(!out.has(key)||issue<out.get(key).issue)out.set(key,record);
 }}return [...out.values()];
}
let SC_SLA_CHART=null,SC_SLA_CHART_SIGNATURE='';
function renderScSlaDashboard(data,orders,spec){
 const summary=document.getElementById('sc-sla-summary');if(!summary)return;
 const start=scDay(spec.start),end=scDay(spec.end),now=scTodayDay();
 const inRange=d=>d!==null&&(start===null||d>=start)&&(end===null||d<end);
 const allRecords=scIssueRecords(data,orders);
 const records=allRecords.filter(x=>spec.key==='portfolio'?new Date(x.issue*SC_SLA_DAY).getUTCFullYear()===new Date(now*SC_SLA_DAY).getUTCFullYear()&&new Date(x.issue*SC_SLA_DAY).getUTCMonth()===new Date(now*SC_SLA_DAY).getUTCMonth():inRange(x.issue));
 const opened=data.filter(r=>isOpen(r)&&(spec.key==='portfolio'||spec.key==='all'||inRange(scDay(r.aprovacao))));
 const typed=['cotacao','direta','unknown'],labels=['Com cotação','Somente emissão','Não classificado'];
 summary.innerHTML=typed.map((type,i)=>{const group=records.filter(x=>x.type===type),avg=group.length?group.reduce((n,x)=>n+x.days,0)/group.length:null,onTime=group.filter(x=>x.onTime).length;return '<div class="order-mgmt-card"><strong>'+(avg===null?'—':avg.toLocaleString('pt-BR',{maximumFractionDigits:1})+' d.u.')+'</strong><span>'+labels[i]+'</span><small>'+group.length+' itens atendidos · '+(group.length?Math.round(onTime/group.length*100)+'% no prazo':'sem amostra')+'</small></div>';}).join('');
 const buckets=[0,0,0,0,0,0,0];let missing=0;
 opened.forEach(r=>{const age=scSlaElapsed(r,now);if(age===null){missing++;return;}const due=scSlaDue(r);buckets[due<now?6:Math.min(age,5)]++;});
 const ageBox=document.getElementById('sc-sla-age');ageBox.innerHTML=['Aprovados hoje / dia 0','1 dia útil','2 dias úteis','3 dias úteis','4 dias úteis','5º dia / prazo final','Vencidos'].map((label,i)=>'<div class="sc-age-cell"><strong>'+buckets[i]+'</strong><span>'+label+'</span></div>').join('');
 const linkedKeys=new Set(orders.flatMap(o=>(o.sourceItems?.length?o.sourceItems:o.sourceSC?[{sc:o.sourceSC,item:o.sourceItem}]:[]).map(x=>[o.company,x.sc,x.item].join('|'))));
 const excluded=data.filter(r=>linkedKeys.has([r.empresa,r.sc,r.item].join('|'))&&!allRecords.some(x=>x.r===r)).length;
 document.getElementById('sc-sla-note').textContent='Amostra por SC/item, sem duplicação. Fim: emissão do PC ou inclusão posterior registrada. Carteira sem aprovação/calendário válido: '+missing+' itens. Itens vinculados sem datas válidas, fora da média: '+excluded+'. O tempo total inclui esperas com terceiros. Pedidos sem SC não entram neste SLA.';
 const groups=['cotacao','direta'].map(type=>records.filter(x=>x.type===type)),averages=groups.map(g=>g.length?g.reduce((n,x)=>n+x.days,0)/g.length:null),signature=JSON.stringify([averages,groups.map(g=>g.length)]);
 if(typeof Chart!=='undefined'&&signature!==SC_SLA_CHART_SIGNATURE){if(SC_SLA_CHART)SC_SLA_CHART.destroy();SC_SLA_CHART_SIGNATURE=signature;SC_SLA_CHART=new Chart(document.getElementById('sc-sla-chart'),{type:'bar',data:{labels:['Com cotação','Somente emissão'],datasets:[{label:'Tempo médio (dias úteis)',data:averages,backgroundColor:['#5284af','#36a684'],borderRadius:6},{type:'line',label:'Prazo: 5 dias úteis',data:[5,5],borderColor:'#d79639',borderDash:[5,4],pointRadius:0}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'bottom'}},scales:{y:{beginAtZero:true,title:{display:true,text:'Dias úteis'}}}}});}
}
