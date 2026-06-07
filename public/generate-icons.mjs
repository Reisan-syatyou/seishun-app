import sharp from 'sharp';

const svg = `<svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="100" fill="#0288d1"/>
  <text x="256" y="320" font-size="280" text-anchor="middle" fill="white">📸</text>
</svg>`;

const buf = Buffer.from(svg);
await sharp(buf).resize(192, 192).png().toFile('public/icon-192.png');
await sharp(buf).resize(512, 512).png().toFile('public/icon-512.png');
console.log('アイコン生成完了！');