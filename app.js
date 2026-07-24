// --- Supabase Config ---
const SUPABASE_URL = 'https://zrziizhxxtkjhuxwxhep.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpyemlpemh4eHRramh1eHd4aGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ4NDA3MzksImV4cCI6MjEwMDQxNjczOX0.mzRICEsMn7FmBw8hZOvDHbFRg_rhkv5-WEcOb8FCAAQ';

// Renamed to 'dbClient' so it doesn't conflict with window.supabase
const dbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- Session State ---
let currentUser = null;
let currentProfile = null;

// Page Navigation
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.add('d-none'));
    document.getElementById(pageId).classList.remove('d-none');

    const nav = document.getElementById('main-nav');
    if (currentUser) {
        nav.classList.remove('d-none');
        if (pageId === 'home-page') loadHomeFeed();
        if (pageId === 'journal-page') renderJournal('All');
        if (pageId === 'requests-page') loadRequests();
        if (pageId === 'profile-page') loadProfile();
    } else {
        nav.classList.add('d-none');
    }
}

// --- Auth System ---
async function handleSignUp(e) {
    e.preventDefault();
    const username = document.getElementById('signup-username').value.trim();
    const email = document.getElementById('signup-email').value.trim();
    const password = document.getElementById('signup-password').value;

    const { data, error } = await dbClient.auth.signUp({ email, password });

    if (error) {
        alert(error.message);
        return;
    }

    if (data.user) {
        await dbClient.from('profiles').insert([{ id: data.user.id, username }]);
        alert("Account created successfully!");
        checkUser();
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;

    const { error } = await dbClient.auth.signInWithPassword({ email, password });

    if (error) {
        alert(error.message);
    } else {
        checkUser();
    }
}

async function handleLogout() {
    await dbClient.auth.signOut();
    currentUser = null;
    currentProfile = null;
    showPage('landing-page');
}

async function checkUser() {
    const { data: { session } } = await dbClient.auth.getSession();
    if (session) {
        currentUser = session.user;

        const { data } = await dbClient
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .maybeSingle();

        currentProfile = data || { username: currentUser.email.split('@')[0] };
        showPage('home-page');
    } else {
        showPage('landing-page');
    }
}

// --- Journal Entries ---
async function handleAddEntry(e) {
    e.preventDefault();
    const title = document.getElementById('entry-title').value;
    const mediaType = document.querySelector('input[name="entry-type"]:checked').value;
    const status = document.getElementById('entry-status').value;
    const rating = parseInt(document.getElementById('entry-rating').value);
    const review = document.getElementById('entry-review').value;

    const { error } = await dbClient.from('entries').insert([{
        user_id: currentUser.id,
        username: currentProfile.username || 'Anonymous',
        title,
        media_type: mediaType,
        status,
        rating,
        review
    }]);

    if (error) {
        alert(error.message);
    } else {
        document.querySelector('#add-entry-page form').reset();
        showPage('journal-page');
    }
}

async function renderJournal(filter) {
    let query = dbClient.from('entries').select('*').eq('user_id', currentUser.id);
    if (filter !== 'All') query = query.eq('media_type', filter);

    const { data: entries, error } = await query;
    const container = document.getElementById('journal-list');
    
    if (error || !entries || entries.length === 0) {
        container.innerHTML = '<p class="text-muted">No entries found.</p>';
        return;
    }

    container.innerHTML = '';
    entries.forEach(entry => {
        const stars = '★'.repeat(entry.rating) + '☆'.repeat(5 - entry.rating);
        container.innerHTML += `
            <div class="card mb-3 shadow-sm">
                <div class="card-body">
                    <h5 class="card-title">${entry.title}</h5>
                    <h6 class="card-subtitle mb-2 text-muted">${entry.media_type} - ${entry.status}</h6>
                    <div class="text-warning mb-2">${stars}</div>
                    <p class="card-text">"${entry.review}"</p>
                    <button onclick="deleteEntry(${entry.id})" class="btn btn-outline-danger btn-sm">Delete</button>
                </div>
            </div>
        `;
    });
}

function filterJournal(type, event) {
    document.querySelectorAll('.btn-group .btn').forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');
    renderJournal(type);
}

async function deleteEntry(id) {
    await dbClient.from('entries').delete().eq('id', id);
    renderJournal('All');
}

// --- Home Feed ---
async function loadHomeFeed() {
    const { data: entries } = await dbClient.from('entries').select('*').order('created_at', { ascending: false });
    const container = document.getElementById('friends-feed-list');
    
    if (!entries || entries.length === 0) {
        container.innerHTML = '<p class="text-muted">No recent posts yet. Add an entry to get started!</p>';
        return;
    }

    container.innerHTML = '';
    entries.forEach(entry => {
        const stars = '★'.repeat(entry.rating) + '☆'.repeat(5 - entry.rating);
        container.innerHTML += `
            <div class="card mb-3 shadow-sm">
                <div class="card-body">
                    <strong>@${entry.username}</strong> rated <strong>${entry.title}</strong> (${entry.media_type})
                    <div class="text-warning my-1">${stars}</div>
                    <p class="mb-0">"${entry.review}"</p>
                </div>
            </div>
        `;
    });
}

// --- Profile Loader ---
async function loadProfile() {
    document.getElementById('profile-username').innerText = `@${currentProfile.username || 'user'}`;
    document.getElementById('profile-bio').innerText = currentProfile.bio || "No bio added yet.";

    const { data: entries } = await dbClient.from('entries').select('*').eq('user_id', currentUser.id);
    
    if (entries) {
        const moviesCount = entries.filter(e => e.media_type === 'Movie').length;
        const booksCount = entries.filter(e => e.media_type === 'Book').length;
        document.getElementById('profile-movies-count').innerText = `${moviesCount} Movies`;
        document.getElementById('profile-books-count').innerText = `${booksCount} Books`;

        const recentContainer = document.getElementById('profile-recent-entries');
        recentContainer.innerHTML = entries.length === 0 ? '<p class="text-muted">No ratings added yet.</p>' : '';
        entries.slice(-5).reverse().forEach(entry => {
            const stars = '★'.repeat(entry.rating) + '☆'.repeat(5 - entry.rating);
            recentContainer.innerHTML += `
                <div class="card mb-2 shadow-sm">
                    <div class="card-body py-2">
                        <strong>${entry.title}</strong> (${entry.media_type}) - <span class="text-warning">${stars}</span>
                    </div>
                </div>
            `;
        });
    }
}

// Check session on startup
checkUser();