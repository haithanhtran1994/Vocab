// ============================================================
// github-api.js — đọc/ghi file JSON trực tiếp vào repo GitHub
// bằng GitHub Contents API (https://docs.github.com/en/rest/repos/contents)
// ============================================================

const GH_API_BASE = 'https://api.github.com';

function ghGetOwnerRepoBranch() {
  return {
    owner: localStorage.getItem('gh_owner') || CONFIG.github.owner,
    repo: localStorage.getItem('gh_repo') || CONFIG.github.repo,
    branch: localStorage.getItem('gh_branch') || CONFIG.github.branch
  };
}

function ghGetToken() {
  return localStorage.getItem('gh_pat') || '';
}
function ghSetToken(t) {
  if (t) localStorage.setItem('gh_pat', t);
  else localStorage.removeItem('gh_pat');
}
function ghHasToken() {
  return !!ghGetToken();
}
function ghSetConnection({ owner, repo, branch, token }) {
  if (owner) localStorage.setItem('gh_owner', owner.trim());
  if (repo) localStorage.setItem('gh_repo', repo.trim());
  if (branch) localStorage.setItem('gh_branch', branch.trim());
  if (token) ghSetToken(token.trim());
}
function ghIsConfigured() {
  const { owner, repo } = ghGetOwnerRepoBranch();
  return !!(owner && repo && owner !== 'YOUR_GITHUB_USERNAME' && repo !== 'YOUR_REPO_NAME' && ghHasToken());
}

function ghAuthHeaders() {
  const headers = { 'Accept': 'application/vnd.github+json' };
  const token = ghGetToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

// UTF-8 safe base64 (vì nội dung có tiếng Việt/tiếng Nhật)
function ghB64Encode(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function ghB64Decode(str) {
  return decodeURIComponent(escape(atob(str)));
}

// Đọc 1 file JSON trong repo. Trả về {content, sha}. content=null nếu file chưa tồn tại (404).
async function ghGetFile(path) {
  const { owner, repo, branch } = ghGetOwnerRepoBranch();
  const url = `${GH_API_BASE}/repos/${owner}/${repo}/contents/${path}?ref=${encodeURIComponent(branch)}&_=${Date.now()}`;
  const res = await fetch(url, { headers: ghAuthHeaders(), cache: 'no-store' });
  if (res.status === 404) return { content: null, sha: null };
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`GET ${path} thất bại (${res.status}): ${t}`);
  }
  const data = await res.json();
  const raw = ghB64Decode((data.content || '').replace(/\n/g, ''));
  let parsed;
  try { parsed = JSON.parse(raw); } catch (e) {
    throw new Error(`File ${path} không phải JSON hợp lệ: ${e.message}`);
  }
  return { content: parsed, sha: data.sha };
}

// Ghi (tạo mới hoặc cập nhật) 1 file JSON. sha=null nếu file chưa tồn tại.
// Trả về response JSON của GitHub (chứa content.sha mới).
async function ghPutFile(path, obj, sha, message) {
  const { owner, repo, branch } = ghGetOwnerRepoBranch();
  const url = `${GH_API_BASE}/repos/${owner}/${repo}/contents/${path}`;
  const body = {
    message: message || `Cập nhật ${path}`,
    content: ghB64Encode(JSON.stringify(obj, null, 2)),
    branch
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: 'PUT',
    headers: { ...ghAuthHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    const err = new Error(`PUT ${path} thất bại (${res.status}): ${t}`);
    err.status = res.status;
    throw err;
  }
  return await res.json();
}
