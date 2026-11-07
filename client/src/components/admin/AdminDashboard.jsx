import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FEEDBACK_TYPES, RATING_OPTIONS } from '../../utils/feedbackForm.js';
import {
  adminApi, createFeedbackQuery, downloadFeedbackCsv, formatFeedbackDate, AdminApiError,
} from '../../services/adminApi.js';
import './admin.css';

const EMPTY_FILTERS = {
  keyword: '',
  startDate: '',
  endDate: '',
  feedbackType: '',
  rating: '',
  sort: 'newest',
};

function formatCount(value) {
  return new Intl.NumberFormat().format(value ?? 0);
}

function StatCard({ label, value, detail, icon, loading }) {
  return (
    <article className="stat-card">
      <div className={`stat-icon stat-icon-${icon}`} aria-hidden="true">
        {icon === 'total' && <svg viewBox="0 0 24 24" fill="none"><path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4.2A2.5 2.5 0 0 1 5 12.5v-6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><path d="M9 9h6M9 12h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>}
        {icon === 'today' && <svg viewBox="0 0 24 24" fill="none"><rect x="4" y="5.5" width="16" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.6" /><path d="M8 3.5v4M16 3.5v4M4 9.5h16m-11 4h2m3 0h2m-7 3h2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg>}
        {icon === 'week' && <svg viewBox="0 0 24 24" fill="none"><path d="M4 18.5h16M6.5 15V9m5.5 6V5m5.5 10v-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
      </div>
      <p className="stat-label">{label}</p>
      <p className="stat-value">{value === null ? (loading ? <span className="skeleton-value" aria-label="Loading" /> : '—') : formatCount(value)}</p>
      <p className="stat-detail">{detail}</p>
    </article>
  );
}

function DistributionList({ title, subtitle, items = [], labelKey, tone, loading }) {
  const maximum = Math.max(1, ...items.map((item) => item.count));
  return (
    <section className="chart-card" aria-labelledby={`${tone}-chart-title`}>
      <div className="chart-title-row">
        <div><h3 id={`${tone}-chart-title`}>{title}</h3><p>{subtitle}</p></div>
      </div>
      {loading ? <div className="chart-skeleton" role="status">Loading chart data…</div> : (
        items.length === 0 ? <p className="chart-empty">No distribution data available.</p> : <ul className="distribution-list">
          {items.map((item) => (
            <li key={item[labelKey]}>
              <div className="distribution-label"><span>{item[labelKey]}</span><strong>{formatCount(item.count)}</strong></div>
              <div className="distribution-track" aria-hidden="true">
                <span className={`distribution-fill fill-${tone}`} style={{ width: `${Math.max(item.count ? 3 : 0, (item.count / maximum) * 100)}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function VolumeChart({ items = [], loading }) {
  const total = useMemo(() => (items || []).reduce((sum, item) => sum + item.count, 0), [items]);
  const peak = useMemo(() => (items || []).reduce((best, item) => item.count > (best?.count ?? -1) ? item : best, null), [items]);
  const maximum = Math.max(1, ...(items || []).map((item) => item.count));
  const submittedDates = useMemo(() => (items || []).filter((item) => item.count > 0), [items]);
  return (
    <section className="chart-card volume-chart" aria-labelledby="volume-chart-title">
      <div className="chart-title-row">
        <div><h3 id="volume-chart-title">Feedback activity</h3><p>Daily submissions · last 30 UTC days</p></div>
        {!loading && <span className="chart-total">{formatCount(total)} <small>total</small></span>}
      </div>
      {loading ? <div className="chart-skeleton" role="status">Loading chart data…</div> : items.length === 0 ? (
        <p className="chart-empty">No chart data available.</p>
      ) : (
        <>
          <p className="chart-summary">
            {total === 0 ? 'No feedback received in this period.' : `Most active: ${peak.date} with ${formatCount(peak.count)} submission${peak.count === 1 ? '' : 's'}.`}
          </p>
          <div className="volume-bars" aria-hidden="true">
            {items.map((item) => (
              <span
                key={item.date}
                className="volume-bar"
                title={`${item.date}: ${item.count}`}
                style={{ height: item.count ? `${Math.max(7, (item.count / maximum) * 100)}%` : '2px' }}
              />
            ))}
          </div>
          <div className="volume-axis"><span>{items[0].date}</span><span>{items[Math.floor(items.length / 2)].date}</span><span>{items.at(-1).date} · UTC</span></div>
          <details className="volume-data">
            <summary>View daily counts as a table</summary>
            <div className="volume-table-wrap">
              <table><thead><tr><th scope="col">UTC date</th><th scope="col">Submissions</th></tr></thead>
                <tbody>{submittedDates.length > 0 ? submittedDates.map((item) => <tr key={item.date}><td>{item.date}</td><td>{formatCount(item.count)}</td></tr>) : <tr><td colSpan="2">No submissions in this period.</td></tr>}</tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}

function RatingLabel({ rating }) {
  return RATING_OPTIONS.find((option) => option.value === rating)?.label || `Rating ${rating}`;
}

function FeedbackCard({ item, onDelete }) {
  const ratingText = RATING_OPTIONS.find((option) => option.value === item.rating)?.label || `Rating ${item.rating}`;
  return (
    <article className="feedback-card" aria-labelledby={`feedback-${item.id}`}>
      <div className="feedback-card-top">
        <div className="feedback-author">
          <span className="avatar-initial" aria-hidden="true">{item.name.trim().charAt(0).toUpperCase() || '?'}</span>
          <div><h3 id={`feedback-${item.id}`}>{item.name}</h3><a href={`mailto:${item.email}`}>{item.email}</a></div>
        </div>
        <time dateTime={item.createdAt}>{formatFeedbackDate(item.createdAt)}</time>
      </div>
      <div className="feedback-meta">
        <span className="type-pill">{item.feedbackType}</span>
        <span className="rating-pill" aria-label={`Rating ${item.rating} out of 5, ${ratingText}`}>
          <span aria-hidden="true">★</span> {item.rating}/5 · <RatingLabel rating={item.rating} />
        </span>
      </div>
      <p className="feedback-message">{item.message.length > 320 ? `${item.message.slice(0, 320)}…` : item.message}</p>
      <div className="feedback-card-actions">
        <button className="delete-button" type="button" onClick={() => onDelete(item)} aria-label={`Delete feedback from ${item.name}`}>
          <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4.5 6h11m-9.5 0 .6 10h7.8L15 6m-7-2h4l.7 2H7.3L8 4Zm1.5 5v4m2-4v4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
          Delete
        </button>
      </div>
    </article>
  );
}

function DeleteDialog({ item, busy, error, onCancel, onConfirm }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (item && dialog && !dialog.open) dialog.showModal();
    if (!item && dialog?.open) dialog.close();
  }, [item]);

  return (
    <dialog
      ref={dialogRef}
      className="delete-dialog"
      aria-labelledby="delete-dialog-title"
      aria-describedby="delete-dialog-description"
      onCancel={(event) => { event.preventDefault(); if (!busy) onCancel(); }}
    >
      {item && (
        <div className="dialog-content">
          <span className="dialog-warning-icon" aria-hidden="true">!</span>
          <p className="admin-eyebrow">PERMANENT ACTION</p>
          <h2 id="delete-dialog-title">Delete this feedback?</h2>
          <p id="delete-dialog-description" className="dialog-description">
            This will permanently delete the feedback from <strong>{item.name}</strong> ({item.email}).
            This action cannot be undone.
          </p>
          {error && <p className="admin-alert" role="alert">{error}</p>}
          <div className="dialog-actions">
            <button className="admin-secondary-button" type="button" autoFocus disabled={busy} onClick={onCancel}>Cancel</button>
            <button className="danger-button" type="button" disabled={busy} onClick={onConfirm}>
              {busy ? 'Deleting…' : 'Delete feedback'}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}

export default function AdminDashboard({ admin, onSessionExpired }) {
  const [stats, setStats] = useState(null);
  const [charts, setCharts] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overviewError, setOverviewError] = useState('');
  const [filterValues, setFilterValues] = useState(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState(EMPTY_FILTERS);
  const [dateError, setDateError] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [listResult, setListResult] = useState(null);
  const [listLoading, setListLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [listVersion, setListVersion] = useState(0);
  const [overviewVersion, setOverviewVersion] = useState(0);
  const [notice, setNotice] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [exportBusy, setExportBusy] = useState(false);

  const loadOverview = useCallback(async (signal) => {
    setOverviewLoading(true);
    setOverviewError('');
    try {
      const [statsResult, chartsResult] = await Promise.all([
        adminApi('/api/admin/dashboard/stats', { signal }),
        adminApi('/api/admin/dashboard/charts', { signal }),
      ]);
      setStats(statsResult.data);
      setCharts(chartsResult.data);
    } catch (error) {
      if (error.name === 'AbortError') return;
      if (error instanceof AdminApiError && error.status === 401) onSessionExpired();
      else setOverviewError(error.message || 'Dashboard data could not be loaded.');
    } finally {
      if (!signal?.aborted) setOverviewLoading(false);
    }
  }, [onSessionExpired]);

  useEffect(() => {
    const controller = new AbortController();
    loadOverview(controller.signal);
    return () => controller.abort();
  }, [loadOverview, overviewVersion]);

  useEffect(() => {
    const controller = new AbortController();
    setListLoading(true);
    setListError('');
    const query = createFeedbackQuery({ filters: appliedFilters, page, limit });
    adminApi(`/api/admin/feedback?${query}`, { signal: controller.signal })
      .then((result) => {
        setListResult(result);
        if (result.pagination.currentPage !== page) setPage(result.pagination.currentPage);
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        if (error instanceof AdminApiError && error.status === 401) onSessionExpired();
        else setListError(error.message || 'Feedback could not be loaded.');
      })
      .finally(() => { if (!controller.signal.aborted) setListLoading(false); });
    return () => controller.abort();
  }, [appliedFilters, page, limit, listVersion, onSessionExpired]);

  function updateFilter(event) {
    const { name, value } = event.target;
    setFilterValues((current) => ({ ...current, [name]: value }));
  }

  function applyFilters(event) {
    event.preventDefault();
    if (filterValues.startDate && filterValues.endDate && filterValues.startDate > filterValues.endDate) {
      setDateError('Start date must be on or before the end date.');
      return;
    }
    setDateError('');
    setPage(1);
    setAppliedFilters({ ...filterValues });
    setNotice('');
  }

  function clearFilters() {
    setFilterValues(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
    setDateError('');
    setPage(1);
    setNotice('');
  }

  async function deleteFeedback() {
    if (!deleteTarget || deleteBusy) return;
    setDeleteBusy(true);
    setDeleteError('');
    try {
      await adminApi(`/api/admin/feedback/${deleteTarget.id}`, { method: 'DELETE' });
      setDeleteTarget(null);
      setNotice(`Feedback from ${deleteTarget.name} was deleted.`);
      setListVersion((version) => version + 1);
      setOverviewVersion((version) => version + 1);
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) onSessionExpired();
      else setDeleteError(error.message || 'Feedback could not be deleted.');
    } finally {
      setDeleteBusy(false);
    }
  }

  async function logout() {
    if (logoutBusy) return;
    setLogoutBusy(true);
    try {
      await adminApi('/api/auth/logout', { method: 'POST', body: '{}' });
      onSessionExpired();
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) onSessionExpired();
      else setNotice(error.message || 'Could not sign out. Try again.');
    } finally {
      setLogoutBusy(false);
    }
  }

  async function exportCsv() {
    if (exportBusy) return;
    setExportBusy(true);
    setNotice('');
    try {
      const filename = await downloadFeedbackCsv(appliedFilters);
      setNotice(`Download started: ${filename}`);
    } catch (error) {
      if (error instanceof AdminApiError && error.status === 401) onSessionExpired();
      else setNotice(error.message || 'The export could not be created.');
    } finally {
      setExportBusy(false);
    }
  }

  const activeFilterCount = useMemo(
    () => ['keyword', 'startDate', 'endDate', 'feedbackType', 'rating'].filter((key) => appliedFilters[key]).length,
    [appliedFilters],
  );
  const feedbackRows = listResult?.data || [];
  const pagination = listResult?.pagination;

  return (
    <div className="admin-shell">
      <header className="admin-header">
        <a className="admin-brand" href="/admin" aria-label="Penthara Technologies feedback dashboard">
          <span className="admin-brand-mark" aria-hidden="true"><i /><i /><i /><i /></span>
          <span className="admin-brand-lockup"><strong>Penthara Technologies</strong><small>FEEDBACK ADMIN</small></span>
        </a>
        <div className="admin-header-actions">
          <a className="admin-public-link" href="/">View public form <span aria-hidden="true">↗</span></a>
          <span className="admin-divider" aria-hidden="true" />
          <span className="admin-identity"><span className="identity-avatar" aria-hidden="true">{admin.email[0].toUpperCase()}</span><span>{admin.email}</span></span>
          <button className="logout-button" type="button" onClick={logout} disabled={logoutBusy}>{logoutBusy ? 'Signing out…' : 'Sign out'}</button>
        </div>
      </header>

      <main className="admin-main">
        <section className="dashboard-heading">
          <div><p className="admin-eyebrow">OVERVIEW</p><h1>Feedback dashboard</h1><p>Understand what people are saying and where to focus next.</p></div>
          <button className="admin-secondary-button refresh-button" type="button" onClick={() => { setOverviewVersion((version) => version + 1); setListVersion((version) => version + 1); }}>
            <svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M16 7.5A6.5 6.5 0 0 0 4.8 5L3.5 6.5M4 12.5A6.5 6.5 0 0 0 15.2 15l1.3-1.5M3.5 3.5v3h3m10 10v-3h-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Refresh data
          </button>
        </section>

        {notice && <div className="admin-toast" role="status"><span aria-hidden="true">✓</span>{notice}<button type="button" aria-label="Dismiss message" onClick={() => setNotice('')}>×</button></div>}
        {overviewError && <div className="admin-alert dashboard-alert" role="alert"><span>{overviewError}</span><button className="text-button" type="button" onClick={() => setOverviewVersion((version) => version + 1)}>Retry</button></div>}

        <section className="stats-grid" aria-label="Feedback summary">
          <StatCard label="Total feedback" value={stats?.totalFeedback ?? null} detail="All submissions" icon="total" loading={overviewLoading} />
          <StatCard label="Today" value={stats?.todayFeedback ?? null} detail="UTC calendar day" icon="today" loading={overviewLoading} />
          <StatCard label="This week" value={stats?.thisWeekFeedback ?? null} detail="Monday to today · UTC" icon="week" loading={overviewLoading} />
        </section>

        <section className="charts-grid" aria-label="Feedback charts">
          <VolumeChart items={charts?.feedbackVolume} loading={overviewLoading} />
          <DistributionList title="Ratings" subtitle="Experience score · out of 5" items={charts?.ratingDistribution || []} labelKey="rating" tone="rating" loading={overviewLoading} />
          <DistributionList title="Feedback types" subtitle="What people are telling us" items={charts?.feedbackTypeDistribution || []} labelKey="feedbackType" tone="type" loading={overviewLoading} />
        </section>

        <section className="feedback-section" aria-labelledby="feedback-list-title">
          <div className="section-heading-row">
            <div><p className="admin-eyebrow">INBOX</p><h2 id="feedback-list-title">Feedback submissions</h2><p>Search, filter, and review incoming feedback.</p></div>
            <div className="section-tools">
              {pagination && <span className="record-count">{formatCount(pagination.totalRecords)} {pagination.totalRecords === 1 ? 'record' : 'records'}</span>}
              <button className="export-button" type="button" onClick={exportCsv} disabled={exportBusy} title="Download all matching records, not only this page">
                {exportBusy ? 'Preparing…' : 'Export CSV'}
              </button>
            </div>
          </div>

          <form className="filter-panel" onSubmit={applyFilters}>
            <div className="filter-grid">
              <div className="admin-field filter-keyword">
                <label htmlFor="filter-keyword">Search feedback</label>
                <div className="search-input-wrap"><svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="8.8" cy="8.8" r="5.8" stroke="currentColor" strokeWidth="1.5" /><path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
                  <input id="filter-keyword" name="keyword" value={filterValues.keyword} onChange={updateFilter} placeholder="Name, email, or message" maxLength={100} />
                </div>
              </div>
              <div className="admin-field"><label htmlFor="filter-start-date">From date <span>UTC</span></label><input id="filter-start-date" name="startDate" type="date" value={filterValues.startDate} onChange={updateFilter} /></div>
              <div className="admin-field"><label htmlFor="filter-end-date">To date <span>UTC</span></label><input id="filter-end-date" name="endDate" type="date" value={filterValues.endDate} onChange={updateFilter} aria-invalid={Boolean(dateError)} aria-describedby={dateError ? 'filter-date-error' : undefined} /></div>
              <div className="admin-field"><label htmlFor="filter-type">Type</label><select id="filter-type" name="feedbackType" value={filterValues.feedbackType} onChange={updateFilter}><option value="">All types</option>{FEEDBACK_TYPES.map((type) => <option key={type}>{type}</option>)}</select></div>
              <div className="admin-field"><label htmlFor="filter-rating">Rating</label><select id="filter-rating" name="rating" value={filterValues.rating} onChange={updateFilter}><option value="">All ratings</option>{RATING_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{value} · {label}</option>)}</select></div>
              <div className="admin-field"><label htmlFor="filter-sort">Sort by</label><select id="filter-sort" name="sort" value={filterValues.sort} onChange={updateFilter}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></div>
            </div>
            {dateError && <p className="admin-field-error" id="filter-date-error">{dateError}</p>}
            <div className="filter-actions">
              <span className="filter-hint">{activeFilterCount ? `${activeFilterCount} active ${activeFilterCount === 1 ? 'filter' : 'filters'}` : `Showing ${appliedFilters.sort === 'newest' ? 'newest' : 'oldest'} submissions`}</span>
              <div><button className="filter-clear" type="button" onClick={clearFilters}>Clear filters</button><button className="admin-primary-button apply-filters" type="submit">Apply filters</button></div>
            </div>
          </form>

          {listError && <div className="admin-alert list-alert" role="alert"><span>{listError}</span><button className="text-button" type="button" onClick={() => setListVersion((version) => version + 1)}>Retry</button></div>}
          {listLoading ? (
            <div className="feedback-loading" role="status"><span className="admin-spinner" aria-hidden="true" /> Loading feedback…</div>
          ) : feedbackRows.length === 0 ? (
            <div className="feedback-empty"><span className="empty-icon" aria-hidden="true">⌕</span><h3>{activeFilterCount ? 'No matching feedback' : 'No feedback yet'}</h3><p>{activeFilterCount ? 'Try adjusting your filters or clear them to see all submissions.' : 'New submissions will appear here.'}</p>{activeFilterCount > 0 && <button className="admin-secondary-button" type="button" onClick={clearFilters}>Clear filters</button>}</div>
          ) : (
            <>
              <div className="feedback-list" aria-live="polite" aria-busy={listLoading}>
                {feedbackRows.map((item) => <FeedbackCard key={item.id} item={item} onDelete={(record) => { setDeleteTarget(record); setDeleteError(''); }} />)}
              </div>
              {pagination && pagination.totalRecords > 0 && (
                <nav className="pagination" aria-label="Feedback pages">
                  <div className="page-size-control"><label htmlFor="page-size">Rows per page</label><select id="page-size" value={limit} onChange={(event) => { setLimit(Number(event.target.value)); setPage(1); }}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></div>
                  <span className="page-summary">Page {pagination.currentPage} of {pagination.totalPages} <span>·</span> {formatCount(pagination.totalRecords)} total</span>
                  <div className="page-buttons"><button type="button" className="page-button" aria-label="Previous page" disabled={pagination.currentPage <= 1 || listLoading} onClick={() => setPage((current) => Math.max(1, current - 1))}>←</button><button type="button" className="page-button" aria-label="Next page" disabled={pagination.currentPage >= pagination.totalPages || listLoading} onClick={() => setPage((current) => current + 1)}>→</button></div>
                </nav>
              )}
            </>
          )}
        </section>

        <footer className="admin-footer"><span>Penthara Technologies · Feedback Portal</span><span>Dashboard dates and chart ranges use UTC.</span></footer>
      </main>

      <DeleteDialog item={deleteTarget} busy={deleteBusy} error={deleteError} onCancel={() => setDeleteTarget(null)} onConfirm={deleteFeedback} />
    </div>
  );
}
