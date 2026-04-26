import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <section className="container empty-state">
      <h1>Page not found</h1>
      <p>The page you are looking for does not exist.</p>
      <Link className="btn btn-teal" to="/">
        Back home
      </Link>
    </section>
  );
}
