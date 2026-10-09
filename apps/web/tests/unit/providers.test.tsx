import { useQueryClient } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Providers } from '../../src/app/providers';

function Probe() {
  const client = useQueryClient();
  return <span>staleTime={String(client.getDefaultOptions().queries?.staleTime)}</span>;
}

describe('Providers', () => {
  it('cung cấp QueryClient với cấu hình mặc định của dự án', () => {
    render(
      <Providers>
        <Probe />
      </Providers>,
    );
    expect(screen.getByText('staleTime=60000')).toBeInTheDocument();
  });
});
