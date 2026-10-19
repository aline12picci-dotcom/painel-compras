(function(){
'use strict';

var PREVIEW=null;
var HEADER_ALIASES={
  company:['empresa','filial','unidade'],order:['pedido','numero pedido','n pedido','ordem de compra','purchase order','po'],item:['item','item pedido','sequencia','seq'],
  supplier:['fornecedor','razao social','supplier'],description:['descricao','material','produto','item descricao'],delivery:['previsao','data entrega','entrega prevista','dt entrega','prazo entrega','delivery date'],
  buyer:['comprador','responsavel','buyer'],status:['status','situacao'],quantity:['quantidade','qtd'],unit:['unidade','um']
};
function norm(s){return String(s==null?'':s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();}
function val(row,headers,key){var aliases=HEADER_ALIASES[key]||[];var h=headers.find(function(x){var n=norm(x);return aliases.some(function(a){return n===a||n.indexOf(a)>=0;});});return h?row[h]:'';}
function asDate(v){
  if(v instanceof Date&&!isNaN(v))return v;
  if(typeof v==='number'&&window.XLSX){var d=XLSX.SSF.parse_date_code(v);if(d)return new Date(d.y,d.m-1,d.d);}
  var s=String(v||'').trim(),m=s.match(/(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})/);if(m){var y=Number(m[3]);if(y<100)y+=2000;return new Date(y,Number(m[2])-1,Number(m[1]));}
  var d2=new Date(s);return isNaN(d2)?null:d2;
}
function isoDay(v){var d=asDate(v);return d?d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'):'';}
function dayDiff(date){var d=asDate(date);if(!d)return 0;d.setHours(0,0,0,0);var now=new Date();now.setHours(0,0,0,0);return Math.max(0,Math.floor((now-d)/86400000));}
function keyOf(x){return [norm(x.company||'Pharmabag'),String(x.order||'').replace(/^0+/,''),String(x.item||'1').replace(/^0+/,'')].join('|');}
function rowsFromHtml(html){
  var doc=new DOMParser().parseFromString(html||'','text/html'),best=Array.from(doc.querySelectorAll('table')).sort(function(a,b){return b.rows.length-a.rows.length;})[0];
  if(!best)return [];
  var matrix=Array.from(best.rows).map(function(r){return Array.from(r.cells).map(function(c){return c.textContent.trim();});}).filter(function(r){return r.some(Boolean);});
  return matrixToObjects(matrix);
}
function matrixToObjects(matrix){
  if(!matrix||matrix.length<2)return [];
  var headerIndex=matrix.findIndex(function(r){return r.some(function(c){var n=norm(c);return HEADER_ALIASES.order.some(function(a){return n===a||n.indexOf(a)>=0;});});});
  if(headerIndex<0)headerIndex=0;var headers=matrix[headerIndex].map(function(h,i){return String(h||('coluna '+(i+1))).trim();});
  return matrix.slice(headerIndex+1).filter(function(r){return r.some(Boolean);}).map(function(r){var o={};headers.forEach(function(h,i){o[h]=r[i]==null?'':r[i];});return o;});
}
function rowsFromText(text){
  var lines=String(text||'').split(/\r?\n/).map(function(x){return x.trim();}).filter(Boolean);if(lines.length<2)return [];
  var sample=lines.slice(0,5).join('\n'),sep=(sample.match(/\t/g)||[]).length?'\t':((sample.match(/;/g)||[]).length>=((sample.match(/,/g)||[]).length)?';':',');
  return matrixToObjects(lines.map(function(line){return line.split(sep).map(function(x){return x.replace(/^['\"]|['\"]$/g,'').trim();});}));
}
function normalizeRows(rows){
  if(!rows.length)return [];
  var headers=Object.keys(rows[0]);return rows.map(function(r){
    var order=String(val(r,headers,'order')||'').trim();if(!order)return null;
    return {company:String(val(r,headers,'company')||'Pharmabag').trim()||'Pharmabag',order:order,item:String(val(r,headers,'item')||'0001').trim(),supplier:String(val(r,headers,'supplier')||'').trim(),description:String(val(r,headers,'description')||'').trim(),deliveryDate:isoDay(val(r,headers,'delivery')),buyer:String(val(r,headers,'buyer')||'').trim(),sourceStatus:String(val(r,headers,'status')||'').trim(),quantity:String(val(r,headers,'quantity')||'').trim(),unit:String(val(r,headers,'unit')||'').trim()};
  }).filter(Boolean).filter(function(x,i,a){return a.findIndex(function(y){return keyOf(y)===keyOf(x);})===i;});
}
async function parseMsg(file){
  var mod=await import('https://esm.sh/@kenjiuno/msgreader@1.28.0');var MsgReader=mod.default||mod.MsgReader;if(!MsgReader)throw new Error('Leitor MSG indisponível.');
  var reader=new MsgReader(await file.arrayBuffer()),info=reader.getFileData();
  var rows=rowsFromHtml(info.bodyHTML||info.htmlBody||'');if(!rows.length)rows=rowsFromText(info.body||'');
  if(!rows.length&&Array.isArray(info.attachments)){
    for(var i=0;i<info.attachments.length;i++){
      var att=reader.getAttachment(info.attachments[i]),name=String(att.fileName||'').toLowerCase();
      if(/\.(xlsx?|csv)$/.test(name)&&window.XLSX){var wb=XLSX.read(att.content,{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]];rows=XLSX.utils.sheet_to_json(ws,{defval:''});if(rows.length)break;}
    }
  }
  return {rows:rows,subject:info.subject||'',messageDate:info.messageDeliveryTime||info.clientSubmitTime||info.creationTime||''};
}
async function parseFile(file){
  var ext=(file.name.split('.').pop()||'').toLowerCase(),rows=[],meta={subject:'',messageDate:''};
  if(ext==='msg'){meta=await parseMsg(file);rows=meta.rows;}
  else if(ext==='html'||ext==='htm'){rows=rowsFromHtml(await file.text());}
  else if(ext==='txt'||ext==='csv'){rows=rowsFromText(await file.text());}
  else if((ext==='xlsx'||ext==='xls')&&window.XLSX){var wb=XLSX.read(await file.arrayBuffer(),{type:'array'}),ws=wb.Sheets[wb.SheetNames[0]];rows=XLSX.utils.sheet_to_json(ws,{defval:''});}
  else throw new Error('Formato não reconhecido. Use MSG, XLSX, CSV, HTML ou TXT.');
  return {items:normalizeRows(rows),subject:meta.subject||'',messageDate:meta.messageDate||''};
}
window.importFollowupWorkflow=async function(input){
  var file=input.files&&input.files[0];if(!file)return;var box=document.getElementById('fu-preview');box.hidden=false;box.innerHTML='<p class="quote-muted">Lendo '+esc(file.name)+'…</p>';
  try{var parsed=await parseFile(file);if(!parsed.items.length)throw new Error('Nenhuma linha com número de pedido foi identificada. O arquivo não foi gravado.');PREVIEW={file:file.name,items:parsed.items,subject:parsed.subject,messageDate:parsed.messageDate,readAt:new Date().toISOString()};renderPreview();}
  catch(e){PREVIEW=null;box.innerHTML='<div class="fu-error"><strong>Não foi possível preparar a importação.</strong><br>'+esc(e.message)+'<br><small>Nada foi alterado. Se o layout do e-mail mudou, envie um exemplo para ajustarmos o mapeamento.</small></div>';}
  finally{input.value='';}
};
function comparison(item){var old=(FOLLOWUP.items||[]).find(function(x){return keyOf(x)===keyOf(item);});if(!old)return {label:'Novo atraso',cls:'new'};if(old.status==='Baixado pelo workflow')return {label:'Reaberto',cls:'reopened'};var oldDays=Number(old.daysLateAtImport==null?dayDiff(old.deliveryDate):old.daysLateAtImport),newDays=dayDiff(item.deliveryDate);if(old.deliveryDate&&item.deliveryDate&&old.deliveryDate!==item.deliveryDate)return {label:'Previsão alterada',cls:'changed'};if(newDays>oldDays)return {label:'Atraso agravado',cls:'worse'};return {label:'Permanece atrasado',cls:'persistent'};}
function renderPreview(){
  var box=document.getElementById('fu-preview'),items=PREVIEW.items,oldActive=(FOLLOWUP.items||[]).filter(function(x){return x.status!=='Baixado pelo workflow'&&norm(x.company)==='pharmabag';}),keys=new Set(items.map(keyOf)),closing=oldActive.filter(function(x){return !keys.has(keyOf(x));});
  box.innerHTML='<div class="fu-preview-head"><div><strong>Prévia segura · '+esc(PREVIEW.file)+'</strong><br><small>'+items.length+' itens identificados · '+closing.length+' sairão da pendência</small></div><button class="ctrl-btn" onclick="confirmFollowupImport()">Confirmar importação</button></div><div class="tbl-wrap"><table class="fu-table"><thead><tr><th>Resultado</th><th>Empresa</th><th>Pedido/item</th><th>Fornecedor</th><th>Previsão</th><th>Dias atraso</th></tr></thead><tbody>'+items.slice(0,100).map(function(x){var c=comparison(x);return '<tr><td><span class="fu-pill '+c.cls+'">'+c.label+'</span></td><td>'+esc(x.company)+'</td><td><strong>'+esc(x.order)+'</strong> / '+esc(x.item)+'</td><td>'+esc(x.supplier||'—')+'</td><td>'+esc(x.deliveryDate||'—')+'</td><td>'+dayDiff(x.deliveryDate)+'</td></tr>';}).join('')+'</tbody></table></div>'+(closing.length?'<p class="fu-warning"><strong>Atenção:</strong> '+closing.length+' item(ns) que estavam no workflow anterior não aparecem neste arquivo e serão movidos para o histórico como “Baixado pelo workflow”.</p>':'');
}
window.confirmFollowupImport=function(){
  if(!PREVIEW)return;var now=new Date().toISOString(),existing=FOLLOWUP.items||[],incomingKeys=new Set(PREVIEW.items.map(keyOf)),companyKeys=new Set(PREVIEW.items.map(function(x){return norm(x.company);}));
  existing.forEach(function(old){if(old.status!=='Baixado pelo workflow'&&companyKeys.has(norm(old.company))&&!incomingKeys.has(keyOf(old))){old.status='Baixado pelo workflow';old.closedAt=now;old.closedBy=ACTIVE_USER;old.lastImportFile=PREVIEW.file;old.clientMutationAt=now;old.history=(old.history||[]).concat([{at:now,type:'Baixado pelo workflow',file:PREVIEW.file,user:ACTIVE_USER}]);}});
  PREVIEW.items.forEach(function(item){var old=existing.find(function(x){return keyOf(x)===keyOf(item);}),c=comparison(item),days=dayDiff(item.deliveryDate);if(old){Object.assign(old,item,{status:c.label,daysLateAtImport:days,lastSeenAt:now,lastImportFile:PREVIEW.file,clientMutationAt:now});old.history=(old.history||[]).concat([{at:now,type:c.label,file:PREVIEW.file,user:ACTIVE_USER,daysLate:days}]);}else{existing.push(Object.assign(item,{id:'FU-'+Date.now()+'-'+Math.random().toString(36).slice(2,7),status:c.label,daysLateAtImport:days,firstSeenAt:now,lastSeenAt:now,lastImportFile:PREVIEW.file,createdBy:ACTIVE_USER,clientMutationAt:now,history:[{at:now,type:c.label,file:PREVIEW.file,user:ACTIVE_USER,daysLate:days}]}));}});
  FOLLOWUP.items=existing;FOLLOWUP.imports=(FOLLOWUP.imports||[]).concat([{id:'FUI-'+Date.now(),file:PREVIEW.file,subject:PREVIEW.subject||'',messageDate:PREVIEW.messageDate||'',importedAt:now,importedBy:ACTIVE_USER,count:PREVIEW.items.length}]).slice(-60);AUDIT.unshift({ts:Date.now(),user:ACTIVE_USER,empresa:'Pharmabag',sc:'Follow-up',item:'Workflow',field:'Importação confirmada',before:'—',after:PREVIEW.file+' · '+PREVIEW.items.length+' itens'});PREVIEW=null;document.getElementById('fu-preview').hidden=true;triggerSave();renderFollowup();toast('Workflow importado e comparado com sucesso.','ok',3500);
};
function businessAge(x){return typeof businessDaysSince==='function'?businessDaysSince(x):dayDiff(x);}
window.updateFollowupTreatment=function(id,value){var x=(FOLLOWUP.items||[]).find(function(r){return r.id===id;});if(!x)return;var now=new Date().toISOString();x.treatment=String(value||'').trim();x.lastTreatmentAt=now;x.treatmentBy=ACTIVE_USER;x.clientMutationAt=now;x.history=(x.history||[]).concat([{at:now,type:'Tratativa atualizada',user:ACTIVE_USER,text:x.treatment}]);triggerSave();renderFollowup();};
window.renderFollowup=function(){
  if(!document.getElementById('fu-body'))return;var q=norm((document.getElementById('fu-search')||{}).value||''),status=(document.getElementById('fu-filter')||{}).value||'active',all=FOLLOWUP.items||[],active=all.filter(function(x){return x.status!=='Baixado pelo workflow';}),rows=all.filter(function(x){if(status==='active'&&x.status==='Baixado pelo workflow')return false;if(status==='closed'&&x.status!=='Baixado pelo workflow')return false;if(status!=='active'&&status!=='closed'&&status&&x.status!==status)return false;return !q||norm([x.order,x.item,x.supplier,x.description,x.buyer,x.treatment].join(' ')).indexOf(q)>=0;}).sort(function(a,b){return dayDiff(b.deliveryDate)-dayDiff(a.deliveryDate);});
  var counts={new:active.filter(function(x){return x.status==='Novo atraso';}).length,persistent:active.filter(function(x){return /Permanece|agravado/.test(x.status);}).length,closed:all.filter(function(x){return x.status==='Baixado pelo workflow';}).length,reopened:active.filter(function(x){return x.status==='Reaberto';}).length,untreated:active.filter(function(x){return businessAge(x.lastTreatmentAt||x.firstSeenAt)>=3;}).length};
  [['fu-current',active.length],['fu-new',counts.new],['fu-persistent',counts.persistent],['fu-closed',counts.closed],['fu-reopened',counts.reopened],['fu-untreated',counts.untreated]].forEach(function(p){var e=document.getElementById(p[0]);if(e)e.textContent=p[1];});
  document.getElementById('fu-body').innerHTML=rows.length?rows.map(function(x){var age=businessAge(x.lastTreatmentAt||x.firstSeenAt),cls=x.status==='Baixado pelo workflow'?'closed':x.status==='Reaberto'?'reopened':x.status==='Novo atraso'?'new':x.status==='Previsão alterada'?'changed':x.status==='Atraso agravado'?'worse':'persistent';return '<tr><td><span class="fu-pill '+cls+'">'+esc(x.status)+'</span>'+(age>=3&&x.status!=='Baixado pelo workflow'?'<br><span class="fu-stale">Sem tratativa há '+age+' d.u.</span>':'')+'</td><td><strong>'+esc(x.order)+'</strong><br><small>Item '+esc(x.item)+'</small></td><td>'+esc(x.supplier||'—')+'</td><td class="desc">'+esc(x.description||'—')+'</td><td>'+esc(x.deliveryDate||'—')+'<br><strong class="danger-num">'+dayDiff(x.deliveryDate)+' dias</strong></td><td>'+esc(x.buyer||'—')+'</td><td><textarea class="fu-treatment" placeholder="Registrar cobrança, retorno e próxima ação" onchange="updateFollowupTreatment(\''+x.id+'\',this.value)">'+esc(x.treatment||'')+'</textarea><small>'+esc(x.treatmentBy||'')+(x.lastTreatmentAt?' · '+fmtDateTime(x.lastTreatmentAt):'')+'</small></td><td>'+esc(x.lastImportFile||'—')+'<br><small>'+fmtDateTime(x.lastSeenAt||x.closedAt)+'</small></td></tr>';}).join(''):'<tr><td colspan="8" class="priority-empty">Nenhum item para este filtro.</td></tr>';
  var last=(FOLLOWUP.imports||[]).slice(-1)[0],meta=document.getElementById('fu-last-import');if(meta)meta.textContent=last?'Último workflow: '+last.file+' · '+fmtDateTime(last.importedAt)+' · '+last.count+' itens':'Nenhum workflow importado ainda.';
  var since=Date.now()-7*86400000,entered=all.filter(function(x){return Date.parse(x.firstSeenAt||0)>=since;}).length,closedWeek=all.filter(function(x){return Date.parse(x.closedAt||0)>=since;}).length,reopenedWeek=all.filter(function(x){return (x.history||[]).some(function(h){return h.type==='Reaberto'&&Date.parse(h.at||0)>=since;});}).length,week=document.getElementById('fu-week');if(week)week.textContent='Comparativo dos últimos 7 dias: '+entered+' entraram em atraso · '+closedWeek+' foram baixados pelo workflow · '+reopenedWeek+' reabriram.';
};
})();
