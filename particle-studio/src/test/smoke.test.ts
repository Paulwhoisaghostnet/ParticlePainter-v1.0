import { describe, it, expect } from 'vitest';

describe('Smoke Test', () => {
  it('should pass if test runner is working', () => {
    expect(true).toBe(true);
  });

  it('should have DOM access', () => {
    const element = document.createElement('div');
    element.textContent = 'Hello World';
    document.body.appendChild(element);
    expect(document.body).toHaveTextContent('Hello World');
  });
});
