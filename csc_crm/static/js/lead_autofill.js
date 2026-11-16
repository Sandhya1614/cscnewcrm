// ============================================================
// STUDENT REGISTER - LEAD AUTOFILL
// Type in First Name -> matching leads appear -> click one ->
// first name, last name, email, phone and course are filled in.
// No match -> "No leads found".
// Load this file AFTER register.js
// ============================================================

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("studentForm");
    const firstNameInput = document.getElementById("id_first_name");

    if (!form || !firstNameInput) return;

    const searchUrl = form.dataset.leadSearchUrl;
    if (!searchUrl) return;

    const lastNameInput = document.getElementById("id_last_name");
    const emailInput = document.getElementById("id_email");
    const phoneInput = document.getElementById("id_phone_no");
    const courseInput = document.getElementById("id_course");

    firstNameInput.setAttribute("autocomplete", "off");

    // ---------- suggestion box ----------
    const wrapper = firstNameInput.closest(".input-wrapper") || firstNameInput.parentElement;
    wrapper.classList.add("lead-autofill-wrapper");

    const box = document.createElement("div");
    box.className = "lead-suggestions";
    wrapper.appendChild(box);

    function hideBox() {
        box.innerHTML = "";
        box.style.display = "none";
    }

    function setValue(input, value) {
        if (!input) return;
        input.value = value || "";
        // let register.js run its own validation / sanitising
        input.dispatchEvent(new Event("input", { bubbles: true }));
    }

    // ---------- course matching ----------
    // lead.course_interested is a choice value, the Course select holds
    // Course ids, so match on the visible course name.
    function selectCourse(lead) {

        if (!courseInput) return;

        const wanted = [lead.course_interested_label, lead.course_interested]
            .filter(Boolean)
            .map(v => String(v).trim().toLowerCase());

        if (wanted.length === 0) return;

        const options = Array.from(courseInput.options).filter(o => o.value);

        const match =
            options.find(o => wanted.includes(o.textContent.trim().toLowerCase())) ||
            options.find(o => {
                const text = o.textContent.trim().toLowerCase();
                return wanted.some(w => text.includes(w) || w.includes(text));
            });

        if (match) {
            courseInput.value = match.value;
            // register.js listens to "change" -> fills duration/fee + loads batches
            courseInput.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }

    // ---------- select a lead ----------
    function selectLead(lead) {

        const parts = (lead.lead_name || "").trim().split(/\s+/);
        const first = parts.shift() || "";
        const last = parts.join(" ");

        setValue(firstNameInput, first);
        setValue(lastNameInput, last);
        setValue(emailInput, lead.email);

        if (phoneInput) {
            const digits = (lead.phone_no || "").replace(/\D/g, "").slice(-10);
            setValue(phoneInput, digits);
        }

        selectCourse(lead);
        hideBox();
    }

    // ---------- render ----------
    function renderSuggestions(leads) {

        box.innerHTML = "";

        if (!leads || leads.length === 0) {
            const empty = document.createElement("div");
            empty.className = "lead-suggestion-empty";
            empty.textContent = "No leads found";
            box.appendChild(empty);
            box.style.display = "block";
            return;
        }

        leads.forEach(lead => {

            const item = document.createElement("div");
            item.className = "lead-suggestion-item";

            const name = document.createElement("span");
            name.className = "lead-suggestion-name";
            name.textContent = lead.lead_name;

            const meta = document.createElement("span");
            meta.className = "lead-suggestion-meta";
            meta.textContent = `${lead.phone_no || ""} • ${lead.course_interested_label || ""}`;

            item.appendChild(name);
            item.appendChild(meta);

            // mousedown fires before the input's blur, so the click is never lost
            item.addEventListener("mousedown", e => {
                e.preventDefault();
                selectLead(lead);
            });

            box.appendChild(item);
        });

        box.style.display = "block";
    }

    // ---------- search (debounced) ----------
    let timer = null;
    let requestId = 0;

    firstNameInput.addEventListener("input", () => {

        clearTimeout(timer);

        const query = firstNameInput.value.trim();

        if (query.length < 2) {
            hideBox();
            return;
        }

        timer = setTimeout(async () => {

            const thisRequest = ++requestId;

            try {
                const res = await fetch(`${searchUrl}?q=${encodeURIComponent(query)}`);
                if (!res.ok) throw new Error("search failed");
                const data = await res.json();

                // ignore out-of-order responses
                if (thisRequest !== requestId) return;

                renderSuggestions(data.leads);

            } catch (err) {
                console.error(err);
                hideBox();
            }

        }, 300);
    });

    firstNameInput.addEventListener("keydown", e => {
        if (e.key === "Escape") hideBox();
    });

    document.addEventListener("click", e => {
        if (!wrapper.contains(e.target)) hideBox();
    });

    // "Clear Form" button
    form.addEventListener("reset", hideBox);
});