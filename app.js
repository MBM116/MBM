// State
const STORAGE_KEY = 'asset_vault_config';
let config = JSON.parse(localStorage.getItem(STORAGE_KEY)) || { token: '', repo: '', branch: 'main', dbSha: null };
let db = []; // Array of assets
let currentFilter = 'all';
let currentPlatformFilter = 'all';
let searchQuery = '';

// DOM Elements
const gridEl = document.getElementById('asset-grid');
const searchInput = document.getElementById('search-input');
const filterBtns = document.querySelectorAll('#category-filters button');
const platformBtns = document.querySelectorAll('#platform-filters button');
const themeToggle = document.getElementById('theme-toggle');

// SVG Icons
const icons = {
    moon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>',
    sun: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>',
    download: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>'
};

// Initialize App
function init() {
    // Theme setup
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    // Setup listeners
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase();
        renderGrid();
    });

    filterBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            filterBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderGrid();
        });
    });

    if (platformBtns) {
        platformBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                platformBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentPlatformFilter = btn.dataset.platform;
                renderGrid();
            });
        });
    }

    // Initial fetch or prompt settings
    if (config.token && config.repo) {
        document.getElementById('gh-token').value = config.token;
        document.getElementById('gh-repo').value = config.repo;
        document.getElementById('gh-branch').value = config.branch || 'main';
        fetchDatabase();
    } else {
        openModal('settings');
    }
}

// Theme Management
function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    updateThemeIcon(next);
}

function updateThemeIcon(theme) {
    themeToggle.innerHTML = theme === 'dark' ? icons.sun : icons.moon;
}

// Modals
function openModal(id) {
    document.getElementById(`${id}-overlay`).classList.add('active');
}

function closeModal(id) {
    document.getElementById(`${id}-overlay`).classList.remove('active');
}

// Settings
function saveSettings() {
    config.token = document.getElementById('gh-token').value.trim();
    config.repo = document.getElementById('gh-repo').value.trim();
    config.branch = document.getElementById('gh-branch').value.trim() || 'main';
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    closeModal('settings');
    fetchDatabase();
}

// --- GitHub API Helpers ---

// Base64 encoding/decoding that handles unicode properly
function b64DecodeUnicode(str) {
    return decodeURIComponent(atob(str).split('').map(c => 
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
    ).join(''));
}

function b64EncodeUnicode(str) {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, 
        (match, p1) => String.fromCharCode('0x' + p1)
    ));
}

async function ghApi(path, method = 'GET', body = null) {
    const url = `https://api.github.com/repos/${config.repo}/${path}`;
    const headers = {
        'Accept': 'application/vnd.github+json',
        'Authorization': `Bearer ${config.token}`
    };
    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);
    
    const res = await fetch(url, options);
    if (!res.ok && res.status !== 404) {
        const err = await res.json();
        throw new Error(err.message || 'GitHub API Error');
    }
    return res;
}

// Fetch db
async function fetchDatabase() {
    showLoading("Syncing database...");
    try {
        const res = await ghApi(`contents/database.json?ref=${config.branch}`);
        if (res.status === 404) {
            db = [];
            config.dbSha = null;
        } else {
            const data = await res.json();
            config.dbSha = data.sha;
            const content = b64DecodeUnicode(data.content);
            db = JSON.parse(content);
        }
        renderGrid();
    } catch (error) {
        alert(`Error fetching database: ${error.message}`);
    } finally {
        hideLoading();
    }
}

// Save db
async function saveDatabase() {
    const content = b64EncodeUnicode(JSON.stringify(db, null, 2));
    const body = {
        message: "Update database.json via Vault UI",
        content: content,
        branch: config.branch
    };
    if (config.dbSha) body.sha = config.dbSha;

    const res = await ghApi('contents/database.json', 'PUT', body);
    const data = await res.json();
    config.dbSha = data.content.sha;
}

// File reader wrapper
function readFileBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            // Extract base64 string without data:mime/type;base64,
            const base64Str = reader.result.split(',')[1];
            resolve(base64Str);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

// Generate raw github content url
function getRawUrl(path) {
    return `https://raw.githubusercontent.com/${config.repo}/${config.branch}/${path}`;
}

// Format category name for display
function formatCategory(cat) {
    return cat.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

// --- Upload Flow ---
async function handleUpload() {
    const titleInput = document.getElementById('asset-title');
    const descInput = document.getElementById('asset-description');
    const catInput = document.getElementById('asset-category');
    const platformInput = document.getElementById('asset-platform');
    const imgInput = document.getElementById('asset-image');
    const fileInput = document.getElementById('asset-file');

    if (!titleInput.value || !imgInput.files.length || !fileInput.files.length || (descInput && !descInput.value)) {
        alert("Please fill all fields and select files.");
        return;
    }

    const title = titleInput.value.trim();
    const description = descInput ? descInput.value.trim() : '';
    const category = catInput.value;
    const platform = platformInput ? platformInput.value : 'ALL';
    const imgFile = imgInput.files[0];
    const assetFile = fileInput.files[0];
    
    // Check file size (GH API limit via base64 is practically ~50MB safely)
    if (assetFile.size > 50 * 1024 * 1024) {
        if(!confirm("The file is larger than 50MB. This might crash the browser during Base64 encoding or hit GitHub API limits. Continue?")) return;
    }

    const uploadBtn = document.getElementById('upload-btn-text');
    const loader = document.getElementById('upload-loader');
    uploadBtn.style.display = 'none';
    loader.style.display = 'inline-block';

    try {
        const timestamp = Date.now();
        const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        
        // 1. Upload Image
        showLoading("Uploading Image...");
        const imgExt = imgFile.name.split('.').pop();
        const imgPath = `assets/images/${safeTitle}_${timestamp}.${imgExt}`;
        const imgBase64 = await readFileBase64(imgFile);
        await ghApi(`contents/${imgPath}`, 'PUT', {
            message: `Add image for ${title}`,
            content: imgBase64,
            branch: config.branch
        });

        // 2. Upload Zip/Rar
        showLoading("Uploading Asset File (This may take a while)...");
        const assetExt = assetFile.name.split('.').pop();
        const assetPath = `assets/files/${safeTitle}_${timestamp}.${assetExt}`;
        const assetBase64 = await readFileBase64(assetFile);
        await ghApi(`contents/${assetPath}`, 'PUT', {
            message: `Add asset for ${title}`,
            content: assetBase64,
            branch: config.branch
        });

        // 3. Update DB
        showLoading("Updating Database...");
        const newItem = {
            id: timestamp.toString(),
            title: title,
            description: description,
            category: category,
            platform: platform,
            imagePath: imgPath,
            filePath: assetPath,
            uploadDate: new Date().toISOString()
        };
        
        db.unshift(newItem); // Add to beginning
        await saveDatabase();

        alert("Asset uploaded successfully!");
        document.getElementById('upload-form').reset();
        closeModal('upload');
        renderGrid();

    } catch (error) {
        alert(`Upload failed: ${error.message}`);
        console.error(error);
    } finally {
        uploadBtn.style.display = 'inline-block';
        loader.style.display = 'none';
        hideLoading();
    }
}

// --- UI Rendering ---
function showLoading(text) {
    document.getElementById('loading-overlay').style.display = 'flex';
    document.getElementById('loading-text').innerText = text;
}

function hideLoading() {
    document.getElementById('loading-overlay').style.display = 'none';
}

function renderGrid() {
    gridEl.innerHTML = '';
    
    let filteredDb = db.filter(item => {
        const legacyFilter = currentFilter !== 'all' ? currentFilter.toLowerCase().replace(/ /g, '-') : 'all';
        const matchFilter = currentFilter === 'all' || item.category === currentFilter || item.category === legacyFilter;
        const matchSearch = item.title.toLowerCase().includes(searchQuery);
        let matchPlatform = true;
        if (currentPlatformFilter !== 'all') {
            const hasPlatformTag = item.platform && item.platform === currentPlatformFilter;
            const hasPlatformTitle = item.title.toLowerCase().includes(currentPlatformFilter.toLowerCase());
            matchPlatform = hasPlatformTag || hasPlatformTitle;
        }
        return matchFilter && matchSearch && matchPlatform;
    });

    if (filteredDb.length === 0) {
        gridEl.innerHTML = `<div class="empty-state">No assets found matching your criteria.</div>`;
        return;
    }

    filteredDb.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card';
        
        const imgUrl = getRawUrl(item.imagePath);
        const fileUrl = getRawUrl(item.filePath);
        const date = new Date(item.uploadDate).toLocaleDateString();
        const catFormatted = formatCategory(item.category);

        const descText = item.description || 'No description available.';

        const pricingText = (item.category && item.category.toLowerCase().includes('free')) ? 'FREE' : 'PAID';
        const platformText = item.platform || 'ALL';

        card.innerHTML = `
            <img src="${imgUrl}" alt="${item.title}" class="card-image" loading="lazy" onerror="this.src='data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9IiMzMyMiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZm9udC1zaXplPSIyMCIgZmlsbD0iI2ZmZiIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+SW1hZ2UgTm90IEZvdW5kPC90ZXh0Pjwvc3ZnPg=='">
            <div class="card-content">
                <div style="display: flex; gap: 8px; align-items: center; margin-bottom: 0.5rem;">
                    <span style="background-color: var(--surface-hover); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold; color: var(--text-primary); text-transform: uppercase;">${platformText}</span>
                    <span style="background-color: rgba(16, 185, 129, 0.1); color: #10b981; border: 1px solid rgba(16, 185, 129, 0.3); padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; font-weight: bold;">${pricingText}</span>
                </div>
                
                <h4 class="card-title" style="margin-bottom: 0.5rem; margin-top: 0;">${item.title}</h4>
                <p class="card-description" style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 1rem; line-height: 1.4;">${descText}</p>
                <div class="card-date" style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 1rem;">Uploaded: ${date}</div>
                
                <div class="card-actions" style="display: flex; align-items: center; justify-content: center; margin-top: auto; padding-top: 1rem; border-top: 1px solid var(--border-color);">
                    <a href="${fileUrl}" target="_blank" download class="btn-custom-download" style="width: 100%;">
                        Download
                    </a>
                </div>
            </div>
        `;
        gridEl.appendChild(card);
    });
}

// Run
window.addEventListener('DOMContentLoaded', init);
