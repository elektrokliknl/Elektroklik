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

function getChecked() {
  return Array.from(document.querySelectorAll('#page-offerte input[type="checkbox"]:checked'))
    .map(cb => cb.value)
    .join(', ');
}

function submitToFormSubmit(data) {
  return new Promise((resolve) => {
    const frameName = 'formsubmit_frame_' + Date.now();
    const iframe = document.createElement('iframe');
    iframe.name = frameName;
    iframe.style.display = 'none';
    document.body.appendChild(iframe);

    const form = document.createElement('form');
    form.method = 'POST';
    form.action = 'https://formsubmit.co/info@elektroklik.nl';
    form.target = frameName;
    form.style.display = 'none';

    const fields = {
      _captcha: 'false',
      _template: 'table',
      ...data
    };

    Object.entries(fields).forEach(([name, value]) => {
      const input = document.createElement('input');
      input.type = 'hidden';
      input.name = name;
      input.value = value == null ? '' : String(value);
      form.appendChild(input);
    });

    document.body.appendChild(form);
    form.submit();

    setTimeout(() => {
      form.remove();
      iframe.remove();
      resolve();
    }, 1600);
  });
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

  const btn = document.querySelector('#offerteForm .form-submit');
  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Bezig met verzenden...';

  try {
    await submitToFormSubmit({
      _subject: 'Offerte aanvraag - ' + naam,
      Naam: naam,
      Email: email,
      Telefoon: tel,
      Adres: adres,
      Type: type,
      Diensten: diensten || 'Niet opgegeven',
      Omschrijving: omschrijving,
      Extra_informatie: extra
    });

    document.getElementById('offerteForm').style.display = 'none';
    const success = document.getElementById('offerteSuccess');
    success.style.display = 'block';
    success.classList.add('show');
    showToast('✅ Aanvraag verstuurd!');
  } catch (error) {
    showToast('⚠️ Verzenden lukte niet. Probeer het opnieuw.');
    btn.disabled = false;
    btn.textContent = oldText;
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

  const btn = document.querySelector('#contactFormBox .form-submit');
  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Bezig met verzenden...';

  try {
    await submitToFormSubmit({
      _subject: 'Contactbericht - ' + naam,
      Naam: naam,
      Email: email,
      Telefoon: tel,
      Bericht: bericht
    });

    document.getElementById('contactFormBox').style.display = 'none';
    const success = document.getElementById('contactSuccess');
    success.style.display = 'block';
    success.classList.add('show');
    showToast('✅ Bericht verstuurd!');
  } catch (error) {
    showToast('⚠️ Verzenden lukte niet. Probeer het opnieuw.');
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

function resetContactForm() {
  document.getElementById('contactFormBox').style.display = 'block';
  const success = document.getElementById('contactSuccess');
  success.style.display = 'none';
  success.classList.remove('show');

  document.getElementById('ct-naam').value = '';
  document.getElementById('ct-email').value = '';
  document.getElementById('ct-tel').value = '';
  document.getElementById('ct-bericht').value = '';
}
