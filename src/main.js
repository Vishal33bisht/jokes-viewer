const API_URL = 'https://api.freeapi.app/api/v1/public/randomjokes';
const PAGE_SIZE = 10;

const state = {
  jokes: [],
  pageInfo: {
    page: 1,
    totalPages: 1,
    totalItems: 0,
    nextPage: false,
    previousPage: false,
  },
  query: '',
  hideExplicit: true,
  loading: true,
  error: '',
  copiedId: null,
};

const root = document.querySelector('#root');

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function normalizeJokes(payload) {
  const data = payload?.data;
  const jokes = Array.isArray(data?.data) ? data.data : [];

  return {
    jokes: jokes.map((joke) => ({
      id: joke.id,
      content: String(joke.content || '').trim(),
      categories: Array.isArray(joke.categories) ? joke.categories : [],
    })),
    page: data?.page || 1,
    totalPages: data?.totalPages || 1,
    totalItems: data?.totalItems || jokes.length,
    nextPage: Boolean(data?.nextPage),
    previousPage: Boolean(data?.previousPage),
  };
}

function getFilteredJokes() {
  const normalizedQuery = state.query.trim().toLowerCase();

  return state.jokes.filter((joke) => {
    const isExplicit = joke.categories.some((category) => category.toLowerCase() === 'explicit');
    const matchesSafety = state.hideExplicit ? !isExplicit : true;
    const matchesQuery = normalizedQuery
      ? joke.content.toLowerCase().includes(normalizedQuery) ||
        joke.categories.some((category) => category.toLowerCase().includes(normalizedQuery))
      : true;

    return matchesSafety && matchesQuery;
  });
}

function renderTags(joke) {
  if (!joke.categories.length) {
    return '<span class="tag quiet">clean-ish</span>';
  }

  return `
    <div class="tags">
      ${joke.categories
        .map((category) => `<span class="tag">${escapeHtml(category)}</span>`)
        .join('')}
    </div>
  `;
}

function renderJokeCard(joke, featured = false) {
  return `
    <article class="joke-card ${featured ? 'featured-card' : ''}">
      <div class="joke-meta">
        <span class="joke-number">#${escapeHtml(joke.id)}</span>
        ${renderTags(joke)}
      </div>
      <p>${escapeHtml(joke.content)}</p>
      <button class="icon-button copy-button" type="button" data-copy-id="${escapeHtml(joke.id)}">
        <span>${state.copiedId === joke.id ? 'Copied' : 'Copy joke'}</span>
      </button>
    </article>
  `;
}

function renderLoading() {
  return `
    <section class="joke-grid" aria-label="Loading jokes">
      ${Array.from({ length: 6 }, () => '<div class="skeleton-card"></div>').join('')}
    </section>
  `;
}

function renderNotice(type, title, message) {
  return `
    <section class="notice ${type === 'error' ? 'error' : ''}" role="${type === 'error' ? 'alert' : 'status'}">
      <span class="notice-icon" aria-hidden="true">${type === 'error' ? '!' : 'i'}</span>
      <div>
        <strong>${escapeHtml(title)}</strong>
        <p>${escapeHtml(message)}</p>
      </div>
    </section>
  `;
}

function renderJokes() {
  const filteredJokes = getFilteredJokes();
  const featuredJoke = filteredJokes[0];
  const listJokes = filteredJokes.slice(1);

  if (state.loading) {
    return renderLoading();
  }

  if (!filteredJokes.length) {
    return renderNotice('empty', 'No jokes match those filters', 'Try a different search or show all joke categories.');
  }

  return `
    <section class="content-grid">
      <div class="featured-column">
        <div class="section-title">
          <span class="mini-icon" aria-hidden="true">?</span>
          <span>First laugh on this page</span>
        </div>
        ${renderJokeCard(featuredJoke, true)}
      </div>

      <div class="joke-list" aria-label="Jokes">
        ${listJokes.map((joke) => renderJokeCard(joke)).join('')}
      </div>
    </section>
  `;
}

function render() {
  root.innerHTML = `
    <main class="app-shell">
      <section class="hero">
        <div class="hero-copy">
          <div class="eyebrow">
            <span class="mini-icon" aria-hidden="true">API</span>
            Random Jokes API
          </div>
          <h1>Jokes Viewer</h1>
          <p>
            Browse a live feed of jokes, filter the noisy bits, search the current page,
            and copy anything that lands.
          </p>
        </div>
        <div class="hero-stats" aria-label="Joke feed summary">
          <span>${state.pageInfo.totalItems.toLocaleString()}</span>
          <small>jokes available</small>
        </div>
      </section>

      <section class="toolbar" aria-label="Joke controls">
        <label class="search-box">
          <span aria-hidden="true">Search</span>
          <input
            id="searchInput"
            type="search"
            placeholder="Search jokes or tags"
            value="${escapeHtml(state.query)}"
          />
        </label>

        <button class="toggle-button ${state.hideExplicit ? 'active' : ''}" id="toggleExplicit" type="button">
          <span>${state.hideExplicit ? 'Explicit hidden' : 'All jokes shown'}</span>
        </button>

        <button class="primary-button" id="refreshButton" type="button" ${state.loading ? 'disabled' : ''}>
          <span>Refresh</span>
        </button>
      </section>

      ${state.error ? renderNotice('error', 'Could not load jokes', state.error) : ''}
      ${renderJokes()}

      <footer class="pager" aria-label="Pagination">
        <button id="previousPage" type="button" ${state.loading || !state.pageInfo.previousPage ? 'disabled' : ''}>
          Previous
        </button>
        <span>
          Page <strong>${state.pageInfo.page}</strong> of ${state.pageInfo.totalPages}
        </span>
        <button id="nextPage" type="button" ${state.loading || !state.pageInfo.nextPage ? 'disabled' : ''}>
          Next
        </button>
      </footer>
    </main>
  `;

  bindEvents();
}

function bindEvents() {
  document.querySelector('#searchInput')?.addEventListener('input', (event) => {
    state.query = event.target.value;
    render();
    document.querySelector('#searchInput')?.focus();
  });

  document.querySelector('#toggleExplicit')?.addEventListener('click', () => {
    state.hideExplicit = !state.hideExplicit;
    render();
  });

  document.querySelector('#refreshButton')?.addEventListener('click', () => {
    loadJokes(state.pageInfo.page);
  });

  document.querySelector('#previousPage')?.addEventListener('click', () => {
    loadJokes(state.pageInfo.page - 1);
  });

  document.querySelector('#nextPage')?.addEventListener('click', () => {
    loadJokes(state.pageInfo.page + 1);
  });

  document.querySelectorAll('[data-copy-id]').forEach((button) => {
    button.addEventListener('click', () => {
      const joke = state.jokes.find((item) => String(item.id) === button.dataset.copyId);
      copyJoke(joke);
    });
  });
}

async function copyJoke(joke) {
  if (!joke) return;

  try {
    await navigator.clipboard.writeText(joke.content);
    state.copiedId = joke.id;
    render();
    window.setTimeout(() => {
      state.copiedId = null;
      render();
    }, 1600);
  } catch {
    state.copiedId = null;
  }
}

async function loadJokes(targetPage = 1) {
  const boundedPage = Math.max(targetPage, 1);
  state.loading = true;
  state.error = '';
  render();

  try {
    const response = await fetch(`${API_URL}?page=${boundedPage}&limit=${PAGE_SIZE}`);
    const payload = await response.json();

    if (!response.ok || payload?.success === false) {
      throw new Error(payload?.message || 'Unable to fetch jokes right now.');
    }

    const normalized = normalizeJokes(payload);
    state.jokes = normalized.jokes;
    state.pageInfo = {
      page: normalized.page,
      totalPages: normalized.totalPages,
      totalItems: normalized.totalItems,
      nextPage: normalized.nextPage,
      previousPage: normalized.previousPage,
    };
  } catch (error) {
    state.jokes = [];
    state.error = error.message || 'Something went wrong while loading jokes.';
  } finally {
    state.loading = false;
    render();
  }
}

render();
loadJokes();
