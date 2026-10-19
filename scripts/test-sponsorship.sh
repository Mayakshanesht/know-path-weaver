#!/usr/bin/env bash
set -euo pipefail
repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
container_name="knowgraph-sponsorship-test-$$"
test_temp_dir="$(mktemp -d)"
cleanup() { docker rm -f "$container_name" >/dev/null 2>&1 || true; rm -rf "$test_temp_dir"; }
trap cleanup EXIT
docker run --rm -d --name "$container_name" -e POSTGRES_HOST_AUTH_METHOD=trust postgres:16-alpine >/dev/null
for attempt in $(seq 1 30); do
  if docker exec "$container_name" pg_isready -h 127.0.0.1 -U postgres >/dev/null 2>&1; then break; fi
  sleep 0.2
done
run_sql() { docker exec -i "$container_name" psql -U postgres -v ON_ERROR_STOP=1 "$@"; }
run_sql -q < "$repo_dir/supabase/tests/sponsorship_bootstrap.sql"
for migration in "$repo_dir"/supabase/migrations/*.sql; do
  if [[ "$migration" = */20261019010000_require_verified_paid_access.sql || "$migration" = */20261019020000_course_quality_improvements.sql ]]; then continue; fi
  # Plain PostgreSQL lacks Supabase's pg_net package; bootstrap supplies a local
  # HTTP queue substitute. Execute every other statement from the real migrations.
  sed '/^CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;$/d' "$migration" | run_sql -q
done
run_sql -q < "$repo_dir/supabase/tests/sponsorship_access.sql"
run_sql -q < "$repo_dir/supabase/tests/verified_access_legacy.sql"
run_sql -q < "$repo_dir/supabase/migrations/20261019010000_require_verified_paid_access.sql"
run_sql -q < "$repo_dir/supabase/tests/verified_paid_access.sql"
run_sql -q < "$repo_dir/supabase/tests/percentage_coupons.sql"
capacity_code="$(run_sql -Atq -c "SELECT code FROM public.sponsorship_codes WHERE label = 'Capacity'")"
run_sql -q <<SQL
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000008', false);
SELECT public.test_assert((public.quote_sponsorship_code('$capacity_code', '10000000-0000-0000-0000-000000000001')->>'total')::numeric = 0,
  'first learner can quote the remaining seat');
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000009', false);
SELECT public.test_assert((public.quote_sponsorship_code('$capacity_code', '10000000-0000-0000-0000-000000000001')->>'total')::numeric = 0,
  'second learner can also quote without reserving or consuming the seat');
SQL
claim_seat() {
  local learner_id="$1"
  run_sql -q > "$test_temp_dir/$learner_id.log" 2>&1 <<SQL
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-$learner_id', false);
BEGIN;
SELECT public.redeem_sponsorship_code('$capacity_code', 'Concurrent Student', 'Engineering College');
SELECT pg_sleep(0.2);
COMMIT;
SQL
}
claim_seat 000000000008 & first_pid=$!
claim_seat 000000000009 & second_pid=$!
set +e
wait "$first_pid"; first_status=$?
wait "$second_pid"; second_status=$?
set -e
if [[ "$first_status" -eq "$second_status" ]]; then
  cat "$test_temp_dir/000000000008.log" "$test_temp_dir/000000000009.log"
  echo 'Expected exactly one simultaneous claim to succeed' >&2
  exit 1
fi
run_sql -q <<'SQL'
SELECT public.test_assert((SELECT count(*) = 1 FROM public.sponsorship_redemptions r
  JOIN public.sponsorship_codes c ON c.id = r.code_id WHERE c.label = 'Capacity'), 'parallel claims cannot exceed the one-person seat limit');
SELECT public.test_assert((SELECT count(*) = 5 FROM public.enrollments e
  JOIN public.sponsorship_redemptions r ON r.id = e.sponsorship_redemption_id
  JOIN public.sponsorship_codes c ON c.id = r.code_id WHERE c.label = 'Capacity'), 'one claimed seat unlocks all five courses');
SQL
loser_id="$(run_sql -Atq -c "SELECT CASE WHEN EXISTS (SELECT 1 FROM public.sponsorship_redemptions r JOIN public.sponsorship_codes c ON c.id = r.code_id WHERE c.label = 'Capacity' AND r.user_id = '00000000-0000-0000-0000-000000000008') THEN '00000000-0000-0000-0000-000000000009' ELSE '00000000-0000-0000-0000-000000000008' END")"
run_sql -q <<SQL
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '$loser_id', false);
SELECT public.test_expect_error(\$q\$SELECT public.quote_sponsorship_code('$capacity_code', '10000000-0000-0000-0000-000000000001')\$q\$, 'All seats');
SQL

# Exercise both commit orders between a new claim and publishing another course.
# Each session holds the shared advisory lock while sleeping; wait_event gives
# the other session a deterministic start point without relying on a short sleep.
run_sql -q <<'SQL'
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', false);
SELECT public.admin_create_sponsorship_code('Race claim first', 'Race claim first', 'general', NULL, 1, NULL, NULL);
SELECT public.admin_create_sponsorship_code('Race publish first', 'Race publish first', 'general', NULL, 1, NULL, NULL);
INSERT INTO public.courses (id, title, price_india, is_published) VALUES
  ('10000000-0000-0000-0000-000000000006', 'Concurrent publication 6', 4999, false),
  ('10000000-0000-0000-0000-000000000007', 'Concurrent publication 7', 5999, false);
SQL
wait_for_transaction_sleep() {
  local application_name="$1"
  for attempt in $(seq 1 40); do
    if [[ "$(run_sql -Atq -c "SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name = '$application_name' AND wait_event = 'PgSleep')")" = 't' ]]; then return; fi
    sleep 0.05
  done
  echo "Timed out waiting for concurrent test transaction: $application_name" >&2
  exit 1
}
race_claim_code="$(run_sql -Atq -c "SELECT code FROM public.sponsorship_codes WHERE label = 'Race claim first'")"
run_sql -q > "$test_temp_dir/race-claim-first.log" 2>&1 <<SQL &
SET application_name = 'sponsorship-race-claim-first';
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000011', false);
BEGIN;
SELECT public.redeem_sponsorship_code('$race_claim_code', 'Race Student Eleven', 'Engineering College');
SELECT pg_sleep(1);
COMMIT;
SQL
race_claim_pid=$!
wait_for_transaction_sleep sponsorship-race-claim-first
run_sql -q -c "UPDATE public.courses SET is_published = true WHERE id = '10000000-0000-0000-0000-000000000006'"
wait "$race_claim_pid"
race_publish_code="$(run_sql -Atq -c "SELECT code FROM public.sponsorship_codes WHERE label = 'Race publish first'")"
run_sql -q > "$test_temp_dir/race-publish-first.log" 2>&1 <<'SQL' &
SET application_name = 'sponsorship-race-publish-first';
BEGIN;
UPDATE public.courses SET is_published = true WHERE id = '10000000-0000-0000-0000-000000000007';
SELECT pg_sleep(1);
COMMIT;
SQL
race_publish_pid=$!
wait_for_transaction_sleep sponsorship-race-publish-first
run_sql -q <<SQL
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000012', false);
SELECT public.redeem_sponsorship_code('$race_publish_code', 'Race Student Twelve', 'Engineering College');
SQL
wait "$race_publish_pid"
run_sql -q <<'SQL'
SELECT public.test_assert((SELECT count(*) = 7 FROM public.enrollments
  WHERE user_id = '00000000-0000-0000-0000-000000000011' AND status = 'approved'), 'claim before publish does not miss a course');
SELECT public.test_assert((SELECT count(*) = 7 FROM public.enrollments
  WHERE user_id = '00000000-0000-0000-0000-000000000012' AND status = 'approved'), 'publish before claim does not miss a course');
SELECT public.test_assert((SELECT count(*) = 0 FROM public.enrollments
  WHERE user_id IN('00000000-0000-0000-0000-000000000019','00000000-0000-0000-0000-000000000020','00000000-0000-0000-0000-000000000022')
  AND course_id IN('10000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000007')), 'partial coupon members never receive future free course grants');
SQL
run_sql -q <<'SQL'
INSERT INTO auth.users(id,email,email_confirmed_at) VALUES
  ('00000000-0000-0000-0000-000000000025','learner25@example.edu',now()),
  ('00000000-0000-0000-0000-000000000026','learner26@example.edu',now());
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',false);
SELECT public.admin_create_sponsorship_code('Partial capacity race','Partial capacity race','general',NULL,1,NULL,NULL,NULL,25);
SQL
partial_capacity_code="$(run_sql -Atq -c "SELECT code FROM public.sponsorship_codes WHERE label='Partial capacity race'")"
reserve_partial_seat() {
  local learner_id="$1"
  run_sql -q > "$test_temp_dir/partial-$learner_id.log" 2>&1 <<SQL
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub','00000000-0000-0000-0000-$learner_id',false);
BEGIN;
SELECT public.reserve_coupon_checkout('$partial_capacity_code','10000000-0000-0000-0000-000000000001','india','Concurrent Paid Learner','Engineering College');
SELECT pg_sleep(0.2);
COMMIT;
SQL
}
reserve_partial_seat 000000000025 & first_partial_pid=$!
reserve_partial_seat 000000000026 & second_partial_pid=$!
set +e
wait "$first_partial_pid"; first_partial_status=$?
wait "$second_partial_pid"; second_partial_status=$?
set -e
if [[ "$first_partial_status" -eq "$second_partial_status" ]]; then
  cat "$test_temp_dir/partial-000000000025.log" "$test_temp_dir/partial-000000000026.log"
  echo 'Expected exactly one simultaneous partial seat reservation to succeed' >&2
  exit 1
fi
run_sql -q <<'SQL'
SELECT public.test_assert((SELECT count(*)=1 FROM public.coupon_checkouts cc
  JOIN public.sponsorship_redemptions r ON r.id=cc.redemption_id
  JOIN public.sponsorship_codes c ON c.id=r.code_id WHERE c.label='Partial capacity race'), 'partial checkout reservations cannot exceed the people seat cap');
SELECT public.test_assert((SELECT count(*)=0 FROM public.enrollments WHERE user_id IN
  ('00000000-0000-0000-0000-000000000025','00000000-0000-0000-0000-000000000026')), 'neither concurrent partial reservation grants unpaid access');
SQL
echo 'All sponsorship database checks passed, including partial reservations, paid captures, simultaneous claims and course publication.'

# Teaching-only portable fixture, loaded after every coupon assertion so its
# published courses cannot change the course counts in the access tests.
quality_migration="$repo_dir/supabase/migrations/20261019020000_course_quality_improvements.sql"
if [[ ! -f "$quality_migration" ]]; then
  echo 'Prepare the reviewed course-quality migration before running the complete suite.' >&2
  exit 1
fi
run_sql -q < "$repo_dir/supabase/tests/course_quality_fixture.sql"
run_sql -q <<'SQL'
CREATE FUNCTION public.test_quality_fingerprint() RETURNS text LANGUAGE plpgsql AS $$
DECLARE v_table text; v_rows jsonb; v_snapshot jsonb:='{}'::jsonb;
BEGIN
  FOR v_table IN SELECT tablename FROM pg_catalog.pg_tables WHERE schemaname='public' ORDER BY tablename LOOP
    EXECUTE format('SELECT COALESCE(jsonb_agg(j ORDER BY j::text),''[]''::jsonb) FROM (SELECT to_jsonb(t) AS j FROM public.%I t) data',v_table) INTO v_rows;
    v_snapshot:=v_snapshot || jsonb_build_object(v_table,v_rows);
  END LOOP;
  RETURN md5(v_snapshot::text);
END;
$$;
SQL
apply_quality() { run_sql -q --single-transaction -f - < "$quality_migration"; }
quality_fingerprint() { run_sql -Atq -c 'SELECT public.test_quality_fingerprint()'; }
apply_quality
run_sql -q < "$repo_dir/supabase/tests/course_quality_expected.sql"
first_release_fingerprint="$(quality_fingerprint)"
apply_quality
run_sql -q < "$repo_dir/supabase/tests/course_quality_expected.sql"
if [[ "$(quality_fingerprint)" != "$first_release_fingerprint" ]]; then
  echo 'Reapplying the course-quality migration changed rows or timestamps.' >&2
  exit 1
fi

# Derive deterministic guide/question IDs from the actual reviewed manifests.
# SQL literals are escaped here, never interpolated into shell command text.
node --input-type=module - "$repo_dir" "$test_temp_dir" <<'JS'
import { readFileSync,writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
const [,,repo,temp]=process.argv;
const { stableContentId }=await import(pathToFileURL(join(repo,'scripts/course-quality-plan.mjs')));
const courses=['content/catalog-core-enhancements.json','content/catalog-applied-enhancements.json']
  .flatMap(file=>JSON.parse(readFileSync(join(repo,file),'utf8')));
const literal=value=>value==null?'NULL':"'"+String(value).replaceAll("'","''")+"'";
const lessons=courses.flatMap(course=>course.capsule_updates??[]);
const first=lessons[0],last=lessons.at(-1);
if(!first||!last||first.id===last.id) throw new Error('Need distinct early/late lesson patches for atomic CAS test');
const guideCourse=courses.find(course=>course.additions?.length);
const guide=guideCourse.additions[0];
const guideId=stableContentId(`${guideCourse.course_id}:guide:${guide.title}`);
const otherGuide=courses.flatMap(course=>course.additions??[]).find(row=>row.target_capsule_id!==guide.target_capsule_id);
const quizzes=courses.flatMap(course=>(course.quizzes??[]).map(quiz=>({...quiz,course_id:course.course_id})));
const quiz=quizzes[0],otherQuiz=quizzes[1];
if(!otherGuide||!quiz||!otherQuiz) throw new Error('Need distinct guide and quiz targets for ownership tests');
const quizId=stableContentId(`${quiz.course_id}:quiz:${quiz.title}`);
const otherQuizId=stableContentId(`${otherQuiz.course_id}:quiz:${otherQuiz.title}`);
const questionId=stableContentId(`${quizId}:question:0`);
const update=(table,id,field,value)=>`UPDATE public.${table} SET ${field}=${literal(value)} WHERE id=${literal(id)};\n`;
const cases={
  'lesson-cas':[
    update('capsules',first.id,'description',first.before_description)+update('capsules',last.id,'description','A concurrent editor changed this lesson after the audit.'),
    update('capsules',first.id,'description',first.description)+update('capsules',last.id,'description',last.description)],
  'guide-owner':[update('capsule_content',guideId,'capsule_id',otherGuide.target_capsule_id),update('capsule_content',guideId,'capsule_id',guide.target_capsule_id)],
  'guide-title':[update('capsule_content',guideId,'title','A concurrent guide title change'),update('capsule_content',guideId,'title',guide.title)],
  'question-owner':[update('quiz_questions',questionId,'quiz_id',otherQuizId),update('quiz_questions',questionId,'quiz_id',quizId)],
  'question-type':[update('quiz_questions',questionId,'question_type','short_answer'),update('quiz_questions',questionId,'question_type','mcq')],
};
for(const [name,[change,restore]] of Object.entries(cases)) {
  writeFileSync(join(temp,`${name}.change.sql`),change);
  writeFileSync(join(temp,`${name}.restore.sql`),restore);
}
JS
for drift_case in lesson-cas guide-owner guide-title question-owner question-type; do
  run_sql -q < "$test_temp_dir/$drift_case.change.sql"
  before_failure_fingerprint="$(quality_fingerprint)"
  if apply_quality > "$test_temp_dir/$drift_case.failure.log" 2>&1; then
    echo "Course-quality migration accepted concurrent drift: $drift_case" >&2
    exit 1
  fi
  case "$drift_case" in
    lesson-cas) expected_error='Lesson edited since audit' ;;
    guide-*) expected_error='Study guide attribution or content changed after release' ;;
    question-*) expected_error='Practice question attribution or content changed after release' ;;
  esac
  if ! rg -F -q "$expected_error" "$test_temp_dir/$drift_case.failure.log"; then
    cat "$test_temp_dir/$drift_case.failure.log"
    echo "Course-quality drift failed for an unexpected reason: $drift_case" >&2
    exit 1
  fi
  if [[ "$(quality_fingerprint)" != "$before_failure_fingerprint" ]]; then
    echo "A rejected course-quality transaction changed database rows: $drift_case" >&2
    exit 1
  fi
  run_sql -q < "$test_temp_dir/$drift_case.restore.sql"
done
apply_quality
run_sql -q < "$repo_dir/supabase/tests/course_quality_expected.sql"
echo 'All course-quality checks passed, including stable reruns, protected teaching media/grades and atomic concurrent-edit rejection.'
