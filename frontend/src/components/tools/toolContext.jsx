import { createContext, useContext } from 'react';
import { useSelector } from 'react-redux';
import { toolsApi } from '../../api/tools';
import { useFetch } from '../../utils/useFetch';

const ToolContext = createContext(null);
export const useTool = () => useContext(ToolContext);

/** Loads the tool catalog + this user's plan/limits/usage once and shares it with every tool page. */
export function ToolsProvider({ children }) {
  const user = useSelector((s) => s.auth.user);
  const cfg = useFetch(() => toolsApi.config(), [user?._id]);
  return <ToolContext.Provider value={{ cfg, user }}>{children}</ToolContext.Provider>;
}
