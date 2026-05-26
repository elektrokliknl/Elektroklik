
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(initReveal, 100);
}

window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 50);
});

function toggleMobileNav() {
  const mobileNav = document.getElementById('mobileNav');
  if (mobileNav) mobileNav.classList.toggle('open');
}

function initReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((e, i) => {
      if (e.isIntersecting) {
        setTimeout(() => e.target.classList.add('visible'), i * 80);
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.page.active .reveal').forEach(el => {
    if (!el.classList.contains('visible')) observer.observe(el);
  });
}

setTimeout(initReveal, 200);

function getChecked() {
  return Array.from(document.querySelectorAll('#page-offerte input[type="checkbox"]:checked'))
    .map(cb => cb.value)
    .join(', ');
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 4000);
}

async function sendToMail(data) {
  const response = await fetch('https://formsubmit.co/ajax/info@elektroklik.nl', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify(data)
  });

  if (!response.ok) {
    throw new Error('Verzenden mislukt');
  }

  return response.json();
}

async function submitOfferte() {
  const naam = document.getElementById('of-naam').value.trim();
  const tel = document.getElementById('of-tel').value.trim();
  const email = document.getElementById('of-email').value.trim();
  const adres = document.getElementById('of-adres').value.trim();
  const type = document.getElementById('of-type').value.trim();
  const diensten = getChecked();
  const omschrijving = document.getElementById('of-omschrijving').value.trim();
  const extra = document.getElementById('of-extra').value.trim();

  if (!naam || !email || !omschrijving) {
    showToast('⚠️ Vul alle verplichte velden in');
    return;
  }

  const submitBtn = document.querySelector('#offerteForm .form-submit');
  const oldText = submitBtn ? submitBtn.textContent : '';

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Bezig met verzenden...';
  }

  try {
    await sendToMail({
      _subject: 'Offerte aanvraag - ' + naam,
      _template: 'table',
      Naam: naam,
      Email: email,
      Telefoon: tel,
      Adres: adres,
      Type: type,
      Diensten: diensten || 'Niet opgegeven',
      Omschrijving: omschrijving,
      Extra_informatie: extra
    });

    const form = document.getElementById('offerteForm');
    const success = document.getElementById('offerteSuccess');

    if (form) form.style.display = 'none';
    if (success) {
      success.style.display = 'block';
      success.classList.add('show');
    }

    showToast('✅ Aanvraag verstuurd!');
  } catch (error) {
    showToast('⚠️ Verzenden lukte niet. Probeer het opnieuw of neem contact op via e-mail.');

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = oldText;
    }
  }
}

async function submitContact() {
  const naam = document.getElementById('ct-naam').value.trim();
  const email = document.getElementById('ct-email').value.trim();
  const tel = document.getElementById('ct-tel').value.trim();
  const bericht = document.getElementById('ct-bericht').value.trim();

  if (!naam || !email || !bericht) {
    showToast('⚠️ Vul alle verplichte velden in');
    return;
  }

  const submitBtn = document.querySelector('#contactFormBox .form-submit');
  const oldText = submitBtn ? submitBtn.textContent : '';

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Bezig met verzenden...';
  }

  try {
    await sendToMail({
      _subject: 'Contactbericht - ' + naam,
      _template: 'table',
      Naam: naam,
      Email: email,
      Telefoon: tel,
      Bericht: bericht
    });

    const form = document.getElementById('contactFormBox');
    const success = document.getElementById('contactSuccess');

    if (form) form.style.display = 'none';
    if (success) {
      success.style.display = 'block';
      success.classList.add('show');
    }

    showToast('✅ Bericht verstuurd!');
  } catch (error) {
    showToast('⚠️ Verzenden lukte niet. Probeer het opnieuw of neem contact op via e-mail.');

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = oldText;
    }
  }
}

function resetContactForm() {
  const form = document.getElementById('contactFormBox');
  const success = document.getElementById('contactSuccess');

  if (form) form.style.display = 'block';
  if (success) {
    success.classList.remove('show');
    success.style.display = 'none';
  }

  const naam = document.getElementById('ct-naam');
  const email = document.getElementById('ct-email');
  const tel = document.getElementById('ct-tel');
  const bericht = document.getElementById('ct-bericht');

  if (naam) naam.value = '';
  if (email) email.value = '';
  if (tel) tel.value = '';
  if (bericht) bericht.value = '';
}
