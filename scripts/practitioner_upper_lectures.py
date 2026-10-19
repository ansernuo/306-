"""Curated, page-level lecture references for the 197 practitioner questions.

Reuse existing WebP assets; --render only creates missing exact pages from the
original lecture PDFs. The TSV is reviewed against lecture text, not a keyword
search result. Some lecture statements reflect older exam conventions; the
question explanations retain the existing version notes and pending answers.
"""
from pathlib import Path
import argparse
import copy
import json
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path('/Users/ray/Desktop/📚 考研备考/🩺 西综/306')
SUBJECT_LABELS = {'med': '内科', 'surgery': '外科'}


def references():
    lectures = {
        subject: {l['number']: l for l in json.loads(
            (ROOT / f'src/data/{subject}-data.json').read_text())['lectures']}
        for subject in SUBJECT_LABELS
    }
    result = {}
    for line in Path(__file__).with_name('practitioner_upper_lecture_pages.tsv').read_text().splitlines():
        if not line or line.startswith('#'):
            continue
        number, entries = line.split('|')
        number = int(number)
        assert number not in result
        result[number] = []
        for entry in entries.split(','):
            subject, lecture_number, page = entry.split(':')
            lecture = lectures[subject][int(lecture_number)]
            page = int(page)
            assert 1 <= page <= lecture['pageCount'], (number, entry)
            result[number].append({
                'lectureId': lecture['id'], 'sourceSubject': subject,
                'lectureNumber': lecture['number'], 'sourceFile': lecture['file'],
                'page': page, 'pageLabel': f'讲义第 {page} 页',
                'title': f'{SUBJECT_LABELS[subject]}第{lecture["number"]}讲 · {lecture["title"]} · 第{page}页',
                'image': f'{subject}/lecture-pages/{lecture["id"]}-page-{page:02d}.webp',
            })
    assert set(result) == set(range(1, 198))
    return result, lectures


def attach_lectures(content):
    refs, lectures = references()
    # The combined lung-cancer lecture belongs to the internal-medicine source
    # files and is also needed in the surgery chapter menu for question 133.
    lung = lectures['med'][12]
    content['surgery']['lectures'] = [{
        **{k: lung[k] for k in ('number', 'title', 'file', 'pageCount')},
        'id': 'med-lecture-12', 'sourceSubject': 'med',
    }]
    for subject, data in content.items():
        for group in data['groups']:
            combined = {}
            for stem in group['stems']:
                evidence = copy.deepcopy(refs[stem['number']])
                for item in evidence:
                    if subject == 'surgery' and item['sourceSubject'] == 'med':
                        item['lectureId'] = 'med-' + item['lectureId']
                    item['questionNumbers'] = [stem['number']]
                    item['knowledgePoints'] = [stem['knowledgePoint']]
                    if item['image'] not in combined:
                        combined[item['image']] = copy.deepcopy(item)
                    else:
                        combined[item['image']]['questionNumbers'].append(stem['number'])
                        combined[item['image']]['knowledgePoints'].append(stem['knowledgePoint'])
                stem['lectureEvidencePages'] = evidence
            group['lectureEvidencePages'] = list(combined.values())
            group['lectureEvidence'] = group['lectureEvidencePages'][0]
        data['meta']['lectureEvidenceStemCount'] = sum(len(g['stems']) for g in data['groups'])


def render_missing(source_dir):
    from PIL import Image
    refs, _ = references()
    unique = {item['image']: item for items in refs.values() for item in items}
    missing = [item for image, item in unique.items() if not (ROOT / 'public' / image).exists()]
    for item in missing:
        source = source_dir / SUBJECT_LABELS[item['sourceSubject']] / '讲义' / item['sourceFile']
        assert source.is_file(), source
    with tempfile.TemporaryDirectory(prefix='practitioner-lectures-') as temp:
        prefix = Path(temp) / 'page'
        for item in missing:
            source = source_dir / SUBJECT_LABELS[item['sourceSubject']] / '讲义' / item['sourceFile']
            subprocess.run(['pdftoppm', '-f', str(item['page']), '-l', str(item['page']),
                '-singlefile', '-scale-to', '1800', '-png', str(source), str(prefix)], check=True,
                stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
            target = ROOT / 'public' / item['image']
            target.parent.mkdir(parents=True, exist_ok=True)
            with Image.open(prefix.with_suffix('.png')) as image:
                image.convert('RGB').save(target, 'WEBP', quality=88)
    print(f'{len(unique)} lecture pages referenced; {len(missing)} missing pages rendered')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--render', action='store_true')
    parser.add_argument('--source-dir', type=Path, default=DEFAULT_SOURCE)
    args = parser.parse_args()
    if args.render:
        render_missing(args.source_dir)
