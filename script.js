function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));

  const pageEl = document.getElementById('page-' + page);
  if (pageEl) pageEl.classList.add('active');

  const navEl = document.getElementById('nav-' + page);
  if (navEl) navEl.classList.add('active');

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleMobileNav() {
  const mobileNav = document.getElementById('mobileNav');
  if (mobileNav) mobileNav.classList.toggle('open');
}

window.addEventListener('scroll', () => {
  const navbar = document.getElementById('navbar');
  if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 50);
});

function showToast(message) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

function getValue(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : '';
}

function getChecked() {
  return Array.from(document.querySelectorAll('#page-offerte input[type="checkbox"]:checked'))
    .map(cb => cb.value)
    .join(', ');
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

  if (!response.ok) throw new Error('Verzenden mislukt');
  return response.json();
}

async function submitOfferte(event) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();

  const naam = getValue('of-naam');
  const tel = getValue('of-tel');
  const email = getValue('of-email');
  const adres = getValue('of-adres');
  const type = getValue('of-type');
  const diensten = getChecked();
  const omschrijving = getValue('of-omschrijving');
  const extra = getValue('of-extra');

  if (!naam || !email || !omschrijving) {
    showToast('⚠️ Vul alle verplichte velden in');
    return;
  }

  const btn = document.querySelector('#offerteForm .form-submit');
  const oldText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Bezig met verzenden...';
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
    if (form) form.style.display = 'none';
    const success = document.getElementById('offerteSuccess');
    if (success) {
      success.style.display = 'block';
      success.classList.add('show');
    }
    showToast('✅ Aanvraag verstuurd!');
  } catch (error) {
    console.error(error);
    showToast('⚠️ Verzenden lukte niet. Probeer het opnieuw.');
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  }
}

async function submitContact(event) {
  if (event && typeof event.preventDefault === 'function') event.preventDefault();

  const naam = getValue('ct-naam');
  const email = getValue('ct-email');
  const tel = getValue('ct-tel');
  const bericht = getValue('ct-bericht');

  if (!naam || !email || !bericht) {
    showToast('⚠️ Vul alle verplichte velden in');
    return;
  }

  const btn = document.querySelector('#contactFormBox .form-submit');
  const oldText = btn ? btn.textContent : '';
  if (btn) {
    btn.disabled = true;
    btn.textContent = 'Bezig met verzenden...';
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
    if (form) form.style.display = 'none';
    const success = document.getElementById('contactSuccess');
    if (success) {
      success.style.display = 'block';
      success.classList.add('show');
    }
    showToast('✅ Bericht verstuurd!');
  } catch (error) {
    console.error(error);
    showToast('⚠️ Verzenden lukte niet. Probeer het opnieuw.');
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  }
}

function resetContactForm() {
  const form = document.getElementById('contactFormBox');
  if (form) form.style.display = 'block';
  const success = document.getElementById('contactSuccess');
  if (success) {
    success.style.display = 'none';
    success.classList.remove('show');
  }

  ['ct-naam', 'ct-email', 'ct-tel', 'ct-bericht'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

window.submitOfferte = submitOfferte;
window.submitContact = submitContact;
window.resetContactForm = resetContactForm;
window.toggleMobileNav = toggleMobileNav;

window.addEventListener('DOMContentLoaded', () => {
  const offerteBtn = document.querySelector('#offerteForm .form-submit');
  if (offerteBtn) offerteBtn.addEventListener('click', submitOfferte);

  const contactBtn = document.querySelector('#contactFormBox .form-submit');
  if (contactBtn) contactBtn.addEventListener('click', submitContact);
});
