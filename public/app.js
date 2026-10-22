(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const money = (n, cur) => new Intl.NumberFormat('es-AR', { style: 'currency', currency: cur, maximumFractionDigits: 0 }).format(n);
  let catalog;

  $('#year').textContent = new Date().getFullYear();

  // Menú mobile
  const toggle = $('.nav-toggle');
  const links = $('.nav-links');
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open);
  });
  links.addEventListener('click', (e) => { if (e.target.closest('a')) links.classList.remove('open'); });

  async function post(url, data) {
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(json.error || 'Algo salió mal. Probá de nuevo.');
    return json;
  }

  function setMsg(form, text, kind) {
    const el = $('.form-msg', form);
    el.textContent = text;
    el.className = `form-msg ${kind || ''}`;
  }

  // ---------- Planes ----------
  function renderPlans() {
    const { brand, currency, products } = catalog;
    $('#wa-link').href = `https://wa.me/${brand.whatsapp}?text=${encodeURIComponent('¡Hola! Quiero consultar por los planes de entrenamiento.')}`;
    $('#ig-link').href = brand.instagram;

    $('#plans').innerHTML = products.map((p) => `
      <article class="card plan${p.featured ? ' featured' : ''}">
        <span class="plan-tag">${p.tag}</span>
        <h3>${p.title}</h3>
        <div class="plan-price">${money(p.price, currency)}${p.consult ? ' <small>/ mes</small>' : ''}</div>
        <p>${p.blurb}</p>
        <ul>${p.features.map((f) => `<li>${f}</li>`).join('')}</ul>
        <button class="btn btn-block" data-buy="${p.id}">${p.consult ? 'Quiero la asesoría' : 'Comprar'}</button>
      </article>`).join('');
  }

  // ---------- Compra ----------
  const dialog = $('#buy');
  const buyForm = $('#buy-form');

  function openBuy(id) {
    const p = catalog.products.find((x) => x.id === id);
    buyForm.producto.value = p.id;
    $('#buy-tag').textContent = p.tag;
    $('#buy-title').textContent = p.title;
    $('#buy-price').textContent = money(p.price, catalog.currency);
    const show = { training: p.needsTraining, diet: p.needsDiet, consult: p.consult };
    buyForm.querySelectorAll('[data-for]').forEach((el) => {
      const visible = !!show[el.dataset.for];
      el.hidden = !visible;
      el.querySelectorAll('input, select').forEach((f) => { f.required = visible; });
    });
    setMsg(buyForm, '');
    dialog.showModal();
  }

  $('#plans').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-buy]');
    if (btn) openBuy(btn.dataset.buy);
  });
  $('.modal-close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });

  buyForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!buyForm.checkValidity()) {
      const bad = buyForm.querySelector(':invalid');
      setMsg(buyForm, `Revisá el campo "${bad.closest('label')?.firstChild.textContent.trim() || 'marcado'}".`, 'error');
      bad.focus();
      return;
    }
    const btn = $('button[type=submit]', buyForm);
    btn.disabled = true;
    setMsg(buyForm, 'Preparando el pago…');
    try {
      const { url } = await post('/api/checkout', Object.fromEntries(new FormData(buyForm)));
      window.location.href = url;
    } catch (err) {
      setMsg(buyForm, err.message, 'error');
      btn.disabled = false;
    }
  });

  // ---------- Contacto ----------
  const contactForm = $('#contact-form');
  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!contactForm.checkValidity()) {
      setMsg(contactForm, 'Completá nombre, email y un mensaje (mínimo 10 caracteres).', 'error');
      return;
    }
    const btn = $('button[type=submit]', contactForm);
    btn.disabled = true;
    try {
      await post('/api/contact', Object.fromEntries(new FormData(contactForm)));
      contactForm.reset();
      setMsg(contactForm, '¡Mensaje enviado! Te respondo a la brevedad. 🤘', 'ok');
    } catch (err) {
      setMsg(contactForm, err.message, 'error');
    } finally {
      btn.disabled = false;
    }
  });

  // ---------- Inicio ----------
  (window.__CATALOG__ ? Promise.resolve(window.__CATALOG__) : fetch('/api/catalog').then((r) => r.json()))
    .then((data) => { catalog = data; renderPlans(); })
    .catch(() => { $('#plans').innerHTML = '<p class="lead">No pudimos cargar los planes. Recargá la página o escribime por WhatsApp.</p>'; });
})();
