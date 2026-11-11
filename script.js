/* ===== JS ===== */
const WA_NUMBER = "62813128643228";   // ganti: format 62..., tanpa + atau 0

const MENU = [
  {id:1,cat:"Nasi ayam",name:"Nasi ayam ",desc:"Ayam crispy, sambal bawang klasik.",price:10000,e:"🍗",img:"nasi-ayam.jpg",pos:"50% 80%"},
  {id:2,cat:"Nasi ayam",name:"Nasi ayam karage",desc:"asin manis.",price:10000,e:"🧀",img:"ayam-karage.jpg",pos:"50% 90%"},
  {id:3,cat:"Nasi ayam",name:"Nasi ayam katsu",desc:"renyah dan enak serta menggungah selera.",price:10000,e:"🌿",img:"ayam-katsu.jpg",pos:"50% 50%"},
  {id:4,cat:"Nasi ayam",name:"Nasi goreng ",desc:"nasi yang hangat dan pulen cita rasa yang merata.",price:10000,e:"🌶️",img:"nasi goreng.jpg.jpeg",pos:"50% 50%"},
  {id:5,cat:"Ayam Geprek",name:"Ayam Geprek",desc:"Pilihan siang paling aman.",price:10000,e:"🍱",img:"ayam-geprek.jpg",pos:"50% 68%"},
  {id:6,cat:"Ayam Geprek",name:"Ayam Kocak",desc:"sambel bisa menyesuaikan sesuai selera dan kepedasan.",price:10000,e:"👫",img:"ayam-kocak.jpg",pos:"50% 85%"},
  {id:7,cat:"Cemilan",name:"potato cik barbeque",desc:"kentang dengan saus barbeque {bisa request bumbu}.",price:5000,e:"🧋",img:"potato-cik.jpg",pos:"50% 50%"},
  
];

const rp = n => "Rp" + n.toLocaleString("id-ID");
const $ = s => document.querySelector(s);
let cat = "Ayam Geprek", cart = {};

/* Menu */
function renderTabs(){
  const cats = [...new Set(MENU.map(m=>m.cat))];
  $("#tabs").innerHTML = cats.map(c=>`<button class="tab" role="tab" aria-selected="${c===cat}" data-c="${c}">${c}</button>`).join("");
}
function renderMenu(){
  $("#grid").innerHTML = MENU.filter(m=>m.cat===cat).map(m=>`
    <article class="card">
      ${m.img
        ? `<img class="thumb" src="${m.img}" alt="${m.name}" loading="lazy"${m.pos ? ` style="object-position:${m.pos}"` : ""}>`
        : `<div class="emo" aria-hidden="true">${m.e}</div>`}
      <h3>${m.name}</h3><p>${m.desc}</p>
      <div class="row"><span class="price">${rp(m.price)}</span>
      <button class="add" data-id="${m.id}">Tambah</button></div>
    </article>`).join("");
}
$("#tabs").addEventListener("click", e=>{
  const t = e.target.closest(".tab"); if(!t) return;
  cat = t.dataset.c; renderTabs(); renderMenu();
});
$("#grid").addEventListener("click", e=>{
  const b = e.target.closest(".add"); if(!b) return;
  const id = +b.dataset.id;
  cart[id] = (cart[id]||0) + 1;
  renderCart();
  toast("Ditambahkan ke keranjang");
});

/* Keranjang */
function renderCart(){
  const ids = Object.keys(cart);
  const count = ids.reduce((a,id)=>a+cart[id],0);
  $("#count").textContent = count;
  let total = 0;
  $("#items").innerHTML = ids.length ? ids.map(id=>{
    const m = MENU.find(x=>x.id==id), q = cart[id];
    total += m.price*q;
    return `<div class="item"><div><strong>${m.name}</strong>
      <div class="qty"><button data-a="-" data-id="${id}" aria-label="Kurangi">−</button>${q}
      <button data-a="+" data-id="${id}" aria-label="Tambah">+</button></div></div>
      <span>${rp(m.price*q)}</span></div>`;
  }).join("") : `<p class="empty">Keranjang masih kosong. Pilih menu dulu, lalu tambahkan.</p>`;
  $("#total").textContent = rp(total);
}
$("#items").addEventListener("click", e=>{
  const b = e.target.closest("button[data-a]"); if(!b) return;
  const id = b.dataset.id;
  cart[id] += b.dataset.a === "+" ? 1 : -1;
  if(cart[id] <= 0) delete cart[id];
  renderCart();
});

function toggleCart(open){
  $("#drawer").classList.toggle("open", open);
  $("#scrim").classList.toggle("open", open);
  $("#drawer").setAttribute("aria-hidden", !open);
}
$("#openCart").onclick = () => toggleCart(true);
$("#closeCart").onclick = $("#scrim").onclick = () => toggleCart(false);
document.addEventListener("keydown", e => { if(e.key==="Escape") toggleCart(false); });

renderTabs(); renderMenu(); renderCart();

/* ===== Data pesanan (disimpan di browser perangkat ini) ===== */
const ORDERS_KEY = "wim_orders";
function loadOrders(){
  try { return JSON.parse(localStorage.getItem(ORDERS_KEY)) || []; } catch(e){ return []; }
}
function storeOrders(list){
  try { localStorage.setItem(ORDERS_KEY, JSON.stringify(list)); } catch(e){ console.warn("Gagal simpan pesanan", e); }
}
function saveOrder(o){
  const list = loadOrders();
  list.unshift({ id:o.id, name:o.name, kelas:o.kelas, note:o.note, items:o.items, total:o.total,
                 status:"menunggu", createdAt:new Date().toISOString() });
  storeOrders(list);
}
function setStatus(id, status){
  const list = loadOrders();
  const o = list.find(x => x.id === id);
  if (!o) return;
  o.status = status;
  if (status === "dibayar") o.paidAt = new Date().toISOString();
  storeOrders(list);
}

/* ===== Pembayaran QRIS dengan batas waktu 3 menit ===== */
const PAY_SECONDS = 180;
let order = null, deadline = 0, timerId = null;

function newOrderId(){
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "WIM-";
  for (let i = 0; i < 5; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}
function fmtTime(sec){
  return String(Math.floor(sec/60)).padStart(2,"0") + ":" + String(sec%60).padStart(2,"0");
}
function tick(){
  const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
  $("#payTime").textContent = fmtTime(left);
  $("#payTimer").classList.toggle("low", left <= 30);
  if (left === 0) expirePay();
}
function expirePay(){
  clearInterval(timerId);
  if (!order || order.done) return;
  order.done = true;
  setStatus(order.id, "kedaluwarsa");
  $("#pay").classList.add("expired");
}
function closePay(){
  clearInterval(timerId);
  $("#pay").classList.remove("open", "expired");
  order = null;
}

$("#send").onclick = () => {
  const ids = Object.keys(cart);
  if(!ids.length) return toast("Keranjang masih kosong");
  const name = $("#name").value.trim();
  const kelas = $("#kelas").value.trim();
  const note = $("#note").value.trim();
  if(!name) return toast("Isi nama kamu dulu");
  if(!kelas) return toast("Isi kelas kamu dulu");
  let total = 0;
  const items = ids.map(id=>{
    const m = MENU.find(x=>x.id==id), q = cart[id];
    total += m.price*q;
    return { name: m.name.trim(), qty: q, price: m.price, subtotal: m.price*q };
  });
  order = { id: newOrderId(), name, kelas, note, items, total, status: "menunggu", done: false };
  saveOrder(order);

  $("#payId").textContent = order.id;
  $("#payAmount").textContent = rp(total);
  $("#pay").classList.remove("expired");
  $("#pay").classList.add("open");
  toggleCart(false);
  deadline = Date.now() + PAY_SECONDS * 1000;
  clearInterval(timerId);
  tick();
  timerId = setInterval(tick, 500);
};

$("#cancelPay").onclick = () => {
  if (order && !order.done) setStatus(order.id, "batal");
  closePay();
};

/* Setelah bayar: baru buka WhatsApp penjual */
$("#paid").onclick = () => {
  if (!order || order.done || Date.now() > deadline) return;
  const o = order;
  o.done = true;
  const lines = o.items.map(i => `- ${i.name} x${i.qty} = ${rp(i.subtotal)}`);
  const msg = [
    "Halo warung ibu my, saya sudah bayar via QRIS.", "",
    `No. pesanan: ${o.id}`, "",
    ...lines, "",
    `Total dibayar: ${rp(o.total)} (belum termasuk ongkir)`,
    `Atas nama: ${o.name}`,
    `Kelas: ${o.kelas}`,
    ...(o.note ? [`Catatan: ${o.note}`] : []), "",
    "Bukti pembayaran saya lampirkan di chat ini."
  ].join("\n");
  window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
  setStatus(o.id, "dibayar");
  cart = {}; renderCart();
  ["#name","#kelas","#note"].forEach(s => $(s).value = "");
  closePay();
  toast("Pesanan dikirim ke penjual");
};

/* Toast */
let tt;
function toast(t){
  const el = $("#toast"); el.textContent = t; el.classList.add("show");
  clearTimeout(tt); tt = setTimeout(()=>el.classList.remove("show"), 1800);
}