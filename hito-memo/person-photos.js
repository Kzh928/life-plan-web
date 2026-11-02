/* このコードは，人物写真を端末内で縮小して保存します．外部URLや画像サーバーは使用しません． */
'use strict';
function safePersonPhoto(p){const value=p?.photo;return typeof value==='string'&&value.length<=170000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(value)?value:null;}
function personAvatar(p){const photo=safePersonPhoto(p);return `<span class="avatar">${photo?`<img src="${photo}" alt="${escapeHtml(p.name)}の写真">`:escapeHtml([...p.name][0])}</span>`;}
function photoControls(p){return `<div class="person-tools"><button class="btn subtle small" data-action="photo-choose" data-id="${escapeHtml(p.id)}">${safePersonPhoto(p)?'写真を変更':'写真を追加'}</button>${safePersonPhoto(p)?`<button class="iconbtn" data-action="photo-remove" data-id="${escapeHtml(p.id)}">写真を削除</button>`:''}<button class="iconbtn" data-action="edit-person">名前・あだ名を編集</button><button class="iconbtn person-delete" data-action="delete-person">人物を削除</button></div><input type="file" id="person-photo-file" data-id="${escapeHtml(p.id)}" accept="image/*" hidden><p class="footnote">写真は端末内で縮小して保存します．バックアップにも含まれます．</p>`;}
async function preparePersonPhoto(file){
  if(!file||file.size>20*1024*1024)throw Error('20 MB以下の画像を選んでください．');
  if(file.type&&!file.type.startsWith('image/'))throw Error('画像ファイルを選んでください．');
  const header=new Uint8Array(await file.slice(0,20).arrayBuffer());if(!isRasterHeader(header))throw Error('JPEG・PNG・WebPなどの写真を選んでください．SVGは使用できません．');
  const url=URL.createObjectURL(file);
  try{const img=new Image();await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('この画像を読み込めません．JPEGかPNGでお試しください．'));img.src=url;});
    if(!img.naturalWidth||!img.naturalHeight)throw Error('画像のサイズを確認してください．');
    const canvas=document.createElement('canvas'),scale=Math.min(1,512/Math.max(img.naturalWidth,img.naturalHeight));canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const ctx=canvas.getContext('2d');if(!ctx)throw Error('写真の処理に対応していません．');ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    for(const quality of [.8,.65,.5,.35]){const data=canvas.toDataURL('image/jpeg',quality);if(data.length<=160000)return data;}
    throw Error('保存用のサイズにできませんでした．小さい画像でお試しください．');
  }finally{URL.revokeObjectURL(url);}
}
function isRasterHeader(bytes){const text=String.fromCharCode(...bytes);return (bytes[0]===255&&bytes[1]===216)||(bytes[0]===137&&text.slice(1,4)==='PNG')||text.startsWith('GIF8')||(text.startsWith('RIFF')&&text.slice(8,12)==='WEBP')||text.slice(4,8)==='ftyp'||text.startsWith('BM');}
if(typeof document!=='undefined'){
  document.addEventListener('click',async e=>{const button=e.target.closest('[data-action]');if(!button||working)return;
    if(button.dataset.action==='photo-choose')document.querySelector('#person-photo-file')?.click();
    if(button.dataset.action==='photo-remove'){const pid=button.dataset.id;await mutate(()=>{const p=person(pid);if(p)delete p.photo;});}
  });
  document.addEventListener('change',async e=>{if(e.target.id!=='person-photo-file')return;const file=e.target.files?.[0],pid=e.target.dataset.id;e.target.value='';if(!file||working)return;
    const targetStore=STORE;toast('写真を縮小しています…');try{const photo=await preparePersonPhoto(file);if(STORE!==targetStore)return;if(!person(pid)){toast('人物が見つかりません');return;}if(await mutate(()=>{person(pid).photo=photo;}))toast('写真を保存しました');}catch(error){toast(error.message||'写真を保存できませんでした');}
  });
}
if(typeof module!=='undefined')module.exports={safePersonPhoto,isRasterHeader};
