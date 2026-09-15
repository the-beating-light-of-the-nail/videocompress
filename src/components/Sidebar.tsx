import { PlayIcon } from './Icons';
import { TOOL_GROUPS } from '../tools/nav';
import { currentPath, goHomeAnchor, navigate, useRoute } from '../lib/router';

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  useRoute(); // re-render on route change so the active item updates
  const path = currentPath();
  const body = (
    <>
      <div className="sidebar-head">
        <span className="logo-mark">
          <PlayIcon size={11} />
        </span>
        VideoCompress
      </div>
      <nav>
        {TOOL_GROUPS.map((g) => (
          <div className="nav-group" key={g.id}>
            <div className="nav-group-title">{g.title}</div>
            {g.items.map((it) => (
              <a
                key={it.path}
                className={`nav-item${path === it.path ? ' active' : ''}`}
                href={it.path === '/' ? '#/' : `#${it.path}`}
                onClick={onClose}
              >
                <span className="dot" />
                {it.label}
              </a>
            ))}
          </div>
        ))}
        <div className="nav-group">
          <div className="nav-group-title">资源</div>
          <a
            className="nav-item"
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              onClose();
              goHomeAnchor('faq');
            }}
          >
            <span className="dot" />
            常见问题
          </a>
          <a className="nav-item" href="#/pricing" onClick={onClose}>
            <span className="dot" />
            价格
          </a>
          <a className="nav-item" href="#/blog" onClick={onClose}>
            <span className="dot" />
            博客
          </a>
        </div>
      </nav>
      <a
        className="sidebar-cta"
        href="#/"
        onClick={(e) => {
          e.preventDefault();
          onClose();
          navigate('/');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      >
        开始使用
      </a>
    </>
  );

  return (
    <>
      <aside className={`sidebar${open ? ' open' : ''}`}>{body}</aside>
      {open && <div className="scrim" onClick={onClose} />}
    </>
  );
}
