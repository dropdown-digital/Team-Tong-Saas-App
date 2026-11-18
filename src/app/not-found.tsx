import Link from "next/link";
export default function NotFound() {
  return (
    <>
      <h1>Off the pitch.</h1>
      <p>This page doesn’t exist.</p>
      <Link className="button" href="/">
        Return to the clubhouse
      </Link>
    </>
  );
}
