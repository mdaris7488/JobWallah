import { lazy, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Loading, ErrorBox } from '../../components/common';
import { useTool } from '../../components/tools/toolContext';
import ToolShell from '../../components/tools/ToolShell';
import ImageTool from './ImageTool';
import { ImagesToPdf, PdfExtract, PdfMerge } from './PdfTools';
import VideoTool from './VideoTool';

const PdfToImage = lazy(() => import('./PdfToImage')); // pdf.js is big - load it only for this tool

const VIEWS = {
  'image-compressor': () => <ImageTool mode="compress" />,
  'image-resizer': () => <ImageTool mode="resize" />,
  'image-converter': () => <ImageTool mode="convert" />,
  'exam-photo': () => <ImageTool mode="exam" />,
  'image-to-pdf': () => <ImagesToPdf />,
  'pdf-merge': () => <PdfMerge />,
  'pdf-extract': () => <PdfExtract />,
  'pdf-to-image': () => <PdfToImage />,
  'video-compressor': () => <VideoTool />,
};

export default function ToolPage() {
  const { id } = useParams();
  const { cfg } = useTool();
  const tool = cfg.data?.tools.find((t) => t.id === id);
  useEffect(() => { if (tool) document.title = `${tool.name} · JobWallah`; }, [tool]);

  if (cfg.loading && !cfg.data) return <Loading />;
  if (cfg.error && !cfg.data) return <ErrorBox message={cfg.error} onRetry={cfg.reload} />;
  if (!tool || !VIEWS[id]) return <div className="center"><h1>Tool not found</h1><Link to="/tools">See all tools</Link></div>;

  return (
    <div className="narrow-wide">
      <p><Link to="/tools">← All tools</Link></p>
      <ToolShell tool={tool}>{VIEWS[id]()}</ToolShell>
    </div>
  );
}
