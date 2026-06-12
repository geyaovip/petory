(() => {
  const nav = document.querySelector('.nav')
  const links = document.querySelector('.nav-links')

  if (nav && links) {
    const toggle = document.createElement('button')
    toggle.className = 'nav-menu-toggle'
    toggle.type = 'button'
    toggle.textContent = '菜单'
    toggle.setAttribute('aria-expanded', 'false')
    toggle.setAttribute('aria-controls', 'site-navigation')
    links.id = 'site-navigation'
    nav.insertBefore(toggle, links)

    const closeMenu = () => {
      nav.classList.remove('is-menu-open')
      toggle.setAttribute('aria-expanded', 'false')
    }

    toggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-menu-open')
      toggle.setAttribute('aria-expanded', String(open))
    })
    links.addEventListener('click', closeMenu)
    window.addEventListener('resize', () => {
      if (window.innerWidth > 640) closeMenu()
    })
  }

  const current = (location.pathname.split('/').pop() || 'index.html').toLowerCase()
  document.querySelectorAll('.nav-links a').forEach((link) => {
    const href = (link.getAttribute('href') || '').split('#')[0].toLowerCase()
    if (href === current) {
      link.classList.add('is-active')
      link.setAttribute('aria-current', 'page')
    }
  })
})()
