const {chromium}=require('playwright');
const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
 const page=await browser.newPage({viewport:{width:1440,height:640},deviceScaleFactor:1});
 await page.goto('file://'+path.join(__dirname,'hero.html'));
 await page.waitForFunction(()=>window.ready);
 await page.evaluate(()=>{window.pauseAnimation=true;});
 const full=process.argv.includes('--full');
 const times=full?Array.from({length:270},(_,i)=>i/25):[0,1.44,2.7,3.36,3.78,4.56,5.76,6.6,8.1,9.3,10.02,10.76];
 const out=path.join(root,'qa',full?'frames':'keyframes');fs.mkdirSync(out,{recursive:true});
 if(full){for(const name of fs.readdirSync(out)){if(/^\d{4}\.png$/.test(name)&&Number(name.slice(0,4))>=times.length)fs.unlinkSync(path.join(out,name));}}
 for(let i=0;i<times.length;i++){
  await page.evaluate(t=>{renderFrame(t);},times[i]);
  await page.screenshot({path:path.join(out,full?`${String(i).padStart(4,'0')}.png`:`${times[i].toFixed(2)}.png`)});
  if(full&&i%50===0)console.log(`Rendered ${i}/${times.length}`);
 }
 await browser.close();console.log('Rendered '+times.length+' frames.');
})().catch(e=>{console.error(e);process.exit(1)});
