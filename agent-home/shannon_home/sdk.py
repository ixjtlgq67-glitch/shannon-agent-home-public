"""Server-only, tool-free reference runner. No model call occurs on import."""
import json
import os
import time
from copy import deepcopy
from agents import Agent, Runner, RunConfig, ModelSettings, set_default_openai_client
from openai import AsyncOpenAI
from .contracts import OUTPUT_MODELS
from .registry import definition, instructions


def prepare_context(agent_id, payload):
    context = deepcopy(payload)
    if agent_id == 'skeptic':
        # Allowlist avoids leaking a nested taste profile via unrelated context.
        context = {k: context[k] for k in ['source', 'accepted_history'] if k in context}
    if agent_id == 'role':
        use = context.get('declared_use')
        if not isinstance(use, dict) or not use.get('id') or not use.get('description'):
            raise ValueError('Declared-use role requires id and description')
    # Only accepted, same-user history may be supplied as accepted evidence.
    user = context.get('source', {}).get('user_id', context.get('authenticated_user_id'))
    for key in ['accepted_history', 'accepted_judgments']:
        records = context.get(key, [])
        if not isinstance(records, list):
            raise ValueError('Accepted history must be a list')
        for record in records:
            if not user or record.get('user_id') != user or record.get('status') != 'accepted':
                raise ValueError('Unaccepted or unauthorized history')
    return context


def make_agent(agent_id, model, *, max_output_tokens=1500):
    if not model or not model.strip():
        raise ValueError('Explicit model ID required')
    if not 128 <= max_output_tokens <= 8192:
        raise ValueError('Output token cap must be between 128 and 8192')
    entry = definition(agent_id)
    return Agent(name=entry['name'], model=model,
                 instructions=instructions(agent_id),
                 output_type=OUTPUT_MODELS[entry['output_model']],
                 model_settings=ModelSettings(max_tokens=max_output_tokens), tools=[])


async def run_agent(agent_id, payload, model, *, max_output_tokens=1500):
    context = prepare_context(agent_id, payload)
    if not os.getenv('OPENAI_API_KEY'):
        raise ValueError('Set OPENAI_API_KEY in the private server environment')
    # Each provider request is one accounted attempt; retry decisions belong to the Conductor.
    set_default_openai_client(AsyncOpenAI(max_retries=0))
    entry = definition(agent_id)
    role_id = 'use:' + context['declared_use']['id'] if agent_id == 'role' else agent_id
    context['runtime_provenance'] = {'model_id': model, 'prompt_version': entry['prompt_version'], 'role_id': role_id}
    agent = make_agent(agent_id, model, max_output_tokens=max_output_tokens)
    started = time.monotonic()
    result = await Runner.run(agent, json.dumps(context), max_turns=1,
                             run_config=RunConfig(tracing_disabled=True))
    usage = result.context_wrapper.usage
    output = result.final_output
    if agent_id in {'role', 'skeptic'}:
        from .contracts import FrozenSource
        from .core import validate_batch
        validate_batch(output, FrozenSource.model_validate(context['source']),
                       expected_role=role_id, expected_model=model,
                       expected_prompt_version=entry['prompt_version'],
                       declared_uses=[context['declared_use']['id']] if agent_id == 'role' else [])
    return {'agent_id': agent_id, 'model_id': model, 'prompt_version': entry['prompt_version'],
            'output': output.model_dump(), 'input_tokens': usage.input_tokens,
            'output_tokens': usage.output_tokens, 'requests': usage.requests,
            'latency_seconds': round(time.monotonic() - started, 3),
            'estimated_cost_usd': None,
            'cost_note': 'Unknown until priced using a versioned provider rate table.'}
