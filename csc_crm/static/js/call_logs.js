// Call-Logs //
    
function onlyLetters(input) {

    input.value = input.value.replace(/[^A-Za-z\s]/g, '');

}

// ---------------- Lead Name Search (Contact Name autocomplete) ----------------

let leadSearchTimer = null;
let selectedLeadId = null;

function searchLeadName(query) {

    selectedLeadId = null;
    const hiddenLead = document.getElementById("lead_id_input");
    if (hiddenLead) hiddenLead.value = "";

    const box = document.getElementById("lead_suggestions");

    clearTimeout(leadSearchTimer);

    query = query.trim();

    if (query.length < 2) {
        box.innerHTML = "";
        box.style.display = "none";
        return;
    }

    leadSearchTimer = setTimeout(() => {

        fetch(`${searchLeadNameUrl}?q=${encodeURIComponent(query)}`)
            .then(res => res.json())
            .then(data => renderLeadSuggestions(data.leads))
            .catch(() => {
                box.innerHTML = "";
                box.style.display = "none";
            });

    }, 300);
}

function renderLeadSuggestions(leads) {

    const box = document.getElementById("lead_suggestions");

    if (!leads || leads.length === 0) {
        box.innerHTML = `<div class="lead-suggestion-empty">No matching leads found</div>`;
        box.style.display = "block";
        return;
    }

    box.innerHTML = leads.map(lead => `
        <div class="lead-suggestion-item"
             onclick="selectLead(${lead.id}, '${lead.lead_name.replace(/'/g, "\\'")}', '${lead.phone_no}')">
            <span class="lead-suggestion-name">${lead.lead_name}</span>
            <span class="lead-suggestion-meta">${lead.phone_no} • ${lead.course_interested}</span>
        </div>
    `).join("");

    box.style.display = "block";
}

function selectLead(id, name, phone) {

    selectedLeadId = id;
    const hiddenLead = document.getElementById("lead_id_input");
    if (hiddenLead) hiddenLead.value = id;

    const nameInput = document.getElementById("lead_name");
    nameInput.value = name;

    const box = document.getElementById("lead_suggestions");
    box.innerHTML = "";
    box.style.display = "none";

    document.getElementById("name_error").innerText = "";
}

document.addEventListener("click", function (e) {

    const box = document.getElementById("lead_suggestions");
    const input = document.getElementById("lead_name");

    if (box && !box.contains(e.target) && e.target !== input) {
        box.style.display = "none";
    }
});


function validateForm() {

    let name = document.getElementById("lead_name").value.trim();

    let error = document.getElementById("name_error");

    if (name === "") {

        error.innerText = "Please enter a name";
        return false;
    }

    else {

        error.innerText = "";
        return true;
    }
}
window.onload = function () {

    let today = new Date().toISOString().split("T")[0];

    document.getElementById("call_date").setAttribute("max", today);

    document.getElementById("next_followup_date").setAttribute("min", today);

    toggleFollowupRequired();
    toggleDurationFields();

    document.getElementById("call_outcome").addEventListener("change", toggleFollowupRequired);
    document.getElementById("call_type").addEventListener("change", toggleDurationFields);
}

// A call that did not connect has no talk time
function toggleDurationFields() {

    const type = document.getElementById("call_type").value;
    const min = document.getElementById("duration_min");
    const sec = document.getElementById("duration_sec");

    const off = type === "did_not_connect";

    min.disabled = off;
    sec.disabled = off;

    if (off) {
        min.value = 0;
        sec.value = 0;
        document.getElementById("call_outcome").value = "Not Reachable";
        toggleFollowupRequired();
    }
}

function toggleFollowupRequired() {

    let outcome = document.getElementById("call_outcome").value;

    let followup = document.getElementById("next_followup_date");

    if (outcome === "Not Interested") {

        followup.required = false;
        followup.value = "";

    } else {

        followup.required = true;
    }
}