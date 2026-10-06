import { ErrorPage } from './ErrorPage';

// Never render raw route errors: lazy imports and API errors may carry details
// that are neither safe nor useful to expose in the public recovery view.
export function RouteErrorBoundary() {
  return <ErrorPage code="load" />;
}
