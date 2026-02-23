// State Management
const state = {
    apiKey: null,
    collections: [],
    selectedEndpoints: new Map(),
    soundEnabled: true,
    currentCollection: null,
    filteredCollections: []
};

// DOM Elements
const loginScreen = document.getElementById('loginScreen');
const mainScreen = document.getElementById('mainScreen');
const apiKeyInput = document.getElementById('apiKey');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const logoutBtn = document.getElementById('logoutBtn');
const refreshBtn = document.getElementById('refreshBtn');
const soundToggle = document.getElementById('soundToggle');
const soundIcon = document.getElementById('soundIcon');
const searchInput = document.getElementById('searchInput');
const collectionsContainer = document.getElementById('collectionsContainer');
const collectionsSection = document.querySelector('.collections-section');
const collectionDetailSection = document.getElementById('collectionDetailSection');
const backToCollectionsBtn = document.getElementById('backToCollectionsBtn');
const detailCollectionName = document.getElementById('detailCollectionName');
const detailCollectionDesc = document.getElementById('detailCollectionDesc');
const folderTreeContainer = document.getElementById('folderTreeContainer');
const selectionCount = document.getElementById('selectionCount');
const clearSelectionBtn = document.getElementById('clearSelectionBtn');
const summarySection = document.getElementById('summarySection');
const summaryContent = document.getElementById('summaryContent');
const copyBtn = document.getElementById('copyBtn');
const downloadBtn = document.getElementById('downloadBtn');
const expandAllBtn = document.getElementById('expandAllBtn');
const collapseAllBtn = document.getElementById('collapseAllBtn');
const toast = document.getElementById('toast');
const clickSound = document.getElementById('clickSound');
const successSound = document.getElementById('successSound');

// Initialize App
function init() {
    const savedApiKey = localStorage.getItem('postman_api_key');
    if (savedApiKey) {
        state.apiKey = savedApiKey;
        validateAndLogin(savedApiKey);
    }
    
    attachEventListeners();
}

// Event Listeners
function attachEventListeners() {
    loginBtn.addEventListener('click', handleLogin);
    apiKeyInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    logoutBtn.addEventListener('click', handleLogout);
    refreshBtn.addEventListener('click', handleRefresh);
    soundToggle.addEventListener('click', toggleSound);
    searchInput.addEventListener('input', handleSearch);
    backToCollectionsBtn.addEventListener('click', backToCollections);
    clearSelectionBtn.addEventListener('click', clearAllSelections);
    copyBtn.addEventListener('click', copyToClipboard);
    downloadBtn.addEventListener('click', downloadSummary);
    expandAllBtn.addEventListener('click', () => setAllSummaryItemsOpen(true));
    collapseAllBtn.addEventListener('click', () => setAllSummaryItemsOpen(false));
    
    window.addEventListener('hashchange', handleHashChange);
}

async function handleHashChange() {
    const hash = window.location.hash.replace('#', '');
    if (hash.startsWith('collection/')) {
        const uid = hash.substring('collection/'.length);
        await openCollectionByUid(uid);
    } else {
        closeCollectionDetail();
    }
}

async function openCollectionByUid(uid) {
    if (!state.apiKey) return;

    let collection = state.collections.find(c => c.uid === uid);
    
    if (!collection) {
        // Show loading state while fetching individual collection
        collectionsSection.style.display = 'none';
        collectionDetailSection.style.display = 'block';
        detailCollectionName.textContent = 'Loading Collection...';
        detailCollectionDesc.textContent = 'Please wait';
        folderTreeContainer.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div>';

        const details = await loadCollectionDetails(uid);
        collection = { 
            uid, 
            name: details?.info?.name || 'Shared Collection', 
            description: details?.info?.description || '', 
            details 
        };
        // Temporarily add to state if needed, or just show it
        if (!details.error) {
            state.collections.push(collection);
        }
    }
    
    if (collection) {
        showCollectionDetail(collection, false);
    }
}

async function retryCollectionLoad() {
    if (state.currentCollection && state.currentCollection.uid) {
        folderTreeContainer.innerHTML = '<div class="skeleton-card"></div><div class="skeleton-card"></div>';
        const details = await loadCollectionDetails(state.currentCollection.uid);
        state.currentCollection.details = details;
        renderFolderTree(details);
    }
}

// Sound Effects
function playSound(sound) {
    if (state.soundEnabled && sound) {
        sound.currentTime = 0;
        sound.play().catch(() => {});
    }
}

function toggleSound() {
    state.soundEnabled = !state.soundEnabled;
    soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
    playSound(clickSound);
    showToast(state.soundEnabled ? 'Sound enabled' : 'Sound muted', 'success');
}

// Authentication
async function handleLogin() {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
        showError('Please enter your Postman API key');
        return;
    }
    
    playSound(clickSound);
    loginBtn.classList.add('loading');
    loginError.classList.remove('show');
    
    await validateAndLogin(apiKey);
}

async function validateAndLogin(apiKey) {
    try {
        const response = await fetch('https://api.getpostman.com/me', {
            headers: {
                'X-Api-Key': apiKey
            }
        });
        
        if (!response.ok) {
            throw new Error('Invalid API key');
        }
        
        state.apiKey = apiKey;
        localStorage.setItem('postman_api_key', apiKey);
        
        loginBtn.classList.remove('loading');
        loginScreen.classList.remove('active');
        mainScreen.classList.add('active');
        
        playSound(successSound);
        await loadCollections();
    } catch (error) {
        loginBtn.classList.remove('loading');
        showError('Invalid API key. Please check and try again.');
    }
}

function handleLogout() {
    playSound(clickSound);
    if (confirm('Are you sure you want to logout?')) {
        state.apiKey = null;
        state.collections = [];
        state.selectedEndpoints.clear();
        state.currentCollection = null;
        localStorage.removeItem('postman_api_key');
        
        mainScreen.classList.remove('active');
        loginScreen.classList.add('active');
        apiKeyInput.value = '';
        collectionsContainer.innerHTML = '';
        updateSelectionUI();
    }
}

async function handleRefresh() {
    playSound(clickSound);
    refreshBtn.classList.add('loading');
    refreshBtn.disabled = true;
    
    // Rotate animation
    const icon = refreshBtn.querySelector('span');
    if (icon) icon.style.transition = 'transform 1s linear';
    if (icon) icon.style.transform = 'rotate(360deg)';
    
    try {
        await loadCollections();
        showToast('Collections synced successfully!', 'success');
    } catch (error) {
        showToast('Sync failed', 'error');
    } finally {
        refreshBtn.classList.remove('loading');
        refreshBtn.disabled = false;
        if (icon) {
            setTimeout(() => {
                icon.style.transition = 'none';
                icon.style.transform = 'rotate(0deg)';
            }, 1000);
        }
    }
}

function showError(message) {
    loginError.textContent = message;
    loginError.classList.add('show');
}

// Search
function handleSearch(e) {
    const query = e.target.value.toLowerCase().trim();
    
    if (!query) {
        state.filteredCollections = state.collections;
    } else {
        state.filteredCollections = state.collections.filter(collection => 
            collection.name.toLowerCase().includes(query) ||
            (collection.description && collection.description.toLowerCase().includes(query))
        );
    }
    
    renderCollections();
}

// Collections
async function loadCollections() {
    try {
        const response = await fetch('https://api.getpostman.com/collections', {
            headers: {
                'X-Api-Key': state.apiKey
            }
        });
        
        if (!response.ok) throw new Error('Failed to fetch collections');
        
        const data = await response.json();
        state.collections = data.collections || [];
        state.filteredCollections = state.collections;
        
        // Load detailed info for each collection
        await Promise.all(state.collections.map(async (collection) => {
            const details = await loadCollectionDetails(collection.uid);
            collection.details = details;
        }));
        
        renderCollections();
        
        if (window.location.hash.startsWith('#collection/')) {
            handleHashChange();
        }
    } catch (error) {
        showToast('Failed to load collections', 'error');
    }
}

async function loadCollectionDetails(collectionId) {
    try {
        const response = await fetch(`https://api.getpostman.com/collections/${collectionId}`, {
            headers: {
                'X-Api-Key': state.apiKey
            }
        });
        
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error?.message || `HTTP Error ${response.status}`);
        }
        
        const data = await response.json();
        return data.collection;
    } catch (error) {
        console.error('Error loading collection details:', error);
        return { error: error.message };
    }
}

function renderCollections() {
    collectionsContainer.innerHTML = '';
    
    state.filteredCollections.forEach(collection => {
        const card = createCollectionCard(collection);
        collectionsContainer.appendChild(card);
    });
}

function createCollectionCard(collection) {
    const card = document.createElement('div');
    card.className = 'collection-card';
    
    const endpointCount = countEndpoints(collection.details);
    
    card.innerHTML = `
        <div class="collection-header">
            <div class="collection-name">${collection.name}</div>
            <div class="collection-badge">${endpointCount} endpoints</div>
        </div>
        <div class="collection-description">
            ${collection.description || 'No description available'}
        </div>
    `;
    
    card.addEventListener('click', () => {
        playSound(clickSound);
        showCollectionDetail(collection);
    });
    
    return card;
}

function countEndpoints(collection) {
    if (!collection || collection.error) return 0;
    let count = 0;
    
    function traverse(items) {
        if (!items) return;
        items.forEach(item => {
            if (item.request) count++;
            if (item.item) traverse(item.item);
        });
    }
    
    traverse(collection.item);
    return count;
}

// Collection Detail View
function showCollectionDetail(collection, updateHash = true) {
    if (updateHash) {
        window.location.hash = `collection/${collection.uid}`;
        return;
    }

    state.currentCollection = collection;
    
    // Hide collections, show detail
    collectionsSection.style.display = 'none';
    collectionDetailSection.style.display = 'block';
    
    // Set collection info
    detailCollectionName.textContent = collection.name;
    detailCollectionDesc.textContent = collection.description || 'No description available';
    
    // Render folder tree
    renderFolderTree(collection.details);
}

function closeCollectionDetail() {
    state.currentCollection = null;
    
    collectionsSection.style.display = 'block';
    collectionDetailSection.style.display = 'none';
}

function backToCollections() {
    playSound(clickSound);
    window.location.hash = ''; // This will trigger hashchange and close detail view
}

function renderFolderTree(collection) {
    folderTreeContainer.innerHTML = '';
    
    if (!collection) {
        folderTreeContainer.innerHTML = '<div class="error-message show">Failed to load collection details.</div>';
        return;
    }
    
    if (collection.error) {
        folderTreeContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">⚠️</div>
                <h4>Error Loading Collection</h4>
                <p class="error-log">${collection.error}</p>
                <button class="btn btn-secondary" style="margin-top: 1rem;" onclick="retryCollectionLoad()">Retry</button>
            </div>
        `;
        return;
    }
    
    if (!collection.item || collection.item.length === 0) {
        folderTreeContainer.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📭</div>
                <h4>No endpoints found</h4>
                <p>This collection has no requests or folders.</p>
            </div>
        `;
        return;
    }
    
    // Create a root container for consistency, or just append directly
    collection.item.forEach(item => {
        const element = createTreeItemElement(item, state.currentCollection.name);
        folderTreeContainer.appendChild(element);
    });
}

function createTreeItemElement(item, collectionName, parentId = '') {
    const isFolder = item.item && item.item.length > 0;
    const uniqueId = parentId ? `${parentId}-${item.name.replace(/\s+/g, '_')}` : item.name.replace(/\s+/g, '_');
    
    if (isFolder) {
        return createFolderElement(item, collectionName, uniqueId);
    } else {
        return createEndpointElement(item, collectionName, uniqueId);
    }
}

function createFolderElement(item, collectionName, uniqueId) {
    const div = document.createElement('div');
    div.className = 'folder-item';
    
    // Get all endpoints in this folder (recursive) for the count and selection
    const allEndpoints = extractEndpointsFromItem(item);
    const endpointCount = allEndpoints.length;
    
    div.innerHTML = `
        <div class="folder-header">
            <input type="checkbox" class="folder-checkbox" id="folder-check-${uniqueId}">
            <span class="folder-icon">▶</span>
            <span class="folder-name">${item.name}</span>
            <span class="folder-count">${endpointCount}</span>
        </div>
        <div class="folder-children" id="folder-children-${uniqueId}">
            <!-- Children will be appended here -->
        </div>
    `;
    
    const childrenContainer = div.querySelector(`#folder-children-${uniqueId}`);
    
    // Recursively render children
    item.item.forEach(subItem => {
        const childEl = createTreeItemElement(subItem, collectionName, uniqueId);
        childrenContainer.appendChild(childEl);
    });
    
    const header = div.querySelector('.folder-header');
    const checkbox = div.querySelector('.folder-checkbox');
    const icon = div.querySelector('.folder-icon');
    
    header.addEventListener('click', (e) => {
        if (e.target !== checkbox) {
            playSound(clickSound);
            div.classList.toggle('expanded');
        }
    });
    
    checkbox.addEventListener('change', (e) => {
        e.stopPropagation();
        handleFolderSelection(allEndpoints, collectionName, checkbox.checked);
        
        // Visually update all child checkboxes
        const childCheckboxes = div.querySelectorAll('input[type="checkbox"]');
        childCheckboxes.forEach(cb => cb.checked = checkbox.checked);
    });
    
    return div;
}

function createEndpointElement(item, collectionName, uniqueId) {
    const div = document.createElement('div');
    const endpoint = parseEndpoint(item);
    const key = `${collectionName}::${endpoint.path}::${endpoint.method}`;
    const isChecked = state.selectedEndpoints.has(key);
    const hasResponse = item.response && item.response.length > 0;
    
    div.className = 'endpoint-item';
    div.innerHTML = `
        <input type="checkbox" class="endpoint-checkbox" id="endpoint-${uniqueId}" ${isChecked ? 'checked' : ''}>
        <span class="endpoint-method method-${endpoint.method.toLowerCase()}">${endpoint.method}</span>
        <span class="endpoint-path">${endpoint.path}</span>
        ${hasResponse ? '<span class="response-badge" title="Has saved response">💾</span>' : ''}
    `;
    
    const checkbox = div.querySelector('.endpoint-checkbox');
    checkbox.addEventListener('change', (e) => {
        handleEndpointSelection(endpoint, collectionName, checkbox.checked);
        
        // Update parent folders state if needed (optional optimization)
        // For now we rely on the user to check folders if they want bulk selection
    });
    
    return div;
}

function parseEndpoint(item) {
    const request = item.request || {};
    const url = typeof request.url === 'string' 
        ? request.url 
        : (request.url?.raw || '');
    
    return {
        name: item.name,
        method: request.method || 'GET',
        path: extractPath(url),
        url: url,
        request: request,
        response: item.response || []
    };
}

function extractEndpointsFromItem(item) {
    const endpoints = [];
    
    function traverse(items) {
        if (!items) return;
        items.forEach(i => {
            if (i.request) {
                endpoints.push(i);
            }
            if (i.item) {
                traverse(i.item);
            }
        });
    }
    
    traverse(item.item);
    return endpoints;
}

function extractPath(url) {
    try {
        if (url.includes('{{')) {
            // Keep the variable part if it's significant, e.g. {{base_url}}/api/v1/...
            // The user wants {{base_url}}/v1/user/... shown
            return url; 
        }
        const urlObj = new URL(url);
        return urlObj.pathname;
    } catch {
        return url;
    }
}

// Selection Management
function handleFolderSelection(endpoints, collectionName, isSelected) {
    playSound(clickSound);
    
    endpoints.forEach(item => {
        const endpoint = parseEndpoint(item);
        const key = `${collectionName}::${endpoint.path}::${endpoint.method}`;
        
        if (isSelected) {
            state.selectedEndpoints.set(key, { ...endpoint, collectionName });
        } else {
            state.selectedEndpoints.delete(key);
        }
    });
    
    updateSelectionUI();
    generateSummary();
}

function handleEndpointSelection(endpoint, collectionName, isSelected) {
    playSound(clickSound);
    
    const key = `${collectionName}::${endpoint.path}::${endpoint.method}`;
    
    if (isSelected) {
        state.selectedEndpoints.set(key, { ...endpoint, collectionName });
    } else {
        state.selectedEndpoints.delete(key);
    }
    
    updateSelectionUI();
    generateSummary();
}

function clearAllSelections() {
    playSound(clickSound);
    state.selectedEndpoints.clear();
    
    // Uncheck all checkboxes
    document.querySelectorAll('.endpoint-checkbox, .folder-checkbox').forEach(cb => {
        cb.checked = false;
    });
    
    updateSelectionUI();
    generateSummary();
}

function updateSelectionUI() {
    const count = state.selectedEndpoints.size;
    selectionCount.textContent = `${count} endpoint${count !== 1 ? 's' : ''} selected`;
    clearSelectionBtn.style.display = count > 0 ? 'block' : 'none';
}

// Summary Generation with improved formatting
function generateSummary() {
    if (state.selectedEndpoints.size === 0) {
        summarySection.style.display = 'none';
        return;
    }
    
    summarySection.style.display = 'block';
    
    // Update stats
    const countEl = document.getElementById('summaryEndpointCount');
    if (countEl) countEl.textContent = state.selectedEndpoints.size;
    
    summaryContent.innerHTML = '';
    
    state.selectedEndpoints.forEach((endpoint, key) => {
        const endpointSummary = createCollapsibleEndpointSummary(endpoint);
        summaryContent.appendChild(endpointSummary);
    });
}

function createCollapsibleEndpointSummary(endpoint) {
    const details = document.createElement('details');
    details.className = 'summary-item-card';
    details.open = true;
    
    const summary = document.createElement('summary');
    summary.className = 'card-header';
    
    const methodClass = `method-${endpoint.method.toLowerCase()}`;
    summary.innerHTML = `
        <div class="header-layout">
            <div class="header-main">
                <span class="method-badge ${methodClass}">${endpoint.method}</span>
                <span class="card-url" title="${endpoint.url}">${endpoint.url}</span>
            </div>
            <div class="header-meta">
                <span class="chevron-icon">▾</span>
            </div>
        </div>
    `;
    
    const body = document.createElement('div');
    body.className = 'card-body';
    
    // Query Parameters
    const queryParams = extractQueryParams(endpoint.request);
    if (queryParams.length > 0) {
        body.appendChild(createInfoBlock('🔍 Query Parameters', createQueryGrid(queryParams), true));
    }
    
    // Request Body
    if (endpoint.request && endpoint.request.body && endpoint.request.body.mode) {
        const bodyContent = formatRequestBody(endpoint.request.body);
        if (bodyContent.trim().length > 0) {
            body.appendChild(createInfoBlock('📦 Request Body', createCodeBlock(bodyContent, 'JSON'), true));
        }
    }
    
    // Response Example (Iterate all saved responses)
    if (endpoint.response && endpoint.response.length > 0) {
        endpoint.response.forEach((response, index) => {
            if (response.body) {
                let formattedBody = response.body;
                try {
                    formattedBody = JSON.stringify(JSON.parse(response.body), null, 2);
                } catch {}
                
                const title = `📥 Response Example ${endpoint.response.length > 1 ? (index + 1) : ''} (${response.name || 'Success'})`;
                body.appendChild(createInfoBlock(title, createCodeBlock(formattedBody, 'JSON'), true));
            }
        });
    }
    
    details.appendChild(summary);
    details.appendChild(body);
    
    return details;
}

function createInfoBlock(title, contentElement, showCopy = false) {
    const block = document.createElement('div');
    block.className = 'info-block';
    
    const header = document.createElement('div');
    header.className = 'block-header';
    
    header.innerHTML = `<span class="block-title">${title}</span>`;
    
    if (showCopy) {
        const copyBtn = document.createElement('button');
        copyBtn.className = 'btn-copy-small';
        copyBtn.textContent = 'Copy';
        copyBtn.onclick = (e) => {
            e.stopPropagation();
            const textToCopy = contentElement.innerText;
            navigator.clipboard.writeText(textToCopy).then(() => {
                copyBtn.textContent = 'Copied!';
                playSound(successSound);
                setTimeout(() => copyBtn.textContent = 'Copy', 2000);
            });
        };
        header.appendChild(copyBtn);
    }
    
    const content = document.createElement('div');
    content.className = 'block-content';
    content.appendChild(contentElement);
    
    block.appendChild(header);
    block.appendChild(content);
    return block;
}

function createQueryGrid(params) {
    const grid = document.createElement('div');
    grid.className = 'query-grid';
    
    params.forEach(param => {
        const item = document.createElement('div');
        item.className = 'query-item';
        item.innerHTML = `
            <span class="query-key">${param.key}</span>
            <span class="query-value">${param.value || param.description || '<span class="optional-hint">(optional)</span>'}</span>
        `;
        grid.appendChild(item);
    });
    
    return grid;
}

function createCodeBlock(code, lang) {
    const pre = document.createElement('pre');
    pre.className = 'code-wrapper';
    pre.setAttribute('data-lang', lang);
    pre.textContent = code;
    return pre;
}

function getSummaryText() {
    let text = '';
    state.selectedEndpoints.forEach((endpoint) => {
        text += `║ ENDPOINT: ${endpoint.url}\n`;
        text += `║ METHOD: ${endpoint.method.toUpperCase()}\n\n`;
        
        const queryParams = extractQueryParams(endpoint.request);
        if (queryParams.length > 0) {
            text += `🔍 Query Parameters:\n`;
            queryParams.forEach(param => {
                text += `   • ${param.key}: ${param.value || param.description || '(optional)'}\n`;
            });
            text += '\n';
        }
        
        if (endpoint.request && endpoint.request.body && endpoint.request.body.mode) {
            const bodyContent = formatRequestBody(endpoint.request.body);
            if (bodyContent.trim().length > 0) {
                text += `📦 Request Body:\n`;
                text += bodyContent + '\n\n';
            }
        }
        
        if (endpoint.response && endpoint.response.length > 0) {
            endpoint.response.forEach((response, index) => {
                if (response.body) {
                    text += `📥 Response Example ${endpoint.response.length > 1 ? (index + 1) : ''} (${response.name || 'Success'}):\n`;
                    try {
                        text += JSON.stringify(JSON.parse(response.body), null, 2) + '\n';
                    } catch {
                        text += response.body + '\n';
                    }
                    text += '\n';
                }
            });
        }
        text += '═'.repeat(80) + '\n\n';
    });
    return text;
}

function extractQueryParams(request) {
    const params = [];
    
    if (request && request.url && request.url.query) {
        params.push(...request.url.query);
    }
    
    return params;
}

function extractPathVariables(request) {
    // User didn't ask for this specifically to be hidden or shown, but implied "no need others".
    // I'll skip displaying them separately to keep it clean as requested.
    return [];
}

function formatRequestBody(body) {
    let output = '';
    
    if (body.mode === 'raw') {
        try {
            const parsed = JSON.parse(body.raw);
            output += JSON.stringify(parsed, null, 2);
        } catch {
            output += body.raw || '';
        }
    } else if (body.mode === 'formdata') {
        body.formdata?.forEach(item => {
            output += `   • ${item.key}: ${item.value || item.src || '(file)'}\n`;
        });
    } else if (body.mode === 'urlencoded') {
        body.urlencoded?.forEach(item => {
            output += `   • ${item.key}: ${item.value}\n`;
        });
    }
    
    return output;
}

function setAllSummaryItemsOpen(isOpen) {
    playSound(clickSound);
    const details = summaryContent.querySelectorAll('.summary-item-card');
    details.forEach(detail => detail.open = isOpen);
}

// Copy & Download
async function copyToClipboard() {
    playSound(clickSound);
    
    try {
        await navigator.clipboard.writeText(getSummaryText());
        playSound(successSound);
        showToast('Copied to clipboard!', 'success');
    } catch (error) {
        showToast('Failed to copy', 'error');
    }
}

function downloadSummary() {
    playSound(clickSound);
    
    const blob = new Blob([getSummaryText()], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `postman-summary-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    playSound(successSound);
    showToast('Summary downloaded!', 'success');
}

// Toast Notifications
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Initialize on load
init();
