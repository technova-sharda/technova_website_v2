import fitz
import os

pdf_path = 'sharda haackathon brochure.pdf'
out_dir = 'public/assets/docs/flipbook'
os.makedirs(out_dir, exist_ok=True)

doc = fitz.open(pdf_path)
for i in range(len(doc)):
    page = doc.load_page(i)
    pix = page.get_pixmap(dpi=150)
    pix.save(f'{out_dir}/page_{i+1}.png')
print(f'Converted {len(doc)} pages.')
