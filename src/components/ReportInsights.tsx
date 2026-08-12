'use client';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ReportType } from '@/lib/reports';
type Row=Record<string,unknown>;
const monthKeys=['jan','feb','mar','apr','mei','may','jun','jul','agu','aug','sep','okt','oct','nov','des','dec'];
const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)?v:0;
const label=(r:Row)=>String(r.department??r.category??r.month??r.bulan??r.status??r.account??r.no??'-');
function aggregate(rows:Row[]){return Object.values(rows.reduce<Record<string,{name:string;budget:number;actual:number;value:number;count:number}>>((all,row)=>{const name=label(row);const item=all[name]??={name,budget:0,actual:0,value:0,count:0};item.budget+=num(row.budget);item.actual+=num(row.actual);item.value+=num(row.total)||num(row.amount)||num(row.nominal)||num(row.budget)||num(row.actual);item.count++;all[name]=item;return all},{}));}
function monthly(rows:Row[]){return monthKeys.filter((m,i)=>i===0||!['may','aug','oct','dec'].includes(m)).map(month=>({name:month.toUpperCase(),value:rows.reduce((sum,row)=>sum+num(row[month]),0)})).filter(x=>x.value!==0)}
export default function ReportInsights({type,rows}:{type:ReportType;rows:Row[]}){if(type==='master_data'){const count=(key:string)=>new Set(rows.map(r=>r[key]).filter(Boolean)).size;return <div className="grid gap-4 sm:grid-cols-3">{[['Department',count('department')],['Kategori',count('category')],['Cost Center',count('cost_center')]].map(x=><section className="kpi" key={x[0]}><p>Jumlah {x[0]}</p><b>{x[1]||'-'}</b></section>)}</div>}
const grouped=aggregate(rows),wide=monthly(rows);let title='Ringkasan Data Laporan',kind:'bar'|'line'|'pie'='bar',data=wide.length?wide:grouped,keys=['value'];
if(type==='budget_planning')title=wide.length?'Budget Planning per Bulan':'Grafik Budget Plan';
if(type==='budget_vs_actual'){title='Budget vs Actual';keys=['budget','actual'];data=grouped}
if(type==='realisasi_budget'){title='Realisasi per Bulan';kind='line'}
if(type==='monitoring_budget'){title='Persentase Pemakaian Budget';data=grouped.filter(x=>x.budget).map(x=>({...x,value:x.actual/x.budget*100}))}
if(type==='pengajuan_budget'&&rows.some(r=>r.status)){title='Pengajuan Berdasarkan Status';kind='pie';data=grouped.map(x=>({...x,value:x.count}))}
if(type==='analisis_variance'){title='Variance per Departemen';data=grouped.map(x=>({...x,value:x.budget-x.actual}))}
if(type==='laporan_budget'&&grouped.some(x=>x.budget||x.actual)){title='Budget vs Actual';keys=['budget','actual'];data=grouped}
if(!data.length||!data.some(x=>keys.some(k=>num(x[k as keyof typeof x]))))return <section className="rounded-2xl border border-gold-500/20 bg-black p-5"><h2 className="mb-4 text-lg font-semibold">{title}</h2><p className="text-zinc-400">Belum ada data untuk ditampilkan.</p></section>;
return <section className="rounded-2xl border border-gold-500/20 bg-black p-5"><h2 className="mb-4 text-lg font-semibold">{title}</h2><div className="chart"><ResponsiveContainer>{kind==='pie'?<PieChart><Pie data={data} dataKey="value" nameKey="name" outerRadius={110}>{data.map((x,i)=><Cell key={x.name} fill={['#d4af37','#f6d365','#b88a16','#fff2a8'][i%4]}/>)}</Pie><Tooltip/><Legend/></PieChart>:kind==='line'?<LineChart data={data}><CartesianGrid stroke="#27272a"/><XAxis dataKey="name" stroke="#d4af37"/><YAxis/><Tooltip/><Line dataKey="value" stroke="#d4af37" strokeWidth={3}/></LineChart>:<BarChart data={data}><CartesianGrid stroke="#27272a"/><XAxis dataKey="name" stroke="#d4af37"/><YAxis/><Tooltip/><Legend/>{keys.map((key,i)=><Bar key={key} dataKey={key} fill={i?'#f6d365':'#d4af37'}/>)}</BarChart>}</ResponsiveContainer></div></section>}
