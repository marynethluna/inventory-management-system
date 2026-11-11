import { AlertTriangle, ChevronLeft, ChevronRight, Inbox } from 'lucide-react';

export function PageHeader({ title, description, children }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="page-head-actions no-print">{children}</div>}
    </div>
  );
}

export function StatCard({ label, value, icon: Icon, tone = 'default', sub, onClick }) {
  const className = ['stat-card', tone !== 'default' ? tone : ''].filter(Boolean).join(' ');
  const content = (
    <>
      <div className="stat-top">
        <div>
          <div className="stat-label">{label}</div>
          <div className="stat-value">{value}</div>
        </div>
        {Icon && (
          <div className="stat-icon">
            <Icon size={17} strokeWidth={1.9} />
          </div>
        )}
      </div>
      {sub && <div className="stat-sub">{sub}</div>}
    </>
  );
  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick} style={{ textAlign: 'left', cursor: 'pointer' }}>
        {content}
      </button>
    );
  }
  return <div className={className}>{content}</div>;
}

export function StatusBadge({ status }) {
  const map = {
    'In Stock': 'status-in',
    'Low Stock': 'status-low',
    'Out of Stock': 'status-out',
  };
  return <span className={`status-pill ${map[status] || ''}`}>{status}</span>;
}

export function Badge({ children, tone = 'neutral', dot = true, className = '' }) {
  return <span className={`badge badge-${tone} ${dot ? '' : 'no-dot'} ${className}`.trim()}>{children}</span>;
}

export function RoleBadge({ role }) {
  const tone = role === 'Administrator' ? 'orange' : role === 'Inventory Staff' ? 'info' : 'neutral';
  const dotClass = role === 'Administrator' ? 'admin' : role === 'Inventory Staff' ? 'staff' : 'viewer';
  return (
    <span className={`badge badge-${tone} no-dot`}>
      <span className={`role-dot ${dotClass}`} />
      {role}
    </span>
  );
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <Icon size={22} strokeWidth={1.7} />
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {action && <div style={{ marginTop: 6 }}>{action}</div>}
    </div>
  );
}

export function LoadingState({ label = 'Loading records…', rows = 5, columns = 5 }) {
  return (
    <div>
      <div className="loading-block">
        <span className="spinner" />
        <span>{label}</span>
      </div>
      <div aria-hidden="true">
        {Array.from({ length: rows }).map((_, rowIndex) => (
          <div className="skeleton-row" key={rowIndex}>
            {Array.from({ length: columns }).map((__, colIndex) => (
              <div
                className="skeleton"
                key={colIndex}
                style={{ flex: colIndex === 0 ? 2 : 1, height: 11, marginTop: 2 }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function Pagination({ page = 1, pages = 1, total = 0, limit = 10, onPageChange, label = 'records' }) {
  if (!total) return null;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  const numbers = [];
  for (let index = 1; index <= pages; index += 1) {
    if (index === 1 || index === pages || Math.abs(index - page) <= 1) numbers.push(index);
    else if (numbers[numbers.length - 1] !== '…') numbers.push('…');
  }
  return (
    <div className="table-footer">
      <div className="info">
        Showing <strong>{start}</strong>–<strong>{end}</strong> of <strong>{total}</strong> {label}
      </div>
      <div className="pagination">
        <button type="button" className="page-btn" onClick={() => onPageChange(page - 1)} disabled={page <= 1} aria-label="Previous page">
          <ChevronLeft size={14} />
        </button>
        {numbers.map((number, index) =>
          number === '…' ? (
            <span key={`gap-${index}`} className="page-btn" style={{ border: 'none', cursor: 'default' }}>
              …
            </span>
          ) : (
            <button
              type="button"
              key={number}
              className={`page-btn ${number === page ? 'active' : ''}`}
              onClick={() => onPageChange(number)}
              aria-current={number === page ? 'page' : undefined}
            >
              {number}
            </button>
          )
        )}
        <button type="button" className="page-btn" onClick={() => onPageChange(page + 1)} disabled={page >= pages} aria-label="Next page">
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export function AlertNote({ tone = 'warning', title, children, icon: Icon = AlertTriangle }) {
  return (
    <div className={`login-note ${tone === 'danger' ? 'danger' : ''}`} style={tone === 'danger' ? { background: 'var(--danger-soft)', borderLeftColor: 'var(--danger)', color: 'var(--danger)' } : undefined}>
      <Icon size={15} style={{ marginTop: 1, flexShrink: 0 }} />
      <div>
        {title && <strong style={{ display: 'block', marginBottom: 1 }}>{title}</strong>}
        {children}
      </div>
    </div>
  );
}

export function SectionCard({ title, description, icon: Icon, actions, children, className = '', bodyClassName = '', style }) {
  return (
    <section className={`card ${className}`.trim()} style={style}>
      {(title || actions) && (
        <div className="card-head">
          <div>
            <h2>
              {Icon && <Icon size={16} style={{ color: 'var(--orange-deep)' }} />}
              {title}
            </h2>
            {description && <p>{description}</p>}
          </div>
          {actions && <div className="head-actions">{actions}</div>}
        </div>
      )}
      <div className={bodyClassName}>{children}</div>
    </section>
  );
}
