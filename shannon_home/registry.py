"""Load the same versioned instructions people read in the public home."""
import hashlib
import json
from pathlib import Path
from .contracts import OUTPUT_MODELS

ROOT = Path(__file__).resolve().parents[1]

def registry():
    return json.loads((ROOT / 'agents/manifest.json').read_text())['agents']

def definition(agent_id):
    for entry in registry():
        if entry['id'] == agent_id:
            return entry
    raise ValueError('Unknown agent: ' + agent_id)

def instructions(agent_id):
    entry = definition(agent_id)
    return '\n\n'.join((ROOT / p).read_text() for p in [
        'AGENTS.md', 'pods/' + entry['pod'] + '.md', 'operations/DECISIONS.md', entry['instructions']])

def check_registry():
    entries = registry()
    if len({e['id'] for e in entries}) != len(entries):
        raise ValueError('Duplicate agent ID')
    for e in entries:
        path = ROOT / e['instructions']
        if e['output_model'] not in OUTPUT_MODELS or not path.is_file():
            raise ValueError('Missing output contract or prompt')
        if e['prompt_version'] not in path.read_text():
            raise ValueError('Prompt version drift: ' + e['id'])
        if hashlib.sha256(path.read_bytes()).hexdigest() != e['prompt_sha256']:
            raise ValueError('Prompt checksum drift: ' + e['id'])
        if e['tools']:
            raise ValueError('Unexpected tool privileges')
    return len(entries)
