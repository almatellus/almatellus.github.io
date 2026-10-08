const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '..', 'SumUp.gs'), 'utf8');
const range = { from: '2026-10-08', to: '2026-10-08' };

function romeMidnight(text) {
  const [year, month, date] = text.slice(0,10).split('-').map(Number);
  const wanted = Date.UTC(year, month-1, date);
  let instant = wanted;
  const formatter = new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Rome',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
  for (let i=0; i<3; i++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(p=>[p.type,p.value]));
    const local = Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second));
    instant += wanted-local;
  }
  return new Date(instant);
}

function app(pages=[], options={}) {
  const calls=[], reads=[];
  const context = vm.createContext({
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>{
      reads.push(key);
      if (options.unconfigured) return null;
      return key==='SUMUP_API_KEY' ? 'fixture-local-only-secret' : 'MTEST';
    }})},
    Utilities:{parseDate:romeMidnight},
    controllaAccessoRichiesteWeb_:()=>{if(options.denied) throw new Error('Accesso riservato');},
    UrlFetchApp:{fetch:(url, config)=>{
      calls.push({url,config});
      if(options.networkError) throw new Error('Transport accidentally includes fixture-local-only-secret');
      const result = pages[calls.length-1];
      if(!result) throw new Error('Unexpected fetch');
      return {getResponseCode:()=>result.http || 200,getContentText:()=>JSON.stringify(result.body || result)};
    }},
    HtmlService:{createTemplateFromFile:()=>{throw new Error('Template must not be available in tests');}}
  });
  vm.runInContext(source,context);
  return { context,calls,reads };
}

function payment(id, extra={}) {
  return Object.assign({id,transaction_code:'CODE_'+id,type:'PAYMENT',amount:15,currency:'EUR',timestamp:'2026-10-08T11:00:00Z',status:'SUCCESSFUL',payment_type:'ECOM',refunded_amount:0},extra);
}

test('elenco e dettaglio negano accesso prima di leggere segreti o interrogare SumUp',()=>{
  const {context,calls,reads}=app([],{denied:true});
  assert.throws(()=>context.sumupWebIncassi(range),/Accesso riservato/);
  assert.throws(()=>context.sumupWebDettaglio('transaction1'),/Accesso riservato/);
  assert.equal(calls.length,0); assert.equal(reads.length,0);
});

test('senza credenziali non restituisce falsi totali pari a zero',()=>{
  const {context,calls}=app([],{unconfigured:true});
  const result=context.sumupWebIncassi(range);
  assert.equal(result.configured,false); assert.equal(result.totals,undefined); assert.equal(result.items,undefined);
  assert.equal(calls.length,0);
});

test('paginazione, doppioni, rimborsi parziali e contanti non alterano i totali',()=>{
  const {context,calls}=app([
    {items:[payment('one'),payment('partial',{amount:5,status:'REFUNDED',refunded_amount:2}),payment('failed',{status:'FAILED'})],links:[{rel:'next',href:'limit=100&newest_ref=event2&order=descending'}]},
    {items:[payment('one'),payment('refund-event',{type:'REFUND',amount:2}),payment('cash',{payment_type:'CASH'})],links:[]}
  ]);
  const result=context.sumupWebIncassi(range);
  assert.equal(result.complete,true); assert.equal(result.items.length,3);
  assert.equal(result.totals[0].count,2); assert.equal(result.totals[0].grossCents,2000);
  assert.equal(result.totals[0].refundedCents,200); assert.equal(result.totals[0].retainedCents,1800);
  assert.equal(calls.length,2);
  assert.equal(new URL(calls[1].url).searchParams.get('newest_ref'),'event2');
  for(const call of calls){assert.equal(call.config.method,'get');assert.equal(call.config.followRedirects,false);assert.equal(new URL(call.url).origin,'https://api.sumup.com');}
  assert.ok(!JSON.stringify(result).includes('fixture-local-only-secret'));
});

test('un rimborso di importo ignoto non viene trattato come rimborso zero',()=>{
  const p=payment('unknown-refund',{status:'REFUNDED'});delete p.refunded_amount;
  const {context}=app([{items:[p],links:[]}]);
  const result=context.sumupWebIncassi(range);
  assert.equal(result.totals[0].refundedCents,null);assert.equal(result.totals[0].retainedCents,null);
});

test('le valute diverse non vengono sommate',()=>{
  const {context}=app([{items:[payment('eur'),payment('usd',{currency:'USD',amount:10})],links:[]}]);
  const result=context.sumupWebIncassi(range);
  assert.equal(result.totals.length,2);assert.equal(result.totals[0].currency,'EUR');assert.equal(result.totals[0].grossCents,1500);
  assert.equal(result.totals[1].currency,'USD');assert.equal(result.totals[1].grossCents,1000);
});

test('intervallo inclusivo nel fuso italiano e cambio dell’ora di ottobre',()=>{
  const {context}=app();
  const regular=context.sumupIntervallo_(range);
  assert.equal(regular.oldest,'2026-10-07T22:00:00.000Z'); assert.equal(regular.newest,'2026-10-08T22:00:00.000Z');
  const dst=context.sumupIntervallo_({from:'2026-10-25',to:'2026-10-25'});
  assert.equal(Date.parse(dst.newest)-Date.parse(dst.oldest),25*3600000);
  assert.throws(()=>context.sumupIntervallo_({from:'2026-02-30',to:'2026-03-01'}),/date valide/);
  assert.throws(()=>context.sumupIntervallo_({from:'2026-10-09',to:'2026-10-08'}),/precedere/);
});

test('riferimenti di pagina non autorizzano mai richieste ad altri host',()=>{
  const {context,calls}=app([{items:[payment('one')],links:[{rel:'next',href:'https://attacker.invalid/collect?newest_ref=x'}]}]);
  assert.throws(()=>context.sumupWebIncassi(range),/pagina non valido/);assert.equal(calls.length,1);
});

test('le transazioni fuori intervallo non entrano nei totali dopo la paginazione',()=>{
  const {context}=app([{items:[payment('inside'),payment('before',{timestamp:'2026-10-07T21:59:59Z'}),payment('next-day',{timestamp:'2026-10-08T22:00:00Z'})],links:[]}]);
  const result=context.sumupWebIncassi(range);assert.equal(result.items.length,1);assert.equal(result.totals[0].grossCents,1500);
});

test('dettagli senza commissione non inventano zero e non restituiscono dati grezzi',()=>{
  const {context}=app([{id:'one',transaction_code:'CODE_one',amount:15,currency:'EUR',status:'SUCCESSFUL',username:'private@example.invalid',card:{last_4_digits:'1234',type:'VISA'}}]);
  const result=context.sumupWebDettaglio('one');assert.equal(result.feeCents,null);assert.equal(result.lastFour,'1234');assert.equal(result.username,undefined);
});

test('errori di trasporto e di autenticazione non espongono credenziali',()=>{
  const failed=app([],{networkError:true});
  assert.throws(()=>failed.context.sumupWebIncassi(range),error=>/collegarsi a SumUp/.test(error.message)&&!error.message.includes('fixture-local-only-secret'));
  const denied=app([{http:401,body:{detail:'fixture-local-only-secret'}}]);
  assert.throws(()=>denied.context.sumupWebIncassi(range),error=>/chiave API/.test(error.message)&&!error.message.includes('fixture-local-only-secret'));
});
