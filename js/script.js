function showPage(page) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-links a').forEach(a => a.classList.remove('active'));
    document.getElementById('page-' + page).classList.add('active');
    const navEl = document.getElementById('nav-' + page);
    if (navEl) navEl.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(initReveal, 100);
  }

  window.addEventListener('scroll', () => {
    document.getElementById('navbar').classList.toggle('scrolled', window.scrollY > 50);
  });

  function toggleMobileNav() {
    document.getElementById('mobileNav').classList.toggle('open');
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
    return Array.from(document.querySelectorAll('#page-offerte input[type="checkbox"]:checked')).map(cb => cb.value).join(', ');
  }

  function showToast(msg) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 4000);
  }

  function submitOfferte() {
    const naam = document.getElementById('of-naam').value.trim();
    const email = document.getElementById('of-email').value.trim();
    const omschrijving = document.getElementById('of-omschrijving').value.trim();

    if (!naam || !email || !omschrijving) {
      showToast('⚠️ Vul alle verplichte velden in');
      return;
    }

    const diensten = getChecked() || 'Niet opgegeven';
    const tel = document.getElementById('of-tel').value;
    const adres = document.getElementById('of-adres').value;
    const type = document.getElementById('of-type').value;
    const extra = document.getElementById('of-extra').value;

    const body = encodeURIComponent(
      `Offerte aanvraag van: ${naam}\n` +
      `E-mail: ${email}\n` +
      `Telefoon: ${tel}\n` +
      `Adres: ${adres}\n` +
      `Type: ${type}\n` +
      `Diensten: ${diensten}\n\n` +
      `Omschrijving:\n${omschrijving}\n\n` +
      `Extra:\n${extra}`
    );

    const mailtoLink = `mailto:info@elektroklik.nl?subject=${encodeURIComponent('Offerte aanvraag - ' + naam)}&body=${body}`;
    window.location.href = mailtoLink;

    document.getElementById('offerteForm').style.display = 'none';
    document.getElementById('offerteSuccess').classList.add('show');
  }

  function submitContact() {
    const naam = document.getElementById('ct-naam').value.trim();
    const email = document.getElementById('ct-email').value.trim();
    const bericht = document.getElementById('ct-bericht').value.trim();

    if (!naam || !email || !bericht) {
      showToast('⚠️ Vul alle verplichte velden in');
      return;
    }

    const tel = document.getElementById('ct-tel').value;
    const body = encodeURIComponent(
      `Contactbericht van: ${naam}\n` +
      `E-mail: ${email}\n` +
      `Telefoon: ${tel}\n\n` +
      `Bericht:\n${bericht}`
    );

    const mailtoLink = `mailto:info@elektroklik.nl?subject=${encodeURIComponent('Contactbericht - ' + naam)}&body=${body}`;
    window.location.href = mailtoLink;

    document.getElementById('contactFormBox').style.display = 'none';
    document.getElementById('contactSuccess').classList.add('show');
  }

  function resetContactForm() {
    document.getElementById('contactFormBox').style.display = 'block';
    document.getElementById('contactSuccess').classList.remove('show');
    document.getElementById('ct-naam').value = '';
    document.getElementById('ct-email').value = '';
    document.getElementById('ct-tel').value = '';
    document.getElementById('ct-bericht').value = '';
  }