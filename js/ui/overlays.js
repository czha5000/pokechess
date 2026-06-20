// 属性克制表速查弹窗
function buildChart(){const types=ACTIVE_TYPES;let h='<table class="chart"><tr><th>攻\\守</th>';types.forEach(t=>h+=`<th style="color:${TCOLOR[t]}">${TYPE_CN[t]}</th>`);h+='</tr>';
  types.forEach(a=>{h+=`<tr><th style="color:${TCOLOR[a]}">${TYPE_CN[a]}</th>`;types.forEach(b=>{const m=typeMult(a,b);const bg=m===0?'#111':m>1?'#2f6d3a':m<1?'#6d2f2f':'transparent';const tx=m===0?'0':m>1?'×2':m<1?'½':'·';h+=`<td style="background:${bg}">${tx}</td>`;});h+='</tr>';});h+='</table>';document.getElementById('chartBox').innerHTML=h;}
