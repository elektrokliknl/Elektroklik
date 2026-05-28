function showPage(page) {
  const routes = {
    home: '/',
    diensten: '/diensten/',
    overons: '/over-ons/',
    contact: '/contact/',
    offerte: '/offerte/'
  };

  if (routes[page]) {
    window.location.href = routes[page];
    return;
  }
}

function toggleMobileNav() {
  document.getElementById('mobileNav').classList.toggle('open');
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
  return Array.from(document.querySelectorAll('input[type="checkbox"]:checked'))
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
    await sendToMail({
      _subject: 'Contactbericht - ' + naam,
      _template: 'table',
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
