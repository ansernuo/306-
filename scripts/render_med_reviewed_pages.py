"""Render the reviewed references from the user-selected local PDF.
Usage: python scripts/render_med_reviewed_pages.py /path/to/27跟课版内科合集【带导图】.pdf [--png-dir /path/to/existing-renders]
Use --review med-remaining-reviewed-lecture-evidence or surgery-ortho-reviewed-lecture-evidence with the matching PDF.
macOS uses PDFKit to preserve the collection's annotations/fonts. Other hosts use Poppler.
"""
import argparse
import concurrent.futures
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('pdf', type=Path)
parser.add_argument('--png-dir', type=Path)
parser.add_argument('--review', default='med-reviewed-lecture-evidence', help='Manifest name in src/data, without .json')
args = parser.parse_args()
review = json.loads((ROOT / 'src/data' / f'{args.review}.json').read_text())
pdf = args.pdf.resolve()
if not pdf.is_file():
    raise SystemExit(f'PDF not found: {pdf}')
pages = list(review['pages'].values())
with tempfile.TemporaryDirectory() as directory:
    temp = Path(directory)
    rendered = args.png_dir
    if rendered is None and sys.platform == 'darwin' and shutil.which('swiftc'):
        executable = temp / 'render-pdf'
        env = {**os.environ, 'CLANG_MODULE_CACHE_PATH': str(temp / 'clang-cache')}
        subprocess.run(['swiftc', '-module-cache-path', str(temp / 'swift-cache'), str(ROOT / 'scripts/render_med_reviewed_pages.swift'), '-o', str(executable)], env=env, check=True)
        subprocess.run([str(executable), str(pdf), str(temp), *[str(page['page']) for page in pages if page['sourceFile'] == pdf.name]], check=True, stdout=subprocess.DEVNULL)
        rendered = temp
    if rendered is None:
        from pypdf import PdfReader, PdfWriter
        reader = PdfReader(pdf)
        for page in pages:
            if page['sourceFile'] != pdf.name: continue
            writer = PdfWriter()
            writer.add_page(reader.pages[page['page'] - 1])
            writer.write(temp / f"{page['page']}.pdf")
    def convert(page):
        target = ROOT / 'public' / page['image']
        target.parent.mkdir(parents=True, exist_ok=True)
        if page['sourceFile'] != pdf.name:
            if page['sourceSubject'] != 'surgery' or page['lectureNumber'] != 14 or page['page'] != 2:
                raise ValueError(f"Pass the matching source PDF for {page['sourceFile']}")
            source = ROOT / 'public/surgery/lecture-pages/lecture-14-page-02.webp'
        elif rendered:
            source = rendered / f"page-{page['page']:03}.png"
        else:
            prefix = temp / f"page-{page['page']:03}"
            subprocess.run([os.environ.get('PDFTOPPM', 'pdftoppm'), '-f', '1', '-l', '1', '-r', '150', '-singlefile', '-png', str(temp / f"{page['page']}.pdf"), str(prefix)], check=True, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            source = prefix.with_suffix('.png')
        with Image.open(source) as image:
            if target.suffix == '.avif':
                image.convert('RGB').save(target, 'AVIF', quality=48, subsampling='4:4:4', speed=5, max_threads=2)
            else:
                image.convert('RGB').save(target, 'WEBP', quality=78, method=6)
        return target.stat().st_size
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        sizes = list(pool.map(convert, pages))
    print(f'Rendered {len(sizes)} reviewed pages ({sum(sizes)/1024/1024:.1f} MiB)')
