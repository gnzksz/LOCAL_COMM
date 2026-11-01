// Landing page: mobile menu and reveal-on-scroll. No dependencies.
(() => {
  document.documentElement.classList.add('js');

  // mobile menu
  const burger = document.getElementById('burger');
  const menu = document.getElementById('menu');
  const closeMenu = () => {
    menu.classList.remove('open');
    burger.setAttribute('aria-expanded', 'false');
  };
  burger.addEventListener('click', () => {
    const open = menu.classList.toggle('open');
    burger.setAttribute('aria-expanded', String(open));
  });
  menu.addEventListener('click', (e) => {
    if (e.target.closest('a')) closeMenu();
  });

  // reveal on scroll
  const items = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    items.forEach((el, i) => {
      el.style.transitionDelay = `${(i % 4) * 70}ms`;
      io.observe(el);
    });
  } else {
    items.forEach((el) => el.classList.add('in'));
  }

  document.getElementById('year').textContent = new Date().getFullYear();
})();
