import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';

export default function ApiListPage({ title, endpoint, collection, columns, rowKey = '_id', actions, detailPath, searchParam }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [search, setSearch] = useState('');
  const [appliedSearch, setAppliedSearch] = useState('');

  const load = useCallback(async (requestedPage = 1, requestedSearch = appliedSearch) => {
    setLoading(true);
    setError('');
    try {
      const params = { page: requestedPage, limit: 20 };
      if (searchParam && requestedSearch.trim()) params[searchParam] = requestedSearch.trim();
      const response = await api.get(endpoint, { params });
      const data = response.data?.data;
      const records = collection ? data?.[collection] : data;
      if (!Array.isArray(records)) {
        throw new Error(`Unexpected response from ${endpoint}.`);
      }
      setItems(records);
      setPage(data?.pagination?.page || data?.page || requestedPage);
      setPages(data?.pagination?.totalPages || data?.pages || 1);
    } catch (requestError) {
      setError(requestError.response?.data?.message || requestError.message || 'Unable to load records.');
    } finally {
      setLoading(false);
    }
  }, [endpoint, collection, searchParam, appliedSearch]);

  useEffect(() => {
    load(1);
  }, [load]);

  const runAction = async (action, item) => {
    setError('');
    try {
      await action.run(item);
      await load(page);
    } catch (actionError) {
      setError(actionError.response?.data?.message || actionError.message || 'The action failed.');
    }
  };

  const submitSearch = (event) => {
    event.preventDefault();
    setAppliedSearch(search);
    setPage(1);
  };

  return (
    <section className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <h2 className="card-title">{title}</h2>
        <button type="button" className="btn" onClick={() => load(page)} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      {searchParam && (
        <form onSubmit={submitSearch} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            aria-label={`Search ${title.toLowerCase()}`}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={`Search ${title.toLowerCase()}`}
          />
          <button type="submit" className="btn" disabled={loading}>Search</button>
        </form>
      )}
      {error && <p role="alert" style={{ color: 'var(--danger)' }}>{error}</p>}
      {loading ? <p role="status">Loading {title.toLowerCase()}…</p> : (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                {columns.map((column) => <th key={column.label}>{column.label}</th>)}
                {(actions?.length > 0 || detailPath) && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr><td colSpan={columns.length + (actions?.length || detailPath ? 1 : 0)} style={{ textAlign: 'center' }}>No {title.toLowerCase()} found</td></tr>
              ) : items.map((item, index) => (
                <tr key={item[rowKey] || item.id || index}>
                  {columns.map((column) => (
                    <td key={column.label}>{column.render ? column.render(item) : column.path.split('.').reduce((value, key) => value?.[key], item) ?? '—'}</td>
                  ))}
                  {(actions?.length > 0 || detailPath) && (
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {detailPath && (
                          <button
                            type="button"
                            className="btn"
                            onClick={() => navigate(typeof detailPath === 'function' ? detailPath(item) : `${detailPath}/${item[rowKey] || item.id}`)}
                          >
                            Details
                          </button>
                        )}
                        {(actions || []).map((action) => (
                          <button
                            key={action.label}
                            type="button"
                            className="btn"
                            disabled={loading || action.disabled?.(item)}
                            onClick={() => runAction(action, item)}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {!loading && pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 16 }}>
          <button type="button" className="btn" onClick={() => load(page - 1)} disabled={page <= 1}>Previous</button>
          <span>Page {page} of {pages}</span>
          <button type="button" className="btn" onClick={() => load(page + 1)} disabled={page >= pages}>Next</button>
        </div>
      )}
    </section>
  );
}
