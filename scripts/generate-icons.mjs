import fs from 'fs'
import path from 'path'
import { Resvg } from '@resvg/resvg-js'

const outDir = path.resolve('public/icons')
fs.mkdirSync(outDir, { recursive: true })

function png(svgPath, size, dest) {
  const svg = fs.readFileSync(svgPath)
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: size } })
  fs.writeFileSync(dest, resvg.render().asPng())
  console.log('wrote', dest)
}

png('public/diya.svg', 192, path.join(outDir, 'icon-192.png'))
png('public/diya.svg', 512, path.join(outDir, 'icon-512.png'))
png('public/diya-maskable.svg', 512, path.join(outDir, 'icon-512-maskable.png'))
png('public/diya-monochrome.svg', 512, path.join(outDir, 'icon-monochrome.png'))
png('public/diya.svg', 180, path.resolve('public/apple-touch-icon.png'))
