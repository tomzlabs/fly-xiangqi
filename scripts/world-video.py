#!/usr/bin/env python3
"""Bounded, resumable simulation-to-video worker. Dry-run unless --execute is given."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import time


def save(path, value):
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(value, ensure_ascii=False, indent=2))
    tmp.replace(path)


def run(args):
    plan = json.loads(Path(args.plan).read_text())
    clips = plan.get('clips', [])
    if not clips:
        raise ValueError('The plan contains no clips. Export after at least 4 simulated seconds.')
    if not 1 <= args.max_clips <= 60:
        raise ValueError('--max-clips must be 1..60')
    clips = clips[:args.max_clips]
    for clip in clips:
        if clip.get('model') != 'sora-2' or str(clip.get('seconds')) != '4' or clip.get('size') != '1280x720':
            raise ValueError('This worker accepts only sora-2, 4 seconds, 1280x720.')
        if not isinstance(clip.get('prompt'), str) or not clip['prompt'].strip():
            raise ValueError('Missing clip prompt')
    digest = hashlib.sha256(json.dumps(clips, sort_keys=True).encode()).hexdigest()
    summary = {'mode': 'execute' if args.execute else 'dry-run', 'clips': len(clips),
               'generated_seconds': 4 * len(clips), 'model': 'sora-2', 'size': '1280x720',
               'plan_sha256': digest, 'output': str(Path(args.out).resolve())}
    print(json.dumps(summary, indent=2), flush=True)
    if not args.execute:
        return summary
    if not os.environ.get('OPENAI_API_KEY'):
        raise ValueError('Set OPENAI_API_KEY locally; never put it in a browser or commit it.')
    if not shutil.which('ffmpeg'):
        raise ValueError('Install ffmpeg before generating; it supplies the next reference frame.')
    from openai import OpenAI
    # No automatic paid creation retries. An ambiguous submission needs reconciliation.
    client = OpenAI(max_retries=0, timeout=120)
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    lock = out / '.worker.lock'
    fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    os.close(fd)
    try:
        ledger_path = out / 'jobs.json'
        ledger = json.loads(ledger_path.read_text()) if ledger_path.exists() else {'plan_sha256': digest, 'jobs': {}}
        if ledger['plan_sha256'] != digest:
            raise ValueError('Output belongs to another plan/limit. Use a new output folder.')
        previous = None
        for index, clip in enumerate(clips, 1):
            key = str(index)
            job = ledger['jobs'].get(key)
            path = out / f'clip-{index:03d}.mp4'
            frame = out / f'frame-{index:03d}.png'
            if job and job.get('status') == 'submitting' and not job.get('id'):
                raise RuntimeError('Submission outcome unknown. Reconcile jobs.json with the provider before retrying; no duplicate submitted.')
            if not job:
                job = {'status': 'submitting', 'clip_id': clip.get('id')}
                ledger['jobs'][key] = job
                save(ledger_path, ledger)
                request = {'model': 'sora-2', 'prompt': clip['prompt'], 'seconds': '4', 'size': '1280x720'}
                if previous:
                    with previous.open('rb') as reference:
                        video = client.videos.create(**request, input_reference=reference)
                else:
                    video = client.videos.create(**request)
                job.update(id=video.id, status=video.status)
                save(ledger_path, ledger)
            deadline = time.monotonic() + args.timeout
            while job['status'] != 'completed':
                if job['status'] == 'failed':
                    raise RuntimeError(f'Clip {index} failed. No automatic regeneration; inspect provider job {job["id"]}.')
                if time.monotonic() >= deadline:
                    raise TimeoutError('Polling timed out. Run the same command to resume the existing job.')
                video = client.videos.retrieve(job['id'])
                job['status'] = video.status
                save(ledger_path, ledger)
                if video.status not in ('completed', 'failed'):
                    time.sleep(10)
            if not path.exists():
                part = path.with_suffix('.part')
                client.videos.download_content(job['id'], variant='video').write_to_file(part)
                part.replace(path)
            if not frame.exists():
                subprocess.run(['ffmpeg', '-v', 'error', '-y', '-sseof', '-0.08', '-i', str(path),
                                '-frames:v', '1', '-vf', 'scale=1280:720', str(frame)], check=True)
            if not frame.exists() or frame.stat().st_size == 0:
                raise RuntimeError('Missing continuation frame; stopped before creating another clip.')
            previous = frame
            job['file'] = path.name
            save(ledger_path, ledger)
            save(out / 'playlist.json', {'clips': [v['file'] for v in ledger['jobs'].values() if 'file' in v]})
            print(f'Ready: {path.name}', flush=True)
        print('Finished bounded batch. Load clip-*.mp4 in the world page to play in order.')
    finally:
        lock.unlink(missing_ok=True)
    return summary


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('plan')
    parser.add_argument('--out', default='output/fly-world')
    parser.add_argument('--max-clips', type=int, default=1)
    parser.add_argument('--timeout', type=int, default=1800)
    parser.add_argument('--execute', action='store_true', help='Submit paid API jobs; default is offline dry-run')
    run(parser.parse_args())
