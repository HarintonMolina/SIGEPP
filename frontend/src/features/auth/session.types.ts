import type { ApiError } from '../../api/errors';
import type { AuthApi } from './auth-api';
import type { LoginInput, Usuario } from './contracts';

export type SessionIdentity = { generation: number; tokenVersion: number };
export type SessionAccess = SessionIdentity & { accessToken: string };
type SnapshotBase = SessionIdentity & {
  error: ApiError | null;
  logoutPending: boolean;
  logoutPersistenceAvailable: boolean;
};
export type SessionSnapshot = SnapshotBase & (
  | { status: 'autenticada'; usuario: Usuario }
  | { status: 'restaurando' | 'anonima' | 'errorRecuperable'; usuario: null }
);
export type LogoutStore = {
  read(): boolean;
  write(pending: boolean): void;
  isPersistent(): boolean;
};
export type SessionService = {
  getSnapshot(): SessionSnapshot;
  subscribe(listener: () => void): () => void;
  getAccess(): SessionAccess | null;
  initialize(): Promise<void>;
  retryRestore(): Promise<void>;
  login(input: LoginInput): Promise<void>;
  refresh(expected: SessionIdentity): Promise<SessionAccess>;
  invalidate(expected: SessionIdentity): Promise<void>;
  logout(): Promise<void>;
};
export type SessionDependencies = {
  api: AuthApi;
  logoutStore: LogoutStore;
  onInvalidate: () => Promise<void>;
};
