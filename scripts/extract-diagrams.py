# Trích khối Mermaid từ tài liệu gốc sang docs/diagrams/src/*.mmd theo docs/diagrams/manifest.json.
#   python scripts/extract-diagrams.py          chỉ báo cáo file nào lệch
#   python scripts/extract-diagrams.py --write  ghi đè file .mmd
# Sau đó xuất ảnh: xem docs/diagrams/README.md
import json, re, sys, os

sys.stdout.reconfigure(encoding='utf-8')
root = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'docs') + '/'
man = json.load(open(root + 'diagrams/manifest.json', encoding='utf8'))
docs = {}


def doc(name):
    if name not in docs:
        docs[name] = open(root + name, encoding='utf8', newline='').read().replace('\r\n', '\n')
    return docs[name]


write = '--write' in sys.argv
changed, missing, same = [], [], 0
for e in man:
    name = e['name']
    path = root + 'diagrams/src/' + name + '.mmd'
    if not e.get('doc'):
        continue
    text = doc(e['doc'])
    heading = e['heading']
    # tìm dòng tiêu đề kết thúc bằng heading (A.51 ..., S.51 ..., 5.1. ...)
    cands = [m for m in re.finditer(r'^#{2,6} (.*)$', text, flags=re.M) if m.group(1).strip() == heading.strip()]
    if not cands:
        cands = [m for m in re.finditer(r'^#{2,6} (.*)$', text, flags=re.M) if heading.strip() in m.group(1)]
    if not cands:
        missing.append((name, heading))
        continue
    # chọn cạnh tiêu đề đầu tiên có khối mermaid ngay sau (trước tiêu đề kế tiếp cùng cấp)
    block = None
    for m in cands:
        nxt = re.search(r'^#{2,6} ', text[m.end():], flags=re.M)
        seg = text[m.end(): m.end() + (nxt.start() if nxt else len(text))]
        mm = re.search(r'```mermaid\n(.*?)```', seg, flags=re.S)
        if mm:
            block = mm.group(1)
            break
    if block is None:
        missing.append((name, heading + ' (không có khối mermaid)'))
        continue
    old = open(path, encoding='utf8', newline='').read().replace('\r\n', '\n') if os.path.exists(path) else None
    if old is not None and old.strip() == block.strip():
        same += 1
    else:
        changed.append(name)
        if write:
            open(path, 'w', encoding='utf8', newline='').write(block.rstrip('\n') + '\n')
print('giống:', same, 'khác:', len(changed), 'không tìm thấy:', len(missing))
for c in changed:
    print('  KHÁC', c)
for m in missing:
    print('  THIẾU', m)
