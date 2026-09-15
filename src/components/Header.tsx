import { useEffect, useRef, useState } from 'react';
import { ChevronDown, MenuIcon, PlayIcon } from './Icons';
import { TOOL_GROUPS } from '../tools/nav';
import { goHomeAnchor, navigate } from '../lib/router';

export default function Header({ onMenu }: { onMenu: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  return (
    <header className="header">
      <div className="header-inner">
        <button className="menu-btn" aria-label="打开菜单" onClick={onMenu}>
          <MenuIcon size={20} />
        </button>
        <a
          className="header-logo"
          href="#/"
          onClick={(e) => {
            e.preventDefault();
            navigate('/');
            window.scrollTo({ top: 0 });
          }}
        >
          <span className="logo-mark">
            <PlayIcon size={11} />
          </span>
          VideoCompress
        </a>
        <nav className="header-nav">
          <div className="product-menu" ref={menuRef}>
            <button className="header-link" onClick={() => setMenuOpen((v) => !v)}>
              产品 <ChevronDown size={14} />
            </button>
            {menuOpen && (
              <div className="product-dropdown">
                {TOOL_GROUPS.map((g) => (
                  <div key={g.id}>
                    <div className="pd-group-title">{g.title}</div>
                    {g.items.map((it) => (
                      <a
                        key={it.path}
                        className="pd-item"
                        href={it.path === '/' ? '#/' : `#${it.path}`}
                        onClick={() => setMenuOpen(false)}
                      >
                        {it.label}
                      </a>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
          <a
            className="header-link"
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              goHomeAnchor('faq');
            }}
          >
            常见问题
          </a>
          <a
            className="header-link hide-m"
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              goHomeAnchor('features');
            }}
          >
            功能特性
          </a>
        </nav>
        <div className="header-right">
          <span className="lang-chip">简体中文</span>
          <button className="btn btn-ghost hide-m-login">登录</button>
          <a
            className="btn btn-primary"
            href="#/"
            onClick={(e) => {
              e.preventDefault();
              goHomeAnchor('compress');
            }}
          >
            免费使用
          </a>
        </div>
      </div>
    </header>
  );
}
