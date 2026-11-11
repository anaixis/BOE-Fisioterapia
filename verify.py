"""Comprueba integridad del banco y distribución de las 2.550 pruebas."""
import json
from pathlib import Path
from html.parser import HTMLParser
root=Path(__file__).parent
raw=(root/'data.js').read_text()
d=json.JSONDecoder().raw_decode(raw.removeprefix('const CONTENT='))[0]
assert len(d['topics'])==50 and len(d['bank'])==2400 and len(d['tests'])==2550
for n,t in enumerate(d['topics'],1):
 assert t['n']==n and len(t['cards'])==24 and t['program']
 assert all(s in d['sources'] for s in t['sources'])
 for e in range(1,51):assert f't{n}-{e}' in d['tests']
 signatures={tuple(sorted(d['tests'][f't{n}-{e}'])) for e in range(1,51)}
 assert len(signatures)==50
for q in d['bank']:
 t,c,rev,opts,a=q
 assert 1<=t<=50 and 0<=c<24 and rev in [0,1]
 assert len(opts)==len(set(opts))==4 and opts[a]==c
for name,ids in d['tests'].items():
 cards=[(d['bank'][i][0],d['bank'][i][1]) for i in ids]
 assert len(set(cards))==len(cards)
 if name.startswith('m'):
  assert len(ids)==85
  assert sum(t<=14 for t,c in cards[:80])==10
  assert all(t>14 for t,c in cards[10:])
 else:
  assert len(ids)==20
  assert all(t==int(name[1:].split('-')[0]) for t,c in cards)
class Links(HTMLParser):
 def __init__(self):super().__init__();self.ids=[];self.hrefs=[]
 def handle_starttag(self,tag,attrs):
  a=dict(attrs)
  if 'id' in a:self.ids.append(a['id'])
  if tag=='a' and a.get('href','').startswith('#'):self.hrefs.append(a['href'][1:])
p=Links();p.feed((root/'index.html').read_text())
assert len(p.ids)==len(set(p.ids))
assert all(x in p.ids for x in p.hrefs)
assert all('tema-'+str(n) in p.ids for n in range(1,51))
print('OK: 50 temas, 1.200 fichas, 2.400 variantes y 2.550 pruebas. Distribuciones y enlaces internos correctos.')
