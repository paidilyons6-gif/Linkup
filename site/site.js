{
  const year = document.getElementById('yr');
  if (year) year.textContent = new Date().getFullYear();

  const nav = document.getElementById('nav');
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');
  if (nav && toggle && links) {
    const setMenu = open => {
      nav.classList.toggle('open', open);
      toggle.setAttribute('aria-expanded', String(open));
    };
    toggle.addEventListener('click', () => setMenu(!nav.classList.contains('open')));
    links.addEventListener('click', event => {
      if (event.target.closest('a')) setMenu(false);
    });
    addEventListener('keydown', event => {
      if (event.key !== 'Escape' || !nav.classList.contains('open')) return;
      setMenu(false);
      toggle.focus();
    });
    const onScroll = () => nav.classList.toggle('stuck', scrollY > 8);
    onScroll();
    addEventListener('scroll', onScroll, { passive: true });
  }

  if (!matchMedia('(prefers-reduced-motion: reduce)').matches && 'IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) return;
        target.classList.remove('pending-reveal');
        observer.unobserve(target);
      });
    });
    document.querySelectorAll('.reveal').forEach(element => {
      if (element.getBoundingClientRect().top < innerHeight) return;
      element.classList.add('pending-reveal');
      observer.observe(element);
    });
  }
}
