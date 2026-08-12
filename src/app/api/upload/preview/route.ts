import { inflateRawSync } from 'node:zlib';
import { NextResponse } from 'next/server';
export const runtime = 'nodejs';

const friendly = 'File Excel gagal dibaca. Pastikan file menggunakan format .xlsx, .xls, atau .csv dan tidak rusak.';
const decodeXml = (s:string) => s.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
function unzipEntries(buffer:Buffer) {
  const files = new Map<string,Buffer>(); let p=0;
  while (p+30<buffer.length && buffer.readUInt32LE(p)===0x04034b50) {
    const method=buffer.readUInt16LE(p+8), packed=buffer.readUInt32LE(p+18), nameLen=buffer.readUInt16LE(p+26), extraLen=buffer.readUInt16LE(p+28);
    const name=buffer.subarray(p+30,p+30+nameLen).toString(); const start=p+30+nameLen+extraLen; const chunk=buffer.subarray(start,start+packed);
    if(method===0) files.set(name,chunk); else if(method===8) files.set(name,inflateRawSync(chunk));
    p=start+packed;
  }
  return files;
}
function parseSheet(xml:string, shared:string[]) {
  return [...xml.matchAll(/<row\b[^>]*>([\s\S]*?)<\/row>/g)].map(row=>{const cells:string[]=[];for(const m of row[1].matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)){const ref=m[1].match(/r="([A-Z]+)\d+"/)?.[1];if(!ref)continue;const col=[...ref].reduce((n,c)=>n*26+c.charCodeAt(0)-64,0)-1;const type=m[1].match(/t="([^"]+)"/)?.[1];const value=m[2].match(/<v>([\s\S]*?)<\/v>/)?.[1]??m[2].match(/<t[^>]*>([\s\S]*?)<\/t>/)?.[1]??'';cells[col]=decodeXml(type==='s'?(shared[Number(value)]??''):value)}return cells.map(x=>x??'')});
}
function parseXlsx(buffer:Buffer) {
  const files=unzipEntries(buffer); if(!files.size)throw new Error('Invalid ZIP workbook');
  const sharedXml=files.get('xl/sharedStrings.xml')?.toString()??'';
  const shared=[...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/g)].map(m=>decodeXml([...m[1].matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map(x=>x[1]).join('')));
  const workbook=files.get('xl/workbook.xml')?.toString()??''; const rels=files.get('xl/_rels/workbook.xml.rels')?.toString()??'';
  const relationships=Object.fromEntries([...rels.matchAll(/<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g)].map(m=>[m[1],m[2]]));
  const sheets=[...workbook.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*(?:r:id|id)="([^"]+)"[^>]*\/?\s*>/g)].map((m,i)=>{const target=relationships[m[2]]??`worksheets/sheet${i+1}.xml`;const path=target.startsWith('/')?target.slice(1):`xl/${target.replace(/^\.\//,'')}`;const xml=files.get(path)?.toString();return {name:decodeXml(m[1]),rows:xml?parseSheet(xml,shared):[]}});
  if(!sheets.length){const xml=files.get('xl/worksheets/sheet1.xml')?.toString();if(xml)sheets.push({name:'Sheet1',rows:parseSheet(xml,shared)})} return sheets;
}
function csv(text:string){return text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(Boolean).map(line=>{const out:string[]=[];let v='',q=false;for(let i=0;i<=line.length;i++){const c=line[i];if(c==='"'&&line[i+1]==='"'){v+='"';i++}else if(c==='"')q=!q;else if((c===','||c===';'||i===line.length)&&!q){out.push(v.trim());v=''}else v+=c??''}return out})}
export async function POST(req:Request){try{const form=await req.formData(),file=form.get('file');if(!(file instanceof File))return NextResponse.json({error:'File tidak ditemukan.'},{status:400});const ext=file.name.split('.').pop()?.toLowerCase();const buffer=Buffer.from(await file.arrayBuffer());if(!['xlsx','xls','csv'].includes(ext??''))return NextResponse.json({error:friendly},{status:400});if(ext==='xls'&&buffer.subarray(0,8).toString('hex')==='d0cf11e0a1b11ae1')return NextResponse.json({error:'File .xls lama belum didukung. Simpan ulang sebagai .xlsx atau CSV.'},{status:400});const sheets=ext==='xlsx'?parseXlsx(buffer):[{name:'Sheet1',rows:csv(buffer.toString('utf8'))}];return NextResponse.json({fileName:file.name,sheets})}catch(e){console.error('Excel parse failed',e);return NextResponse.json({error:friendly},{status:400})}}
