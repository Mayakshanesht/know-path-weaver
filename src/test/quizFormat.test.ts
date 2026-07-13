import { describe, expect, it } from 'vitest';
import { toFormState, toStored, hasEnoughOptions } from '@/lib/quizFormat';

/**
 * The contract these tests defend: whatever the admin editor saves, the learner's grader
 * must be able to mark it correct. The grader does String(userAnswer) === String(correct_answer)
 * and renders options with Object.entries(). A question that fails that is unanswerable.
 */
const grades = (stored: { options: Record<string, string> | null; correct_answer: string }, chosen: string) =>
  String(chosen) === String(stored.correct_answer);

describe('quiz question storage format', () => {
  it('round-trips an MCQ without moving the correct answer', () => {
    const stored = { options: { a: 'Alpha', b: 'Beta', c: 'Gamma', d: 'Delta' }, correct_answer: 'c' };

    const form = toFormState('mcq', stored.options, stored.correct_answer);
    expect(form.options.slice(0, 4)).toEqual(['Alpha', 'Beta', 'Gamma', 'Delta']);
    expect(form.correct_answer).toBe(2);

    expect(toStored('mcq', form)).toEqual(stored);
  });

  it('produces an MCQ the learner grader can actually mark correct', () => {
    const saved = toStored('mcq', { options: ['Yes', 'No', '', ''], correct_answer: 1 });

    expect(saved.options).toEqual({ a: 'Yes', b: 'No' });
    expect(grades(saved, 'b')).toBe(true);
    expect(grades(saved, 'a')).toBe(false);
  });

  it('never writes the {correct_index} / {answer} shapes that broke grading before', () => {
    const saved = toStored('mcq', { options: ['One', 'Two', '', ''], correct_answer: 0 });
    expect(saved.correct_answer).toBe('a');
    expect(typeof saved.correct_answer).toBe('string');
    expect(saved.correct_answer).not.toBe(0);
  });

  it('round-trips true/false as the strings the grader compares', () => {
    expect(toStored('true_false', { options: [], correct_answer: 0 }).correct_answer).toBe('true');
    expect(toStored('true_false', { options: [], correct_answer: 1 }).correct_answer).toBe('false');

    expect(toFormState('true_false', null, 'true').correct_answer).toBe(0);
    expect(toFormState('true_false', null, 'false').correct_answer).toBe(1);

    const saved = toStored('true_false', { options: [], correct_answer: 0 });
    expect(grades(saved, 'true')).toBe(true);
    expect(grades(saved, 'false')).toBe(false);
  });

  it('round-trips a short answer', () => {
    const form = toFormState('short_answer', null, 'the margin');
    expect(form.options[0]).toBe('the margin');
    expect(toStored('short_answer', form).correct_answer).toBe('the margin');
  });

  it('drops blank options and keeps the correct answer pointing at the right label', () => {
    // Editing left a gap: the third box is empty but the fourth is the right answer.
    const saved = toStored('mcq', { options: ['Alpha', 'Beta', '', 'Delta'], correct_answer: 3 });

    // Delta compacts to key 'c'. The answer must follow it rather than point into a hole.
    expect(saved.options).toEqual({ a: 'Alpha', b: 'Beta', c: 'Delta' });
    expect(saved.correct_answer).toBe('c');
    expect(saved.options![saved.correct_answer]).toBe('Delta');
  });

  it('refuses a choice question with fewer than two options', () => {
    expect(hasEnoughOptions('mcq', { options: ['Only one', '', '', ''], correct_answer: 0 })).toBe(false);
    expect(hasEnoughOptions('mcq', { options: ['One', 'Two', '', ''], correct_answer: 0 })).toBe(true);
    expect(hasEnoughOptions('true_false', { options: [], correct_answer: 0 })).toBe(true);
  });

  it('survives a question whose stored options are missing entirely', () => {
    const form = toFormState('mcq', null, '');
    expect(form.correct_answer).toBe(0);
    expect(form.options).toHaveLength(4);
  });
});
