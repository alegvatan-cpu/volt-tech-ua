'use strict';
(() => {
  const store=window.STORE, products=window.PRODUCTS;
  if(!store||!products)return;
  const $=s=>document.querySelector(s), money=n=>new Intl.NumberFormat('uk-UA').format(n)+' ₴';
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key='tech-stores-v1-'+store.slug, byId=new Map(products.map(p=>[p.id,p]));
  let saved={};try{saved=JSON.parse(localStorage.getItem(key)||'{}')}catch{}
  const state={cart:{},favorites:[],compare:[],orders:[]};
  if(saved.cart&&typeof saved.cart==='object')for(const [id,n] of Object.entries(saved.cart)){if(byId.has(id)&&Number.isInteger(n)&&n>0)state.cart[id]=Math.min(n,byId.get(id).stock)}
  for(const field of ['favorites','compare'])if(Array.isArray(saved[field]))state[field]=[...new Set(saved[field].filter(x=>byId.has(x)))].slice(0,field==='compare'?4:100);
  if(Array.isArray(saved.orders))state.orders=saved.orders.filter(x=>x&&typeof x.token==='string'&&typeof x.id==='string').slice(-50);
  let activePanel='', toastTimer, lastFocus, checkoutBusy=false;
  function save(){try{localStorage.setItem(key,JSON.stringify(state))}catch{toast('Браузер не дозволяє збереження. Зміни доступні в цій вкладці.')}update()}
  function update(){
    $('#cart-count').textContent=Object.values(state.cart).reduce((a,b)=>a+b,0);
    $('#fav-count').textContent=state.favorites.length;$('#compare-count').textContent=state.compare.length;
    document.querySelectorAll('[data-fav]').forEach(b=>{const on=state.favorites.includes(b.dataset.fav);b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));b.textContent=on?'♥':'♡'});
    document.querySelectorAll('[data-compare]').forEach(b=>{const on=state.compare.includes(b.dataset.compare);b.classList.toggle('selected',on);b.setAttribute('aria-pressed',String(on));b.textContent=on?'✓ У порівнянні':'＋ Порівняти'});
  }
  function toast(t){$('#toast').textContent=t;$('#toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('show'),2800)}
  function normalizeSearch(s){return String(s).normalize('NFKC').toLocaleLowerCase('uk-UA').replace(/проектор/g,'проєктор').replace(/эйсер|ейсер|асер/g,'acer').replace(/айфон/g,'iphone').replace(/самсунг/g,'samsung').replace(/[^\p{L}\p{N}]+/gu,' ' ).trim()}
  function matchesSearch(p,q){const text=normalizeSearch([p.name,p.brand,p.category,p.description,p.slug,...Object.values(p.specs||{})].join(' '));const compact=text.replace(/ /g,'');return normalizeSearch(q).split(/ +/).every(word=>text.includes(word)||compact.includes(word))}
  function card(p){return `<article class="product-card"><div class="card-top"><span class="pill">${escape(p.brand)}</span><button class="icon-btn favorite" data-fav="${p.id}" aria-label="До обраного: ${escape(p.name)}">♡</button></div><a class="product-image" href="/${store.slug}/products/${p.slug}/"><img src="${p.images[0]}" alt="${escape(p.name)}" width="400" height="300" loading="lazy"></a><span class="category-label">${escape(p.category)}</span><a class="product-name" href="/${store.slug}/products/${p.slug}/">${escape(p.name)}</a><span class="stock"><i></i> Демо · наявність уточнюється</span><div class="card-bottom"><strong>${money(p.price)}</strong><button class="add-btn" data-add="${p.id}" aria-label="До кошика: ${escape(p.name)}">＋</button></div><button class="compare-link" data-compare="${p.id}">＋ Порівняти</button></article>`}
  function empty(title,text){return `<div class="empty"><h3>${title}</h3><p>${text}</p><a class="button" href="/${store.slug}/#catalog">Переглянути каталог ↗</a></div>`}
  function show(title,body,type){
    const d=$('#panel');activePanel=type;$('#panel-title').textContent=title;$('#panel-body').innerHTML=body;
    if(!d.open){lastFocus=document.activeElement;d.showModal()}update();
  }
  function total(){return Object.entries(state.cart).reduce((n,[id,qty])=>n+byId.get(id).price*qty,0)}
  function renderCart(){
    const entries=Object.entries(state.cart);
    if(!entries.length){show('Ваш кошик',empty('Тут поки порожньо','Додайте товари з каталогу. Вони залишаться у кошику після перезавантаження.'),'cart');return}
    const rows=entries.map(([id,qty])=>{const p=byId.get(id);return `<div class="cart-row"><img src="${p.images[0]}" alt="${escape(p.name)}"><div><a href="/${store.slug}/products/${p.slug}/">${escape(p.name)}</a><p>${money(p.price)} за шт.</p><div class="qty"><button data-qty="${id}" data-delta="-1" aria-label="Зменшити кількість ${escape(p.name)}">−</button><span>${qty}</span><button data-qty="${id}" data-delta="1" aria-label="Збільшити кількість ${escape(p.name)}">＋</button><small> = ${money(p.price*qty)}</small></div></div><button class="remove" data-remove="${id}" aria-label="Видалити ${escape(p.name)}">Видалити</button></div>`}).join('');
    show('Ваш кошик',rows+`<div class="cart-total"><span>Разом</span><strong>${money(total())}</strong></div><div class="cart-tools"><small>Доставку не включено.<br>Демонстраційне замовлення без оплати.</small><button class="button" id="checkout">Оформити замовлення ↗</button></div>`,'cart');
  }
  function renderFavorites(){show('Обрані товари',state.favorites.length?`<div class="product-grid">${state.favorites.map(id=>card(byId.get(id))).join('')}</div>`:empty('Збережіть те, що сподобалось','Натисніть сердечко біля товару, щоб повернутися до нього пізніше.'),'favorites')}
  function renderCompare(){
    const ps=state.compare.map(id=>byId.get(id));
    if(!ps.length){show('Порівняння',empty('Виберіть товари для порівняння','Додайте до чотирьох моделей кнопкою «Порівняти».'),'compare');return}
    const props=[...new Set(ps.flatMap(p=>Object.keys(p.specs)))];
    let t='<p class="form-note">Порівнюйте до чотирьох товарів. Для подібних параметрів обирайте товари однієї категорії.</p><div class="compare-wrap"><table class="compare-table"><thead><tr><th>Товар</th>'+ps.map(p=>`<th><img src="${p.images[0]}" alt="${escape(p.name)}"><a href="/${store.slug}/products/${p.slug}/">${escape(p.name)}</a><button class="remove" data-uncompare="${p.id}">Прибрати</button></th>`).join('')+'</tr></thead><tbody><tr><td>Ціна</td>'+ps.map(p=>`<td><strong>${money(p.price)}</strong></td>`).join('')+'</tr>';
    for(const prop of props)t+='<tr><td>'+escape(prop)+'</td>'+ps.map(p=>`<td>${escape(p.specs[prop]||'—')}</td>`).join('')+'</tr>';
    t+='<tr><td>До кошика</td>'+ps.map(p=>`<td><button class="button" data-add="${p.id}">Додати ＋</button></td>`).join('')+'</tr></tbody></table></div>';
    show('Порівняння товарів',t,'compare');
  }
  function checkout(){
    if(window.PUBLIC_CATALOG){
      if(!Object.keys(state.cart).length){renderCart();return}
      show('Зберегти демо-кошик',`<p>Це демонстраційний каталог. Ціни та наявність не підтверджені. Продаж, оплата й доставка ще не підключені.</p><p>Можна зберегти список товарів у цьому браузері без введення особистих даних.</p><button class="button" id="save-demo">Зберегти список товарів</button>`,'checkout');
      $('#save-demo').addEventListener('click',()=>{const record={id:'DEMO-'+store.slug.toUpperCase()+'-'+crypto.randomUUID().slice(0,8),token:'browser',created:new Date().toISOString(),total:total(),items:Object.entries(state.cart).map(([id,quantity])=>({name:byId.get(id).name,price:byId.get(id).price,quantity}))};state.orders.push(record);state.cart={};save();renderOrders()});return;
    }

    if(!Object.keys(state.cart).length){renderCart();return}
    show('Оформлення замовлення',`<p class="form-note">Демо-режим: використовуйте тестові дані. Запис зберігається лише на цьому комп’ютері. Кошти не списуються.</p><form id="checkout-form" class="checkout-grid"><label>Ім’я та прізвище<input name="name" minlength="3" maxlength="90" required autocomplete="off" placeholder="Тестовий Покупець"></label><label>Телефон<input name="phone" type="tel" maxlength="25" required autocomplete="off" inputmode="tel" placeholder="+380 00 000 00 00"></label><label>Місто<input name="city" minlength="2" maxlength="80" required autocomplete="off" placeholder="Київ"></label><label>Спосіб доставки<select name="delivery" id="delivery-method"><option value="branch">До відділення (демо)</option><option value="courier">Кур’єром (демо)</option></select></label><label class="full"><span id="address-label">Номер або адреса відділення</span><input name="address" minlength="2" maxlength="200" required placeholder="Тестове відділення № 1" autocomplete="off"></label><label class="full">Коментар<textarea name="comment" maxlength="500" rows="2" placeholder="Побажання до демонстраційного замовлення"></textarea></label><div class="full"><div class="cart-total"><span>Товари</span><strong>${money(total())}</strong></div><p class="form-note">Вартість доставки не розрахована. Оплата: демонстраційне оформлення без списання коштів.</p></div><label class="full consent"><input type="checkbox" name="consent" required><span>Розумію, що це демо-замовлення, та погоджуюсь зі <a href="/${store.slug}/info/#privacy" target="_blank" rel="noopener"><u>збереженням тестових даних</u></a> на цьому комп’ютері.</span></label><p id="checkout-error" class="error full" role="alert"></p><div class="full cart-tools"><button type="button" class="button secondary" data-panel="cart">← До кошика</button><button type="submit" class="button" id="submit-order">Створити демо-замовлення ↗</button></div></form>`,'checkout');
  }
  async function submitCheckout(form){
    if(checkoutBusy||!form.reportValidity())return;
    const data=Object.fromEntries(new FormData(form));
    const phone=data.phone.replace(/\D/g,'');
    if(!(/^380\d{9}$/.test(phone)||/^0\d{9}$/.test(phone))){$('#checkout-error').textContent='Введіть український телефон у форматі +380XXXXXXXXX або 0XXXXXXXXX.';return}
    checkoutBusy=true;$('#submit-order').disabled=true;$('#checkout-error').textContent='';
    if(!form.dataset.requestId)form.dataset.requestId=crypto.randomUUID();
    try{
      const response=await fetch('/api/orders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({store:store.slug,items:Object.entries(state.cart).map(([id,quantity])=>({id,quantity})),customer:data,requestId:form.dataset.requestId})});
      const order=await response.json();if(!response.ok)throw Error(order.error||'Не вдалося зберегти замовлення.');
      if(!state.orders.some(x=>x.id===order.id))state.orders.push({id:order.id,token:order.token});state.cart={};save();
      show('Демо-замовлення створено',`<div class="success"><div class="success-mark">✓</div><h3>Дякуємо за перевірку магазину!</h3><p>Замовлення <strong>${escape(order.id)}</strong><br>Сума товарів: <strong>${money(order.total)}</strong></p><p class="form-note">Запис збережено локально. Товар не резервується, платіж і повідомлення продавцю не надсилаються.</p><button class="button" data-panel="orders">Переглянути мої замовлення ↗</button></div>`,'success');
    }catch(e){if($('#checkout-error'))$('#checkout-error').textContent=e.message||'Немає зв’язку з локальним сервером. Запустіть магазини кнопкою START.cmd.'}
    finally{checkoutBusy=false;if($('#submit-order'))$('#submit-order').disabled=false}
  }
  async function renderOrders(){
    if(window.PUBLIC_CATALOG){
      const records=state.orders.filter(o=>Array.isArray(o.items)).slice().reverse();
      show('Збережені демо-кошики',records.length?records.map(o=>`<article class="order-card"><h3>${escape(o.id)}</h3><p>${new Date(o.created).toLocaleString('uk-UA')}</p>${o.items.map(i=>`<p>${escape(i.name)} × ${i.quantity} — ${money(i.price*i.quantity)}</p>`).join('')}<strong>Разом: ${money(o.total)}</strong><p>Збережено лише у цьому браузері. Замовлення продавцю не надіслано. Оплати й резервування немає.</p></article>`).join(''):empty('Збережених кошиків ще немає','Додайте товари та збережіть демо-кошик.'),'orders');return;
    }

    if(!state.orders.length){show('Мої замовлення',empty('Замовлень ще немає','Після оформлення демо-замовлення воно з’явиться тут.'),'orders');return}
    show('Мої замовлення','<p class="form-note">Завантаження…</p>','orders');
    try{
      const records=await Promise.all(state.orders.slice().reverse().map(async o=>{const r=await fetch('/api/orders/'+encodeURIComponent(o.id),{headers:{'X-Order-Token':o.token}});if(!r.ok)throw Error('Не вдалося завантажити замовлення. Перевірте локальний сервер.');return r.json()}));
      if(activePanel!=='orders')return;
      $('#panel-body').innerHTML=records.map(o=>`<article class="order-card"><h3>${escape(o.id)}</h3><p class="stock"><i></i> Збережено · демо-замовлення</p><p>${new Date(o.created).toLocaleString('uk-UA')}</p>${o.items.map(i=>`<p>${escape(i.name)} × ${i.quantity} — ${money(i.price*i.quantity)}</p>`).join('')}<strong>Разом: ${money(o.total)}</strong><p class="muted">Оплати та резервування товару немає.</p></article>`).join('');
    }catch(e){if(activePanel==='orders')$('#panel-body').innerHTML=`<p class="error">${escape(e.message)}</p>`}
  }
  const panels={cart:renderCart,favorites:renderFavorites,compare:renderCompare,orders:renderOrders};
  document.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    if(b.dataset.panel){panels[b.dataset.panel]?.();return}
    if(b.id==='close-panel'){$('#panel').close();return}
    if(b.dataset.add){const id=b.dataset.add,p=byId.get(id);if(!p)return;const n=state.cart[id]||0;if(n>=p.stock){toast('Досягнуто максимальну кількість у демо-каталозі');return}state.cart[id]=n+1;save();toast('Товар додано до кошика');if(activePanel==='cart'&&$('#panel').open)renderCart();return}
    if(b.dataset.fav){const id=b.dataset.fav;if(!byId.has(id))return;const i=state.favorites.indexOf(id);i<0?state.favorites.push(id):state.favorites.splice(i,1);save();if(activePanel==='favorites'&&$('#panel').open)renderFavorites();return}
    if(b.dataset.compare||b.dataset.uncompare){const id=b.dataset.compare||b.dataset.uncompare;if(!byId.has(id))return;const i=state.compare.indexOf(id);if(i<0){if(state.compare.length>=4){toast('Можна порівняти до чотирьох товарів');return}state.compare.push(id);toast('Додано до порівняння')}else state.compare.splice(i,1);save();if(activePanel==='compare'&&$('#panel').open)renderCompare();return}
    if(b.dataset.qty){const id=b.dataset.qty;if(!byId.has(id))return;const qty=state.cart[id]+Number(b.dataset.delta);if(qty<1)delete state.cart[id];else if(qty<=byId.get(id).stock)state.cart[id]=qty;else toast('Досягнуто максимальну кількість');save();renderCart();return}
    if(b.dataset.remove){delete state.cart[b.dataset.remove];save();renderCart();return}
    if(b.id==='checkout'){checkout();return}
    if(b.dataset.image){$('#main-product-image').src=b.dataset.image;document.querySelectorAll('.thumb').forEach(t=>t.setAttribute('aria-pressed',String(t===b)));return}
  });
  $('#panel').addEventListener('click',e=>{if(e.target===$('#panel')){const r=$('#panel').getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$('#panel').close()}});
  $('#panel').addEventListener('close',()=>{activePanel='';lastFocus?.focus()});
  document.addEventListener('submit',e=>{if(e.target.id==='checkout-form'){e.preventDefault();submitCheckout(e.target)}});
  document.addEventListener('change',e=>{if(e.target.id==='delivery-method'){const courier=e.target.value==='courier';$('#address-label').textContent=courier?'Вулиця, будинок, квартира':'Номер або адреса відділення';const input=$('[name="address"]');input.value='';input.placeholder=courier?'Тестова вулиця, 1, кв. 1':'Тестове відділення № 1'}});
  if($('#product-grid')){
    const params=new URLSearchParams(location.search),search=$('#search'),category=$('#category-filter'),brand=$('#brand-filter'),min=$('#min-price'),max=$('#max-price'),sort=$('#sort');
    search.value=params.get('q')||'';category.value=params.get('category')||'';brand.value=params.get('brand')||'';min.value=params.get('min')||'';max.value=params.get('max')||'';sort.value=params.get('sort')||'featured';if(!sort.value)sort.value='featured';
    function filter(sync=true){
      const query=search.value.trim().toLocaleLowerCase('uk-UA');
      let result=products.filter(p=>(!query||matchesSearch(p,query))&&(!category.value||p.category===category.value)&&(!brand.value||p.brand===brand.value)&&(!min.value||p.price>=Number(min.value))&&(!max.value||p.price<=Number(max.value)));
      if(sort.value==='price-asc')result.sort((a,b)=>a.price-b.price);if(sort.value==='price-desc')result.sort((a,b)=>b.price-a.price);if(sort.value==='name')result.sort((a,b)=>a.name.localeCompare(b.name,'uk'));
      $('#product-grid').innerHTML=result.map(card).join('');$('#empty-results').hidden=!!result.length;$('#result-count').textContent=`${result.length} із ${products.length} товарів`;$('#active-filter').textContent=[category.value,brand.value,query?`«${search.value.trim()}»`:''].filter(Boolean).join(' · ')||'Увесь каталог';update();
      if(sync){const q=new URLSearchParams();for(const[k,v]of[['q',search.value.trim()],['category',category.value],['brand',brand.value],['min',min.value],['max',max.value],['sort',sort.value==='featured'?'':sort.value]])if(v)q.set(k,v);history.replaceState(null,'',location.pathname+(q.size?'?'+q:'')+location.hash)}
    }
    [category,brand,sort].forEach(el=>el.addEventListener('change',()=>filter()));[search,min,max].forEach(el=>el.addEventListener('input',()=>filter()));
    search.closest('form').addEventListener('submit',e=>{e.preventDefault();filter();$('#catalog').scrollIntoView({behavior:'smooth'})});
    function reset(){search.value='';category.value='';brand.value='';min.value='';max.value='';sort.value='featured';filter()}
    $('#reset-filters').addEventListener('click',reset);$('#clear-search').addEventListener('click',reset);filter(false);
  }
  update();
})();
