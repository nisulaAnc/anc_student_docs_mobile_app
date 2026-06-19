const fs = require('fs');
const pngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAACklEQVR4nGMAAQAABQABDQottAAAAABJRU5ErkJggg==";
fs.writeFileSync('assets/logo.png', Buffer.from(pngBase64, 'base64'));
console.log('Dummy logo created');