/* ============ DOWNLOAD FORMAT VALIDATION ============ */
function validateFormat() {

    const format = document.getElementById("format");
    const error = document.getElementById("error-msg");

    if (!format.value) {
        error.innerText = "Please select a format (Excel or PDF)";
        error.style.color = "red";
        return false;
    }

    error.innerText = "";

    setTimeout(() => { format.value = ""; }, 100);
    return true;
}


/* ============ HELPERS ============ */
/* Reads a fetch response safely: JSON when valid, readable error otherwise */
function parseResponse(res) {
    return res.text().then(text => {
        let data = null;
        try { data = JSON.parse(text); } catch (e) { data = null; }

        if (data === null) {
            return {
                ok: false,
                data: { error: `Could not load data (HTTP ${res.status}). Check the URL in urls.py or log in again.` }
            };
        }

        if (!res.ok && !data.error) {
            data.error = `Could not load data (HTTP ${res.status}).`;
        }

        return { ok: res.ok, data };
    });
}


const AH_COLORS = ['#2563eb', '#16a34a', '#dc2626', '#9333ea', '#ea580c', '#0891b2', '#ca8a04', '#be123c'];

function esc(value) {
    const div = document.createElement("div");
    div.textContent = value == null ? "" : String(value);
    return div.innerHTML;
}

function initials(name) {
    const parts = (name || "").trim().split(/\s+/);
    const a = parts[0] ? parts[0][0] : "";
    const b = parts.length > 1 ? parts[parts.length - 1][0] : "";
    return (a + b).toUpperCase();
}

function avatar(name, index, cls) {
    return `<div class="${cls || 'ah-av'}" style="background:${AH_COLORS[index % AH_COLORS.length]}">${esc(initials(name))}</div>`;
}


/* ============ FILTERS: AUTO-SUBMIT, DATE PICKER, BANNER ============ */
document.addEventListener("DOMContentLoaded", function () {

    const form = document.getElementById("filterForm");

    if (form) {

        form.querySelectorAll("select, input[type='date']").forEach(el => {
            el.addEventListener("change", () => form.submit());
        });

        const search = form.querySelector("input[name='search']");
        let timer;

        if (search) {
            search.addEventListener("input", () => {
                clearTimeout(timer);
                timer = setTimeout(() => form.submit(), 600);
            });
        }
    }

    document.querySelectorAll("input[type='date']").forEach(input => {
        input.addEventListener("click", function () {
            if (this.showPicker) this.showPicker();
        });
    });

    // Just-saved banner close
    const toastClose = document.getElementById("ahToastClose");
    if (toastClose) {
        toastClose.addEventListener("click", () => {
            document.getElementById("ahToast").remove();
        });
    }

    // Just-saved row opens automatically
    const fresh = document.querySelector(".ah-row.ah-fresh");
    if (fresh) toggleRow(fresh);
});


/* ============ ROW EXPAND (STUDENTS / CLASS LOG / AUDIT TRAIL) ============ */
const detailCache = {};

function toggleRow(row) {

    const xp = document.getElementById("xp-" + row.dataset.key);
    if (!xp) return;

    if (!xp.hidden) {
        xp.hidden = true;
        row.classList.remove("open");
        return;
    }

    xp.hidden = false;
    row.classList.add("open");

    if (xp.dataset.loaded) return;

    xp.innerHTML = '<div class="ah-empty">Loading...</div>';

    fetch(`${window.AH.detailUrl}${row.dataset.batch}/${row.dataset.date}/`)
        .then(parseResponse)
        .then(({ ok, data }) => {

            if (!ok) {
                xp.innerHTML = `<div class="ah-empty">${esc(data.error || "Unable to load details")}</div>`;
                return;
            }

            detailCache[row.dataset.key] = data;
            xp.dataset.loaded = "1";
            renderDetail(row.dataset.key, "st");
        })
        .catch(() => {
            xp.innerHTML = '<div class="ah-empty">Unable to load details. Please try again.</div>';
        });
}

function renderDetail(key, tab) {

    const xp = document.getElementById("xp-" + key);
    const data = detailCache[key];
    if (!xp || !data) return;

    const tabs = [
        ["st", `Students (${data.students.length})`],
        ["cl", "Class Log"],
        ["au", "Audit Trail"]
    ];

    let html = '<div class="ah-tabs">' + tabs.map(t =>
        `<button type="button" data-key="${esc(key)}" data-tab="${t[0]}" class="${tab === t[0] ? 'on' : ''}">${t[1]}</button>`
    ).join("") + "</div>";

    if (tab === "st") {

        html += '<div class="ah-sgrid">' + data.students.map((s, i) => {
            const remark = s.remarks ? " · " + esc(s.remarks) : "";
            return `<div class="ah-sc">
                ${avatar(s.name, i)}
                <span class="nm"><a class="ah-link" data-sid="${s.student_pk}">${esc(s.name)}</a>
                    <small>${esc(s.student_id)}${remark}</small></span>
                <span class="ah-pill ah-p${esc(s.status)}">${esc(s.status)}</span>
            </div>`;
        }).join("") + "</div>";

    } else if (tab === "cl") {

        if (data.class_log) {
            const c = data.class_log;
            html += `<div class="ah-cl">
                <div><small>Topic covered</small><b>${esc(c.topic)}</b></div>
                <div><small>Next topic</small><b>${esc(c.next_topic)}</b></div>
                <div><small>Duration</small><b>${esc(c.duration)}</b></div>
                <div><small>Trainer notes</small>${esc(c.notes)}</div>
            </div>`;
        } else {
            html += '<div class="ah-empty">No class log was saved for this day.</div>';
        }

    } else {

        html += '<div class="ah-tl">' + (data.audit.length ? data.audit.map(a =>
            `<div class="e ${a.type}"><b>${esc(a.title)}</b> by ${esc(a.by)}
                <small>${esc(a.when)} · ${esc(a.note)}</small></div>`
        ).join("") : '<div class="ah-empty">No audit entries.</div>') + "</div>";
    }

    if (data.can_edit) {
        html += `<div class="ah-actions"><a href="${esc(data.edit_url)}">Edit attendance</a></div>`;
    } else if (data.is_today === false) {
        html += '<div class="ah-actions"><span class="ah-lock">&#128274; Past attendance is locked. Only today\'s attendance can be edited.</span></div>';
    }

    xp.innerHTML = html;
}

/* ============ GLOBAL CLICK HANDLER ============ */
document.addEventListener("click", function (e) {

    // student name -> overall attendance drawer
    const link = e.target.closest(".ah-link");
    if (link) {
        openDrawer(link.dataset.sid);
        return;
    }

    // inner tabs of an expanded row
    const tab = e.target.closest(".ah-tabs button");
    if (tab) {
        renderDetail(tab.dataset.key, tab.dataset.tab);
        return;
    }

    // row expand / collapse
    const row = e.target.closest(".ah-row");
    if (row) toggleRow(row);
});


/* ============ STUDENT OVERALL ATTENDANCE DRAWER ============ */
let drawerData = null;
let drawerFilter = "";
let drawerShowAll = false;

function openDrawer(studentId) {

    const overlay = document.getElementById("drawerOverlay");
    const drawer = document.getElementById("studentDrawer");
    const body = document.getElementById("drawerBody");

    overlay.hidden = false;
    drawer.hidden = false;
    body.innerHTML = '<div class="ah-empty">Loading...</div>';

    fetch(`${window.AH.studentUrl}${studentId}/`)
        .then(parseResponse)
        .then(({ ok, data }) => {

            if (!ok) {
                body.innerHTML = `<div class="ah-empty">${esc(data.error || "Unable to load attendance")}</div>`;
                return;
            }

            drawerData = data;
            drawerFilter = "";
            drawerShowAll = false;
            renderDrawer();
        })
        .catch(() => {
            body.innerHTML = '<div class="ah-empty">Unable to load attendance. Please try again.</div>';
        });
}

function closeDrawer() {
    document.getElementById("drawerOverlay").hidden = true;
    document.getElementById("studentDrawer").hidden = true;
}

function renderDrawer() {

    const d = drawerData;
    const body = document.getElementById("drawerBody");
    if (!d) return;

    const riskClass = d.risk === "At Risk" ? "Absent" : d.risk === "Needs Attention" ? "Late" : "Present";
    const pctColor = d.percentage < 75 ? "var(--ah-red)" : "var(--ah-green)";

    const photo = d.photo_url
        ? `<img class="big" src="${esc(d.photo_url)}" alt="">`
        : `<div class="big" style="background:#4f46e5">${esc(initials(d.student_name))}</div>`;

    let html = `<div class="ah-dp">${photo}
        <div><h3>${esc(d.student_name)} <span class="ah-pill ah-p${riskClass}">${esc(d.risk)}</span></h3>
        <p>${esc(d.student_id)} · ${esc(d.course)} · ${esc(d.batch)} · Trainer: ${esc(d.trainer)}</p></div></div>`;

    html += `<div class="ah-ms">
        <div><b>${d.total}</b><small>Days</small></div>
        <div><b style="color:var(--ah-green)">${d.present}</b><small>Present</small></div>
        <div><b style="color:var(--ah-amber)">${d.late}</b><small>Late</small></div>
        <div><b style="color:var(--ah-red)">${d.absent}</b><small>Absent</small></div>
        <div><b style="color:${pctColor}">${d.percentage}%</b><small>Overall</small></div>
    </div>`;

    html += "<h4>Month-wise</h4>" + d.months.map(m => {
        const t = m.present + m.late + m.absent || 1;
        const pct = Math.round(((m.present + m.late) / t) * 100);
        return `<div class="ah-mo"><span>${esc(m.label)}</span>
            <div class="sk"><i class="gP" style="width:${m.present / t * 100}%"></i><i class="gL" style="width:${m.late / t * 100}%"></i><i class="gA" style="width:${m.absent / t * 100}%"></i></div>
            <b>${pct}%</b></div>`;
    }).join("");

    const list = d.timeline.filter(r => !drawerFilter || r.status === drawerFilter);
    const shown = drawerShowAll ? list : list.slice(0, 10);

    html += '<h4>All records with remarks</h4><div class="ah-mc">' +
        [["", "All"], ["Present", "Present"], ["Late", "Late"], ["Absent", "Absent"]].map(f =>
            `<button type="button" data-filter="${f[0]}" class="${drawerFilter === f[0] ? 'on' : ''}">${f[1]}</button>`
        ).join("") + "</div>";

    html += shown.map(r => `<div class="ah-rl">
        <div class="d">${esc(r.weekday)}, ${esc(r.date)}</div>
        <span class="ah-pill ah-p${esc(r.status)}">${esc(r.status)}</span>
        <div class="rm">${esc(r.remarks) || "-"}</div>
    </div>`).join("");

    if (list.length > 10) {
        html += `<button type="button" class="ah-more" id="drawerMore">${drawerShowAll ? "Show less" : "Show all " + list.length + " records"}</button>`;
    }

    body.innerHTML = html;
}

document.addEventListener("DOMContentLoaded", function () {

    document.getElementById("drawerClose").addEventListener("click", closeDrawer);
    document.getElementById("drawerOverlay").addEventListener("click", closeDrawer);

    document.addEventListener("keydown", e => {
        if (e.key === "Escape") closeDrawer();
    });

    document.getElementById("drawerBody").addEventListener("click", function (e) {

        const chip = e.target.closest(".ah-mc button");
        if (chip) {
            drawerFilter = chip.dataset.filter;
            drawerShowAll = false;
            renderDrawer();
            return;
        }

        if (e.target.id === "drawerMore") {
            drawerShowAll = !drawerShowAll;
            renderDrawer();
        }
    });
});