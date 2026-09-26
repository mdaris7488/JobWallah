import { useCallback, useEffect, useState } from 'react';
import { getErrorMessage } from '../api/http';

/** Tiny data hook: useFetch(() => api.call(), [deps]) -> { data, meta, loading, error, errorCode, reload } */
export function useFetch(fn, deps = []) {
  const [state, setState] = useState({ data: null, meta: null, summary: null, loading: true, error: null, errorCode: null });
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let alive = true;
    setState((s) => ({ ...s, loading: true, error: null, errorCode: null }));
    fn()
      .then((res) => alive && setState({ data: res.data.data, meta: res.data.meta || null, summary: res.data.summary || null, loading: false, error: null, errorCode: null }))
      .catch((err) => alive && setState({
        data: null, meta: null, summary: null, loading: false, error: getErrorMessage(err), errorCode: err?.response?.data?.code || null,
      }));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
