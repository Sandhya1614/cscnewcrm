// ====== GRAPH (LINE CHART WITH AMOUNT LABELS) ======
document.addEventListener("DOMContentLoaded", function () {

    const thisMonthEl = document.getElementById("week-data-this");
    const lastMonthEl = document.getElementById("week-data-last");

    if (!thisMonthEl || !lastMonthEl) return;

    let thisMonth = [];
    let lastMonth = [];

    try {
        thisMonth = JSON.parse(thisMonthEl.textContent || "[]");
        lastMonth = JSON.parse(lastMonthEl.textContent || "[]");
    } catch (e) {
        console.log("Invalid JSON data");
        return;
    }

    const x = [50, 200, 350, 500, 650];
    const yTop = 120;
    const yBottom = 320;

    // ---- DYNAMIC MAX SCALE ----
    const allValues = [...thisMonth, ...lastMonth].map(v => Number(v) || 0);
    let maxValue = Math.max(...allValues, 0);

    function niceMax(val) {
        if (val <= 0) return 100;
        const magnitude = Math.pow(10, Math.floor(Math.log10(val)));
        const normalized = val / magnitude;
        let n;
        if (normalized <= 1) n = 1;
        else if (normalized <= 2) n = 2;
        else if (normalized <= 5) n = 5;
        else n = 10;
        return n * magnitude;
    }

    maxValue = niceMax(maxValue);

    function getY(value) {
        const safeValue = Math.max(0, Math.min(Number(value) || 0, maxValue));
        return yBottom - ((safeValue / maxValue) * (yBottom - yTop));
    }

    function buildPoints(data) {
        if (!Array.isArray(data)) return "";
        let points = "";
        data.forEach((value, index) => {
            if (index >= x.length) return;
            points += `${x[index]},${getY(value)} `;
        });
        return points.trim();
    }

    function buildAreaPoints(data) {
        if (!Array.isArray(data)) return "";
        const linePts = data.map((value, index) => {
            if (index >= x.length) return null;
            return `${x[index]},${getY(value)}`;
        }).filter(Boolean);

        const lastX = x[Math.min(data.length, x.length) - 1];
        const firstX = x[0];

        return [
            `${firstX},${yBottom}`,
            ...linePts,
            `${lastX},${yBottom}`
        ].join(' ');
    }

    // ---- DOTS + FULL ₹ AMOUNT LABELS ----
    function drawDotsAndLabels(data, groupId, dotClass, labelClass, labelAbove) {
        const group = document.getElementById(groupId);
        if (!group || !Array.isArray(data)) return;

        group.innerHTML = "";
        const ns = "http://www.w3.org/2000/svg";

        data.forEach((rawValue, index) => {
            if (index >= x.length) return;

            const value = Number(rawValue) || 0;
            const cx = x[index];
            const cy = getY(value);

            // Dot
            const circle = document.createElementNS(ns, "circle");
            circle.setAttribute("cx", cx);
            circle.setAttribute("cy", cy);
            circle.setAttribute("r", 6);
            circle.setAttribute("class", `chart-dot ${dotClass}`);

            const title = document.createElementNS(ns, "title");
            title.textContent = `₹${value.toLocaleString('en-IN')}`;
            circle.appendChild(title);

            group.appendChild(circle);

            // Full amount label
            const label = document.createElementNS(ns, "text");
            label.setAttribute("x", cx);
            label.setAttribute("y", labelAbove ? cy - 12 : cy + 22);
            label.setAttribute("class", `chart-value-label ${labelClass}`);
            label.textContent = `₹${value.toLocaleString('en-IN')}`;
            group.appendChild(label);
        });
    }

    function formatValue(val) {
        if (val >= 100000) return (val / 100000).toFixed(val % 100000 === 0 ? 0 : 1) + "L";
        if (val >= 1000) return (val / 1000).toFixed(val % 1000 === 0 ? 0 : 1) + "k";
        return val.toString();
    }

    function updateAxisLabels() {
        const labels = document.querySelectorAll(".over-chart-text");
        const steps = [0, 0.2, 0.4, 0.6, 0.8, 1];

        labels.forEach((label, i) => {
            if (i >= steps.length) return;
            const val = Math.round(maxValue * steps[i]);
            label.textContent = formatValue(val);
        });
    }

    updateAxisLabels();

    const blueLine = document.getElementById("line-this-month");
    const greenLine = document.getElementById("line-last-month");
    const areaThis = document.getElementById("area-this-month");
    const areaLast = document.getElementById("area-last-month");

    if (blueLine) blueLine.setAttribute("points", buildPoints(thisMonth));
    if (greenLine) greenLine.setAttribute("points", buildPoints(lastMonth));
    if (areaThis) areaThis.setAttribute("points", buildAreaPoints(thisMonth));
    if (areaLast) areaLast.setAttribute("points", buildAreaPoints(lastMonth));

    drawDotsAndLabels(thisMonth, "dots-this-month", "chart-dot-blue", "chart-value-label-blue", true);
    drawDotsAndLabels(lastMonth, "dots-last-month", "chart-dot-green", "chart-value-label-green", false);
});


// ====== NAVBAR ======

document.addEventListener("DOMContentLoaded", function () {

    const navToggle = document.getElementById("navToggle");
    const navTabs = document.getElementById("navTabs");

    if (!navToggle || !navTabs) return;

    let isOpen = false;

    navToggle.addEventListener("click", function (e) {
        e.stopPropagation();
        isOpen = !isOpen;
        navTabs.classList.toggle("show", isOpen);
    });

    navTabs.addEventListener("click", function (e) {
        e.stopPropagation();
    });

    document.addEventListener("click", function () {
        isOpen = false;
        navTabs.classList.remove("show");
    });

});

// ==================== STAFF ADDED SUCCESS MESSAGE HIDE ===========================

document.addEventListener('DOMContentLoaded', () => {

    const alerts = document.querySelectorAll('.alert');

    alerts.forEach(alert => {
        setTimeout(() => {
            alert.style.transition = 'opacity 0.5s ease';
            alert.style.opacity = '0';

            setTimeout(() => {
                alert.remove();
            }, 500);

        }, 3000);
    });

});