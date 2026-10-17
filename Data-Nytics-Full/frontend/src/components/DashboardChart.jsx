import { ResponsiveContainer, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export default function DashboardChart({ chart, numericColumns = [], onChange = () => {} }) {
  const values = chart?.values || chart?.data || [];
  const type = chart?.chartType || chart?.type || 'bar';
  const key = chart?.yColumn || 'value';
  const xKey = chart?.xColumn || 'label';
  const common = <><CartesianGrid strokeDasharray="3 3"/><XAxis dataKey={xKey} tick={{fontSize:11}}/><YAxis tick={{fontSize:11}}/><Tooltip/></>;
  return <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:14,padding:16,minWidth:0}}>
    <div style={{display:'flex',justifyContent:'space-between',gap:8,alignItems:'center',marginBottom:12}}><strong>{chart?.title || `${chart?.yColumn || 'Value'} by ${chart?.xColumn || 'Category'}`}</strong><select value={type} onChange={e=>onChange({chartType:e.target.value})} aria-label="Chart type"><option value="bar">Bar</option><option value="line">Line</option><option value="pie">Pie</option></select></div>
    <div style={{width:'100%',height:260}}><ResponsiveContainer>{type==='line'?<LineChart data={values}>{common}<Line type="monotone" dataKey={key} stroke="#2563eb" strokeWidth={3}/></LineChart>:type==='pie'?<PieChart><Tooltip/><Pie data={values} dataKey={key} nameKey={xKey} outerRadius={85} label>{values.map((_,i)=><Cell key={i} fill={['#2563eb','#0d9488','#7c3aed','#f59e0b','#e11d48'][i%5]}/>)}</Pie></PieChart>:<BarChart data={values}>{common}<Bar dataKey={key} fill="#2563eb" radius={[5,5,0,0]}/></BarChart>}</ResponsiveContainer></div>
  </div>;
}
