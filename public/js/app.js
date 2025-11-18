// ===========================================================================
// Note Graph - Client Application
// Trace: TASK-017
// ===========================================================================

// ---------------------------------------------------------------------------
// API Service Layer
// ---------------------------------------------------------------------------
const API = {
  baseURL: '',

  async request(endpoint, options = {}) {
    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    // In development (localhost only), use test auth header
    if (!headers['Cf-Access-Authenticated-User-Email'] && window.location.hostname === 'localhost') {
      headers['X-Test-User-Email'] = 'test@example.com';
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '알 수 없는 오류가 발생했습니다' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  },

  async get(endpoint) {
    return this.request(endpoint);
  },

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async patch(endpoint, data) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
  },

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  },

  async uploadFile(endpoint, file, metadata = {}) {
    const formData = new FormData();
    formData.append('file', file);

    Object.entries(metadata).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        formData.append(key, value);
      }
    });

    const headers = {};
    // In development (localhost only), use test auth header
    if (!headers['Cf-Access-Authenticated-User-Email'] && window.location.hostname === 'localhost') {
      headers['X-Test-User-Email'] = 'test@example.com';
    }

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: '업로드 실패' }));
      throw new Error(error.message || `HTTP ${response.status}`);
    }

    return response.json();
  },

  // Auth
  getMe: () => API.get('/me'),

  // Work Notes
  getWorkNotes: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return API.get(`/work-notes${query ? '?' + query : ''}`);
  },
  getWorkNote: (workId) => API.get(`/work-notes/${workId}`),
  createWorkNote: (data) => API.post('/work-notes', data),
  updateWorkNote: (workId, data) => API.put(`/work-notes/${workId}`, data),
  deleteWorkNote: (workId) => API.delete(`/work-notes/${workId}`),

  // Persons
  getPersons: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return API.get(`/persons${query ? '?' + query : ''}`);
  },
  getPerson: (personId) => API.get(`/persons/${personId}`),
  createPerson: (data) => API.post('/persons', data),
  updatePerson: (personId, data) => API.put(`/persons/${personId}`, data),

  // Departments
  getDepartments: (params = {}) => {
    const query = new URLSearchParams(params).toString();
    return API.get(`/departments${query ? '?' + query : ''}`);
  },
  getDepartment: (deptName) => API.get(`/departments/${deptName}`),
  createDepartment: (data) => API.post('/departments', data),
  updateDepartment: (deptName, data) => API.put(`/departments/${deptName}`, data),

  // Todos
  getTodos: (view = 'today') => API.get(`/todos?view=${view}`),
  getWorkNoteTodos: (workId) => API.get(`/work-notes/${workId}/todos`),
  createTodo: (workId, data) => API.post(`/work-notes/${workId}/todos`, data),
  updateTodo: (todoId, data) => API.patch(`/todos/${todoId}`, data),

  // Search
  search: (query, filters = {}) => API.post('/search/work-notes', { query, ...filters }),

  // RAG
  ragQuery: (query, scope = 'GLOBAL', filters = {}) => API.post('/rag/query', { query, scope, ...filters }),

  // AI Draft
  generateDraft: (text, hints = {}) => API.post('/ai/work-notes/draft-from-text', { text, ...hints }),

  // PDF
  uploadPDF: (file, metadata = {}) => API.uploadFile('/pdf-jobs', file, metadata),
  getPDFJob: (jobId) => API.get(`/pdf-jobs/${jobId}`),
};

// ---------------------------------------------------------------------------
// UI Utilities
// ---------------------------------------------------------------------------
const UI = {
  showLoading() {
    document.getElementById('loading-overlay').classList.remove('hidden');
  },

  hideLoading() {
    document.getElementById('loading-overlay').classList.add('hidden');
  },

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);

    setTimeout(() => {
      toast.remove();
    }, 3000);
  },

  formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', { year: 'numeric', month: '2-digit', day: '2-digit' });
  },

  formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },
};

// ---------------------------------------------------------------------------
// Page Renderer
// ---------------------------------------------------------------------------
const Pages = {
  // Dashboard Page
  async dashboard() {
    return `
      <div class="page-header">
        <h1 class="page-title">대시보드</h1>
        <p class="page-subtitle">오늘의 할 일과 업무 현황을 확인하세요</p>
      </div>

      <div class="tabs" id="todo-tabs">
        <button class="tab active" data-view="today">오늘</button>
        <button class="tab" data-view="this_week">이번 주</button>
        <button class="tab" data-view="this_month">이번 달</button>
        <button class="tab" data-view="backlog">밀린 업무</button>
        <button class="tab" data-view="all">전체</button>
      </div>

      <div class="card">
        <div class="card-body">
          <div id="todo-list-container">
            <p style="text-align: center; color: var(--gray-500);">로딩 중...</p>
          </div>
        </div>
      </div>
    `;
  },

  async workNotes() {
    return `
      <div class="page-header">
        <div class="flex-between">
          <div>
            <h1 class="page-title">업무노트</h1>
            <p class="page-subtitle">업무 기록을 관리하세요</p>
          </div>
          <button class="btn btn-primary" id="create-worknote-btn">
            ➕ 새 노트
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <div id="work-notes-container">
            <p style="text-align: center; color: var(--gray-500);">로딩 중...</p>
          </div>
        </div>
      </div>
    `;
  },

  async persons() {
    return `
      <div class="page-header">
        <div class="flex-between">
          <div>
            <h1 class="page-title">사람 관리</h1>
            <p class="page-subtitle">조직 구성원을 관리하세요</p>
          </div>
          <button class="btn btn-primary" id="create-person-btn">
            ➕ 사람 추가
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <div id="persons-container">
            <p style="text-align: center; color: var(--gray-500);">로딩 중...</p>
          </div>
        </div>
      </div>
    `;
  },

  async departments() {
    return `
      <div class="page-header">
        <div class="flex-between">
          <div>
            <h1 class="page-title">부서 관리</h1>
            <p class="page-subtitle">조직 부서를 관리하세요</p>
          </div>
          <button class="btn btn-primary" id="create-department-btn">
            ➕ 부서 추가
          </button>
        </div>
      </div>

      <div class="card">
        <div class="card-body">
          <div id="departments-container">
            <p style="text-align: center; color: var(--gray-500);">로딩 중...</p>
          </div>
        </div>
      </div>
    `;
  },

  async search() {
    return `
      <div class="page-header">
        <h1 class="page-title">검색</h1>
        <p class="page-subtitle">하이브리드 검색으로 업무노트를 찾아보세요</p>
      </div>

      <div class="card">
        <div class="card-body">
          <div class="form-group">
            <input
              type="text"
              class="form-input"
              id="search-input"
              placeholder="검색어를 입력하세요..."
            >
          </div>
          <button class="btn btn-primary" id="search-btn">
            🔍 검색
          </button>
        </div>
      </div>

      <div id="search-results-container"></div>
    `;
  },

  async rag() {
    return `
      <div class="page-header">
        <h1 class="page-title">AI 챗봇</h1>
        <p class="page-subtitle">업무 컨텍스트 기반 질의응답</p>
      </div>

      <div class="tabs mb-3" id="rag-scope-tabs">
        <button class="tab active" data-scope="GLOBAL">전체</button>
        <button class="tab" data-scope="PERSON">사람별</button>
        <button class="tab" data-scope="DEPARTMENT">부서별</button>
        <button class="tab" data-scope="WORK">업무별</button>
      </div>

      <div class="chat-container">
        <div class="chat-messages" id="chat-messages">
          <div class="chat-message assistant">
            <div class="message-bubble">
              안녕하세요! 업무노트 기반 AI 어시스턴트입니다. 무엇을 도와드릴까요?
            </div>
          </div>
        </div>
        <div class="chat-input-container">
          <div class="chat-input-group">
            <input
              type="text"
              class="chat-input"
              id="chat-input"
              placeholder="질문을 입력하세요..."
            >
            <button class="btn btn-primary" id="send-chat-btn">
              전송
            </button>
          </div>
        </div>
      </div>
    `;
  },

  async pdf() {
    return `
      <div class="page-header">
        <h1 class="page-title">PDF 업로드</h1>
        <p class="page-subtitle">PDF 파일에서 자동으로 업무노트 초안을 생성하세요</p>
      </div>

      <div class="card">
        <div class="card-body">
          <div class="upload-area" id="upload-area">
            <div class="upload-icon">📎</div>
            <p style="font-size: 1.125rem; font-weight: 500; margin-bottom: 0.5rem;">
              PDF 파일을 드래그하거나 클릭하여 선택하세요
            </p>
            <p style="color: var(--gray-600); font-size: 0.875rem;">
              최대 10MB까지 업로드 가능합니다
            </p>
            <input type="file" id="pdf-file-input" accept="application/pdf" style="display: none;">
          </div>

          <div id="upload-status" class="mt-3" style="display: none;">
            <div class="card" style="background-color: var(--gray-50);">
              <div class="card-body">
                <p id="status-text" style="margin-bottom: 0.5rem;"></p>
                <p id="status-detail" style="font-size: 0.875rem; color: var(--gray-600);"></p>
              </div>
            </div>
          </div>

          <div id="draft-result" class="mt-3"></div>
        </div>
      </div>
    `;
  },
};

// ---------------------------------------------------------------------------
// Application Controller
// ---------------------------------------------------------------------------
const App = {
  currentPage: 'dashboard',
  currentUser: null,
  currentTodoView: 'today',
  currentRagScope: 'GLOBAL',
  currentPdfDraft: null,
  persons: [],
  departments: [],

  async init() {
    // Load user info
    try {
      this.currentUser = await API.getMe();
      document.querySelector('.user-email').textContent = this.currentUser.email;
    } catch (error) {
      UI.showToast('인증 실패: ' + error.message, 'error');
    }

    // Load reference data
    await this.loadReferenceData();

    // Setup navigation
    this.setupNavigation();

    // Setup router
    this.setupRouter();

    // Navigate to initial page
    this.navigate(window.location.hash || '#/');
  },

  async loadReferenceData() {
    try {
      [this.persons, this.departments] = await Promise.all([
        API.getPersons(),
        API.getDepartments(),
      ]);
    } catch (error) {
      console.error('Failed to load reference data:', error);
    }
  },

  setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const page = item.dataset.page;
        this.navigate(`#/${page === 'dashboard' ? '' : page}`);
      });
    });
  },

  setupRouter() {
    window.addEventListener('hashchange', () => {
      this.navigate(window.location.hash);
    });
  },

  async navigate(hash) {
    const page = hash.replace('#/', '') || 'dashboard';

    // Update active nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.page === page);
    });

    // Render page
    const container = document.getElementById('page-container');

    if (Pages[page]) {
      UI.showLoading();
      try {
        container.innerHTML = await Pages[page]();
        this.currentPage = page;
        await this.afterPageRender(page);
      } catch (error) {
        container.innerHTML = `
          <div class="card">
            <div class="card-body" style="text-align: center; color: var(--danger);">
              <p>페이지 로딩 실패: ${UI.escapeHtml(error.message)}</p>
            </div>
          </div>
        `;
      } finally {
        UI.hideLoading();
      }
    } else {
      container.innerHTML = `
        <div class="card">
          <div class="card-body" style="text-align: center;">
            <h2>404</h2>
            <p>페이지를 찾을 수 없습니다</p>
          </div>
        </div>
      `;
    }
  },

  async afterPageRender(page) {
    switch (page) {
      case 'dashboard':
        await this.loadTodos();
        this.setupTodoTabs();
        break;
      case 'workNotes':
        await this.loadWorkNotes();
        this.setupWorkNotesButtons();
        break;
      case 'persons':
        await this.loadPersons();
        this.setupPersonsButtons();
        break;
      case 'departments':
        await this.loadDepartments();
        this.setupDepartmentsButtons();
        break;
      case 'search':
        this.setupSearchHandlers();
        break;
      case 'rag':
        this.setupRagTabs();
        this.setupChatHandlers();
        break;
      case 'pdf':
        this.setupPdfUpload();
        break;
    }
  },

  // Setup button handlers for work notes page
  setupWorkNotesButtons() {
    const createBtn = document.getElementById('create-worknote-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => this.showCreateWorkNoteModal());
    }
  },

  // Setup button handlers for persons page
  setupPersonsButtons() {
    const createBtn = document.getElementById('create-person-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => this.showCreatePersonModal());
    }
  },

  // Setup button handlers for departments page
  setupDepartmentsButtons() {
    const createBtn = document.getElementById('create-department-btn');
    if (createBtn) {
      createBtn.addEventListener('click', () => this.showCreateDepartmentModal());
    }
  },

  // Setup search handlers
  setupSearchHandlers() {
    const searchInput = document.getElementById('search-input');
    const searchBtn = document.getElementById('search-btn');

    if (searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.performSearch();
        }
      });
    }

    if (searchBtn) {
      searchBtn.addEventListener('click', () => this.performSearch());
    }
  },

  // Setup chat handlers
  setupChatHandlers() {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-chat-btn');

    if (chatInput) {
      chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.sendChatMessage();
        }
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', () => this.sendChatMessage());
    }
  },

  // Dashboard - Todos
  setupTodoTabs() {
    document.querySelectorAll('#todo-tabs .tab').forEach(tab => {
      tab.addEventListener('click', async () => {
        document.querySelectorAll('#todo-tabs .tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentTodoView = tab.dataset.view;
        await this.loadTodos();
      });
    });
  },

  async loadTodos() {
    const container = document.getElementById('todo-list-container');

    try {
      const todos = await API.getTodos(this.currentTodoView);

      if (todos.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--gray-500);">할 일이 없습니다</p>';
        return;
      }

      container.innerHTML = `
        <ul class="todo-list">
          ${todos.map(todo => `
            <li class="todo-item">
              <input
                type="checkbox"
                class="todo-checkbox"
                data-todo-id="${todo.todo_id}"
                ${todo.status === '완료' ? 'checked' : ''}
              >
              <div class="todo-content">
                <div class="todo-title">${UI.escapeHtml(todo.title)}</div>
                <div class="todo-meta">
                  📅 ${UI.formatDate(todo.due_date)}
                  ${todo.work_title ? `| 📄 ${UI.escapeHtml(todo.work_title)}` : ''}
                </div>
              </div>
              <span class="todo-status">
                <span class="badge ${this.getTodoStatusBadgeClass(todo.status)}">
                  ${UI.escapeHtml(todo.status)}
                </span>
              </span>
            </li>
          `).join('')}
        </ul>
      `;

      // Add event listeners to checkboxes
      document.querySelectorAll('.todo-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
          const todoId = e.target.dataset.todoId;
          const checked = e.target.checked;
          this.toggleTodoStatus(todoId, checked, e.target);
        });
      });
    } catch (error) {
      container.innerHTML = `<p style="text-align: center; color: var(--danger);">로딩 실패: ${UI.escapeHtml(error.message)}</p>`;
    }
  },

  getTodoStatusBadgeClass(status) {
    const map = {
      '완료': 'badge-success',
      '진행중': 'badge-primary',
      '보류': 'badge-warning',
      '중단': 'badge-danger',
    };
    return map[status] || 'badge-secondary';
  },

  async toggleTodoStatus(todoId, checked, checkboxElement) {
    const newStatus = checked ? '완료' : '진행중';

    // Optimistic UI update
    const checkbox = checkboxElement;
    const originalChecked = !checked;

    try {
      await API.updateTodo(todoId, { status: newStatus });
      UI.showToast('할 일 상태가 업데이트되었습니다', 'success');

      // Reload to show recurrence if created
      await this.loadTodos();
    } catch (error) {
      // Revert on error
      checkbox.checked = originalChecked;
      UI.showToast('업데이트 실패: ' + error.message, 'error');
    }
  },

  // Work Notes
  async loadWorkNotes() {
    const container = document.getElementById('work-notes-container');

    try {
      const workNotes = await API.getWorkNotes();

      if (workNotes.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--gray-500);">업무노트가 없습니다</p>';
        return;
      }

      container.innerHTML = `
        <table class="table">
          <thead>
            <tr>
              <th>제목</th>
              <th>카테고리</th>
              <th>작성일</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            ${workNotes.map(note => `
              <tr>
                <td>${UI.escapeHtml(note.title)}</td>
                <td><span class="badge badge-primary">${UI.escapeHtml(note.category)}</span></td>
                <td>${UI.formatDate(note.created_at)}</td>
                <td class="table-actions">
                  <button class="btn btn-sm btn-secondary view-worknote-btn" data-work-id="${note.work_id}">
                    보기
                  </button>
                  <button class="btn btn-sm btn-danger delete-worknote-btn" data-work-id="${note.work_id}">
                    삭제
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;

      // Add event listeners to action buttons
      document.querySelectorAll('.view-worknote-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const workId = e.target.dataset.workId;
          this.viewWorkNote(workId);
        });
      });

      document.querySelectorAll('.delete-worknote-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const workId = e.target.dataset.workId;
          this.deleteWorkNote(workId);
        });
      });
    } catch (error) {
      container.innerHTML = `<p style="text-align: center; color: var(--danger);">로딩 실패: ${UI.escapeHtml(error.message)}</p>`;
    }
  },

  showCreateWorkNoteModal() {
    const modal = prompt('새 업무노트 제목을 입력하세요:');
    if (!modal) return;

    const category = prompt('카테고리를 입력하세요 (예: 회의, 프로젝트, 보고):') || '기타';
    const content = prompt('내용을 입력하세요:') || '';

    UI.showLoading();
    API.createWorkNote({ title: modal, category, content })
      .then(() => {
        UI.showToast('업무노트가 생성되었습니다', 'success');
        return this.loadWorkNotes();
      })
      .catch(error => UI.showToast('생성 실패: ' + error.message, 'error'))
      .finally(() => UI.hideLoading());
  },

  async viewWorkNote(workId) {
    alert('상세 보기 기능은 향후 구현 예정입니다.');
  },

  async deleteWorkNote(workId) {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    UI.showLoading();
    try {
      await API.deleteWorkNote(workId);
      UI.showToast('업무노트가 삭제되었습니다', 'success');
      await this.loadWorkNotes();
    } catch (error) {
      UI.showToast('삭제 실패: ' + error.message, 'error');
    } finally {
      UI.hideLoading();
    }
  },

  // Persons
  async loadPersons() {
    const container = document.getElementById('persons-container');

    try {
      const persons = await API.getPersons();

      if (persons.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--gray-500);">등록된 사람이 없습니다</p>';
        return;
      }

      container.innerHTML = `
        <table class="table">
          <thead>
            <tr>
              <th>ID</th>
              <th>이름</th>
              <th>부서</th>
              <th>직급</th>
            </tr>
          </thead>
          <tbody>
            ${persons.map(person => {
              const id = person.personId || person.person_id;
              const dept = person.currentDept || person.dept_name || '-';
              const position = person.currentPosition || person.title || '-';
              return `
              <tr>
                <td>${UI.escapeHtml(id)}</td>
                <td>${UI.escapeHtml(person.name)}</td>
                <td>${UI.escapeHtml(dept)}</td>
                <td>${UI.escapeHtml(position)}</td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      `;
    } catch (error) {
      container.innerHTML = `<p style="text-align: center; color: var(--danger);">로딩 실패: ${UI.escapeHtml(error.message)}</p>`;
    }
  },

  async showCreatePersonModal() {
    // Fetch departments for selection
    let departments = [];
    let baseDepartments = [];
    let suggestions = [];
    let activeIndex = -1;
    let isLoading = false;
    try {
      departments = await API.getDepartments();
      baseDepartments = departments;
    } catch (error) {
      console.error('Failed to load departments:', error);
    }

    // Create modal
    const modal = this.createModal('사람 추가', `
      <form id="create-person-form">
        <div class="form-group">
          <label class="form-label">사번 (6자리 숫자) *</label>
          <input type="text" class="form-input" id="person-id-input" pattern="\\d{6}" maxlength="6" required>
          <small style="color: var(--gray-600);">6자리 숫자로 입력하세요</small>
        </div>

        <div class="form-group">
          <label class="form-label">이름 *</label>
          <input type="text" class="form-input" id="person-name-input" required>
        </div>

        <div class="form-group">
          <label class="form-label">부서</label>
          <div class="input-with-action suggestions">
            <input type="text" class="form-input" id="person-dept-input" placeholder="부서 선택 또는 검색" autocomplete="off">
            <div id="dept-loading" class="spinner-sm hidden"></div>
            <button type="button" class="btn btn-secondary" id="add-dept-inline">+ 새 부서</button>
            <div class="suggestions-list hidden" id="dept-suggestions"></div>
          </div>
          <small style="color: var(--gray-600);">기존 부서를 검색해 선택하거나, 없으면 새 부서를 추가하세요. 최대 5개 제안이 표시됩니다.</small>
        </div>

        <div class="form-group">
          <label class="form-label">직급</label>
          <input type="text" class="form-input" id="person-position-input">
        </div>

        <div class="form-group hidden" id="new-dept-form">
          <label class="form-label">새 부서 추가</label>
          <div class="inline-fields">
            <input type="text" class="form-input" id="new-dept-name" placeholder="부서 이름" required>
            <input type="text" class="form-input" id="new-dept-desc" placeholder="설명 (선택)" />
            <button type="button" class="btn btn-primary" id="save-new-dept">추가</button>
            <button type="button" class="btn btn-secondary" id="cancel-new-dept">취소</button>
          </div>
          <small style="color: var(--gray-600);">추가 후 자동으로 선택됩니다.</small>
        </div>

        <div class="flex-gap mt-3">
          <button type="submit" class="btn btn-primary">저장</button>
          <button type="button" class="btn btn-secondary modal-close">취소</button>
        </div>
      </form>
    `);

    document.body.appendChild(modal);

    // Populate department options
    const deptInput = modal.querySelector('#person-dept-input');
    const deptLoading = modal.querySelector('#dept-loading');
    const suggestionBox = modal.querySelector('#dept-suggestions');
    const addDeptButton = modal.querySelector('#add-dept-inline');
    const newDeptForm = modal.querySelector('#new-dept-form');
    const newDeptName = modal.querySelector('#new-dept-name');
    const newDeptDesc = modal.querySelector('#new-dept-desc');
    const saveNewDept = modal.querySelector('#save-new-dept');
    const cancelNewDept = modal.querySelector('#cancel-new-dept');

    const renderSuggestions = (items = []) => {
      suggestions = items.slice(0, 5);
      if (suggestions.length === 0) {
        suggestionBox.classList.add('hidden');
        activeIndex = -1;
        return;
      }

      suggestionBox.innerHTML = suggestions
        .map((dept, idx) => `
          <div class="suggestion-item${idx === activeIndex ? ' active' : ''}" data-name="${UI.escapeHtml(dept.deptName || dept.dept_name)}">
            ${UI.escapeHtml(dept.deptName || dept.dept_name)}
          </div>
        `)
        .join('');
      suggestionBox.classList.remove('hidden');
    };

    renderSuggestions(departments);

    const setLoading = (state) => {
      isLoading = state;
      deptLoading.classList.toggle('hidden', !state);
    };

    // Debounced remote search for departments
    const debounce = (fn, delay = 250) => {
      let timer;
      return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), delay);
      };
    };

    const fetchAndRenderDepartments = async (term) => {
      if (!term) {
        departments = baseDepartments;
        renderSuggestions(departments);
        return;
      }

      try {
        setLoading(true);
        const results = await API.getDepartments({ q: term, limit: 5 });
        departments = results;
        renderSuggestions(results);
      } catch (error) {
        console.error('Department search failed:', error);
        UI.showToast('부서 검색에 실패했습니다', 'error');
      } finally {
        setLoading(false);
      }
    };

    deptInput.addEventListener('input', debounce((event) => {
      const term = event.target.value.trim();
      activeIndex = -1;
      fetchAndRenderDepartments(term);
    }, 300));

    // Keyboard navigation for suggestions
    deptInput.addEventListener('keydown', (event) => {
      if (suggestions.length === 0) return;

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        activeIndex = (activeIndex + 1) % suggestions.length;
        renderSuggestions(suggestions);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        activeIndex = activeIndex <= 0 ? suggestions.length - 1 : activeIndex - 1;
        renderSuggestions(suggestions);
      } else if (event.key === 'Enter') {
        if (activeIndex >= 0) {
          event.preventDefault();
          const selected = suggestions[activeIndex];
          deptInput.value = selected.deptName || selected.dept_name;
          suggestionBox.classList.add('hidden');
        }
      } else if (event.key === 'Escape') {
        suggestionBox.classList.add('hidden');
        activeIndex = -1;
      }
    });

    // Click selection
    suggestionBox.addEventListener('click', (event) => {
      const item = event.target.closest('.suggestion-item');
      if (!item) return;
      const value = item.dataset.name;
      deptInput.value = value;
      suggestionBox.classList.add('hidden');
    });

    // Toggle inline department form
    addDeptButton.addEventListener('click', () => {
      newDeptForm.classList.remove('hidden');
      newDeptName.focus();
    });

    cancelNewDept.addEventListener('click', () => {
      newDeptForm.classList.add('hidden');
      newDeptName.value = '';
      newDeptDesc.value = '';
    });

    saveNewDept.addEventListener('click', async () => {
      const name = newDeptName.value.trim();
      const description = newDeptDesc.value.trim();
      if (!name) {
        UI.showToast('부서 이름을 입력해주세요', 'warning');
        newDeptName.focus();
        return;
      }

      UI.showLoading();
      try {
        const created = await API.createDepartment({ deptName: name, description: description || undefined });
        UI.showToast('부서가 추가되었습니다', 'success');
        // Refresh local list and select
        baseDepartments = [...baseDepartments, created];
        departments = baseDepartments;
        renderSuggestions(baseDepartments);
        deptInput.value = created.deptName || created.dept_name || name;
        newDeptForm.classList.add('hidden');
        newDeptName.value = '';
        newDeptDesc.value = '';
      } catch (error) {
        UI.showToast('부서 추가 실패: ' + error.message, 'error');
      } finally {
        UI.hideLoading();
      }
    });

    // Auto-filter using datalist (native browser handles search)

    // Handle form submit
    const form = document.getElementById('create-person-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const personId = document.getElementById('person-id-input').value.trim();
      const name = document.getElementById('person-name-input').value.trim();
      const dept = document.getElementById('person-dept-input').value.trim() || undefined;
      const position = document.getElementById('person-position-input').value.trim() || undefined;

      if (dept) {
        const exists = departments.some((d) => (d.deptName || d.dept_name) === dept);
        if (!exists) {
          UI.showToast('부서 목록에서 선택하거나 새 부서를 추가해주세요.', 'warning');
          deptInput.focus();
          return;
        }
      }

      UI.showLoading();
      try {
        await API.createPerson({
          personId,
          name,
          currentDept: dept,
          currentPosition: position
        });
        UI.showToast('사람이 추가되었습니다', 'success');
        modal.remove();
        await this.loadPersons();
      } catch (error) {
        UI.showToast('추가 실패: ' + error.message, 'error');
      } finally {
        UI.hideLoading();
      }
    });

    // Handle close buttons
    modal.querySelectorAll('.modal-close, .modal-backdrop').forEach(el => {
      el.addEventListener('click', () => modal.remove());
    });
  },

  // Helper: Create modal dialog
  createModal(title, content) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.innerHTML = `
      <div class="modal-backdrop"></div>
      <div class="modal-dialog">
        <div class="modal-header">
          <h3 class="modal-title">${UI.escapeHtml(title)}</h3>
          <button class="modal-close-btn modal-close">&times;</button>
        </div>
        <div class="modal-body">
          ${content}
        </div>
      </div>
    `;
    return modal;
  },

  // Departments
  async loadDepartments() {
    const container = document.getElementById('departments-container');

    try {
      const departments = await API.getDepartments();

      if (departments.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: var(--gray-500);">등록된 부서가 없습니다</p>';
        return;
      }

      container.innerHTML = `
        <table class="table">
          <thead>
            <tr>
              <th>부서명</th>
              <th>설명</th>
            </tr>
          </thead>
          <tbody>
            ${departments.map(dept => `
              <tr>
                <td>${UI.escapeHtml(dept.dept_name)}</td>
                <td>${UI.escapeHtml(dept.description || '-')}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } catch (error) {
      container.innerHTML = `<p style="text-align: center; color: var(--danger);">로딩 실패: ${UI.escapeHtml(error.message)}</p>`;
    }
  },

  showCreateDepartmentModal() {
    const deptName = prompt('부서명을 입력하세요:');
    if (!deptName) return;

    const description = prompt('설명을 입력하세요 (선택):') || null;

    UI.showLoading();
    API.createDepartment({ dept_name: deptName, description })
      .then(() => {
        UI.showToast('부서가 추가되었습니다', 'success');
        return this.loadDepartments();
      })
      .catch(error => UI.showToast('추가 실패: ' + error.message, 'error'))
      .finally(() => UI.hideLoading());
  },

  // Search
  async performSearch() {
    const query = document.getElementById('search-input').value.trim();
    if (!query) {
      UI.showToast('검색어를 입력하세요', 'warning');
      return;
    }

    const container = document.getElementById('search-results-container');
    UI.showLoading();

    try {
      const results = await API.search(query);

      if (results.length === 0) {
        container.innerHTML = `
          <div class="card mt-3">
            <div class="card-body" style="text-align: center; color: var(--gray-500);">
              검색 결과가 없습니다
            </div>
          </div>
        `;
        return;
      }

      container.innerHTML = `
        <div class="card mt-3">
          <div class="card-header">
            <h3 class="card-title">검색 결과 (${results.length}개)</h3>
          </div>
          <div class="card-body">
            <table class="table">
              <thead>
                <tr>
                  <th>제목</th>
                  <th>카테고리</th>
                  <th>점수</th>
                  <th>출처</th>
                </tr>
              </thead>
              <tbody>
                ${results.map(result => `
                  <tr>
                    <td>${UI.escapeHtml(result.title)}</td>
                    <td><span class="badge badge-primary">${UI.escapeHtml(result.category)}</span></td>
                    <td>${result.score.toFixed(3)}</td>
                    <td><span class="badge badge-secondary">${result.source}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `;
    } catch (error) {
      container.innerHTML = `
        <div class="card mt-3">
          <div class="card-body" style="text-align: center; color: var(--danger);">
            검색 실패: ${UI.escapeHtml(error.message)}
          </div>
        </div>
      `;
    } finally {
      UI.hideLoading();
    }
  },

  // RAG Chat
  setupRagTabs() {
    document.querySelectorAll('#rag-scope-tabs .tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('#rag-scope-tabs .tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.currentRagScope = tab.dataset.scope;
      });
    });
  },

  async sendChatMessage() {
    const input = document.getElementById('chat-input');
    const query = input.value.trim();

    if (!query) return;

    const messagesContainer = document.getElementById('chat-messages');

    // Add user message
    const userMessage = document.createElement('div');
    userMessage.className = 'chat-message user';
    userMessage.innerHTML = `<div class="message-bubble">${UI.escapeHtml(query)}</div>`;
    messagesContainer.appendChild(userMessage);

    // Clear input
    input.value = '';

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Show loading
    const loadingMessage = document.createElement('div');
    loadingMessage.className = 'chat-message assistant';
    loadingMessage.innerHTML = `<div class="message-bubble">생각 중...</div>`;
    messagesContainer.appendChild(loadingMessage);

    try {
      const response = await API.ragQuery(query, this.currentRagScope);

      // Remove loading
      loadingMessage.remove();

      // Add assistant message
      const assistantMessage = document.createElement('div');
      assistantMessage.className = 'chat-message assistant';

      let html = `<div class="message-bubble">${UI.escapeHtml(response.answer)}</div>`;

      if (response.sources && response.sources.length > 0) {
        html += `
          <div class="message-sources">
            <strong>출처:</strong>
            <ul style="margin: 0.5rem 0 0 1rem;">
              ${response.sources.map(src => `
                <li>${UI.escapeHtml(src.work_title)} (${(src.similarity * 100).toFixed(1)}%)</li>
              `).join('')}
            </ul>
          </div>
        `;
      }

      assistantMessage.innerHTML = html;
      messagesContainer.appendChild(assistantMessage);

    } catch (error) {
      loadingMessage.remove();

      const errorMessage = document.createElement('div');
      errorMessage.className = 'chat-message assistant';
      errorMessage.innerHTML = `
        <div class="message-bubble" style="background-color: var(--danger); color: white;">
          오류: ${UI.escapeHtml(error.message)}
        </div>
      `;
      messagesContainer.appendChild(errorMessage);
    }

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  },

  // PDF Upload
  setupPdfUpload() {
    const uploadArea = document.getElementById('upload-area');
    const fileInput = document.getElementById('pdf-file-input');

    uploadArea.addEventListener('click', () => fileInput.click());

    uploadArea.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadArea.classList.add('drag-over');
    });

    uploadArea.addEventListener('dragleave', () => {
      uploadArea.classList.remove('drag-over');
    });

    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('drag-over');

      const files = e.dataTransfer.files;
      if (files.length > 0) {
        this.handlePdfUpload(files[0]);
      }
    });

    fileInput.addEventListener('change', (e) => {
      if (e.target.files.length > 0) {
        this.handlePdfUpload(e.target.files[0]);
      }
    });
  },

  async handlePdfUpload(file) {
    if (!file.type.includes('pdf')) {
      UI.showToast('PDF 파일만 업로드 가능합니다', 'error');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      UI.showToast('파일 크기는 10MB 이하여야 합니다', 'error');
      return;
    }

    const statusContainer = document.getElementById('upload-status');
    const statusText = document.getElementById('status-text');
    const statusDetail = document.getElementById('status-detail');

    statusContainer.style.display = 'block';
    statusText.textContent = '📤 업로드 중...';
    statusDetail.textContent = file.name;

    try {
      const result = await API.uploadPDF(file);

      statusText.textContent = '⏳ PDF 처리 중...';
      statusDetail.textContent = `작업 ID: ${result.jobId}`;

      // Poll for result
      await this.pollPdfJob(result.jobId);

    } catch (error) {
      statusText.textContent = '❌ 업로드 실패';
      statusDetail.textContent = error.message;
      UI.showToast('업로드 실패: ' + error.message, 'error');
    }
  },

  async pollPdfJob(jobId, attempts = 0) {
    const maxAttempts = 60; // 60 attempts = 1 minute

    if (attempts >= maxAttempts) {
      document.getElementById('status-text').textContent = '❌ 처리 시간 초과';
      document.getElementById('status-detail').textContent = '잠시 후 다시 시도해주세요';
      return;
    }

    try {
      const job = await API.getPDFJob(jobId);

      if (job.status === 'READY') {
        document.getElementById('status-text').textContent = '✅ 처리 완료!';
        document.getElementById('status-detail').textContent = '업무노트 초안이 생성되었습니다';
        this.showPdfDraft(job.draft);
        UI.showToast('PDF 처리가 완료되었습니다', 'success');
        return;
      }

      if (job.status === 'ERROR') {
        document.getElementById('status-text').textContent = '❌ 처리 실패';
        document.getElementById('status-detail').textContent = job.error_message || '알 수 없는 오류';
        UI.showToast('처리 실패: ' + job.error_message, 'error');
        return;
      }

      // Still processing, poll again
      setTimeout(() => this.pollPdfJob(jobId, attempts + 1), 1000);

    } catch (error) {
      document.getElementById('status-text').textContent = '❌ 상태 확인 실패';
      document.getElementById('status-detail').textContent = error.message;
    }
  },

  showPdfDraft(draft) {
    // Store draft in app state instead of HTML attribute
    this.currentPdfDraft = draft;

    const container = document.getElementById('draft-result');

    container.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h3 class="card-title">생성된 업무노트 초안</h3>
        </div>
        <div class="card-body">
          <div class="form-group">
            <label class="form-label">제목</label>
            <input type="text" class="form-input" value="${UI.escapeHtml(draft.title)}" readonly>
          </div>

          <div class="form-group">
            <label class="form-label">카테고리</label>
            <input type="text" class="form-input" value="${UI.escapeHtml(draft.category)}" readonly>
          </div>

          <div class="form-group">
            <label class="form-label">내용</label>
            <textarea class="form-textarea" readonly style="min-height: 200px;">${UI.escapeHtml(draft.content)}</textarea>
          </div>

          ${draft.suggested_todos && draft.suggested_todos.length > 0 ? `
            <div class="form-group">
              <label class="form-label">제안된 할 일</label>
              <ul style="margin-left: 1.5rem;">
                ${draft.suggested_todos.map(todo => `
                  <li>${UI.escapeHtml(todo.title)} ${todo.due_date ? `(기한: ${UI.formatDate(todo.due_date)})` : ''}</li>
                `).join('')}
              </ul>
            </div>
          ` : ''}

          <div class="flex-gap mt-3">
            <button class="btn btn-primary" id="save-draft-btn">
              📝 업무노트로 저장
            </button>
            <button class="btn btn-secondary" id="reload-upload-btn">
              🔄 새로 업로드
            </button>
          </div>
        </div>
      </div>
    `;

    // Add event listeners
    document.getElementById('save-draft-btn').addEventListener('click', () => {
      this.saveGeneratedDraft();
    });

    document.getElementById('reload-upload-btn').addEventListener('click', () => {
      location.reload();
    });
  },

  async saveGeneratedDraft() {
    if (!this.currentPdfDraft) {
      UI.showToast('저장할 초안이 없습니다', 'error');
      return;
    }

    UI.showLoading();

    try {
      await API.createWorkNote({
        title: this.currentPdfDraft.title,
        category: this.currentPdfDraft.category,
        content: this.currentPdfDraft.content,
      });

      UI.showToast('업무노트가 저장되었습니다', 'success');
      this.currentPdfDraft = null; // Clear draft
      this.navigate('#/work-notes');

    } catch (error) {
      UI.showToast('저장 실패: ' + error.message, 'error');
    } finally {
      UI.hideLoading();
    }
  },
};

// ---------------------------------------------------------------------------
// Initialize App
// ---------------------------------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
