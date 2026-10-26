import argparse
import asyncio
import json
import os
from .registry import ROOT, registry, check_registry


def demo():
    from .contracts import FrozenSource, ProposalBatch, HumanDecision
    from .core import select_panel, validate_batch, deduplicate, apply_demo_decision, metrics, panel_status
    source = FrozenSource.model_validate_json((ROOT/'examples/source.json').read_text())
    batch = ProposalBatch.model_validate_json((ROOT/'examples/proposals.json').read_text())
    planned = select_panel(['teaching'], ['teaching'], 2)
    valid = validate_batch(batch, source, expected_role='use:teaching', expected_model='synthetic-model',
                           expected_prompt_version='1.0.0', declared_uses=['teaching'])
    pending = deduplicate(valid)
    decision = HumanDecision(proposal_id=pending[0].proposal_id, user_id='demo-user', human_name='Demo Human',
                             action='accept', reason='Useful for the synthetic lesson', decided_at='2026-10-26T12:00:00Z')
    return {'mode':'synthetic offline demonstration; no live agents or authentication', 'planned_roles':planned,
            'run_status':panel_status(planned, ['use:teaching']),
            'pending_proposal_count':len(pending),
            'decision':apply_demo_decision(pending[0],decision,authenticated_user_id='demo-user'),
            'metrics':metrics(accepted=1,reviewed=1,event_costs=[0.002,0.004])}


def main():
    parser=argparse.ArgumentParser(description='Team Shannon shared agent home')
    sub=parser.add_subparsers(dest='command',required=True)
    for cmd in ['list','check','demo']:sub.add_parser(cmd)
    run=sub.add_parser('run'); run.add_argument('agent_id'); run.add_argument('--input',required=True)
    run.add_argument('--model',default=os.getenv('SHANNON_MODEL'))
    run.add_argument('--max-output-tokens',type=int,default=1500)
    args=parser.parse_args()
    if args.command=='list':
        result=[{'id':e['id'],'name':e['name'],'version':e['prompt_version']} for e in registry()]
    elif args.command=='check':result={'verified_agent_definitions':check_registry()}
    elif args.command=='demo':result=demo()
    else:
        from pathlib import Path
        from .sdk import run_agent
        if not args.model:parser.error('Set SHANNON_MODEL or pass --model')
        payload=json.loads(Path(args.input).read_text())
        result=asyncio.run(run_agent(args.agent_id,payload,args.model,max_output_tokens=args.max_output_tokens))
    print(json.dumps(result,indent=2))

if __name__=='__main__':main()
