type DownloadFilenameLinkProps = {
  href: string;
  filename: string;
  className?: string;
};

export default function DownloadFilenameLink({
  href,
  filename,
  className = '',
}: DownloadFilenameLinkProps) {
  return (
    <a
      className={`link-primary fw-semibold text-decoration-none d-inline-flex align-items-center gap-2 ${className}`.trim()}
      href={href}
      download
      title={`Download ${filename}`}
      style={{ maxWidth: '100%' }}
    >
      <span aria-hidden="true">⬇️</span>
      <span style={{ overflowWrap: 'anywhere' }}>{filename}</span>
    </a>
  );
}
