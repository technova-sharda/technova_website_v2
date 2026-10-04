const fs = require('fs');
const path = 'app/(public)/hackathon/page.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Extract Why Sharda
const whyShardaStart = content.indexOf('                {/* Why Sharda / Venue Highlights Section */}');
const mapLogisticsStart = content.indexOf('                {/* Map & Logistics Section */}');
const whyShardaBlock = content.substring(whyShardaStart, mapLogisticsStart);
content = content.replace(whyShardaBlock, '');

// 2. Insert Why Sharda at top (before Contact & Registration Info Block)
const contactInfoStart = content.indexOf('                {/* Contact & Registration Info Block (Moved to Top) */}');
content = content.substring(0, contactInfoStart) + whyShardaBlock + content.substring(contactInfoStart);

// 3. Extract FAQ
const faqStart = content.indexOf('                {/* FAQ Section */}');
const flipbookStart = content.indexOf('                {/* Flipbook Section */}');
const faqBlock = content.substring(faqStart, flipbookStart);
content = content.replace(faqBlock, '');

// 4. Insert FAQ at the very bottom, after Flipbook
const flipbookEnd = content.indexOf('                    <FlipbookViewer />\n                </div>');
const insertIndex = flipbookEnd + '                    <FlipbookViewer />\n                </div>'.length;
content = content.substring(0, insertIndex) + '\n\n' + faqBlock + content.substring(insertIndex);

fs.writeFileSync(path, content, 'utf8');
console.log('Done organizing layout!');
