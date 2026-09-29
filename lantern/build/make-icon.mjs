import sharp from 'sharp'
import pngToIco from 'png-to-ico'
import { readFileSync, writeFileSync } from 'node:fs'

const svg = readFileSync(new URL('./icon.svg', import.meta.url))
const sizes = [16, 24, 32, 48, 64, 128, 256]
const pngs = await Promise.all(sizes.map((s) => sharp(svg).resize(s, s).png().toBuffer()))
// main window/app png
writeFileSync(new URL('./icon.png', import.meta.url), pngs[pngs.length - 1])
// multi-size ICO for Windows taskbar/exe
const ico = await pngToIco(pngs)
writeFileSync(new URL('./icon.ico', import.meta.url), ico)
console.log('wrote build/icon.png (256) and build/icon.ico (' + sizes.join(',') + ')')
