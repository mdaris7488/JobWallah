import { useCallback, useState } from 'react';
import { getErrorMessage } from '../../api/http';
import { runTool } from '../../api/tools';
import { useTool } from './toolContext';

/** Runs a server tool: upload progress, result, friendly errors, and refreshes the "used today" counter. */
export function useToolRun() {
  const { cfg } = useTool();
  const [state, setState] = useState({ busy: false, progress: 0, result: null, error: '', code: '' });

  const run = useCallback(async (path, buildForm) => {
    setState({ busy: true, progress: 0, result: null, error: '', code: '' });
    try {
      const result = await runTool(path, buildForm(), {
        onUploadProgress: (e) => setState((s) => ({ ...s, progress: e.total ? Math.round((e.loaded / e.total) * 100) : 0 })),
      });
      setState({ busy: false, progress: 100, result, error: '', code: '' });
    } catch (err) {
      setState({ busy: false, progress: 0, result: null, error: getErrorMessage(err), code: err?.response?.data?.code || '' });
    } finally {
      cfg.reload();
    }
  }, [cfg]);

  const reset = useCallback(() => setState({ busy: false, progress: 0, result: null, error: '', code: '' }), []);
  return { ...state, run, reset };
}
