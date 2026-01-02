let adminPassword = null;

async function resetEvent() {
    if (!adminPassword) {
        showError('configError', 'Non autenticato');
        return;
    }

    if (!confirm('Sei sicuro di voler resettare tutto? Questo cancellerà tutti gli inviti e le risposte!')) {
        return;
    }

    try {
        const response = await fetch('/api/admin/reset', {
            method: 'POST',
            headers: {
                'x-admin-password': adminPassword
            }
        });

        const data = await response.json();

        if (response.ok) {
            showCopyFeedback('Evento resettato!');
            document.getElementById('eventName').value = '';
            document.getElementById('eventTime').value = '';
            document.getElementById('eventLocation').value = '';
            loadInvites();
        } else {
            showCopyFeedback('Errore nel reset');
        }
    } catch (err) {
        showCopyFeedback('Errore nel reset');
    }
}

async function saveConfig() {
    if (!adminPassword) {
        showCopyFeedback('Non autenticato');
        return;
    }

    const eventName = document.getElementById('eventName').value.trim();
    const eventTime = document.getElementById('eventTime').value;
    const eventLocation = document.getElementById('eventLocation').value.trim();
    const serviceFood = document.getElementById('serviceFood').checked;
    const serviceSleep = document.getElementById('serviceSleep').checked;
    const serviceRosmarino = document.getElementById('serviceRosmarino').checked;
    const serviceAlcohol = document.getElementById('serviceAlcohol').checked;

    if (!eventName || !eventTime || !eventLocation) {
        showCopyFeedback('Tutti i campi sono richiesti');
        return;
    }

    try {
        const response = await fetch('/api/admin/config', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-password': adminPassword
            },
            body: JSON.stringify({ 
                eventName, 
                eventTime, 
                eventLocation,
                serviceFood,
                serviceSleep,
                serviceRosmarino,
                serviceAlcohol
            })
        });

        const data = await response.json();

        if (response.ok) {
            showCopyFeedback('Configurazione salvata!');
        } else {
            showCopyFeedback('Errore nel salvare la configurazione');
        }
    } catch (err) {
        errorEl.textContent = 'Errore: ' + err.message;
        errorEl.style.display = 'block';
        successEl.style.display = 'none';
    }
}

async function loadConfig() {
    if (!adminPassword) return;

    try {
        const response = await fetch('/api/admin/config', {
            headers: { 'x-admin-password': adminPassword }
        });
        const data = await response.json();

        if (response.ok && data) {
            document.getElementById('eventName').value = data.eventName || '';
            document.getElementById('eventTime').value = data.eventTime || '';
            document.getElementById('eventLocation').value = data.eventLocation || '';
            document.getElementById('serviceFood').checked = data.serviceFood !== 0;
            document.getElementById('serviceSleep').checked = data.serviceSleep !== 0;
            document.getElementById('serviceRosmarino').checked = data.serviceRosmarino !== 0;
            document.getElementById('serviceAlcohol').checked = data.serviceAlcohol !== 0;
        }
    } catch (err) {
        console.error('Error loading config:', err);
    }
}

async function revokeInvite(code) {
    if (!adminPassword) {
        showError('createError', 'Non autenticato');
        return;
    }

    if (!confirm('Sei sicuro di voler revocare questo invito?')) {
        return;
    }

    try {
        const response = await fetch(`/api/admin/revoke/${code}`, {
            method: 'POST',
            headers: {
                'x-admin-password': adminPassword
            }
        });

        const data = await response.json();

        if (response.ok) {
            showCopyFeedback('Invito revocato!');
            loadInvites();
        } else {
            showCopyFeedback('Errore nella revoca');
        }
    } catch (err) {
        showCopyFeedback('Errore nella revoca');
    }
}

async function adminLogin() {
    const password = document.getElementById('adminPassword').value.trim();
    const errorEl = document.getElementById('loginError');

    if (!password) {
        errorEl.textContent = 'Password richiesta';
        errorEl.style.display = 'block';
        return;
    }

    try {
        const response = await fetch('/api/admin/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });

        const data = await response.json();

        if (response.ok) {
            adminPassword = password;
            localStorage.setItem('adminPassword', password);
            document.getElementById('loginSection').style.display = 'none';
            document.getElementById('adminDashboard').style.display = 'block';
            document.getElementById('logoutBtn').style.display = 'block';
            loadConfig();
            loadInvites();
        } else {
            errorEl.textContent = data.error || 'Accesso fallito';
            errorEl.style.display = 'block';
        }
    } catch (err) {
        errorEl.textContent = 'Errore: ' + err.message;
        errorEl.style.display = 'block';
    }
}

function logout() {
    adminPassword = null;
    localStorage.removeItem('adminPassword');
    document.getElementById('adminPassword').value = '';
    document.getElementById('loginSection').style.display = 'block';
    document.getElementById('adminDashboard').style.display = 'none';
    document.getElementById('logoutBtn').style.display = 'none';
}

async function createInvite() {
    if (!adminPassword) {
        showCopyFeedback('Non autenticato');
        return;
    }

    const name = document.getElementById('name').value.trim();

    if (!name) {
        showCopyFeedback('Nome richiesto');
        return;
    }

    try {
        const response = await fetch('/api/admin/create-invite', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-admin-password': adminPassword
            },
            body: JSON.stringify({ name })
        });

        const data = await response.json();

        if (response.ok) {
            showCopyFeedback(`Invito creato! Codice: ${data.code}`);
            document.getElementById('name').value = '';
            loadInvites();
        } else {
            showCopyFeedback('Errore nella creazione dell\'invito');
        }
    } catch (err) {
        showCopyFeedback('Errore nella creazione dell\'invito');
    }
}

async function loadInvites() {
    if (!adminPassword) return;

    try {
        const response = await fetch('/api/admin/invites', {
            headers: { 'x-admin-password': adminPassword }
        });
        const data = await response.json();
        const table = document.getElementById('invitesTable');

        if (!Array.isArray(data) || data.length === 0) {
            table.innerHTML = '<tr><td colspan="10" style="text-align: center; color: #999;">Nessun invito ancora</td></tr>';
            updateCounters(0, 0, 0, 0, 0);
            return;
        }

        // Calculate counters
        let participatingCount = 0, rosmarinoCount = 0, eatingCount = 0, alcoholCount = 0, sleepCount = 0;
        data.forEach(row => {
            if (row.response_id) {
                if (row.participating) participatingCount++;
                if (row.rosmarino) rosmarinoCount++;
                if (row.eating) eatingCount++;
                if (row.alcohol) alcoholCount++;
                if (row.sleep) sleepCount++;
            }
        });

        updateCounters(participatingCount, rosmarinoCount, eatingCount, alcoholCount, sleepCount);

        table.innerHTML = data.map(row => `
            <tr>
                <td>${row.name || '-'}</td>
                <td><span class="invite-code" onclick="copyInviteLink('${row.code}')" title="Clicca per copiare link">${row.code}</span></td>
                <td><span class="icon ${row.status === 'pending' ? 'icon-pending' : row.status === 'responded' ? 'icon-responded' : 'icon-canceled'}">${row.status === 'pending' ? '⏳' : row.status === 'responded' ? '✅' : '❌'}</span></td>
                <td>${row.response_id ? (row.participating ? '<span class="icon icon-yes">✅</span>' : '<span class="icon icon-no">❌</span>') : '-'}</td>
                <td>${row.response_id ? (row.rosmarino ? '<span class="icon icon-yes">✅</span>' : '<span class="icon icon-no">❌</span>') : '-'}</td>
                <td>${row.response_id ? (row.eating ? '<span class="icon icon-yes">✅</span>' : '<span class="icon icon-no">❌</span>') : '-'}</td>
                <td>${row.response_id ? (row.alcohol ? '<span class="icon icon-yes">✅</span>' : '<span class="icon icon-no">❌</span>') : '-'}</td>
                <td>${row.response_id ? (row.sleep ? '<span class="icon icon-yes">✅</span>' : '<span class="icon icon-no">❌</span>') : '-'}</td>
                <td>${row.submitted_at ? new Date(row.submitted_at + 'Z').toLocaleString('it-IT', { timeZone: 'Europe/Rome' }) : '-'}</td>
                <td>${row.status === 'pending' ? `<button class="revoke-btn" onclick="revokeInvite('${row.code}')">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="#000000" d="M6 19a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V7H6zM8 9h8v10H8zm7.5-5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
                </button>` : '-'}</td>
            </tr>
        `).join('');
    } catch (err) {
        console.error('Error loading invites:', err);
    }
}

function updateCounters(participating, rosmarino, eating, alcohol, sleep) {
    document.getElementById('participatingCount').textContent = `(${participating})`;
    document.getElementById('rosmarinoCount').textContent = `(${rosmarino})`;
    document.getElementById('eatingCount').textContent = `(${eating})`;
    document.getElementById('alcoholCount').textContent = `(${alcohol})`;
    document.getElementById('sleepCount').textContent = `(${sleep})`;
}

function copyInviteCode(code) {
    navigator.clipboard.writeText(code).then(() => {
        showCopyFeedback('Codice copiato!');
    }).catch(err => {
        console.error('Errore nel copiare il codice:', err);
    });
}

function copyInviteLink(code) {
    const link = `${window.location.origin}/?invite=${code}`;
    navigator.clipboard.writeText(link).then(() => {
        showCopyFeedback('Link copiato!');
    }).catch(err => {
        console.error('Errore nel copiare il link:', err);
    });
}

function showCopyFeedback(message) {
    const feedback = document.getElementById('copyFeedback');
    feedback.textContent = message;
    feedback.classList.add('show');
    setTimeout(() => {
        feedback.classList.remove('show');
    }, 2000);
}

function showError(elementId, message) {
    const errorEl = document.getElementById(elementId);
    errorEl.textContent = message;
    errorEl.style.display = 'block';
}

// Allow Enter key to login
document.getElementById('adminPassword').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') adminLogin();
});

// Check for saved session on page load
window.addEventListener('load', () => {
    const savedPassword = localStorage.getItem('adminPassword');
    if (savedPassword) {
        adminPassword = savedPassword;
        document.getElementById('loginSection').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'block';
        document.getElementById('logoutBtn').style.display = 'block';
        loadConfig();
        loadInvites();
    }

    // Load invites every 5 seconds if logged in
    setInterval(() => {
        if (adminPassword) loadInvites();
    }, 5000);
});