// Renders public/icon.svg into the PNG sizes iOS and the PWA manifest need.
import sharp from 'sharp'

const sizes = { 'apple-touch-icon.png': 180, 'icon-192.png': 192, 'icon-512.png': 512 }
for (const [file, size] of Object.entries(sizes)) {
  await sharp('public/icon.svg').resize(size, size).png().toFile(`public/${file}`)
  console.log(`public/${file} ${size}px`)
}
