"""Apply a source-audited lecture review without exposing extraction evidence in cards."""
import json
from pathlib import Path


def apply_lecture_review(data, make_block):
    root = Path(__file__).resolve().parents[1] / 'src/data'
    for subject in ('med', 'surgery'):
        path = root / f'{subject}-mnemonic-review.json'
        if path.exists():
            data = apply_review(data, make_block, json.loads(path.read_text()), subject)
    return data


def apply_review(data, make_block, review, subject):
    records = {item['id']: item for item in data['items']}
    for addition in review['additions']:
        if addition['id'] in records:
            raise ValueError('Duplicate lecture addition: ' + addition['id'])
        item = {key: addition[key] for key in ('id', 'number', 'subject', 'chapter', 'section', 'title')}
        item['locations'] = [{key: item[key] for key in ('subject', 'chapter', 'section')}]
        records[item['id']] = item
    for update in [*review['updates'], *review['additions']]:
        item = records[update['id']]
        item['scope'] = update['scope']
        item['blocks'] = [make_block('mapping', text) for text in update.get('mappings', [])]
        item['blocks'] += [make_block('text', text) for text in update.get('notes', [])]
        for key in ('title', 'chapter', 'section'):
            if key in update:
                item[key] = update[key]
        if 'aliases' in update:
            item['aliases'] = update['aliases']
        if not item['blocks']:
            raise ValueError('Empty reviewed entry: ' + item['id'])
    for change in review['locations']:
        item = records[change['id']]
        location = change['location']
        if location not in item['locations']:
            item['locations'].append(location)
    merged = dict(data['curation']['merged'])
    for change in review['merges']:
        duplicate, canonical = change['id'], change['canonical']
        if duplicate not in records or canonical not in records:
            raise ValueError('Unknown review consolidation: ' + duplicate + ' → ' + canonical)
        merged[duplicate] = canonical
    def resolve(key):
        seen = set()
        while key in merged:
            if key in seen:
                raise ValueError('Cyclic mnemonic consolidation: ' + key)
            seen.add(key)
            key = merged[key]
        return key
    merged = {key: resolve(key) for key in merged}
    # Resolve every old bookmark directly to its final canonical entry, including older merges.
    for change in review['merges']:
        duplicate, canonical = change['id'], resolve(change['canonical'])
        source, target = records[duplicate], records[canonical]
        for location in source['locations'] if change.get('transferLocations', True) else []:
            if location not in target['locations']:
                target['locations'].append(location)
        aliases = change.get('aliases', [])
        if change.get('keepAlias', True):
            aliases = [source['title'], *source.get('aliases', []), *aliases]
        for alias in aliases:
            if alias != target['title'] and alias not in target.setdefault('aliases', []):
                target['aliases'].append(alias)
    for item in records.values():
        item['alternateIds'] = [key for key, value in merged.items() if value == item['id']]
        if not item['alternateIds']:
            item.pop('alternateIds')
    data['items'] = [item for key, item in records.items() if key not in merged]
    data['curation']['merged'] = merged
    data['curation']['lectureAdditions'] = [*data['curation'].get('lectureAdditions', []), *[item['id'] for item in review['additions']]]
    data['curation'].setdefault('reviewedSubjects', {})[subject] = {'pageCount': review['source']['pageCount'], 'reviewedCount': len(review['reviewedIds'])}
    if subject == 'med':
        data['curation']['reviewedSubject'] = subject
        data['curation']['reviewedPages'] = review['source']['pageCount']
    data['version'] = 3 if subject == 'med' else 4
    return data
