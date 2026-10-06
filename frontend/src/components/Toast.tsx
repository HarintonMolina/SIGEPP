import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import * as Toast from '@radix-ui/react-toast';
import { CheckCircle, CircleAlert, Info, X } from 'lucide-react';
import { ToastContext, type ToastInput } from '../hooks/useToast';
import { Button } from './Button';

const tones = {
  exito: { Icon: CheckCircle, border: 'border-l-success' },
  error: { Icon: CircleAlert, border: 'border-l-error' },
  informacion: { Icon: Info, border: 'border-l-info' },
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<(ToastInput & { key: number })[]>([]);
  const nextKey = useRef(0);
  const notify = useCallback((input: ToastInput) => {
    const notice = { ...input, key: nextKey.current++ };
    setNotices((current) => [...current, notice]);
  }, []);
  const service = useMemo(() => ({ notify }), [notify]);

  return <ToastContext.Provider value={service}>
    <Toast.Provider label="Aviso" duration={5000}>
      {children}
      {notices.map((notice) => {
        const { Icon, border } = tones[notice.tone];
        return <Toast.Root key={notice.key} open type={notice.tone === 'error' ? 'foreground' : 'background'} duration={notice.tone === 'error' ? 10000 : 5000}
          onOpenChange={(open) => { if (!open) setNotices((current) => current.filter((item) => item.key !== notice.key)); }}
          className={`flex min-w-0 items-start gap-3 rounded-card border border-border border-l-[4px] bg-surface p-4 text-text shadow-lg ${border}`}>
          <Icon className="ui-icon" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <Toast.Title className="font-semibold">{notice.title}</Toast.Title>
            {notice.description && <Toast.Description className="text-sm text-muted">{notice.description}</Toast.Description>}
          </div>
          <Toast.Close asChild><Button variant="fantasma" aria-label="Cerrar aviso" className="shrink-0 p-2"><X className="ui-icon" aria-hidden="true" /></Button></Toast.Close>
        </Toast.Root>;
      })}
      <Toast.Viewport label="Avisos ({hotkey})" className="fixed bottom-4 right-4 z-[100] flex max-h-[calc(100dvh_-_2rem)] w-[calc(100%_-_2rem)] max-w-[24rem] list-none flex-col gap-3 overflow-y-auto p-0" />
    </Toast.Provider>
  </ToastContext.Provider>;
}
