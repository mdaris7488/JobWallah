import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container page narrow center">
      <h1>Page not found</h1>
      <p className="muted">The page you are looking for does not exist or was moved.</p>
      <Link className="btn btn-primary" to="/">Back to home</Link>
    </div>
  );
}
