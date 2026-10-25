"""Import the five reviewed Notion mnemonic exports without changing their facts.

Usage: python3 scripts/import_mnemonics.py /path/to/exports
Expected filenames: mnemonic-source-{subject}.md.
"""
import hashlib
import html
import json
import re
import sys
from html.parser import HTMLParser
from pathlib import Path
from curate_mnemonics import curate_records

SUBJECTS = {
    'med': ('内科', '3f533d3af50a81d5a723d31f14378d76'),
    'surgery': ('外科', '3f133d3af50a8131a9daeeaa0f22b8bf'),
    'pathology': ('病理', '3f633d3af50a81889368c02c6e123763'),
    'physiology': ('生理', '3f633d3af50a813f8e4ef56c616b3344'),
    'biochemistry': ('生化', '3f633d3af50a81db8ebdf0716e8de862'),
}
COLORS = {'red', 'blue', 'green', 'orange', 'purple'}


class RichText(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.stack = []
        self.parts = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'br':
            self.handle_data('\n')
            return
        self.stack.append((tag, attrs.get('color', ''), tag in ('b', 'strong')))

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i][0] == tag:
                del self.stack[i:]
                break

    def handle_data(self, data):
        data = re.sub(r'\\([.*_{}\[\]|<>~`])', r'\1', data)
        tone = next((color for _, color, _ in reversed(self.stack) if color in COLORS), '')
        bold = any(b for _, _, b in self.stack)
        if not data:
            return
        if self.parts and self.parts[-1].get('color', '') == tone and self.parts[-1].get('bold', False) == bold:
            self.parts[-1]['text'] += data
        else:
            part = {'text': data}
            if tone:
                part['color'] = tone
            if bold:
                part['bold'] = True
            self.parts.append(part)


def rich(value):
    value = re.sub(r'<span color="gray">〔[^<]*〕</span>', '', value)
    value = re.sub(r'〔(?:PDF|p\.)[^〕]*〕', '', value)
    parser = RichText()
    parser.feed(value)
    parser.close()
    return parser.parts


def plain(value):
    return ''.join(p['text'] for p in rich(value)).strip()


MARKER = re.compile(
    r'<h3[^>]*>\s*(\d+)\\?\.\s*([\s\S]*?)\s*</h3>'
    r'|^<b><span color="blue">(\d+)\.\s*([^\n]*?)</span></b>', re.M)
HEADER = re.compile(r'<h([12])[^>]*>\s*([\s\S]*?)\s*</h\1>')


def import_subject(subject, source):
    text = source.read_text()
    headers = list(HEADER.finditer(text))
    markers = list(MARKER.finditer(text))
    records = []
    for i, marker in enumerate(markers):
        number = int(marker[1] or marker[3])
        title = plain(marker[2] or marker[4])
        chapter = section = ''
        for header in headers:
            if header.start() >= marker.start():
                break
            heading = re.sub(r'^\d+\.\s*', '', plain(header[2]))
            if subject == 'med' and header[1] == '1':
                chapter, section = heading, ''
            elif subject == 'med':
                section = heading
            else:
                chapter = heading
        end = markers[i + 1].start() if i + 1 < len(markers) else len(text)
        following_header = next((h.start() for h in headers if marker.end() < h.start() < end), None)
        if following_header is not None:
            end = following_header
        body = text[marker.end():end]
        body = re.split(r'<(?:page |h2[^>]*>\s*原拆分页备份)', body)[0]
        # Backups are whole lecture paragraphs containing unrelated mnemonics.
        body = re.sub(r'<toggle>\s*讲义汇总原文[\s\S]*?</toggle>', '', body)
        def table_rows(table):
            rows = []
            for row in re.findall(r'<tr[^>]*>([\s\S]*?)</tr>', table[0]):
                cells = re.findall(r'<td[^>]*>([\s\S]*?)</td>', row)
                if len(cells) < 2 or any(plain(c) in ('口诀字 / 片段', '对应原文考点', '对应内容', '口诀字／片段') for c in cells):
                    continue
                fragment, knowledge = cells[-2:]
                fragment = re.sub(r'\s+', ' ', fragment).strip()
                knowledge = re.sub(r'\s+', ' ', knowledge).strip().replace('color="blue"', 'color="red"')
                rows.append(f'- {fragment} → {knowledge}')
            return '\n\n' + '\n'.join(rows) + '\n\n'
        body = re.sub(r'<table[^>]*>[\s\S]*?</table>', table_rows, body)
        body = re.sub(r'</?(?:p|toggle|details|summary)[^>]*>', '', body)
        blocks = []
        for paragraph in re.split(r'\n\s*\n', body.strip()):
            for line in re.split(r'\n(?=- |\t- )', paragraph):
                line = line.strip()
                if not line or line == '---' or line.startswith(('出处：', '出处:', '<table-of-contents')):
                    continue
                if line == '补充速记' or re.match(r'PDF第?[\dp.、—– -]+页', line):
                    continue
                kind = 'context' if line.startswith('>') else 'mapping' if line.startswith('- ') else 'note' if line.startswith(('说明：', '备注：')) else 'text'
                line = re.sub(r'^[>\-]\s*', '', line)
                parts = rich(line)
                parts = [{**part, 'text': re.sub(r'\s+', ' ', part['text'])} for part in parts]
                content = ''.join(p['text'] for p in parts).strip()
                if not content or content.startswith(('出处：', '出处:')):
                    continue
                blocks.append({'kind': kind, 'parts': parts})
        assert title and blocks, (subject, number, title)
        record = {'id': f'{subject}-{number}', 'number': number, 'subject': subject,
                  'chapter': chapter or '综合', 'section': section, 'title': title, 'blocks': blocks}
        if '瓜瓜一定摆平' in title:
            record['aliases'] = ['呱呱一定摆平']
        records.append(record)
    assert len({r['id'] for r in records}) == len(markers)
    return records


def main():
    folder = Path(sys.argv[1])
    data = {'version': 1, 'sources': [], 'items': []}
    for subject, (label, page) in SUBJECTS.items():
        source = folder / f'mnemonic-source-{subject}.md'
        records = import_subject(subject, source)
        data['sources'].append({'subject': subject, 'label': label, 'url': f'https://app.notion.com/p/{page}',
                                'count': len(records), 'sha256': hashlib.sha256(source.read_bytes()).hexdigest()})
        data['items'].extend(records)
    data = curate_records(data)
    target = Path(__file__).resolve().parents[1] / 'src/data/mnemonics-data.json'
    target.write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(json.dumps({s['label']: s['count'] for s in data['sources']}, ensure_ascii=False))
    print(f'{len(data["items"])} records; {target.stat().st_size:,} bytes')


if __name__ == '__main__':
    main()
