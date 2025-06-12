export function createPopup(church) {
    return `
    <div class="churchPopup">            
        <h1>${church.name}</h1>
        <p><i class="fas fa-map-marker-alt"></i> <a href="${church.map}" target="_blank">${church.address}</a></p>
        <p><i class="fas fa-phone"></i> ${formatPhoneNumber(church.phone)}</p>
        <p><i class="fas fa-globe"></i> <a href="${church.website}" target="_blank">${formatUrl(church.website)}</a></p>
        ${addMasses(church)}
        ${addDailyMasses(church)}
        ${addConfessions(church)}
        ${addAdorations(church)}
    </div>
    `
}

function addMasses(church) {
    return church.masses.length == 0 ? '' :
        `<h2>Masses</h2>
        <ul>
            ${church.masses.map(m => `<li>
                ${m.day} - ${formatTime(m.time)}
                ${m.note ? `<ul class="sublist"><li>${m.note}</li></ul>` : ''}
            </li>`).join('')}
        </ul>`;
}

function addDailyMasses(church) {
    return church.daily_masses.length == 0 ? '' :
        `<h2>Daily Masses</h2>
        <ul>
            ${church.daily_masses.map(m => `<li>
                ${m.day} - ${formatTime(m.time)}
                ${m.note ? `<ul class="sublist"><li>${m.note}</li></ul>` : ''}
            </li>`).join('')}
        </ul>`;
}

function addAdorations(church) {
    return church.adoration.length == 0 ? '' :
        `<h2>Adoration Times</h2>
        <ul>
            ${church.adoration.map(a => `<li>
                ${a.day} - ${formatTime(a.start)} - ${formatTime(a.end)}
                ${a.note ? `<ul class="sublist"><li>${a.note}</li></ul>` : ''}
            </li>`).join('')}
        </ul>`;
}

function addConfessions(church) {
    return church.confession.length == 0 ? '' :
        `<h2>Confession Times</h2>
                <ul>
                ${church.confession.map(c => `<li>
                    ${c.day} - ${formatTime(c.start)} - ${formatTime(c.end)}
                    ${c.note ? `<ul class="sublist"><li>${c.note}</li></ul>` : ''}
                </li>`).join('')}
            </ul>`;
}

function formatPhoneNumber(phoneNumber) {
    return phoneNumber.replace(/\D/g, '').replace(/(\d{1})(\d{3})(\d{3})(\d{4})/, '($2) $3-$4');
}

function formatUrl(url) {
    return url.replace(/^(https?:\/\/)?/i, '').replace(/\/$/, '');
}

function formatTime(time) {
    const hours = time.slice(0, 2);
    const minutes = time.slice(2);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const formattedHours = hours % 12 || 12;
    return `${formattedHours}:${minutes} ${ampm}`;
}