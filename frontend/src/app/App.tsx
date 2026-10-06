import { RouterProvider } from 'react-router-dom';
import { createAppRouter } from '../routes/router';
import { pages } from './pages';

const router = createAppRouter(pages);
export function App(): JSX.Element { return <RouterProvider router={router} future={{ v7_startTransition: true }} />; }
