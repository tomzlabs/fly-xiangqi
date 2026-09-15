"""Reproducibly pack the authors' entire v783 graph; never invent or sample edges."""
import gzip
import hashlib
import json
import struct
import urllib.request
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW, OUT = ROOT / 'data/raw', ROOT / 'public/data'
PINS = json.loads((ROOT / 'data/sources.json').read_text())
LOCK = {entry['url']: entry for entry in json.loads((ROOT / 'data/source-lock.json').read_text())}
SOURCES = [
    ('philshiu/Drosophila_brain_model', 'Completeness_783.csv'),
    ('philshiu/Drosophila_brain_model', 'Connectivity_783.parquet'),
    ('philshiu/Drosophila_brain_model', 'LICENSE'),
    ('philshiu/Drosophila_brain_model', 'model.py'),
    ('flyconnectome/flywire_annotations', 'supplemental_files/Supplemental_file1_neuron_annotations.tsv'),
]

def sha(data):
    return hashlib.sha256(data).hexdigest()

def main():
    RAW.mkdir(parents=True, exist_ok=True)
    OUT.mkdir(parents=True, exist_ok=True)
    records = []
    for repo, name in SOURCES:
        url = f'https://raw.githubusercontent.com/{repo}/{PINS[repo]}/{name}'
        path = RAW / Path(name).name
        if not path.exists():
            print('Downloading', name, flush=True)
            with urllib.request.urlopen(url, timeout=180) as r:
                path.write_bytes(r.read())
        digest=sha(path.read_bytes())
        if digest != LOCK[url]['sha256']:
            raise ValueError(f'Source checksum mismatch: {path}. Remove the cached file and download again.')
        records.append({'url': url, 'sha256': digest, 'bytes': path.stat().st_size})
    ids = pd.read_csv(RAW / 'Completeness_783.csv').iloc[:, 0].to_numpy(dtype=np.uint64)
    edges = pd.read_parquet(RAW / 'Connectivity_783.parquet')
    n, m = len(ids), len(edges)
    pre = edges.Presynaptic_Index.to_numpy(dtype=np.uint32)
    post = edges.Postsynaptic_Index.to_numpy(dtype=np.uint32)
    assert pre.max() < n and post.max() < n
    assert np.array_equal(ids[pre], edges.Presynaptic_ID.to_numpy(dtype=np.uint64))
    assert np.array_equal(ids[post], edges.Postsynaptic_ID.to_numpy(dtype=np.uint64))
    weight = edges['Excitatory x Connectivity'].to_numpy(dtype=np.int64)
    assert np.max(np.abs(weight)) <= 32767 and (weight != 0).all()
    assert np.array_equal(np.abs(weight), edges.Connectivity.to_numpy())
    order = np.argsort(pre, kind='stable')
    offsets = np.r_[0, np.cumsum(np.bincount(pre, minlength=n))].astype('<u4')
    # FL Y1 / N / M, CSR offsets (u32), targets (u32), signed counts (i16).
    blob = struct.pack('<4sII', b'FLY1', n, m) + offsets.tobytes() + post[order].astype('<u4').tobytes() + weight[order].astype('<i2').tobytes()
    packed = gzip.compress(blob, compresslevel=9, mtime=0)
    (OUT / 'connectome.bin.gz').write_bytes(packed)
    annotations = pd.read_csv(RAW / 'Supplemental_file1_neuron_annotations.tsv', sep='\t', low_memory=False).set_index('root_id').reindex(ids)
    visual = np.flatnonzero((annotations.super_class == 'sensory') & (annotations.cell_class == 'visual'))
    descending = np.flatnonzero(annotations.super_class.isin(['descending', 'motor']))
    assert len(visual) >= 1260 and len(descending) > 100
    # Evenly spread the artificial 1260 input channels over real visual sensory IDs.
    # This is a chess adapter, not a claim of biological retinotopy.
    sensory = visual.tolist()
    coords = annotations[['pos_x', 'pos_y', 'pos_z']].to_numpy(dtype=float) * [4, 4, 40]
    finite = np.isfinite(coords).all(axis=1)
    center = np.nanmedian(coords[finite], axis=0)
    scale = np.max(np.ptp(coords[finite], axis=0)) / 2
    coords = (coords - center) / scale
    coords[~finite] = 0
    groups = np.zeros(n, dtype='u1')
    groups[annotations.super_class.isin(['optic', 'visual_projection', 'visual_centrifugal'])] = 1
    groups[visual] = 2
    groups[descending] = 3
    # Real anchor locations, not decorative random points. Missing anchors are flagged.
    positions = coords.astype('<f4').tobytes() + groups.tobytes() + finite.astype('u1').tobytes()
    (OUT / 'neurons.bin.gz').write_bytes(gzip.compress(positions, mtime=0))
    # Root IDs remain strings to avoid JS integer precision loss.
    meta = {'sensory': sensory, 'outputs': descending.tolist(), 'ids': [str(x) for x in ids]}
    (OUT / 'neurons.json.gz').write_bytes(gzip.compress(json.dumps(meta, separators=(',', ':')).encode(), mtime=0))
    manifest = {
        'dataset': 'FlyWire FAFB v783 · Shiu author release', 'neurons': n,
        'edges': m, 'synapses': int(edges.Connectivity.sum()),
        'sensory': len(sensory), 'outputs': len(descending),
        'positioned': int(finite.sum()), 'compressedBytes': len(packed),
        'uncompressedBytes': len(blob), 'graphSha256': sha(blob),
        'files': {p.name: {'sha256': sha(p.read_bytes()), 'bytes': p.stat().st_size,
                         'rawSha256': sha(gzip.decompress(p.read_bytes())),
                         'rawBytes': len(gzip.decompress(p.read_bytes()))} for p in OUT.glob('*.gz')},
        'sources': records,
        'transform': 'All author neurons and edges retained. Stable CSR sort only. Signed counts are multiplied by 0.275 mV at runtime. Annotation joins do not change the graph.',
        'reference': 'https://doi.org/10.1038/s41586-024-07763-9',
        'annotationsReference': 'https://doi.org/10.1038/s41586-024-012606-5',
    }
    (OUT / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
    (ROOT / 'docs/shiu-model-LICENSE.txt').write_text((RAW / 'LICENSE').read_text())
    print(json.dumps({k: v for k, v in manifest.items() if k not in ['sources', 'files']}, indent=2))

if __name__ == '__main__':
    main()
