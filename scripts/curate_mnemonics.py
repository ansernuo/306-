"""Keep mnemonic-specific knowledge, rather than surrounding lecture paragraphs."""
import json
import re
import sys
import unicodedata
from pathlib import Path
from lecture_mnemonic_review import apply_lecture_review


def norm(text):
    return re.sub(r'[\W_]+', '', unicodedata.normalize('NFKC', text).lower())


def text_of(block):
    return ''.join(part['text'] for part in block['parts']).strip()


def block(kind, text):
    if kind == 'mapping' and '→' in text:
        fragment, knowledge = text.split('→', 1)
        parts = [{'text': fragment.strip(), 'color': 'blue', 'bold': True}, {'text': ' → '},
                 {'text': knowledge.strip(), 'color': 'red'}]
    else:
        parts = [{'text': text}]
    return {'kind': kind, 'parts': parts}


META = re.compile(r'本节口诀|原文汇总|讲义汇总|逐字|没有单独对应|未逐字|未给出|不编造|本稿|原旁注没有|不另冒充|课堂|作为原讲义|按原页|串联字|连接语|情景联想|核心精讲|帮助同学们|思维导图|性感认识')
FILLER = re.compile(r'^(?:串联字|连接字|连接语|音形提示|情景联想|字形提示|原文未|原页未|无独立考点|无单独考点)')
EDITORIAL = re.compile(r'^(?:这(?:是|句|里|条)|本(?:句|条|章|语境)|不能(?:据|因|由|只)|不是说|只作|纯属|仅记忆|名称联想|原文注明|已对照|按对应|不另|不各|不强定|不把|保留讲义|依原讲义|补全原句|性别仅为)')
EDITORIAL_ONLY = re.compile(r'^(?:原合集|原资料|保留原|根据.*拆解|按原书|只按记忆|短记号按|以完整结构|手写旁注|本处旁注|按该章|仅保留记忆|数字旁注|旁注原句|第\d+页另记|[“"\s]*口诀仅|.*(?:是|为)串联语$|.*未单独(?:解释|释义|展开)|.*未解释其.*含义)')


def polish(text):
    if EDITORIAL_ONLY.search(text):
        return ''
    text = re.sub(r'^(?:说明|备注|提示)：\s*', '', text)
    text = re.sub(r'(?:原记忆句|可靠记忆点|原句限制|记忆句|记忆点|记忆标签|记忆钩子|记忆字形|形象记忆|步骤性记忆|记忆场景|记忆归纳|记忆语境|记忆尾缀|整体记忆|压缩记忆|记忆)', '', text)
    text = re.sub(r'^(?:[^：；]*章节原句|[^：；]*来源|[^：；]*相关药物组|左心衰|SLE|并列)[：:](?=.)', '', text) if '记忆' in text else text
    text = re.sub(r'（口诀仅[^）]*）|（口径）', '', text)
    text = re.sub(r'(?:的)?(?:英文|英语|汉语|谐音|字形|读音|字母|数字|数值|生活化|生活|音形|整体|姓名|整组|整句)?联想(?:尾字|用字|语)?', '', text)
    text = re.sub(r'的(?:音形|情景|字形|记忆)提示', '', text)
    text = re.sub(r'(?:原页|原文|原列表|原图|讲义)(?:明确|另|中|所用|用|列|写|指出|注明|为)?', '', text)
    text = re.sub(r'(?:原表|原旁注|源页|源导图|导图|本页|同页)(?:中的|中|的|另|仅|写|所列|所用)?', '', text)
    text = re.sub(r'(?:的)?(?:情景|情境|形象|空间|生活)?比喻', '', text)
    text = re.sub(r'(?:的)?(?:字母|读音|情境|情景|情节)(?:与情境)?(?:串联|提示|钩子|尾字|尾语|词|字)?', '', text)
    text = re.sub(r'^(?:对应考点|所列|记忆点|小结|复习)[：: ]*', '', text)
    clauses = re.split(r'[；。]', text)
    kept = []
    for clause in clauses:
        clause = clause.strip(' ，、')
        if not clause or EDITORIAL.search(clause) or EDITORIAL_ONLY.search(clause) or META.search(clause):
            continue
        if re.fullmatch(r'(?:串联语|串联|记忆|情境|情景|尾语|尾字|读音提示|本节口诀|按药理考点整理|具体特点见.*)', clause):
            continue
        if re.fullmatch(r'(?:串联|连接|尾|用|提示)?字|不是物质|不是第三种药|不另造一种抑制剂|不另对应一个疾病|不额外对应药名', clause):
            continue
        clause = re.sub(r'^(?:\d+(?:\.(?!\d)|、)|[①②③④⑤⑥⑦⑧⑨⑩])\s*', '', clause)
        kept.append(clause)
    return '；'.join(kept)


def clean_note(text):
    text = re.sub(r'^(?:说明|备注|补充|提示)：\s*', '', text)
    # Keep clinical qualifications; discard editorial explanations of how a mnemonic was made.
    clauses = re.split(r'(?<=[。；])', text)
    return ''.join(clause for clause in clauses if not META.search(clause)).strip('；。 ')


def curate_records(data):
    titles = {norm(item['title']): item['title'] for item in data['items'] if len(norm(item['title'])) >= 3}
    for item in data['items']:
        old = item['blocks']
        mappings, notes = [], []
        contexts = [text_of(b) for b in old if b['kind'] == 'context']
        for source in old:
            text = text_of(source)
            if re.search(r'^(?:口诀(?:字|片段)|比较项目|对应(?:原文考点|知识点与条件))', text):
                continue
            if source['kind'] == 'mapping':
                if '→' in text:
                    fragment, knowledge = text.split('→', 1)
                    knowledge = re.sub(r'^(?:串联字；|串联字，|此处联想|用以联想)', '', knowledge).strip()
                    knowledge = re.sub(r'；No\.1整体.*', '', knowledge)
                    if FILLER.search(knowledge) or not knowledge:
                        continue
                    text = fragment.strip() + ' → ' + knowledge
                if not META.search(text):
                    mappings.append(block('mapping', text))
            elif source['kind'] not in ('context',):
                cleaned = clean_note(text)
                if cleaned and cleaned not in notes:
                    notes.append(cleaned)

        own = norm(item['title'])
        scope = ''
        # A later paragraph often belongs to the next mnemonic or a chapter recap.
        # Only the first source paragraph may supply this entry's clinical scope.
        for context in contexts[:1]:
            context = re.sub(r'^\s*(?:[一二三四五六七八九十]+、|\d+(?:\.(?!\d)|、)\s*)', '', context)
            context_key = norm(context)
            other = [title for key, title in titles.items() if key != own and len(key) >= 4 and key in context_key and key not in own]
            label = re.split(r'[:：]', context, maxsplit=1)[0]
            if 2 <= len(label) <= 35 and not META.search(label) and norm(label) not in own:
                scope = label
            # The summary must be specific to this mnemonic. Whole-chapter lists never enter live data.
            if not other and not META.search(context) and len(context) <= 110:
                cleaned = context.replace(item['title'], '').strip(' 、；。()（）')
                if cleaned and not scope:
                    scope = cleaned
                # Preserve short exceptions, thresholds and amounts not already in the decoding rows.
                numeric = re.findall(r'\d+(?:\.\d+)?(?:%|\s*(?:mg|ml|mL|mmHg|mmol|cm|mm|分钟|小时|天|年|分子))', cleaned)
                mapping_text = ''.join(text_of(b) for b in mappings)
                if any(norm(value) not in norm(mapping_text) for value in numeric) or re.search(r'不能|不等于|禁用|不包括|仅限|最重要', cleaned):
                    if norm(cleaned) not in norm(mapping_text) and cleaned not in notes:
                        notes.append(cleaned)
            if scope:
                break

        if item['subject'] == 'med' and not mappings:
            # These entries were already rewritten in Notion as short, mnemonic-specific definitions.
            notes = [clean_note(text_of(b)) for b in old if b['kind'] != 'context' and clean_note(text_of(b))]
        if len(scope) > 50 or META.search(scope):
            scope = ''
        item['scope'] = polish(scope)
        item['scope'] = re.sub(r'（口径）|教材编写不纠结.*|先掌握框架.*|跨章旁注|记忆标签', '', item['scope']).strip()
        refined = []
        for candidate in mappings + [block('text', note) for note in notes]:
            text = text_of(candidate)
            # Recover inline fragment/definition pairs in the medicine source as real rows.
            clauses = re.split(r'[；\n]', text) if item['subject'] == 'med' else [text]
            for clause in clauses:
                if '→' in clause and len(clause.split('→', 1)[0]) <= 35:
                    fragment, knowledge = clause.split('→', 1)
                    knowledge = polish(knowledge)
                    if knowledge and not re.fullmatch(r'(?:串联语|串联|字|语|情境|情景|记忆|尾语|尾字|的|名称|计数，不是时间阈值|为|的尾缀)', knowledge):
                        refined.append(block('mapping', fragment.strip() + ' → ' + knowledge))
                else:
                    cleaned = polish(clause)
                    if cleaned:
                        refined.append(block('text', cleaned))
        item['blocks'] = refined
        if not item['blocks']:
            # An original definition can be substantive even when its original editor added a meta note.
            candidates = [text_of(b) for b in old if b['kind'] != 'context' and not FILLER.search(text_of(b))]
            if candidates:
                item['blocks'] = [block('text', candidates[0])]
            else:
                item['blocks'] = [block('text', scope or contexts[0])]

    overrides = json.loads((Path(__file__).resolve().parents[1] / 'src/data/mnemonic-curation.json').read_text())
    for item in data['items']:
        if item['id'] in overrides:
            override = overrides[item['id']]
            item['scope'] = override['scope']
            item['blocks'] = [block('mapping', text) for text in override.get('mappings', [])] + [block('text', text) for text in override.get('notes', [])]
            for key in ('chapter', 'section'):
                if key in override:
                    item[key] = override[key]
            if override.get('title') and override['title'] != item['title']:
                item.setdefault('aliases', []).append(item['title'])
                item['title'] = override['title']
    # Consolidate confirmed same-meaning copies; keep both classification locations.
    by_id = {item['id']: item for item in data['items']}
    for item in data['items']:
        item['locations'] = [{key: item[key] for key in ('subject', 'chapter', 'section')}]
    consolidation = json.loads((Path(__file__).resolve().parents[1] / 'src/data/mnemonic-consolidation.json').read_text())
    merged = consolidation['merged']
    for duplicate, canonical in merged.items():
        by_id[canonical].setdefault('alternateIds', []).append(duplicate)
        for title in [by_id[duplicate]['title'], *by_id[duplicate].get('aliases', [])]:
            if title != by_id[canonical]['title'] and title not in by_id[canonical].get('aliases', []):
                by_id[canonical].setdefault('aliases', []).append(title)
        for location in by_id[duplicate]['locations']:
            # Same-subject cross-references should not duplicate a topic under unrelated chapters.
            if location['subject'] != by_id[canonical]['subject'] and location not in by_id[canonical]['locations']:
                by_id[canonical]['locations'].append(location)
    # A repeated chapter-reference bundle is not an independent mnemonic; BBPPE is an
    # undecoded OCR string beside an answer table, not a usable mnemonic definition.
    excluded = consolidation['excluded']
    data['items'] = [item for item in data['items'] if item['id'] not in merged and item['id'] not in excluded]
    for item in data['items']:
        unique = {}
        for candidate in item['blocks']:
            if re.search(r'^(?:口诀(?:字|片段)|比较项目|对应(?:原文考点|知识点与条件))', text_of(candidate)):
                continue
            unique.setdefault(norm(text_of(candidate)), candidate)
        item['blocks'] = list(unique.values())
    data['curation'] = {'merged': merged, 'excluded': excluded}
    data = apply_lecture_review(data, block)
    for source in data['sources']:
        source.setdefault('sourceCount', source['count'])
        source['count'] = sum(any(location['subject'] == source['subject'] for location in item['locations']) for item in data['items'])
    data['version'] = max(2, data.get('version', 2))
    return data


if __name__ == '__main__':
    root = Path(__file__).resolve().parents[1]
    source = Path(sys.argv[1])
    data = curate_records(json.loads(source.read_text()))
    (root / 'src/data/mnemonics-data.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')) + '\n')
    print(f'Curated {len(data["items"])} entries')
