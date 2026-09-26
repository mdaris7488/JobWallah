import { Outlet } from 'react-router-dom';
import { ToolsProvider } from '../../components/tools/toolContext';

export default function ToolsLayout() {
  return (
    <ToolsProvider>
      <div className="container page"><Outlet /></div>
    </ToolsProvider>
  );
}
