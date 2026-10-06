const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const root=path.resolve(__dirname,'..');
(async()=>{const b=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
for(const d of JSON.parse(fs.readFileSync(path.join(root,'assets/manifest.json'))).diagrams){
 const page=await b.newPage({viewport:{width:d.width,height:d.height},deviceScaleFactor:2});
 await page.goto('file://'+path.join(root,'assets',d.file+'.svg'));
 await page.evaluate(async()=>{await document.fonts.ready;});
 await page.screenshot({path:path.join(root,'assets',d.file+'.png')});
 // Check every visible text bounding box for canvas overflow.
 const errors=await page.evaluate(()=>Array.from(document.querySelectorAll('text')).map(e=>({t:e.textContent,b:e.getBBox()})).filter(({b})=>b.x<0||b.y<0||b.x+b.width>1440));
 if(errors.length)throw new Error(JSON.stringify(errors));
 await page.close();console.log('Rendered '+d.file);
}await b.close();})().catch(e=>{console.error(e);process.exit(1)});
