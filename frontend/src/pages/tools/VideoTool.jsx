import { useEffect, useState } from 'react';
import FileDrop from '../../components/tools/FileDrop';
import ResultCard from '../../components/tools/ResultCard';
import { useTool } from '../../components/tools/toolContext';
import { getErrorMessage } from '../../api/http';
import { toolsApi } from '../../api/tools';
import { Field, Select } from '../../components/common';

const CHIPS = [5, 10, 20, 50, 100];

export default function VideoTool() {
  const { cfg } = useTool();
  const { limits } = cfg.data;
  const [files, setFiles] = useState([]);
  const [targetMb, setTargetMb] = useState('20');
  const [resolution, setResolution] = useState('auto');
  const [stage, setStage] = useState('idle'); // idle | uploading | processing | done | error
  const [uploadPct, setUploadPct] = useState(0);
  const [jobId, setJobId] = useState('');
  const [job, setJob] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const fail = (message) => { setError(message); setStage('error'); cfg.reload(); };
  const reset = () => { setFiles([]); setStage('idle'); setJob(null); setResult(null); setError(''); setUploadPct(0); };

  const start = async (e) => {
    e.preventDefault();
    if (!files.length) return fail('Please choose a video first.');
    if (!(Number(targetMb) >= 0.5)) return fail('Enter a target size of at least 0.5 MB.');
    setError(''); setStage('uploading'); setUploadPct(0);
    const fd = new FormData();
    fd.append('targetMb', targetMb);
    fd.append('resolution', resolution);
    fd.append('files', files[0]);
    try {
      const { data } = await toolsApi.startVideo(fd, (ev) => setUploadPct(ev.total ? Math.round((ev.loaded / ev.total) * 100) : 0));
      setJobId(data.data.jobId);
      setStage('processing');
    } catch (err) {
      fail(getErrorMessage(err));
    }
    return undefined;
  };

  // poll the background job
  useEffect(() => {
    if (stage !== 'processing') return undefined;
    let stop = false;
    let timer;
    const tick = async () => {
      try {
        const { data } = await toolsApi.videoStatus(jobId);
        const j = data.data;
        if (stop) return;
        setJob(j);
        if (j.status === 'done') {
          const res = await toolsApi.videoDownload(jobId);
          if (!stop) { setResult(res); setStage('done'); cfg.reload(); }
          return;
        }
        if (j.status === 'failed') { if (!stop) fail(j.error || 'Video processing failed.'); return; }
        timer = setTimeout(tick, 1500);
      } catch (err) {
        if (!stop) fail(getErrorMessage(err));
      }
    };
    tick();
    return () => { stop = true; clearTimeout(timer); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, jobId]);

  if (stage === 'done' && result) return <ResultCard result={result} onReset={reset} />;
  const busy = stage === 'uploading' || stage === 'processing';

  return (
    <form className="form" onSubmit={start}>
      <FileDrop files={files} onChange={setFiles} accept="video/mp4,video/quicktime,video/webm,video/x-matroska,video/x-msvideo,.mp4,.mov,.webm,.mkv,.avi"
        maxMb={limits.maxVideoMb} label="Choose a video or drop it here"
        hint={`MP4, MOV, WebM, MKV, AVI · up to ${limits.maxVideoMb} MB and ${limits.maxVideoMinutes} minutes`} />
      <Field label="I want the video to be at most… (MB)">
        <input type="number" min="0.5" step="any" value={targetMb} onChange={(e) => setTargetMb(e.target.value)} disabled={busy} />
      </Field>
      <div className="chips">
        {CHIPS.map((mb) => <button type="button" key={mb} className="chip chip-btn" onClick={() => setTargetMb(String(mb))} disabled={busy}>{mb} MB</button>)}
      </div>
      <Field label="Resolution" hint="Auto picks the best resolution for your target size.">
        <Select value={resolution} onChange={setResolution} disabled={busy}
          options={[{ value: 'auto', label: 'Auto (recommended)' }, { value: '1080', label: 'Up to 1080p' }, { value: '720', label: 'Up to 720p' }, { value: '480', label: 'Up to 480p' }, { value: '360', label: 'Up to 360p' }]} />
      </Field>

      {busy && (
        <div className="progress-wrap" role="status">
          <div className="progress"><span style={{ width: `${stage === 'uploading' ? uploadPct : job?.progress || 3}%` }} /></div>
          <span className="muted small">{stage === 'uploading' ? `Uploading… ${uploadPct}%` : `Compressing… ${job?.progress || 0}% (${job?.status === 'queued' ? 'waiting in queue' : 'working'}). You can keep this tab open.`}</span>
        </div>
      )}
      {error && <div className="form-error" role="alert">{error}</div>}
      <button className="btn btn-accent" disabled={busy}>{busy ? 'Working…' : 'Compress video'}</button>
    </form>
  );
}
