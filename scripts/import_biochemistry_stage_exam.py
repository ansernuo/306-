"""Import the supplied 25-question biochemistry exam without inventing its key.

The PDF contains questions only. Preserve its X-type markers independently of
the missing answers. Default output is apply_patch; --check verifies the data;
--images converts original page renders for the website source viewer.
"""
import argparse
import difflib
import hashlib
import json
import re
from pathlib import Path

from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
SOURCE_NAME = '【生化】阶段考试 天天师兄27考研 再相逢！.pdf'
SOURCE = Path('/Users/ray/Downloads') / SOURCE_NAME
TARGET = ROOT / 'src/data/biochemistry-stage-exam-data.json'
KEY = 'biochemistry-stage-exam-2026-10'
MULTIPLE = {3, 4, 6, 10, 11, 13, 18, 21, 22}
# Classify by the tested knowledge, never by a distractor's organ or molecule.
LECTURES = [8, 3, 3, 3, 6, 6, 2, 7, 7, 9, 10, 10, 20, 20, 16, 16,
            17, 18, 19, 19, 14, 14, 14, 14, 14]
TOPICS = {2: '生物氧化', 3: '糖代谢', 6: '脂代谢',
          7: '氨基酸与蛋白质', 8: '氨基酸与蛋白质',
          9: '核苷酸代谢', 10: '胆色素代谢与生物转化', 14: '小基因',
          16: '核酸', 17: '核酸', 18: '核酸', 19: '核酸', 20: '核酸'}


def clean(text):
    # The printed source contains these watermark fragments within sentences.
    text = text.replace('uusx', '')
    text = re.sub(r'\s+', ' ', text).strip()
    text = re.sub(r'(?<=[\u4e00-\u9fff]) (?=[\u4e00-\u9fff])', '', text)
    text = re.sub(r'\s*([，。：；、])\s*', r'\1', text)
    return text


def extract():
    records = {}
    current = field = None
    pages = PdfReader(SOURCE).pages
    assert len(pages) == 5
    for page_no, page in enumerate(pages, 1):
        for raw in page.extract_text().splitlines():
            line = clean(raw)
            if not line or '每日计划' in line or re.fullmatch(r'- \d+ -', line):
                continue
            match = re.match(r'^(\d{1,2})\.(?!\d)(.*)', line)
            if match:
                number = int(match[1])
                assert number == len(records) + 1, (number, len(records))
                text = match[2].strip()
                multi = text.startswith('（X）')
                if multi:
                    text = text.removeprefix('（X）').strip()
                current = {'number': number, 'page': page_no, 'pages': {page_no},
                           'text': [text], 'options': {}, 'multiple': multi}
                records[number] = current
                field = current['text']
                continue
            if current is None:
                continue
            current['pages'].add(page_no)
            option = re.match(r'^([A-D])\.(.*)', line)
            if option:
                assert option[1] not in current['options'], current
                current['options'][option[1]] = [option[2]]
                field = current['options'][option[1]]
            else:
                field.append(line)
    assert list(records) == list(range(1, 26))
    assert {n for n, q in records.items() if q['multiple']} == MULTIPLE
    for q in records.values():
        assert list(q['options']) == list('ABCD'), q
        q['text'] = clean(' '.join(q['text']))
        q['options'] = {key: clean(' '.join(value)) for key, value in q['options'].items()}
        assert q['text'] and all(q['options'].values())
    # Visually checked typography: PDF extraction separates letters in Q23,
    # flattens Fe's superscript charge and B6's subscript numeral in Q12.
    records[12]['options']['A'] = records[12]['options']['A'].replace('Fe2+', 'Fe²⁺')
    records[12]['options']['C'] = records[12]['options']['C'].replace('B6', 'B₆')
    for key, value in records[23]['options'].items():
        assert re.fullmatch(r'[ACGT ]+', value), value
        records[23]['options'][key] = value.replace(' ', '')
    return records


def build():
    groups = []
    for n, q in extract().items():
        lecture = LECTURES[n - 1]
        lid = f'lecture-{lecture:02d}'
        mode = '多选' if q['multiple'] else '单选'
        groups.append({
            'id': f'{KEY}-q{n:03d}', 'page': q['page'],
            'sourceKey': KEY, 'sourceName': SOURCE_NAME, 'sourceSection': '生物化学',
            'sourceQuestion': str(n), 'sourceLabel': '阶段考试',
            'sourcePages': sorted(q['pages']), 'title': f'阶段考试 · 第{n}题',
            'kind': 'X' if q['multiple'] else 'A',
            'kindLabel': '多项选择' if q['multiple'] else '单项选择',
            'answerLayout': 'rows', 'topic': TOPICS[lecture], 'lectureIds': [lid],
            'supplement': True, 'supplementNotice': '原卷未附答案，暂不自动判分',
            'answerSourceLabel': '阶段考试答案',
            'options': [{'key': key, 'displayKey': key, 'label': value}
                        for key, value in q['options'].items()],
            'stems': [{'number': n, 'sourceQuestion': n, 'sourcePage': q['page'],
                       'text': q['text'], 'answerRaw': '', 'answer': [],
                       'answerMode': mode, 'answerState': '暂无参考答案', 'lectureId': lid}],
        })
    return {
        'meta': {'title': '生物化学·阶段考试', 'sourceName': SOURCE_NAME, 'sourcePages': 5,
                 'sourceSha256': hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
                 'groupCount': 25, 'stemCount': 25, 'multipleChoiceCount': 9,
                 'missingAnswerQuestions': list(range(1, 26)),
                 'answerNote': '所提供PDF只有题目，无参考答案；保留原卷单/多选题型，全部暂不判分，不推测标准答案。'},
        'groups': groups,
        'pages': [{'page': n, 'sourceKey': KEY, 'image': f'biochemistry/{KEY}/page-{n:02d}.webp'}
                  for n in range(1, 6)],
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    parser.add_argument('--images', type=Path)
    args = parser.parse_args()
    data = build()
    if args.images:
        from PIL import Image
        dest = ROOT / 'public/biochemistry' / KEY
        dest.mkdir(parents=True, exist_ok=True)
        for n in range(1, 6):
            with Image.open(args.images / f'page-{n}.png') as im:
                im.convert('RGB').save(dest / f'page-{n:02d}.webp', quality=92)
        print('5 original PDF pages converted.')
    elif args.check:
        assert json.loads(TARGET.read_text()) == data
        print('25 questions, 100 options, 9 multiple-choice questions, no invented answers: PASS')
    else:
        new = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
        print('*** Begin Patch')
        if TARGET.exists():
            print('*** Update File: src/data/biochemistry-stage-exam-data.json')
            for line in list(difflib.unified_diff(TARGET.read_text().splitlines(), new.splitlines(), n=3))[2:]:
                print('@@' if line.startswith('@@') else line)
        else:
            print('*** Add File: src/data/biochemistry-stage-exam-data.json')
            print('\n'.join('+' + line for line in new.splitlines()))
        print('*** End Patch')


if __name__ == '__main__':
    main()
