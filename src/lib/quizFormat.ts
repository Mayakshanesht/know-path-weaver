/**
 * The one place that knows how a quiz question is stored.
 *
 * The learner's grader (src/pages/Quiz.tsx) renders options with Object.entries() and grades
 * with String(userAnswer) === String(correct_answer). So the stored shape is:
 *
 *   mcq / multiple_select   options: { a: 'label', b: 'label', ... }   correct_answer: 'b'
 *   true_false              options: null                              correct_answer: 'true' | 'false'
 *   short_answer            options: null                              correct_answer: 'the answer'
 *
 * The admin editor used to write { correct_index: 0 } and { answer: true } instead. Neither
 * can ever equal the string the grader compares against, so every question saved that way
 * was unanswerable — the learner picked the right option and was marked wrong.
 *
 * That bug has appeared twice. It lives here now, with tests, so it cannot appear a third time.
 */

export type QuestionType = 'mcq' | 'short_answer' | 'true_false' | 'multiple_select';

export interface QuestionFormState {
  options: string[];
  /** Index into `options`. For true_false, 0 means true and 1 means false. */
  correct_answer: number;
}

export interface StoredQuestion {
  options: Record<string, string> | null;
  correct_answer: string;
}

const isChoiceType = (type: QuestionType) => type === 'mcq' || type === 'multiple_select';

/** a, b, c, d … — the keys the grader compares against. */
export const optionKey = (index: number) => String.fromCharCode(97 + index);

/** Stored shape → the positional form the editor works in. */
export function toFormState(
  type: QuestionType,
  options: unknown,
  correctAnswer: unknown
): QuestionFormState {
  const correct = String(correctAnswer ?? '');

  if (type === 'true_false') {
    return { options: ['', '', '', ''], correct_answer: correct === 'true' ? 0 : 1 };
  }

  if (type === 'short_answer') {
    return { options: [correct, '', '', ''], correct_answer: 0 };
  }

  const stored = (options ?? {}) as Record<string, string>;
  const entries = Object.entries(stored).sort(([a], [b]) => a.localeCompare(b));

  const found = entries.findIndex(([key]) => key === correct);
  const labels = entries.map(([, label]) => label);
  while (labels.length < 4) labels.push('');

  return { options: labels, correct_answer: found >= 0 ? found : 0 };
}

/** The editor's positional form → the shape the grader reads. */
export function toStored(type: QuestionType, form: QuestionFormState): StoredQuestion {
  if (type === 'true_false') {
    return { options: null, correct_answer: form.correct_answer === 0 ? 'true' : 'false' };
  }

  if (type === 'short_answer') {
    return { options: null, correct_answer: form.options[0]?.trim() ?? '' };
  }

  const labels = form.options.map((o) => o.trim()).filter(Boolean);
  const index = Math.min(Math.max(form.correct_answer, 0), Math.max(labels.length - 1, 0));

  return {
    options: Object.fromEntries(labels.map((label, i) => [optionKey(i), label])),
    correct_answer: optionKey(index),
  };
}

/** A choice question needs at least two options to be a choice at all. */
export function hasEnoughOptions(type: QuestionType, form: QuestionFormState): boolean {
  if (!isChoiceType(type)) return true;
  return form.options.map((o) => o.trim()).filter(Boolean).length >= 2;
}
