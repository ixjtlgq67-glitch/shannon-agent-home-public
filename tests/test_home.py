import json
import unittest
from copy import deepcopy
from pathlib import Path
from pydantic import ValidationError
from jsonschema import Draft202012Validator
from agents.agent_output import AgentOutputSchema
from shannon_home.contracts import ProposalBatch, FrozenSource, HumanDecision, SCHEMA_MODELS
from shannon_home.core import validate_batch, select_panel, deduplicate, metrics, apply_demo_decision, panel_status
from shannon_home.registry import ROOT, registry, check_registry
from shannon_home.sdk import make_agent, prepare_context

class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.raw=json.loads((ROOT/'examples/proposals.json').read_text())
        self.source=FrozenSource.model_validate_json((ROOT/'examples/source.json').read_text())
    def validate(self, raw=None):
        return validate_batch(ProposalBatch.model_validate(raw or self.raw), self.source,
            expected_role='use:teaching', expected_model='synthetic-model',
            expected_prompt_version='1.0.0',declared_uses=['teaching'])
    def test_valid_exact_quote(self):
        self.assertEqual(len(self.validate()),1)
    def test_fabricated_quote(self):
        self.raw['proposals'][0]['quote']='This text does not exist'
        with self.assertRaises(ValueError):self.validate()
    def test_quote_from_wrong_paragraph(self):
        self.raw['proposals'][0]['paragraph_id']='p2'
        with self.assertRaises(ValueError):self.validate()
    def test_wrong_identity_source_or_version(self):
        for field in ['user_id','source_id','source_version']:
            with self.subTest(field=field):
                raw=deepcopy(self.raw);raw['proposals'][0][field]='other'
                with self.assertRaises(ValueError):self.validate(raw)
    def test_provenance_cannot_be_forged(self):
        for field in ['role_id','model_id','prompt_version']:
            with self.subTest(field=field):
                raw=deepcopy(self.raw);raw['proposals'][0][field]='wrong'
                with self.assertRaises(ValueError):self.validate(raw)
    def test_undeclared_use(self):
        self.raw['proposals'][0]['use_id']='unknown'
        with self.assertRaises(ValueError):self.validate()
    def test_role_cannot_return_three(self):
        self.raw['proposals']*=3
        with self.assertRaises(ValidationError):self.validate()
    def test_agent_cannot_set_accepted(self):
        self.raw['proposals'][0]['status']='accepted'
        with self.assertRaises(ValidationError):self.validate()
    def test_duplicate_locator(self):
        self.source.paragraphs.append(self.source.paragraphs[0])
        with self.assertRaises(ValueError):self.validate()
    def test_blank_quote(self):
        self.raw['proposals'][0]['quote']=' '
        with self.assertRaises(ValueError):self.validate()
    def test_deduplication_preserves_other_judgments(self):
        p=self.validate()[0]
        duplicate=p.model_copy(update={'proposal_id':'duplicate'})
        dissent=p.model_copy(update={'proposal_id':'dissent','judgment':'The source does not establish time savings.'})
        other_role=p.model_copy(update={'proposal_id':'skeptic-1','role_id':'skeptic','use_id':None})
        self.assertEqual(len(deduplicate([p,duplicate,dissent,other_role])),3)
    def test_duplicate_id_across_batches_fails(self):
        p=self.validate()[0]
        with self.assertRaises(ValueError):deduplicate([p,p])
    def test_rejection_never_enters_register(self):
        p=self.validate()[0]
        d=HumanDecision(proposal_id=p.proposal_id,user_id=p.user_id,human_name='Test Human',action='reject',reason='Not useful',decided_at='2026-10-26T12:00:00Z')
        result=apply_demo_decision(p,d,authenticated_user_id=p.user_id)
        self.assertIsNone(result['register_entry']);self.assertEqual(result['audit']['action'],'reject')
    def test_named_accept_and_immutability(self):
        p=self.validate()[0]
        d=HumanDecision(proposal_id=p.proposal_id,user_id=p.user_id,human_name='Test Human',action='accept',reason='Useful',decided_at='2026-10-26T12:00:00Z')
        self.assertEqual(apply_demo_decision(p,d,authenticated_user_id=p.user_id)['status'],'accepted')
        with self.assertRaises(ValueError):apply_demo_decision(p,d,authenticated_user_id='other-user')
        with self.assertRaises(ValueError):apply_demo_decision(p,d,authenticated_user_id=p.user_id,current_status='accepted')
        with self.assertRaises(ValueError):apply_demo_decision(p,d.model_copy(update={'human_name':' '}),authenticated_user_id=p.user_id)

class OrchestrationTests(unittest.TestCase):
    def test_panel_caps_four_including_skeptic(self):
        self.assertEqual(select_panel(['a','b','a','c','d'],['a','b','c','d'],10),['skeptic','use:a','use:b','use:c'])
    def test_budget_reserves_skeptic(self):
        self.assertEqual(select_panel(['a'],['a'],1),['skeptic'])
        with self.assertRaises(ValueError):select_panel(['a'],['a'],0)
        with self.assertRaises(ValueError):select_panel(['b'],['a'],2)
    def test_partial_run_is_incomplete(self):
        self.assertEqual(panel_status(['skeptic','use:a'],['use:a']),'incomplete')
        self.assertEqual(panel_status(['skeptic','use:a'],['use:a','skeptic']),'complete')
    def test_cost_denominators_and_unknowns(self):
        self.assertIsNone(metrics(accepted=0,reviewed=4,event_costs=[1.0])['cost_per_accepted_judgment_usd'])
        self.assertIsNone(metrics(accepted=1,reviewed=4,event_costs=[1.0,None])['total_model_cost_usd'])
        m=metrics(accepted=2,reviewed=4,event_costs=[1.0,2.0,3.0])
        self.assertEqual(m['cost_per_accepted_judgment_usd'],3.0)
        self.assertEqual(m['acceptance_rate'],0.5)
    def test_skeptic_never_receives_taste(self):
        context={'source':{'user_id':'demo-user'},'taste_profile':'favor positive opinions','declared_use':{'taste':'hidden'},'accepted_history':[]}
        cleaned=prepare_context('skeptic',context)
        self.assertEqual(set(cleaned),{'source','accepted_history'})
        self.assertIn('taste_profile',context)
    def test_history_must_be_accepted_and_same_user(self):
        for record in [{'user_id':'other','status':'accepted'},{'user_id':'demo-user','status':'pending'}]:
            with self.assertRaises(ValueError):prepare_context('chatbot',{'authenticated_user_id':'demo-user','accepted_judgments':[record]})
    def test_role_requires_user_definition(self):
        with self.assertRaises(ValueError):prepare_context('role',{'source':{}})

class HomeTests(unittest.TestCase):
    def test_every_named_agent_loads_as_sdk_agent(self):
        self.assertEqual(check_registry(),20)
        for entry in registry():
            with self.subTest(agent=entry['id']):
                agent=make_agent(entry['id'],'test-model')
                self.assertFalse(agent.tools)
                # Construct the SDK's strict structured-output schema without a network call.
                AgentOutputSchema(agent.output_type)
    def test_schemas_are_valid_and_current(self):
        for name,model in SCHEMA_MODELS.items():
            with self.subTest(schema=name):
                saved=json.loads((ROOT/'schemas'/f'{name}.schema.json').read_text())
                Draft202012Validator.check_schema(saved)
                self.assertEqual(saved,model.model_json_schema())
    def test_synthetic_examples_match_schema(self):
        for filename,model in [('source.json',FrozenSource),('proposals.json',ProposalBatch)]:
            data=json.loads((ROOT/'examples'/filename).read_text())
            Draft202012Validator(model.model_json_schema()).validate(data)
    def test_no_missing_local_markdown_links(self):
        import re
        for path in ROOT.rglob('*.md'):
            for target in re.findall(r'!?\[[^\]]*\]\(([^)]+)\)',path.read_text()):
                if '://' not in target and not target.startswith('#'):
                    self.assertTrue((path.parent/target.split('#')[0]).exists(),f'{path}: {target}')

if __name__=='__main__':unittest.main()
