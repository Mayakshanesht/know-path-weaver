// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { prepareQualityPlan } from '../../scripts/course-quality-plan.mjs';

const snapshot = {
  courses: [{ id: 'course', is_published: true }, { id: 'draft', is_published: false }],
  learning_paths: [{ id: 'path', course_id: 'course' }, { id: 'other', course_id: 'other' }],
  capsules: [{ id: 'lesson', learning_path_id: 'path', description: 'Original' }, { id: 'unrelated', learning_path_id: 'other' }],
  capsule_content: [], quizzes: [], quiz_questions: [],
};
const guide = { target_capsule_id: 'lesson', title: 'Study guide', content_type: 'text',
  content_value: `${'Substantive teaching material '.repeat(200)} https://docs.python.org/3/` };
const question = { question_type: 'mcq', question_text: 'Which procedure isolates the test data?',
  options: { a: 'Fit on all data', b: 'Split before fitting', c: 'Use the test set for tuning' },
  correct_answer: 'b', explanation: 'Splitting first keeps held-out observations outside fitting and tuning.' };
const course = { course_id: 'course', course_title: 'Course', additions: [guide],
  quizzes: [{ capsule_id: 'lesson', title: 'Practice', questions: [question, { ...question, question_text: 'Another substantive question' }] }] };

describe('reviewed course-quality plan', () => {
  it('uses stable content IDs so a prepared release cannot duplicate guides and quizzes', () => {
    const first = prepareQualityPlan([[course]], snapshot);
    const second = prepareQualityPlan([[course]], snapshot);
    expect(first[0].additions[0].id).toBe(second[0].additions[0].id);
    expect(first[0].quizzes[0].questions[0].id).toBe(second[0].quizzes[0].questions[0].id);
  });
  it('rejects overwriting a lesson changed since the audited baseline', () => {
    expect(() => prepareQualityPlan([[{ ...course, capsule_updates: [{ id: 'lesson', before_description: 'Stale', description: 'A useful replacement lesson description explaining the practical work clearly.' }] }]], snapshot)).toThrow('baseline changed');
  });
  it('rejects cross-course lesson attribution and unpublished course promotion', () => {
    expect(() => prepareQualityPlan([[{ ...course, additions: [{ ...guide, target_capsule_id: 'unrelated' }] }]], snapshot)).toThrow('another course');
    expect(() => prepareQualityPlan([[{ ...course, course_id: 'draft' }]], snapshot)).toThrow('unpublished');
  });
  it('rejects the object-shaped answer format that the learner grader cannot score', () => {
    const bad = { ...course, quizzes: [{ ...course.quizzes[0], questions: [question, { ...question, correct_answer: { answer: 'b' } }] }] };
    expect(() => prepareQualityPlan([[bad]], snapshot)).toThrow('Invalid quiz answer');
  });
});

describe('course-quality release identity guards', () => {
  const planned = () => prepareQualityPlan([[course]], snapshot)[0];
  const validQuiz = () => ({ id: planned().quizzes[0].id, course_id: 'course', capsule_id: 'lesson', title: 'Practice',
    quiz_type: 'quiz', is_graded: false, is_published: true, max_attempts: null });
  const validGuide = () => ({ id: planned().additions[0].id, capsule_id: 'lesson', title: guide.title, content_type: 'text', content_value: guide.content_value });
  const validQuestion = () => ({ ...question, id: planned().quizzes[0].questions[0].id,
    quiz_id: planned().quizzes[0].id, order_index: 0, points: 1 });

  it('accepts an identical existing release without planning replacement media or changing attempt answer positions', () => {
    const audited = { ...snapshot, capsule_content: [validGuide()], quizzes: [validQuiz()], quiz_questions: [validQuestion()] };
    const result = prepareQualityPlan([[course]], audited)[0];
    expect(result.additions[0].content_type).toBe('text');
    expect(result.quizzes[0].questions[0]).toMatchObject({ correct_answer: 'b', order_index: 0, points: 1 });
  });

  it.each([
    ['capsule_id', 'unrelated'], ['content_type', 'youtube'], ['title', 'Different guide'], ['content_value', 'Edited live body'],
  ])('rejects an existing guide whose %s drifted', (field, value) => {
    const audited = { ...snapshot, capsule_content: [{ ...validGuide(), [field]: value }] };
    expect(() => prepareQualityPlan([[course]], audited)).toThrow('Existing study guide attribution or content changed');
  });

  it('rejects moving an existing guide to another lesson in the same course', () => {
    const audited = { ...snapshot, capsules: [...snapshot.capsules, { id: 'second-lesson', learning_path_id: 'path', description: '' }],
      capsule_content: [{ ...validGuide(), capsule_id: 'second-lesson' }] };
    expect(() => prepareQualityPlan([[course]], audited)).toThrow('Existing study guide attribution');
  });

  it.each([
    ['is_graded', true], ['is_published', false], ['max_attempts', 3], ['quiz_type', 'exam'],
    ['capsule_id', 'unrelated'], ['title', 'Another quiz'], ['course_id', 'other'],
  ])('rejects existing formative quiz settings drift: %s', (field, value) => {
    const audited = { ...snapshot, quizzes: [{ ...validQuiz(), [field]: value }] };
    expect(() => prepareQualityPlan([[course]], audited)).toThrow('Existing formative quiz attribution or settings changed');
  });

  it.each([
    ['quiz_id', 'another-quiz'], ['question_type', 'true_false'], ['order_index', 4], ['points', 2],
  ])('rejects an existing practice question whose %s drifted', (field, value) => {
    const audited = { ...snapshot, quizzes: [validQuiz()], quiz_questions: [{ ...validQuestion(), [field]: value }] };
    expect(() => prepareQualityPlan([[course]], audited)).toThrow('Existing practice question attribution or content changed');
  });

  it('rejects duplicate generated IDs within a release instead of silently skipping an authored row', () => {
    expect(() => prepareQualityPlan([[{ ...course, additions: [guide, guide] }]], snapshot)).toThrow('Duplicate text target');
    expect(() => prepareQualityPlan([[{ ...course, quizzes: [course.quizzes[0], course.quizzes[0]] }]], snapshot)).toThrow('Duplicate quiz target');
  });
});

describe('existing question corrections preserve the learner grader contract', () => {
  const old = { id: 'old-question', quiz_id: 'old-quiz', question_type: 'mcq', ...question, order_index: 2, points: 1 };
  const patch = { id: old.id, before_question_text: old.question_text, before_options: old.options,
    before_correct_answer: old.correct_answer, before_explanation: old.explanation,
    question_text: 'Which evaluation split isolates unseen driving episodes?', options: { ...old.options }, correct_answer: 'b',
    explanation: 'Assigning whole episodes before fitting keeps related observations out of the held-out evaluation partition.' };
  const audited = { ...snapshot, quizzes: [{ id: old.quiz_id, course_id: 'course' }], quiz_questions: [old] };

  it('records the audited quiz and type while retaining a scalar correct answer', () => {
    const result = prepareQualityPlan([[{ ...course, question_updates: [patch] }]], audited)[0].question_updates[0];
    expect(result).toMatchObject({ quiz_id: 'old-quiz', question_type: 'mcq', correct_answer: 'b' });
    expect(result).not.toHaveProperty('order_index');
  });

  it('requires revised explanations and rejects object-shaped answers or changed answer letters', () => {
    expect(() => prepareQualityPlan([[{ ...course, question_updates: [{ ...patch, explanation: 'Too short' }] }]], audited)).toThrow('needs explanation');
    expect(() => prepareQualityPlan([[{ ...course, question_updates: [{ ...patch, correct_answer: { answer: 'b' } }] }]], audited)).toThrow('Invalid quiz answer');
    expect(() => prepareQualityPlan([[{ ...course, question_updates: [{ ...patch, correct_answer: 'a' }] }]], audited)).toThrow('Preserve existing attempt answer positions');
  });

  it('rejects changing existing option labels even when the correct answer letter is retained', () => {
    const options = { a: old.options.a, b: old.options.b, d: old.options.c };
    expect(() => prepareQualityPlan([[{ ...course, question_updates: [{ ...patch, options }] }]], audited)).toThrow('Preserve existing option positions');
  });

  it('supports correcting a true/false question while preserving its type, null options, and scalar false answer', () => {
    const oldTrueFalse = { ...old, question_type: 'true_false', options: null, correct_answer: 'false' };
    const updated = { ...patch, before_options: null, before_correct_answer: 'false', options: null, correct_answer: 'false' };
    const result = prepareQualityPlan([[{ ...course, question_updates: [updated] }]], { ...audited, quiz_questions: [oldTrueFalse] })[0].question_updates[0];
    expect(result).toMatchObject({ question_type: 'true_false', options: null, correct_answer: 'false' });
  });
});
