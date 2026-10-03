"""Real concurrent PostgreSQL commands. Only an explicitly named local test DB is accepted."""
import concurrent.futures
import json
import os
from pathlib import Path
import re
import subprocess
import threading
from urllib.parse import urlparse

DATABASE = os.environ['REVIEW_TEST_DATABASE_URL']
parsed = urlparse(DATABASE)
if parsed.hostname not in ('127.0.0.1', 'localhost') or not parsed.path.startswith('/codex_review_validation_'):
    raise SystemExit('Use an isolated local codex_review_validation_* database')


def sql(statement):
    return subprocess.run(['psql', DATABASE, '-XAt', '-v', 'ON_ERROR_STOP=1'], input=statement,
                          text=True, capture_output=True, timeout=20)


def fixture():
    source = (Path(__file__).resolve().parents[2] / 'supabase/tests/human_review.sql').read_text()
    prefix = source.split(' -- CONCURRENCY_FIXTURE_END')[0]
    setup = prefix + """
 r:=public.ensure_artifact_review(submission,learner,'concurrency-test');
 r:=public.assign_artifact_review(r.id,scope_ref,'college_program',ARRAY[reviewer],3,'Asia/Kolkata',10);
 r:=public.start_artifact_review(r.id,reviewer,r.version);
 RAISE NOTICE 'FIXTURE:%',jsonb_build_object('review',r.id,'learner',learner,'reviewer',reviewer,'other',other_user,
 'submission',submission,'artifact',artifact,'progress',progress,'scope',scope_ref,'version',r.version,'criteria',r.rubric_snapshot->'criteria');
 END $$; COMMIT;
"""
    result = sql(setup)
    if result.returncode:
        raise RuntimeError(result.stderr)
    return json.loads(re.search(r'FIXTURE:(\{.*\})', result.stderr).group(1))


def completion(f, decision='pass', key='same-command'):
    command = dict(expectedVersion=f['version'], decision=decision,
                   criteria=[dict(c, score=2, evidence='Observed evidence') for c in f['criteria']],
                   feedback='Evidence checked', rationale='Rubric applied', hasCriticalFailure=False,
                   actionItems=[] if decision == 'pass' else ['Add missing evidence'])
    payload = json.dumps(command).replace("'", "''")
    return f"SELECT public.complete_artifact_review('{f['review']}','{f['reviewer']}','{key}','{key}','{payload}'::jsonb);"


def race(left, right):
    barrier = threading.Barrier(2)
    def execute(statement):
        barrier.wait()
        return sql(statement)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        a, b = pool.submit(execute,left), pool.submit(execute,right)
        return a.result(), b.result()


def outcome(f):
    result = sql(f"""SELECT jsonb_build_object(
 'scores',(SELECT count(*) FROM public.review_criterion_scores WHERE review_id='{f['review']}'),
 'xp',(SELECT count(*) FROM public.xp_events WHERE source_id='{f['submission']}'),
 'staff',(SELECT count(*) FROM public.artifact_evaluation_flows WHERE submission_id='{f['submission']}' AND stage='staff_review'),
 'current',(SELECT count(*) FROM public.artifact_evaluation_flows WHERE submission_id='{f['submission']}' AND is_current_stage),
 'status',(SELECT status FROM public.review_assignments WHERE id='{f['review']}'));""")
    assert result.returncode == 0, result.stderr
    return json.loads(result.stdout)

f = fixture()
a,b = race(completion(f),completion(f))
assert a.returncode == b.returncode == 0, (a.stderr,b.stderr)
assert json.loads(a.stdout) == json.loads(b.stdout), 'replay changed result'
assert outcome(f) == dict(scores=5,xp=1,staff=1,current=1,status='completed')
print('PASS concurrent duplicate completion: one outcome and XP award')

f = fixture()
a,b = race(completion(f,key='pass'),completion(f,'revise_and_resubmit','revision'))
assert sum(r.returncode == 0 for r in (a,b)) == 1, (a.stderr,b.stderr)
assert 'REVIEW_CONFLICT' in (a.stderr+b.stderr), (a.stderr,b.stderr)
result=outcome(f)
assert result['xp'] == result['staff'] == result['current'] == 1
assert result['scores'] == 5
print('PASS completion versus revision: exactly one command commits')

f = fixture()
reassign=f"SELECT public.reassign_artifact_review('{f['review']}','{f['other']}','{f['other']}',{f['version']},'Coverage','{f['scope']}','college_program',10,3,'Asia/Kolkata');"
a,b = race(completion(f),reassign)
assert sum(r.returncode == 0 for r in (a,b)) == 1, (a.stderr,b.stderr)
assert any(code in a.stderr+b.stderr for code in ('REVIEW_CONFLICT','REVIEW_NOT_FOUND'))
result=outcome(f)
assert result['current'] == 1 and result['staff'] == result['xp'] == (1 if a.returncode == 0 else 0)
assert result['scores'] == (5 if a.returncode == 0 else 0)
print('PASS completion versus reassignment: stale actor/version cannot commit')

f = fixture()
replacement=f"INSERT INTO public.artifact_submissions(artifact_id,user_id,user_module_progress_id,version_label,attempt_no) VALUES('{f['artifact']}','{f['learner']}','{f['progress']}','v2',2);"
a,b = race(completion(f),replacement)
assert a.returncode == 0 and b.returncode != 0, (a.stderr,b.stderr)
assert any(code in b.stderr for code in ('REVIEW_PENDING','SUBMISSION_ALREADY_ACCEPTED'))
assert outcome(f) == dict(scores=5,xp=1,staff=1,current=1,status='completed')
print('PASS completion versus replacement attempt: reviewed evidence cannot be replaced')

f = fixture()
transfer=f"SELECT public.reconcile_artifact_review_scope('{f['review']}','{f['learner']}',{f['version']},gen_random_uuid(),'school_class');"
a,b = race(completion(f),transfer)
assert sum(r.returncode == 0 for r in (a,b)) == 1, (a.stderr,b.stderr)
assert any(code in a.stderr+b.stderr for code in ('REVIEW_CONFLICT','REVIEW_NOT_FOUND'))
result=outcome(f)
assert result['current'] == 1 and result['staff'] == result['xp'] == (1 if a.returncode == 0 else 0)
assert result['scores'] == (5 if a.returncode == 0 else 0)
assert result['status'] == ('completed' if a.returncode == 0 else 'unassigned')
print('PASS completion versus scope transfer: one winner, no stale outcome or partial XP')
