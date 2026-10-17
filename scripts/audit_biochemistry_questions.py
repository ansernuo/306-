#!/usr/bin/env python3
"""Validate all biochemistry question pools without regenerating their contents."""
import argparse
import collections
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def banks():
    paths = [ROOT / 'src/data/biochemistry-data.json']
    paths += [ROOT / f'src/data/biochemistry-lecture{i}-data.json' for i in range(2, 21)]
    paths += [ROOT / 'src/data/biochemistry-teacher-supplement.json']
    paths += [ROOT / 'src/data/biochemistry-stage-exam-data.json']
    return [(p, json.loads(p.read_text())) for p in paths]

def audit():
    issues, chapter_counts, group_ids, ungraded = [], [], set(), 0
    for path, bank in banks():
        groups = bank['groups']
        chapter_counts.append({'file': path.name, 'groups': len(groups), 'questions': sum(len(g['stems']) for g in groups)})
        for group in groups:
            gid = group['id']
            def issue(kind, detail, number=None):
                issues.append({'file': path.name, 'group': gid, 'number': number, 'kind': kind, 'detail': detail})
            if gid in group_ids:
                issue('duplicate_group_id', gid)
            group_ids.add(gid)
            keys = [o['key'] for o in group['options']]
            if len(keys) != len(set(keys)):
                issue('duplicate_option_key', keys)
            labels = collections.defaultdict(list)
            for option in group['options']:
                labels[(option.get('category'), re.sub(r'\s+', '', option['label']))].append(option['key'])
            for label, duplicates in labels.items():
                if len(duplicates) > 1:
                    issue('duplicate_option_text', {'keys': duplicates, 'label': label[1]})
            numbers, stem_texts = set(), set()
            for stem in group['stems']:
                n, mode = stem['number'], stem.get('answerMode')
                if n in numbers:
                    issue('duplicate_stem_number', n, n)
                numbers.add(n)
                identity = (stem.get('optionCategory'), re.sub(r'\s+', '', stem['text']))
                if identity in stem_texts:
                    issue('duplicate_stem_text', stem['text'], n)
                stem_texts.add(identity)
                answer = stem.get('answer', [])
                if stem.get('answerState') == '暂无参考答案':
                    ungraded += 1
                    if answer or stem.get('answerRaw') or mode not in {'单选', '多选'}:
                        issue('invalid_ungraded_question', stem, n)
                    continue
                if mode == '填空':
                    if 'answerDisplay' in stem and stem['answerDisplay'] != '；'.join(answer):
                        issue('stale_fill_answer_display', stem['answerDisplay'], n)
                    blanks = len(re.findall(r'_{3,}', stem['text']))
                    if blanks != len(answer):
                        issue('fill_answer_count', {'blanks': blanks, 'answers': len(answer)}, n)
                    if any(len(candidate) != len(answer) for candidate in stem.get('acceptedAnswers', [])):
                        issue('invalid_accepted_fill_answer', stem.get('acceptedAnswers'), n)
                if mode in {'填空', '排序'}:
                    continue
                pool = [o for o in group['options'] if not stem.get('optionCategory') or o.get('category') == stem['optionCategory']]
                valid_keys = {o['key'] for o in pool}
                if not answer or not set(answer) <= valid_keys:
                    issue('invalid_answer', answer, n)
                if len(set(answer)) != len(answer):
                    issue('duplicate_answer', answer, n)
                expected = '多选' if len(answer) > 1 else '单选'
                if mode != expected:
                    issue('incorrect_answer_mode', {'actual': mode, 'expected': expected}, n)
                display = {o['key']: o.get('displayKey', o['key']) for o in pool}
                raw = re.findall(r'[A-Z]+', stem.get('answerRaw', ''))
                raw_keys = raw if any(len(k) > 1 for k in valid_keys) else list(''.join(raw))
                expected_raw = [display.get(k, k) for k in answer]
                if raw_keys != expected_raw:
                    issue('stale_answer_raw', {'actual': stem.get('answerRaw'), 'expected': expected_raw}, n)
        for key, actual in [('groupCount', len(groups)), ('stemCount', sum(len(g['stems']) for g in groups))]:
            if key in bank.get('meta', {}) and bank['meta'][key] != actual:
                issues.append({'file': path.name, 'kind': 'stale_count', 'field': key, 'actual': actual, 'stored': bank['meta'][key]})
    return {'chapters': chapter_counts, 'groups': len(group_ids), 'questions': sum(c['questions'] for c in chapter_counts), 'ungradedQuestions': ungraded, 'issues': issues}

def dump(start, end):
    for chapter, (path, bank) in enumerate(banks(), 1):
        if not start <= chapter <= end:
            continue
        print(f'\nCHAPTER {chapter}: {bank["meta"]["title"]}')
        for group in bank['groups']:
            options = {o['key']: o['label'] for o in group['options']}
            print(f'\n{group["id"]}: {group["title"]}')
            print(' | '.join(f'{k}={v}' for k, v in options.items()))
            for stem in group['stems']:
                answer = '；'.join(options.get(k, k) for k in stem['answer'])
                print(f'{stem["number"]}. {stem["text"]} => {"/".join(stem["answer"])} [{answer}]')

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--dump', nargs=2, type=int)
    args = parser.parse_args()
    if args.dump:
        dump(*args.dump)
    else:
        result = audit()
        print(json.dumps(result, ensure_ascii=False, indent=2))
        raise SystemExit(bool(result['issues']))
