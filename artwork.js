export function artwork(kind,color){
 const c=document.createElement('canvas');c.width=360;c.height=440;const g=c.getContext('2d');
 const shape=(d,fill,stroke='#33333332',w=2)=>{g.fillStyle=fill;g.strokeStyle=stroke;g.lineWidth=w;const p=new Path2D(d);g.fill(p);if(stroke)g.stroke(p)};
 const line=(d,color='#ffffff70',w=2)=>{g.strokeStyle=color;g.lineWidth=w;g.stroke(new Path2D(d))};
 const grad=g.createLinearGradient(70,0,300,0);grad.addColorStop(0,color);grad.addColorStop(.43,color);grad.addColorStop(.7,kind==='shirt'?'#f9f8ef':color);grad.addColorStop(1,kind==='shirt'?'#d7d8cd':color);
 if(kind==='shirt'||kind==='knit'){
 shape('M119 61 L148 48 Q180 66 211 48 L241 61 317 104 289 191 243 168 252 350 Q180 370 108 350 L116 167 71 190 44 104 Z',grad);
 if(kind==='shirt') {shape('M148 48 L180 69 164 104 137 74 Z','#faf9f0');shape('M211 48 L180 69 196 104 222 74 Z','#f4f3e9');line('M180 83 L180 351','#bfc1b5',1.4);for(let y=117;y<340;y+=32){g.fillStyle='#adb3a5';g.beginPath();g.arc(185,y,2.1,0,7);g.fill()}line('M204 125 L232 125 230 158 205 157 Z','#bfc3b7',1);}
 else{shape('M148 48 Q180 80 211 48 L208 69 Q180 103 151 69 Z','#8b998360');for(let x=118;x<250;x+=5)line(`M${x} 310 L${x} 350`,'#ffffff20',1);}
 line('M120 98 Q131 172 116 318 M240 98 Q226 170 245 318','#8e988b35',3);line('M108 340 Q180 356 251 340','#8e988b35',1);
 } else if(kind==='pants'){
 shape('M113 40 Q180 48 247 40 L258 158 277 400 197 405 178 196 166 405 85 400 103 153 Z',grad);
 line('M110 65 L248 65 M180 66 L180 130 Q201 138 204 94 M107 83 Q139 114 151 64 M211 64 Q221 103 251 83','#e9e2bf88',2);
 line('M133 139 L113 389 M227 140 L247 391','#ffffff25',3);line('M87 387 L166 391 M198 391 L275 387','#ece5c777',2);
 for(const x of [124,157,222,240])line(`M${x} 43 L${x} 68`,'#e5dfc088',3);
 } else if(kind==='bag'){
 g.lineWidth=12;g.strokeStyle='#765743';g.stroke(new Path2D('M128 182 Q126 70 185 75 Q246 78 240 184'));
 shape('M89 175 Q180 163 274 175 L294 351 Q179 376 70 351 Z',grad);shape('M91 178 Q182 163 273 178 L263 262 Q178 286 101 262 Z',color);
 shape('M170 248 L194 248 194 280 170 280 Z','#cbb382','#ae9060',2);line('M89 338 Q182 358 279 339','#e7c7a270',1.5);
 } else if(kind==='shoe'){
 g.save();g.translate(5,45);g.rotate(-.1);shape('M63 216 Q94 212 114 159 L160 157 Q177 208 226 221 L281 239 Q309 248 303 277 Q211 303 66 274 Z',grad);shape('M63 264 Q198 284 303 263 L301 285 Q168 308 61 284 Z','#ecebdf');line('M133 186 L184 206 M126 197 L198 219 M116 211 L207 230','#fffdf7',5);line('M86 228 Q128 250 154 244','#b9b9a7',2);g.restore();
 g.save();g.translate(27,123);g.rotate(-.13);shape('M56 218 Q100 209 112 164 L163 161 Q180 211 220 220 L276 237 Q305 246 300 275 Q195 303 57 274 Z',grad);shape('M57 265 Q185 285 300 263 L299 284 Q155 306 55 286 Z','#edece1');line('M132 189 L181 207 M125 201 L194 219 M115 214 L208 231','#fffef8',5);g.restore();
 }else if(kind==='coat'){
 shape('M118 65 L150 42 212 42 243 65 312 100 321 287 277 294 250 155 259 393 103 393 110 155 82 294 39 287 49 99 Z',grad);shape('M150 42 L177 112 144 183 124 99 Z','#d2c5ac');shape('M212 42 L177 112 212 183 235 99 Z','#d7cbb7');line('M177 112 L177 388','#8d877577',2);line('M122 268 L157 268 M202 268 L240 268','#8c826966',3);for(let y=208;y<358;y+=50){g.fillStyle='#7d735d';g.beginPath();g.arc(190,y,3,0,7);g.fill()}
 }
 return c.toDataURL('image/png');
}
export function demoClothes(){return [
 {id:'shirt',name:'奶油白衬衫',category:'上衣',kind:'shirt',color:'#e8e9de',meta:'棉质 · 春 / 秋'},
 {id:'pants',name:'复古直筒牛仔裤',category:'下装',kind:'pants',color:'#6d8391',meta:'牛仔 · 四季'},
 {id:'bag',name:'焦糖色手提包',category:'配饰',kind:'bag',color:'#9f7554',meta:'皮革 · 四季'},
 {id:'shoe',name:'日常小白鞋',category:'鞋履',kind:'shoe',color:'#d6d8c9',meta:'休闲 · 四季'},
 {id:'knit',name:'鼠尾草绿针织衫',category:'上衣',kind:'knit',color:'#9aa68d',meta:'针织 · 春 / 秋'},
 {id:'coat',name:'燕麦色长风衣',category:'外套',kind:'coat',color:'#bfb49d',meta:'棉质 · 秋季'},
 {id:'blackpants',name:'垂感深色西裤',category:'下装',kind:'pants',color:'#474d49',meta:'混纺 · 春 / 秋'},
 {id:'darkbag',name:'巧克力色小方包',category:'配饰',kind:'bag',color:'#5c4536',meta:'皮革 · 四季'}
].map(c=>({...c,subcategory:({shirt:'长袖',knit:'长袖',pants:'长裤',coat:'风衣',shoe:'休闲鞋',bag:'手提包'})[c.kind]||'未细分',notes:'',image:artwork(c.kind,c.color),status:'available',sample:true,createdAt:Date.now()}));}
