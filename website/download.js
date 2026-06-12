async function loadManifest() {
  const versionEl = document.getElementById('release-version')
  const macLink = document.getElementById('mac-download')
  const winLink = document.getElementById('win-download')
  const macMeta = document.getElementById('mac-meta')
  const winMeta = document.getElementById('win-meta')

  try {
    const response = await fetch('releases/latest.json', { cache: 'no-store' })
    if (!response.ok) throw new Error('manifest unavailable')
    const data = await response.json()

    versionEl.textContent = data.version
    macLink.href = data.mac.url
    macLink.textContent = '下载 macOS 版'
    winLink.href = data.win.url
    winLink.textContent = '下载 Windows 版'
  } catch {
    versionEl.textContent = '暂不可用'
    macMeta.textContent = '暂时无法获取下载链接，请稍后再试'
    winMeta.textContent = '暂时无法获取下载链接，请稍后再试'
    macLink.href = '#'
    winLink.href = '#'
    macLink.classList.add('btn-disabled')
    winLink.classList.add('btn-disabled')
    macLink.setAttribute('aria-disabled', 'true')
    winLink.setAttribute('aria-disabled', 'true')
  }
}

void loadManifest()
