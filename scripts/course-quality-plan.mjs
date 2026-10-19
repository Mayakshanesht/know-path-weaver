import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

export function stableContentId(key) {
  const hex = createHash('sha256').update(`knowgraph-quality-20261019:${key}`).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

const assert = (condition, message) => { if (!condition) throw new Error(message); };
const jsonFieldsEqual = (left, right, fields) => fields.every(key => isDeepStrictEqual(left[key], right[key]));
const contentFields = ['question_text', 'options', 'correct_answer', 'explanation'];

function validateQuestion(question, type, label) {
  assert(typeof question.question_text === 'string' && question.question_text.trim().length >= 15, `Question is too thin: ${label}`);
  assert(typeof question.correct_answer === 'string', `Invalid quiz answer: ${label}`);
  assert(typeof question.explanation === 'string' && question.explanation.trim().length >= 35, `Quiz answer needs explanation: ${label}`);
  if (type === 'true_false') {
    assert(question.options === null && ['true', 'false'].includes(question.correct_answer), `Invalid true/false answer: ${label}`);
  } else {
    assert(type === 'mcq', `Unsupported revised question type: ${label}`);
    assert(question.options && !Array.isArray(question.options) && typeof question.options === 'object'
      && Object.hasOwn(question.options, question.correct_answer), `Invalid quiz answer: ${label}`);
    const values = Object.values(question.options);
    assert(values.length >= 3 && values.every(value => typeof value === 'string' && value.trim())
      && new Set(values).size === values.length, `Quiz options must be distinct: ${label}`);
  }
}

/** Validate authored changes against the exact audited catalog before producing SQL. */
export function prepareQualityPlan(manifests, snapshot) {
  const courses = new Map(snapshot.courses.map(row => [row.id, row]));
  const paths = new Map(snapshot.learning_paths.map(row => [row.id, row.course_id]));
  const capsules = new Map(snapshot.capsules.map(row => [row.id, row]));
  const content = new Map(snapshot.capsule_content.map(row => [row.id, row]));
  const questions = new Map(snapshot.quiz_questions.map(row => [row.id, row]));
  const quizzes = new Map(snapshot.quizzes.map(row => [row.id, row]));
  const seen = new Set();
  const edited = new Set();
  const belongs = (capsuleId, courseId) => paths.get(capsules.get(capsuleId)?.learning_path_id) === courseId;
  const unique = (kind, id) => {
    const key = `${kind}:${id}`;
    assert(!edited.has(key), `Duplicate ${kind} target: ${id}`);
    edited.add(key);
  };
  return manifests.flat().map(course => {
    const existing = courses.get(course.course_id);
    assert(existing?.is_published, `Course is missing or unpublished: ${course.course_id}`);
    assert(!seen.has(course.course_id), `Duplicate course plan: ${course.course_id}`);
    seen.add(course.course_id);
    const plan = { ...course, capsule_updates: [], content_updates: [], question_updates: [], additions: [], quizzes: [] };
    for (const patch of course.capsule_updates ?? []) {
      unique('lesson', patch.id);
      const row = capsules.get(patch.id);
      assert(belongs(patch.id, course.course_id), `Lesson belongs to another course: ${patch.id}`);
      assert(row.description === patch.before_description, `Lesson baseline changed: ${patch.id}`);
      assert(typeof patch.description === 'string' && patch.description.trim().length >= 60, `Description too thin: ${patch.id}`);
      plan.capsule_updates.push({ ...patch, learning_path_id: row.learning_path_id });
    }
    for (const patch of course.content_updates ?? []) {
      unique('text', patch.id);
      const row = content.get(patch.id);
      assert(row?.content_type === 'text' && belongs(row.capsule_id, course.course_id), `Text content belongs to another course: ${patch.id}`);
      assert(row.content_value === patch.before_content_value, `Text baseline changed: ${patch.id}`);
      assert(typeof patch.content_value === 'string' && patch.content_value.trim().length >= 100, `Empty replacement text: ${patch.id}`);
      plan.content_updates.push({ ...patch, capsule_id: row.capsule_id, before_title: row.title });
    }
    for (const patch of course.question_updates ?? []) {
      unique('question', patch.id);
      const row = questions.get(patch.id);
      assert(quizzes.get(row?.quiz_id)?.course_id === course.course_id, `Question belongs to another course: ${patch.id}`);
      for (const key of contentFields) {
        assert(isDeepStrictEqual(row[key], patch[`before_${key}`]), `Question baseline changed: ${patch.id}/${key}`);
      }
      assert(!patch.question_type || patch.question_type === row.question_type, `Question type must be preserved: ${patch.id}`);
      validateQuestion(patch, row.question_type, patch.id);
      assert(patch.correct_answer === row.correct_answer, `Preserve existing attempt answer positions: ${patch.id}`);
      if (row.question_type === 'mcq') {
        assert(isDeepStrictEqual(Object.keys(patch.options).sort(), Object.keys(row.options).sort()), `Preserve existing option positions: ${patch.id}`);
      }
      plan.question_updates.push({ ...patch, quiz_id: row.quiz_id, question_type: row.question_type });
    }
    for (const addition of course.additions ?? []) {
      assert(belongs(addition.target_capsule_id, course.course_id), `Guide lesson belongs to another course: ${addition.target_capsule_id}`);
      assert(addition.content_type === 'text', 'Editorial additions must be text; preserve existing media.');
      assert(typeof addition.title === 'string' && addition.title.trim(), 'Study guide needs a title.');
      assert(typeof addition.content_value === 'string' && addition.content_value.trim().split(/\s+/).length >= 500, `Study guide is too thin: ${addition.title}`);
      assert(/https:\/\//.test(addition.content_value), `Guide needs primary references: ${addition.title}`);
      const id = stableContentId(`${course.course_id}:guide:${addition.title}`);
      unique('text', id);
      const current = content.get(id);
      if (current) {
        assert(belongs(current.capsule_id, course.course_id) && current.capsule_id === addition.target_capsule_id
          && current.content_type === 'text' && current.title === addition.title && current.content_value === addition.content_value,
        `Existing study guide attribution or content changed: ${id}`);
      }
      plan.additions.push({ ...addition, id });
    }
    for (const quiz of course.quizzes ?? []) {
      assert(belongs(quiz.capsule_id, course.course_id), `Quiz lesson belongs to another course: ${quiz.capsule_id}`);
      assert(typeof quiz.title === 'string' && quiz.title.trim(), 'Practice quiz needs a title.');
      assert(quiz.questions?.length >= 2, `Quiz needs at least two questions: ${quiz.title}`);
      const id = stableContentId(`${course.course_id}:quiz:${quiz.title}`);
      unique('quiz', id);
      const currentQuiz = quizzes.get(id);
      if (currentQuiz) {
        assert(currentQuiz.course_id === course.course_id && currentQuiz.capsule_id === quiz.capsule_id
          && currentQuiz.title === quiz.title && currentQuiz.quiz_type === 'quiz'
          && currentQuiz.is_graded === false && currentQuiz.is_published === true && currentQuiz.max_attempts === null,
        `Existing formative quiz attribution or settings changed: ${id}`);
      }
      plan.quizzes.push({ ...quiz, id, questions: quiz.questions.map((question, index) => {
        assert(question.question_type === 'mcq', 'New formative questions use the supported single-choice format.');
        validateQuestion(question, 'mcq', `${quiz.title}/${index}`);
        const questionId = stableContentId(`${id}:question:${index}`);
        unique('question', questionId);
        const currentQuestion = questions.get(questionId);
        if (currentQuestion) {
          assert(currentQuestion.quiz_id === id && currentQuestion.question_type === 'mcq'
            && currentQuestion.order_index === index && currentQuestion.points === 1
            && jsonFieldsEqual(currentQuestion, question, contentFields), `Existing practice question attribution or content changed: ${questionId}`);
        }
        return { ...question, id: questionId, order_index: index, points: 1 };
      }) });
    }
    return plan;
  });
}
