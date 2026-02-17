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
    soundToggle.addEventListener('click', toggleSound);
    searchInput.addEventListener('input', handleSearch);
    backToCollectionsBtn.addEventListener('click', backToCollections);
    clearSelectionBtn.addEventListener('click', clearAllSelections);
    copyBtn.addEventListener('click', copyToClipboard);
    downloadBtn.addEventListener('click', downloadSummary);
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
        
        if (!response.ok) throw new Error('Failed to fetch collection details');
        
        const data = await response.json();
        return data.collection;
    } catch (error) {
        return null;
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
    if (!collection) return 0;
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
function showCollectionDetail(collection) {
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

function backToCollections() {
    playSound(clickSound);
    state.currentCollection = null;
    
    collectionsSection.style.display = 'block';
    collectionDetailSection.style.display = 'none';
}

function renderFolderTree(collection) {
    folderTreeContainer.innerHTML = '';
    
    if (!collection || !collection.item) return;
    
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
    
    let summary = '';
    
    state.selectedEndpoints.forEach((endpoint, key) => {
        summary += formatEndpoint(endpoint);
        summary += '\n' + '═'.repeat(80) + '\n\n';
    });
    
    summaryContent.textContent = summary;
}

function formatEndpoint(endpoint) {
    let output = '';
    
    // Formatted Header per user request
    // ║ ENDPOINT: {{base_url}}/v1/user/send-money/wallet-to-user/info
    // ║ METHOD: GET
    
    // We use endpoint.url for the path in the header as requested
    output += `║ ENDPOINT: ${endpoint.url}\n`;
    output += `║ METHOD: ${endpoint.method.toUpperCase()}\n\n`;
    
    // Only show Body and Params if they exist
    // No "Header", "Path Variables" unless part of Params logic or user requests specifically.
    // User said: "okay and show save response no need others info if body and prams show must with field value"
    
    // Query Parameters
    const queryParams = extractQueryParams(endpoint.request);
    if (queryParams.length > 0) {
        output += `🔍 Query Parameters:\n`;
        queryParams.forEach(param => {
            output += `   • ${param.key}: ${param.value || param.description || '(optional)'}\n`;
        });
        output += '\n';
    }
    
    // Request Body
    if (endpoint.request && endpoint.request.body && endpoint.request.body.mode) {
        const bodyContent = formatRequestBody(endpoint.request.body);
        if (bodyContent.trim().length > 0) {
            output += `� Request Body:\n`;
            output += bodyContent;
            output += '\n\n';
        }
    }
    
    // Response Example
    if (endpoint.response && endpoint.response.length > 0) {
        output += `📥 Response Example:\n`;
        const response = endpoint.response[0]; // Taking the first response (usually success)
        if (response.body) {
            try {
                const formatted = JSON.stringify(JSON.parse(response.body), null, 2);
                output += formatted + '\n';
            } catch {
                output += response.body + '\n';
            }
        }
        output += '\n';
    }
    
    return output;
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

// Copy & Download
async function copyToClipboard() {
    playSound(clickSound);
    
    try {
        await navigator.clipboard.writeText(summaryContent.textContent);
        playSound(successSound);
        showToast('Copied to clipboard!', 'success');
    } catch (error) {
        showToast('Failed to copy', 'error');
    }
}

function downloadSummary() {
    playSound(clickSound);
    
    const blob = new Blob([summaryContent.textContent], { type: 'text/plain' });
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
