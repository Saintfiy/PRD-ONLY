const $ = selector => document.querySelector(selector);
const rp = value => `Rp${Math.round(value).toLocaleString('id-ID')}`;
const escapeHTML = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

const S = {
  cart: [],
  voucher: null,
  ship: 'reg',
  insurance: false,
  method: 'M1',
  fail: false,
  order: null,
  searchHistory: [],
  address: DATA.alamat[0].alamat,
  directItem: null,
  showCampaign: true
};

const P = id => DATA.produk.find(product => product.id === id);
const V = id => DATA.voucher.find(voucher => voucher.id === id);
const activeItems = () => S.directItem ? [S.directItem] : S.cart;
const shippingCost = () => S.ship === 'reg' ? 10000 : 20000;
const subtotal = () => activeItems().reduce((sum, item) => sum + P(item.id).harga_akhir * item.q, 0);

function voucherSaving(voucher, amount = subtotal()) {
  if (amount < voucher.minimum_belanja) return 0;
  if (voucher.jenis === 'ongkir') return Math.min(voucher.potongan, shippingCost());
  if (voucher.jenis === 'persen') {
    return Math.min(amount * voucher.potongan_persen / 100, voucher.maksimum_potongan);
  }
  return 0;
}

function bestVoucher() {
  return DATA.voucher
    .map(voucher => [voucher, voucherSaving(voucher)])
    .sort((left, right) => right[1] - left[1])[0];
}

function currentVoucher() {
  if (S.voucher) {
    const voucher = V(S.voucher);
    const saving = voucher && voucherSaving(voucher);
    if (voucher && saving > 0) return [voucher, saving];
  }
  const [voucher, saving] = bestVoucher();
  return saving > 0 ? [voucher, saving] : [null, 0];
}

function total() {
  const [, saving] = currentVoucher();
  return subtotal() + shippingCost() + (S.insurance ? 1000 : 0) - saving;
}

function productCard(product) {
  return `<a class="card" href="#/produk/${product.id}">
    <div class="ph" aria-hidden="true"></div>
    <div class="card-copy">
      <b>${escapeHTML(product.nama)}</b>
      <div class="old">${rp(product.harga_coret)}</div>
      <div class="fin">${rp(product.harga_akhir)} <span class="mut">hemat ${product.diskon_persen}%</span></div>
      <div class="mut">Syarat: ${escapeHTML(product.syarat)}</div>
    </div>
  </a>`;
}

function categoryLinks() {
  return [...new Set(DATA.produk.map(product => product.kategori))]
    .map(category => `<a href="#/cari?q=${encodeURIComponent(category)}">${escapeHTML(category)}</a>`)
    .join('');
}

function relevantVouchers(category) {
  return DATA.voucher.filter(voucher => !category || voucher.kategori.includes(category));
}

function searchPage() {
  const query = $('#q').value.trim().toLowerCase();
  const suggestions = query
    ? [...new Set(DATA.produk
      .filter(product => `${product.nama} ${product.kategori}`.toLowerCase().includes(query))
      .map(product => product.nama))]
    : [];
  const history = S.searchHistory.filter(item => !query || item.toLowerCase().includes(query));
  return `<h2>Pencarian dan Saran</h2>
    <div class="box suggestion-box">
      <b>${query ? 'Saran pencarian' : 'Saran'}</b>
      ${suggestions.length ? suggestions.map(item =>
        `<a class="suggestion" data-query="${encodeURIComponent(item)}" href="#/cari?q=${encodeURIComponent(item)}">${escapeHTML(item)}</a>`
      ).join('') : '<p class="mut">Ketik nama produk atau kategori untuk melihat saran.</p>'}
      ${history.length ? `<b class="history-title">Riwayat pencarian</b>
        ${history.map(item =>
          `<div class="history-entry">
            <a class="suggestion history-item" data-query="${encodeURIComponent(item)}" href="#/cari?q=${encodeURIComponent(item)}">${escapeHTML(item)}</a>
            <button class="sec history-remove" aria-label="Hapus riwayat ${escapeHTML(item)}" onclick="removeSearchHistory('${encodeURIComponent(item)}')">×</button>
          </div>`
        ).join('')}` : ''}
    </div>`;
}

const R = {
  '': () => `<div class="chips">${categoryLinks()}</div>
    <section aria-labelledby="promo-home-title">
      <h2 id="promo-home-title">Promo Untuk Anda <a href="#/promo" class="mut">Lihat semua</a></h2>
      ${DATA.voucher.slice(0, 2).map(voucher => `<div class="box promo-card">
        <b>${escapeHTML(voucher.nama)}</b>
        <div class="mut">Min. belanja ${rp(voucher.minimum_belanja)} · ${escapeHTML(voucher.syarat)}</div>
      </div>`).join('')}
    </section>
    ${S.showCampaign ? '<a class="campaign" href="#/promo">Promo kampanye pilihan minggu ini</a>' : ''}
    <h2>Rekomendasi Produk</h2>
    ${DATA.produk.slice(0, 4).map(productCard).join('')}`,

  search: searchPage,

  cari: params => {
    const query = params.get('q') || '';
    const category = params.get('kategori') || '';
    const order = params.get('urutkan') || '';
    let products = DATA.produk.filter(product =>
      `${product.nama} ${product.kategori}`.toLowerCase().includes(query.toLowerCase()) &&
      (!category || product.kategori === category)
    );
    if (order === 'termurah') products.sort((left, right) => left.harga_akhir - right.harga_akhir);
    if (order === 'termahal') products.sort((left, right) => right.harga_akhir - left.harga_akhir);
    const categories = [...new Set(DATA.produk.map(product => product.kategori))];
    const url = new URLSearchParams({ q: query });
    const matchedCategory = category || DATA.produk.find(product =>
      `${product.nama} ${product.kategori}`.toLowerCase().includes(query.toLowerCase())
    )?.kategori || '';
    const vouchers = matchedCategory ? relevantVouchers(matchedCategory) : [];
    return `<h2>Hasil Pencarian</h2>
      <div class="filter-row">
        <label>Filter kategori
          <select aria-label="Filter kategori" onchange="setSearchFilter('kategori', this.value)">
            <option value="">Semua kategori</option>
            ${categories.map(item => `<option value="${escapeHTML(item)}" ${item === category ? 'selected' : ''}>${escapeHTML(item)}</option>`).join('')}
          </select>
        </label>
        <label>Urutkan
          <select aria-label="Urutkan produk" onchange="setSearchFilter('urutkan', this.value)">
            <option value="">Relevan</option>
            <option value="termurah" ${order === 'termurah' ? 'selected' : ''}>Termurah</option>
            <option value="termahal" ${order === 'termahal' ? 'selected' : ''}>Termahal</option>
          </select>
        </label>
      </div>
      <p class="mut">${products.length} produk ditemukan</p>
      ${products.map(productCard).join('') || '<p>Produk tidak ditemukan. Ubah kata kunci atau filter.</p>'}
      ${vouchers.length ? `<section class="related-promos"><h2>Promo Terkait</h2>
        ${vouchers.slice(0, 2).map(voucher => `<div class="box">
          <b>${escapeHTML(voucher.nama)}</b>
          <div class="mut">Min. ${rp(voucher.minimum_belanja)} · ${escapeHTML(voucher.syarat)}</div>
        </div>`).join('')}</section>` : ''}`;
  },

  produk: id => {
    const product = P(id);
    if (!product) return '<p>Produk tidak ditemukan.</p>';
    return `<a class="back-link" href="#/">&larr; Kembali</a>
      <div class="ph product-image" aria-hidden="true"></div>
      <h2>${escapeHTML(product.nama)}</h2>
      <div class="fin">Harga akhir ${rp(product.harga_akhir)} <span class="old">${rp(product.harga_coret)}</span></div>
      <p>Syarat promo: ${escapeHTML(product.syarat)}</p>
      <p class="mut">Ulasan ${product.rating} | Toko: ${escapeHTML(product.toko)}</p>
      <div class="product-actions">
        <button onclick="addToCart('${product.id}')">Tambah ke Keranjang</button>
        <button class="sec" onclick="buyNow('${product.id}')">Beli Langsung</button>
      </div>`;
  },

  kategori: () => `<h2>Kategori</h2><p class="mut">Pilih kategori untuk melihat produk.</p><div class="chips">${categoryLinks()}</div>`,

  keranjang: () => {
    if (!S.cart.length) return '<h2>Keranjang</h2><p>Keranjang kosong.</p><a class="btn" href="#/">Mulai belanja</a>';
    const [voucher, saving] = currentVoucher();
    return `<h2>Keranjang</h2>
      ${S.cart.map(item => `<div class="cart-item">
        <div class="ph" aria-hidden="true"></div>
        <div class="cart-copy"><b>${escapeHTML(P(item.id).nama)}</b>
          <div class="fin">Harga akhir ${rp(P(item.id).harga_akhir)}</div>
          <div class="mut">Syarat promo: ${escapeHTML(P(item.id).syarat)}</div></div>
        <div class="quantity" aria-label="Jumlah ${escapeHTML(P(item.id).nama)}">
          <button class="sec" aria-label="Kurangi jumlah" onclick="changeQuantity('${item.id}', -1)">−</button>
          <span>${item.q}</span>
          <button class="sec" aria-label="Tambah jumlah" onclick="changeQuantity('${item.id}', 1)">+</button>
        </div>
      </div>`).join('')}
      <div class="box"><b>Voucher Terbaik terpakai</b>
        <div>${voucher ? `${escapeHTML(voucher.nama)} (hemat ${rp(saving)})` : 'Belum ada voucher yang memenuhi syarat'}</div>
        <a class="btn sec" href="#/promo">Ganti voucher</a>
      </div>
      <div class="row"><span>Subtotal</span><span>${rp(subtotal())}</span></div>
      <div class="row"><span>Ongkir</span><span>${rp(shippingCost())}</span></div>
      <div class="row"><span>Potongan voucher</span><span>−${rp(saving)}</span></div>
      <div class="row fin"><span>Total</span><span>${rp(total())}</span></div>
      <a class="btn full-width" href="#/checkout">Checkout</a>`;
  },

  promo: () => `<a class="back-link" href="#/keranjang">&larr; Kembali</a><h2>Pusat Promo · Voucher Saya</h2>
    ${DATA.voucher.map(voucher => {
      const eligible = subtotal() >= voucher.minimum_belanja && voucher.jenis !== 'cashback';
      const chosen = currentVoucher()[0]?.id === voucher.id;
      return `<div class="box">
        <b>${escapeHTML(voucher.nama)} ${chosen ? '<span class="badge">Terpakai</span>' : ''}</b>
        <div class="mut">Syarat: min. ${rp(voucher.minimum_belanja)}. ${escapeHTML(voucher.syarat)}</div>
        <button ${eligible ? '' : 'disabled'} onclick="chooseVoucher('${voucher.id}')">${chosen ? 'Terpilih' : 'Pakai'}</button>
      </div>`;
    }).join('')}`,

  checkout: () => {
    if (!S.cart.length && !S.directItem) return '<h2>Checkout</h2><p>Keranjang kosong.</p><a class="btn" href="#/">Mulai belanja</a>';
    const [voucher, saving] = currentVoucher();
    return `<h2>Checkout</h2>
      <div class="row address-row"><span><b>Alamat</b><br>${escapeHTML(DATA.alamat[0].label)}: ${escapeHTML(S.address)}</span>
        <button class="sec" onclick="editAddress()">Ubah</button></div>
      <div class="row address-row"><span><b>Pengiriman</b><br>${S.ship === 'reg' ? 'Reguler · 2–3 hari' : 'Ekspres · 1 hari'}</span>
        <button class="sec" onclick="toggleShipping()">Ubah</button></div>
      <div class="box payment-summary"><b>Ringkasan pembayaran</b>
        <div class="row"><span>Subtotal</span><span>${rp(subtotal())}</span></div>
        <div class="row"><span>Ongkir</span><span>${rp(shippingCost())}</span></div>
        ${voucher ? `<div class="row"><span>${escapeHTML(voucher.nama)}</span><span>−${rp(saving)}</span></div>` : ''}
        ${S.insurance ? '<div class="row"><span>Asuransi</span><span>Rp1.000</span></div>' : ''}
        <div class="row fin"><span>Total</span><span>${rp(total())}</span></div>
      </div>
      <a class="btn full-width" href="#/bayar">Bayar Sekarang</a>
      <div class="box offer"><b>Tawaran tambahan (opsional)</b><p>Asuransi barang · Rp1.000</p>
        <button class="sec" onclick="setInsurance(true)">Tambahkan</button>
        <button class="sec" onclick="setInsurance(false)">Lewati</button>
        ${S.insurance ? '<p class="mut">Asuransi ditambahkan ke ringkasan pembayaran.</p>' : ''}
      </div>`;
  },

  bayar: () => `<h2>Pilih metode pembayaran</h2>
    ${DATA.metode_bayar.map(method => `<label class="box payment-option">
      <input type="radio" name="method" value="${method.id}" ${S.method === method.id ? 'checked' : ''}
        onchange="selectMethod(this.value)"> ${escapeHTML(method.nama)}
    </label>`).join('')}
    ${S.fail ? `<p class="err" role="alert">${escapeHTML(DATA.metode_bayar.find(method => method.id === S.method)?.pesan_gagal || 'Pembayaran gagal.')}</p>
      <button class="sec" onclick="changePaymentMethod()">Ganti metode</button>` : ''}
    <button onclick="pay()">${S.fail ? 'Coba lagi' : 'Bayar'}</button>`,

  sukses: () => `<div class="success-mark" aria-hidden="true">✓</div>
    <h2>Pesanan berhasil</h2><p>Terima kasih. Pembayaran Anda sudah diterima.</p>
    <a class="btn" href="#/pesanan/${S.order?.id || DATA.pesanan[0].id}">Lihat Pesanan</a>`,

  pesanan: id => {
    if (!S.order) {
      const sample = DATA.pesanan[0];
      const product = P(sample.item[0]);
      if (!id) return `<h2>Pesanan</h2>
        <a class="card order-card" href="#/pesanan/${sample.id}">
          <div><b>Pesanan contoh #${sample.id}</b><div class="mut">Status: ${sample.status}</div></div>
          <span>${rp(sample.total)}</span>
        </a>`;
      return `<a class="back-link" href="#/pesanan">&larr; Daftar Pesanan</a>
        <h2>Pesanan #${sample.id}</h2>
        <div class="box"><b>Status: ${escapeHTML(sample.status)}</b>
          <div class="tracking-steps">${sample.tahap_status.map((status, index) =>
            `<span class="${index === 0 ? 'complete' : ''}">${escapeHTML(status)}</span>`
          ).join('')}</div>
          <p>Resi: ${escapeHTML(sample.resi)}</p>
        </div>
        ${product ? `<div class="row"><span>${escapeHTML(product.nama)} × 1</span><span>${rp(sample.total)}</span></div>` : ''}
        <div class="row fin"><span>Total</span><span>${rp(sample.total)}</span></div>`;
    }
    if (!id) return `<h2>Pesanan</h2>
      <a class="card order-card" href="#/pesanan/${S.order.id}">
        <div><b>Pesanan #${S.order.id}</b><div class="mut">Status: ${S.order.statuses[S.order.statusIndex]}</div></div>
        <span>${rp(S.order.total)}</span>
      </a>`;
    return `<a class="back-link" href="#/pesanan">&larr; Daftar Pesanan</a>
      <h2>Pesanan #${S.order.id}</h2>
      <div class="box"><b>Status: ${S.order.statuses[S.order.statusIndex]}</b>
        <div class="tracking-steps">${S.order.statuses.map((status, index) =>
          `<span class="${index <= S.order.statusIndex ? 'complete' : ''}">${escapeHTML(status)}</span>`
        ).join('')}</div>
        <p>Resi: ${escapeHTML(S.order.resi)}</p>
        <button class="sec" onclick="trackOrder()" ${S.order.statusIndex === S.order.statuses.length - 1 ? 'disabled' : ''}>
          ${S.order.statusIndex === S.order.statuses.length - 1 ? 'Pesanan selesai' : 'Lacak pesanan'}
        </button>
      </div>
      ${S.order.items.map(item => `<div class="row"><span>${escapeHTML(item.name)} × ${item.q}</span><span>${rp(item.price * item.q)}</span></div>`).join('')}
      <div class="row fin"><span>Total</span><span>${rp(S.order.total)}</span></div>`;
  },

  akun: () => `<h2>Akun</h2>
    <div class="box"><b>Profil</b><div class="mut">Profil pembeli (dummy)</div></div>
    <div class="box"><b>Alamat tersimpan</b><div class="mut">${escapeHTML(S.address)}</div></div>
    <div class="box"><b>Pengaturan Tampilan Promo</b>
      <label class="toggle"><input type="checkbox" ${S.showCampaign ? 'checked' : ''}
        onchange="toggleCampaign(this.checked)"> Tampilkan banner kampanye</label>
    </div>
    <div class="box">Notifikasi</div><div class="box">Bantuan</div>`
};

function addToCart(id) {
  const item = S.cart.find(entry => entry.id === id);
  if (item) item.q += 1;
  else S.cart.push({ id, q: 1 });
  S.directItem = null;
  location.hash = '#/keranjang';
}

function buyNow(id) {
  S.directItem = { id, q: 1 };
  S.voucher = null;
  location.hash = '#/checkout';
}

function changeQuantity(id, amount) {
  const item = S.cart.find(entry => entry.id === id);
  if (!item) return;
  item.q += amount;
  if (item.q < 1) S.cart = S.cart.filter(entry => entry !== item);
  route();
}

function chooseVoucher(id) {
  S.voucher = id;
  S.directItem = null;
  location.hash = '#/keranjang';
}

function setSearchFilter(key, value) {
  const params = new URLSearchParams(location.hash.split('?')[1] || '');
  if (value) params.set(key, value);
  else params.delete(key);
  location.hash = `#/cari?${params}`;
}

function editAddress() {
  const address = prompt('Masukkan alamat pengiriman:', S.address);
  if (address?.trim()) {
    S.address = address.trim();
    route();
  }
}

function toggleShipping() {
  S.ship = S.ship === 'reg' ? 'exp' : 'reg';
  route();
}

function setInsurance(enabled) {
  S.insurance = enabled;
  route();
}

function selectMethod(id) {
  S.method = id;
  S.fail = false;
  route();
}

function changePaymentMethod() {
  S.method = DATA.metode_bayar.find(method => !method.selalu_gagal)?.id || DATA.metode_bayar[0].id;
  S.fail = false;
  route();
}

function pay() {
  const method = DATA.metode_bayar.find(item => item.id === S.method);
  if (method?.selalu_gagal) {
    S.fail = true;
    route();
    return;
  }
  const isDirectPurchase = Boolean(S.directItem);
  S.order = {
    id: DATA.pesanan[0].id,
    resi: DATA.pesanan[0].resi,
    statuses: DATA.pesanan[0].tahap_status,
    statusIndex: 0,
    total: total(),
    items: activeItems().map(item => ({ name: P(item.id).nama, price: P(item.id).harga_akhir, q: item.q }))
  };
  if (!isDirectPurchase) S.cart = [];
  S.voucher = null;
  S.insurance = false;
  S.directItem = null;
  S.fail = false;
  location.hash = '#/sukses';
}

function trackOrder() {
  if (S.order && S.order.statusIndex < S.order.statuses.length - 1) {
    S.order.statusIndex += 1;
    route();
  }
}

function toggleCampaign(enabled) {
  S.showCampaign = enabled;
  route();
}

function setSearchHistory(query) {
  const value = query.trim();
  if (!value) return;
  S.searchHistory = [value, ...S.searchHistory.filter(item => item.toLowerCase() !== value.toLowerCase())].slice(0, 5);
}

function removeSearchHistory(encodedQuery) {
  const query = decodeURIComponent(encodedQuery);
  S.searchHistory = S.searchHistory.filter(item => item !== query);
  route();
}

function route() {
  const [path, queryString] = location.hash.slice(2).split('?');
  const [name, argument] = path.split('/');
  const params = new URLSearchParams(queryString || '');
  const page = R[name || ''];
  $('#view').innerHTML = page ? page(name === 'cari' ? params : argument) : '<p>Halaman tidak ditemukan.</p>';

  if (name === 'cari') $('#q').value = params.get('q') || '';
  if (name === 'search' && params.has('q')) $('#q').value = params.get('q');
  document.querySelectorAll('#tabs a').forEach(tab => {
    const activeTab = name === 'produk' || name === 'cari' || name === 'search' ? '' : name || '';
    tab.classList.toggle('on', tab.dataset.t === activeTab);
    if (tab.dataset.t === activeTab) tab.setAttribute('aria-current', 'page');
    else tab.removeAttribute('aria-current');
  });
  scrollTo(0, 0);
}

$('#sf').addEventListener('submit', event => {
  event.preventDefault();
  const query = $('#q').value.trim();
  setSearchHistory(query);
  location.hash = `#/cari?q=${encodeURIComponent(query)}`;
});

$('#q').addEventListener('focus', () => {
  if (location.hash.slice(2).split(/[/?]/)[0] !== 'search') location.hash = '#/search';
});

$('#q').addEventListener('input', () => {
  if (location.hash.slice(2).split(/[/?]/)[0] === 'search') {
    $('#view').innerHTML = searchPage();
  }
});

$('#view').addEventListener('click', event => {
  const suggestion = event.target.closest('a.suggestion');
  if (suggestion?.dataset.query) setSearchHistory(decodeURIComponent(suggestion.dataset.query));
});

window.addToCart = addToCart;
window.buyNow = buyNow;
window.changeQuantity = changeQuantity;
window.chooseVoucher = chooseVoucher;
window.setSearchFilter = setSearchFilter;
window.editAddress = editAddress;
window.toggleShipping = toggleShipping;
window.setInsurance = setInsurance;
window.selectMethod = selectMethod;
window.changePaymentMethod = changePaymentMethod;
window.pay = pay;
window.trackOrder = trackOrder;
window.toggleCampaign = toggleCampaign;
window.removeSearchHistory = removeSearchHistory;

addEventListener('hashchange', route);
route();
