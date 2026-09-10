export async function copyPlainText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  fallbackCopy(text)
}

export async function copyRichText(html: string, plain: string): Promise<void> {
  if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html': new Blob([html], { type: 'text/html' }),
          'text/plain': new Blob([plain], { type: 'text/plain' }),
        }),
      ])
      return
    } catch {
      // fall through to fallback
    }
  }
  fallbackCopyRich(html, plain)
}

function fallbackCopy(text: string): void {
  const el = document.createElement('textarea')
  el.value = text
  el.style.position = 'fixed'
  el.style.left = '-9999px'
  document.body.appendChild(el)
  el.select()
  document.execCommand('copy')
  document.body.removeChild(el)
}

function fallbackCopyRich(html: string, plain: string): void {
  const el = document.createElement('div')
  el.contentEditable = 'true'
  el.style.position = 'fixed'
  el.style.left = '-9999px'
  el.innerHTML = html
  document.body.appendChild(el)

  const range = document.createRange()
  range.selectNodeContents(el)
  const sel = window.getSelection()
  sel?.removeAllRanges()
  sel?.addRange(range)

  try {
    document.execCommand('copy')
  } catch {
    fallbackCopy(plain)
  }

  document.body.removeChild(el)
}
