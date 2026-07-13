import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Markdown } from '@/lib/markdown';

describe('Markdown', () => {
  it('renders headings, lists and inline formatting', () => {
    render(
      <Markdown
        content={[
          '## Findings',
          '',
          'The model uses **BEV fusion** and a `nuScenes` split.',
          '',
          '- Higher recall',
          '- Lower latency',
        ].join('\n')}
      />
    );

    expect(screen.getByRole('heading', { name: 'Findings' })).toBeInTheDocument();
    expect(screen.getByText('BEV fusion')).toBeInTheDocument();
    expect(screen.getByText('nuScenes')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('Higher recall')).toBeInTheDocument();
  });

  it('renders http links and opens them safely', () => {
    render(<Markdown content="See [the paper](https://arxiv.org/abs/1234.5678) for detail." />);

    const link = screen.getByRole('link', { name: 'the paper' });
    expect(link).toHaveAttribute('href', 'https://arxiv.org/abs/1234.5678');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('neutralises a javascript: URL rather than linking to it', () => {
    // Article bodies are model-generated and the model reads untrusted web pages,
    // so a prompt-injected link must never become a live javascript: href.
    render(<Markdown content="[click me](javascript:alert(1))" />);

    expect(screen.getByRole('link', { name: 'click me' })).toHaveAttribute('href', '#');
  });

  it('renders raw HTML as visible text instead of executing it', () => {
    const { container } = render(
      <Markdown content={'Intro.\n\n<script>window.__pwned = true;</script>'} />
    );

    expect(container.querySelector('script')).toBeNull();
    expect(
      (window as unknown as { __pwned?: boolean }).__pwned
    ).toBeUndefined();
    // The tag survives as literal text — which is exactly what we want.
    expect(container.textContent).toContain('<script>');
  });
});
