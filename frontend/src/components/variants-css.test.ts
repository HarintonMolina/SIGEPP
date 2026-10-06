import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import postcss, { type Root } from 'postcss';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';
import { beforeAll, describe, expect, it } from 'vitest';
import tailwindConfig from '../../tailwind.config';

describe('colores de variantes emitidos por Tailwind', () => {
  let stylesheet: Root;

  beforeAll(async () => {
    const stylePath = resolve('src/styles/global.css');
    const [css, button, badge] = await Promise.all([
      readFile(stylePath, 'utf8'),
      readFile(resolve('src/components/Button.tsx'), 'utf8'),
      readFile(resolve('src/components/Badge.tsx'), 'utf8'),
    ]);
    // Scan the owning components so consumers/tests cannot rescue a missing class.
    const result = await postcss([
      tailwindcss({ ...tailwindConfig, content: [{ raw: button, extension: 'tsx' }, { raw: badge, extension: 'tsx' }] }),
      autoprefixer(),
    ]).process(css, { from: stylePath });
    stylesheet = result.root;
  });

  it.each([
    { component: 'button', variant: 'primario', background: 'var(--color-primary)', color: 'var(--color-surface)' },
    { component: 'button', variant: 'secundario', background: 'var(--color-surface)', color: 'var(--color-primary)', border: 'var(--color-primary)' },
    { component: 'button', variant: 'peligro', background: 'var(--color-error)', color: 'var(--color-surface)' },
    { component: 'button', variant: 'fantasma', background: 'transparent', color: 'var(--color-primary)' },
    { component: 'badge', variant: 'exito', background: 'var(--color-success)', color: 'var(--color-text)' },
    { component: 'badge', variant: 'advertencia', background: 'var(--color-warning)', color: 'var(--color-text)' },
    { component: 'badge', variant: 'error', background: 'var(--color-error)', color: 'var(--color-surface)' },
    { component: 'badge', variant: 'informacion', background: 'var(--color-info)', color: 'var(--color-surface)' },
  ])('$component $variant conserva sus declaraciones de color en el CSS procesado', ({ component, variant, background, color, border }) => {
    const declarations: Record<string, string> = {};
    stylesheet.walkRules(`.ui-${component}--${variant}`, (rule) => {
      rule.walkDecls((declaration) => { declarations[declaration.prop] = declaration.value; });
    });
    expect(declarations).toMatchObject({ background, color, ...(border && { 'border-color': border }) });
  });
});
