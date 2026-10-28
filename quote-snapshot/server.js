// Experimental on-demand browser automation. TradingView prohibits automated data collection.
const http = require('http');
const {chromium} = require('playwright');
const PORT = Number(process.env.PORT || 8002);
const SITE_URL = process.env.SITE_URL || 'http://127.0.0.1:8001/';
const allowed = new Set((process.env.ALLOWED_ORIGINS || '').split(',').map(x=>x.trim()).filter(Boolean));
const groups = {forex:['EURUSD','GBPUSD','USDJPY','USDCHF'],commodities:['XAUUSD','XAGUSD','USOIL','BCOUSD'],indices:['SPXUSD','US30','NSXUSD']};
const all = [...groups.forex,...groups.commodities,...groups.indices];
let busy=false, last=new Map();
const send=(res,status,data,origin)=>{const h={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};if(origin && allowed.has(origin))h['Access-Control-Allow-Origin']=origin;res.writeHead(status,h);res.end(JSON.stringify(data))};
http.createServer(async(req,res)=>{
 const origin=req.headers.origin;
 if(origin && !allowed.has(origin))return send(res,403,{error:'origin_not_allowed'});
 if(req.method!=='GET')return send(res,405,{error:'method_not_allowed'},origin);
 const u=new URL(req.url,'http://localhost');if(u.pathname!=='/api/quotes')return send(res,404,{error:'not_found'},origin);
 const category=u.searchParams.get('category');if(!['forex','commodities','indices','all'].includes(category))return send(res,400,{error:'invalid_category'},origin);
 const ip=req.socket.remoteAddress,now=Date.now(); if(now-(last.get(ip)||0)<5000)return send(res,429,{error:'try_later'},origin); last.set(ip,now); if(last.size>10000)last.clear();
 if(busy)return send(res,503,{error:'busy'},origin);busy=true;let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});const page=await browser.newPage({viewport:{width:430,height:900}});
  await page.goto(SITE_URL,{waitUntil:'domcontentloaded',timeout:30000});
  // The unmodified public widget supplies the test data. No login or bypass is used.
  await page.locator('#vx-share-prices').click();
  await page.selectOption('#vx-capture-category',category);
  const frame=page.frameLocator('#vx-capture-widget iframe');const symbols=category==='all'?all:groups[category];
  await frame.getByText(symbols[0],{exact:true}).waitFor({timeout:20000});
  await page.waitForTimeout(9000);
  const lines=(await frame.locator('body').innerText()).split('\n').map(x=>x.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069\u00a0]/g,'').trim());
  const quotes=symbols.map(symbol=>{let i=lines.indexOf(symbol);let value=i>=0?lines[i+2]:'';return {symbol,price:/^[0-9][0-9,.]*$/.test(value)?value:null}});
  if(!quotes.some(x=>x.price))return send(res,502,{error:'quotes_unavailable'},origin);
  send(res,200,{quotes,capturedAt:new Date().toISOString(),source:'TradingView widget',notice:'Collection time; quote timestamps are unavailable and data may be delayed.'},origin);
 }catch(err){console.error('quote test failed:',String(err.message).slice(0,250));send(res,502,{error:'quotes_unavailable'},origin)}finally{if(browser)await browser.close().catch(()=>{});busy=false}
}).listen(PORT,process.env.HOST||'127.0.0.1',()=>console.log('Quote service listening on',PORT));
