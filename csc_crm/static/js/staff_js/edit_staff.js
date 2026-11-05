// ============================================================
// EDIT STAFF - COMPLETE JS
// ============================================================

document.addEventListener("DOMContentLoaded", function () {
    "use strict";

    const form = document.getElementById("staffMgmtForm");
    if (!form) return;

    console.log("EDIT STAFF JS LOADED");

    // ========================================================
    // HELPERS
    // ========================================================

    const $ = (id) => document.getElementById(id);

    const field = (name, id) =>
        (id && $(id)) || document.querySelector(`[name="${name}"]`);

    const value = (input) =>
        input ? String(input.value || "").trim() : "";

    function error(input, errorEl, message) {
        if (errorEl) errorEl.textContent = message;
        if (input) input.classList.add("error-input");
    }

    function clearError(input, errorEl) {
        if (errorEl) errorEl.textContent = "";
        if (input) input.classList.remove("error-input");
    }

    // ========================================================
    // FIELDS
    // ========================================================

    const employeeId = field("employee_id", "employeeIdInput");
    const firstName = field("first_name", "firstNameInput");
    const lastName = field("last_name", "lastNameInput");
    const email = field("email", "emailInput");
    const phone = field("phone", "phoneInput");

    const dob = field("date_of_birth", "dateOfBirthInput");
    const doj = field("date_of_joining", "dateOfJoiningInput");

    const gender = field("gender", "genderInput");
    const bloodGroup = field("blood_group", "bloodGroupInput");

    const emergencyName =
        field("emergency_contact_name", "emergencyContactNameInput");

    const emergencyPhone =
        field("emergency_contact_phone", "emergencyContactPhoneInput");

    const role = field("role", "roleInput");
    const department = field("department", "departmentInput");
    const status = field("status", "statusInput");

    const reportingManager =
        field("reporting_manager", "reportingManagerInput");

    const password = field("password", "passwordInput");
    const confirmPassword =
        field("confirm_password", "confirmPasswordInput");

    const skillsInput = $("skillsTypedInput");
    const skillsHidden = field("skills", "skillsInput");

    const monthlyTarget =
        field("monthly_target", "monthlyTargetInput");

    const performanceRating =
        field("performance_rating", "performanceRatingInput");

    const updateBtn = $("updateStaffBtn");

    // ========================================================
    // PHOTO FIELDS
    // ========================================================

    const photoInput =
        $("profilePhotoInput") ||
        document.querySelector('[name="profile_photo"]');

    const photoBox = $("photoDropzone");
    const removePhotoBtn = $("removePhotoBtn");
    const photoProgress = $("photoProgressBar");
    const photoText = $("progressText");
    const photoError = $("profilePhotoError");

    // ========================================================
    // DOCUMENT FIELDS (kept optional — only wired if present)
    // ========================================================

    const documentInput = $("documentInput");
    const removeDocBtn = $("removeDocumentBtn");
    const documentProgress = $("documentProgressBar");
    const documentText = $("documentprogressText");
    const documentError = $("documentError");

    // ========================================================
    // ERRORS
    // ========================================================

    const errors = {
        firstName: $("firstNameError"),
        lastName: $("lastNameError"),
        email: $("emailError"),
        phone: $("phoneError"),
        dob: $("dateOfBirthError"),
        doj: $("dateOfJoiningError"),
        role: $("roleError"),
        status: $("statusError"),
        emergencyName: $("emergencyContactNameError"),
        emergencyPhone: $("emergencyContactPhoneError"),
        password: $("passwordError"),
        confirmPassword: $("confirmPasswordError"),
        skills: $("skillsError"),
        monthlyTarget: $("monthlyTargetError"),
        performance: $("performanceRatingError")
    };

    // ========================================================
    // ORIGINAL VALUES
    // ========================================================

    const original = {
        firstName: value(firstName),
        lastName: value(lastName),
        email: value(email),
        phone: value(phone),

        dob: dob ? dob.value : "",
        doj: doj ? doj.value : "",

        gender: gender ? gender.value : "",
        bloodGroup: bloodGroup ? bloodGroup.value : "",

        emergencyName: value(emergencyName),
        emergencyPhone: value(emergencyPhone),

        role: role ? role.value : "",
        department: department ? department.value : "",
        status: status ? status.value : "",

        reportingManager:
            reportingManager ? reportingManager.value : "",

        monthlyTarget:
            monthlyTarget ? monthlyTarget.value : "",

        performanceRating:
            performanceRating ? performanceRating.value : ""
    };

    // ========================================================
    // EMPLOYEE ID
    // ========================================================

    if (employeeId) {
        employeeId.readOnly = true;
    }

    // ========================================================
    // ROLE -> DEPARTMENT
    // ========================================================

    const roleDepartmentMap = {
        "Developer": "Technical",
        "Trainer": "Technical",

        "Admin": "Management",
        "Manager": "Management",
        "HR": "Management",

        "Sales Exec": "Sales Department",
        "Sales Exec Lead": "Sales Department",

        "Digital Marketing": "Marketing",
        "Content Creator": "Marketing",
        "Marketing Lead": "Marketing"
    };

    function getRoleText() {
        if (!role) return "";

        const option =
            role.options[role.selectedIndex];

        return option
            ? option.text.trim()
            : "";
    }

    function setDepartmentFromRole() {
        if (!role || !department) return;

        const roleText = getRoleText();
        const departmentName =
            roleDepartmentMap[roleText];

        if (!departmentName) return;

        for (const option of department.options) {
            if (
                option.text.trim().toLowerCase() ===
                departmentName.toLowerCase()
            ) {
                department.value = option.value;
                break;
            }
        }
    }

    // IMPORTANT: never set department.disabled = true.
    // Disabled fields are excluded from form submission entirely,
    // which was silently failing form.is_valid() on every edit
    // (department is a required field) and blocking every save.
    // Block interaction instead, same as add_staff.js, so the
    // value still submits.
    if (department) {
        department.addEventListener('mousedown', (e) => e.preventDefault());
        department.addEventListener('keydown', (e) => e.preventDefault());
        department.addEventListener('focus', () => department.blur());
    }

    // ========================================================
    // REPORTING MANAGER
    // ========================================================

    const REPORTING_MANAGER_RULES = {
        'Admin': null,
        'Manager': ['Admin'],
        'Developer': ['Admin', 'Manager'],
        'Trainer': ['Admin', 'Manager'],
        'HR': ['Admin', 'Manager'],

        'Sales Exec Lead': ['Admin', 'Manager'],
        'Marketing Lead': ['Admin', 'Manager'],

        'Digital Marketing': ['Marketing Lead'],
        'Content Creator': ['Marketing Lead'],
        'Sales Exec': ['Sales Exec Lead'],
    };

    let staffRoles = {};

    const staffRolesElement =
        $("staffRolesData");

    if (staffRolesElement) {
        try {
            staffRoles =
                JSON.parse(
                    staffRolesElement.textContent
                ) || {};
        } catch (e) {
            console.error(
                "staffRolesData JSON error:",
                e
            );
        }
    }

    let managerOptions = [];

    if (reportingManager) {
        managerOptions =
            Array.from(
                reportingManager.options
            ).filter(
                option => option.value !== ""
            );
    }

    function getManagerRole(option) {

        if (!option) return "";

        if (option.dataset.role) {
            return option.dataset.role.trim();
        }

        const data =
            staffRoles[option.value];

        if (typeof data === "string") {
            return data.trim();
        }

        if (data && typeof data === "object") {
            return (
                data.role ||
                data.role_name ||
                data.staff_role ||
                ""
            ).toString().trim();
        }

        return "";
    }

    // ------------------------------------------------------
    // FIX: was referencing the undefined variable
    // `REPORTING_RULES` (typo) instead of the real
    // `REPORTING_MANAGER_RULES`. That threw a silent
    // ReferenceError every time this ran, which broke
    // everything chained after it (validateRole,
    // validateMonthlyTarget, checkChanges, and even the
    // page-load INITIALIZE calls at the bottom of this file).
    // ------------------------------------------------------

    function normalizeRoleText(text) {
        return (text || "").toString().trim().toLowerCase();
    }

    function filterReportingManagers() {

        if (!role || !reportingManager) {
            return;
        }

        const selectedRole = getRoleText();
        const selectedRoleNorm = normalizeRoleText(selectedRole);
        const group = $("reportingManagerGroup");

        // Find the rule by normalized comparison (case/whitespace safe),
        // instead of relying on an exact string match against
        // REPORTING_MANAGER_RULES keys.
        let allowedRoles;
        let ruleKeyFound = false;

        for (const key in REPORTING_MANAGER_RULES) {
            if (normalizeRoleText(key) === selectedRoleNorm) {
                allowedRoles = REPORTING_MANAGER_RULES[key];
                ruleKeyFound = true;
                break;
            }
        }

        if (!ruleKeyFound) {
            allowedRoles = selectedRoleNorm ? 'ANY' : null;
        }

        // Normalize the allowed list once for comparison below.
        const allowedRolesNorm =
            Array.isArray(allowedRoles)
                ? allowedRoles.map(normalizeRoleText)
                : allowedRoles;

        if (allowedRoles === null) {
            reportingManager.value = "";
            reportingManager.required = false;
            reportingManager.innerHTML = '<option value="">---------</option>';

            if (group) {
                group.style.display = "none";
            }

            checkChanges();
            return;
        }

        if (group) {
            group.style.display = "";
        }

        // Reporting Manager is optional — never force it as required.
        reportingManager.required = false;

        const currentValue = reportingManager.value;

        reportingManager.innerHTML = "";

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "---------";
        reportingManager.appendChild(placeholder);

        managerOptions.forEach(function (option) {

            const managerRole = getManagerRole(option);
            const managerRoleNorm = normalizeRoleText(managerRole);

            if (allowedRolesNorm === 'ANY' || allowedRolesNorm.includes(managerRoleNorm)) {

                const newOption = option.cloneNode(true);
                reportingManager.appendChild(newOption);
            }
        });

        // Keep the previously-selected manager if it's still
        // a valid option after filtering (important for edit page
        // so the existing reporting manager doesn't get wiped out).
        const exists = Array.from(reportingManager.options).some(
            option => option.value === currentValue
        );

        reportingManager.value = exists ? currentValue : "";

        checkChanges();
    }

    // ========================================================
    // ROLE CHANGE
    // ========================================================

    if (role) {

        role.addEventListener(
            "change",
            function () {

                setDepartmentFromRole();

                filterReportingManagers();

                toggleMonthlyTarget();

                validateRole();

                validateMonthlyTarget();

                checkChanges();
            }
        );
    }

    // ========================================================
    // ROLE VALIDATION
    // ========================================================

    function validateRole() {

        if (!role) return true;

        if (!role.value) {

            error(
                role,
                errors.role,
                "Role is required."
            );

            return false;
        }

        clearError(
            role,
            errors.role
        );

        return true;
    }

    // ========================================================
    // STATUS
    // ========================================================

    function validateStatus() {

        if (!status) return true;

        if (!status.value) {

            error(
                status,
                errors.status,
                "Status is required."
            );

            return false;
        }

        clearError(
            status,
            errors.status
        );

        return true;
    }

    if (status) {
        status.addEventListener(
            "change",
            function () {
                validateStatus();
                checkChanges();
            }
        );
    }

    // ========================================================
    // EMAIL
    // ========================================================

    const emailPattern =
        /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

    function validateEmail() {

        if (!email) return true;

        const val =
            value(email).toLowerCase();

        if (!val) {

            error(
                email,
                errors.email,
                "Email is required."
            );

            return false;
        }

        if (!emailPattern.test(val)) {

            error(
                email,
                errors.email,
                "Please enter a valid email address."
            );

            return false;
        }

        clearError(
            email,
            errors.email
        );

        return true;
    }

    async function duplicateEmail() {

        if (!email || !validateEmail()) {
            return false;
        }

        const current =
            value(email);

        if (
            current.toLowerCase() ===
            original.email.toLowerCase()
        ) {
            return true;
        }

        try {

            const response =
                await fetch(
                    `/staff/check-email/?email=${encodeURIComponent(current)}`
                );

            const data =
                await response.json();

            if (data.exists) {

                error(
                    email,
                    errors.email,
                    "This email already exists!"
                );

                return false;
            }

            clearError(
                email,
                errors.email
            );

            return true;

        } catch (e) {

            console.error(e);

            return true;
        }
    }

    if (email) {

        email.addEventListener(
            "input",
            function () {
                validateEmail();
                checkChanges();
            }
        );

        email.addEventListener(
            "blur",
            duplicateEmail
        );
    }

    // ========================================================
    // PHONE
    // ========================================================

    // 10-digit Indian mobile (6/7/8/9 start), no +91 - rule lives in phone_validation.js

    function sanitizePhone(input) {

        if (!input) return;

        input.value =
            CSCPhone.sanitize(input.value);
    }

    function validatePhone() {

        if (!phone) return true;

        const val =
            value(phone);

        const phoneMessage =
            CSCPhone.error(val);

        if (phoneMessage) {

            error(
                phone,
                errors.phone,
                phoneMessage
            );

            return false;
        }

        clearError(
            phone,
            errors.phone
        );

        return true;
    }

    async function duplicatePhone() {

        if (!phone || !validatePhone()) {
            return false;
        }

        const current =
            value(phone);

        if (current === original.phone) {
            return true;
        }

        try {

            const response =
                await fetch(
                    `/staff/check-phone/?phone=${encodeURIComponent(current)}`
                );

            const data =
                await response.json();

            if (data.exists) {

                error(
                    phone,
                    errors.phone,
                    "This phone number already exists!"
                );

                return false;
            }

            clearError(
                phone,
                errors.phone
            );

            return true;

        } catch (e) {

            console.error(e);

            return true;
        }
    }

    if (phone) {

        phone.addEventListener(
            "input",
            function () {

                sanitizePhone(phone);
                validatePhone();
                checkChanges();
            }
        );

        phone.addEventListener(
            "blur",
            duplicatePhone
        );
    }


    // ========================================================
    // NAME
    // ========================================================

    function validateName(
        input,
        errorEl,
        label
    ) {

        if (!input) return true;

        input.value =
            input.value
                .replace(
                    /[^a-zA-Z\s]/g,
                    ""
                )
                .substring(0, 50);

        if (!value(input)) {

            error(
                input,
                errorEl,
                `${label} is required.`
            );

            return false;
        }

        clearError(
            input,
            errorEl
        );

        return true;
    }

    if (firstName) {

        firstName.addEventListener(
            "input",
            function () {

                validateName(
                    firstName,
                    errors.firstName,
                    "First name"
                );

                checkChanges();
            }
        );
    }

    if (lastName) {

        lastName.addEventListener(
            "input",
            function () {

                validateName(
                    lastName,
                    errors.lastName,
                    "Last name"
                );

                checkChanges();
            }
        );
    }

    // ========================================================
    // EMERGENCY CONTACT
    // ========================================================

    function validateEmergencyName() {

        if (!emergencyName) return true;

        emergencyName.value =
            emergencyName.value
                .replace(
                    /[^a-zA-Z\s]/g,
                    ""
                )
                .substring(0, 40);

        const val = value(emergencyName);

        if (val.length > 40) {

            error(
                emergencyName,
                errors.emergencyName,
                "Emergency contact name cannot exceed 40 characters."
            );

            return false;
        }

        clearError(
            emergencyName,
            errors.emergencyName
        );

        return true;
    }

    function validateEmergencyPhone() {

        if (!emergencyPhone) return true;

        const val =
            value(emergencyPhone);

        if (!val) {

            clearError(
                emergencyPhone,
                errors.emergencyPhone
            );

            return true;
        }

        const emergencyMessage =
            CSCPhone.error(val);

        if (emergencyMessage) {

            error(
                emergencyPhone,
                errors.emergencyPhone,
                emergencyMessage
            );

            return false;
        }

        clearError(
            emergencyPhone,
            errors.emergencyPhone
        );

        return true;
    }

    if (emergencyName) {

        emergencyName.addEventListener(
            "input",
            function () {
                validateEmergencyName();
                checkChanges();
            }
        );

        emergencyName.addEventListener(
            "blur",
            validateEmergencyName
        );
    }

    if (emergencyPhone) {

        emergencyPhone.addEventListener(
            "input",
            function () {

                sanitizePhone(
                    emergencyPhone
                );

                validateEmergencyPhone();
                checkChanges();
            }
        );

        emergencyPhone.addEventListener(
            "blur",
            validateEmergencyPhone
        );

        emergencyPhone.addEventListener(
            "focus",
            function () {
                if (this.value.trim() === "") return;
                validateEmergencyPhone();
            }
        );
    }

    // ========================================================
    // PASSWORD
    // ========================================================

    function validatePassword() {

        if (!password || !confirmPassword) {
            return true;
        }

        password.setAttribute("maxlength", "20");
        confirmPassword.setAttribute("maxlength", "20");

        if (password.value.length > 20) {
            password.value = password.value.substring(0, 20);
        }

        if (confirmPassword.value.length > 20) {
            confirmPassword.value = confirmPassword.value.substring(0, 20);
        }

        /*
            Blank = keep old password
        */

        if (
            !password.value &&
            !confirmPassword.value
        ) {

            clearError(
                password,
                errors.password
            );

            clearError(
                confirmPassword,
                errors.confirmPassword
            );

            return true;
        }

        if (!password.value) {
            error(
                password,
                errors.password,
                "Please enter the new password."
            );
            return false;
        }

        if (!confirmPassword.value) {
            error(
                confirmPassword,
                errors.confirmPassword,
                "Please confirm the new password."
            );
            return false;
        }

        if (
            password.value !==
            confirmPassword.value
        ) {

            error(
                confirmPassword,
                errors.confirmPassword,
                "Passwords do not match."
            );

            return false;
        }

        clearError(
            password,
            errors.password
        );

        clearError(
            confirmPassword,
            errors.confirmPassword
        );

        return true;
    }

    if (password) {

        password.addEventListener(
            "input",
            function () {

                validatePassword();
                checkChanges();
            }
        );

        password.addEventListener(
            "blur",
            validatePassword
        );
    }

    if (confirmPassword) {

        confirmPassword.addEventListener(
            "input",
            function () {

                validatePassword();
                checkChanges();
            }
        );

        confirmPassword.addEventListener(
            "blur",
            validatePassword
        );
    }

    // ========================================================
    // DATE
    // ========================================================

    const todayForMax = new Date();
    todayForMax.setHours(0, 0, 0, 0);

    const todayString =
        todayForMax.getFullYear() + "-" +
        String(todayForMax.getMonth() + 1).padStart(2, "0") + "-" +
        String(todayForMax.getDate()).padStart(2, "0");

    if (dob) {
        dob.setAttribute("max", todayString);

        dob.addEventListener("click", () => {
            if (dob.showPicker) dob.showPicker();
        });
    }

    if (doj) {
        doj.removeAttribute("max");

        doj.addEventListener("click", () => {
            if (doj.showPicker) doj.showPicker();
        });
    }

    function parseDate(val) {

        if (!val) return null;

        const parts =
            val.split("-").map(Number);

        if (parts.length !== 3) {
            return null;
        }

        const date =
            new Date(
                parts[0],
                parts[1] - 1,
                parts[2]
            );

        if (
            date.getFullYear() !== parts[0] ||
            date.getMonth() !== parts[1] - 1 ||
            date.getDate() !== parts[2]
        ) {
            return null;
        }

        date.setHours(0, 0, 0, 0);

        return date;
    }

    function calculateAge(dobDate, dojDate) {
        let age = dojDate.getFullYear() - dobDate.getFullYear();
        const monthDiff = dojDate.getMonth() - dobDate.getMonth();
        if (
            monthDiff < 0 ||
            (monthDiff === 0 && dojDate.getDate() < dobDate.getDate())
        ) {
            age--;
        }
        return age;
    }

    function validateDates() {

        let valid = true;

        clearError(
            dob,
            errors.dob
        );

        clearError(
            doj,
            errors.doj
        );

        const dobDate =
            dob ? parseDate(dob.value) : null;

        const dojDate =
            doj ? parseDate(doj.value) : null;

        const today =
            new Date();

        today.setHours(
            0, 0, 0, 0
        );

        if (
            dob &&
            dob.value &&
            !dobDate
        ) {

            error(
                dob,
                errors.dob,
                "Invalid date of birth."
            );

            valid = false;
        }

        if (
            dobDate &&
            dobDate > today
        ) {

            error(
                dob,
                errors.dob,
                "Date of birth cannot be in the future."
            );

            valid = false;
        }

        if (
            doj &&
            !doj.value
        ) {

            error(
                doj,
                errors.doj,
                "Date of joining is required."
            );

            valid = false;
        }

        if (
            doj &&
            doj.value &&
            !dojDate
        ) {
            error(
                doj,
                errors.doj,
                "Invalid date of joining."
            );

            valid = false;
        }

        if (
            dobDate &&
            dojDate
        ) {

            if (dojDate < dobDate) {

                error(
                    doj,
                    errors.doj,
                    "Date of joining cannot be before date of birth."
                );

                error(
                    dob,
                    errors.dob,
                    "Date of joining cannot be before date of birth."
                );

                valid = false;

            } else if (calculateAge(dobDate, dojDate) < 18) {

                error(
                    doj,
                    errors.doj,
                    "Employee must be at least 18 years old on date of joining."
                );

                error(
                    dob,
                    errors.dob,
                    "Employee must be at least 18 years old on date of joining."
                );

                valid = false;
            }
        }

        return valid;
    }

    if (dob) {
        dob.addEventListener(
            "change",
            function () {
                validateDates();
                checkChanges();
            }
        );
    }

    if (doj) {
        doj.addEventListener(
            "change",
            function () {
                validateDates();
                checkChanges();
            }
        );
    }

    // ========================================================
    // SKILLS
    // ========================================================

    const MAX_SKILL_LENGTH = 30;

    function parseTypedSkills(raw) {
        const skills = raw
            .split(",")
            .map(s => s.trim())
            .filter(s => s.length > 0)
            .map(s => s.length > MAX_SKILL_LENGTH ? s.substring(0, MAX_SKILL_LENGTH) : s);

        const seen = new Set();
        const unique = [];

        skills.forEach(skill => {
            const key = skill.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                unique.push(skill);
            }
        });

        return unique;
    }

    function loadSkills() {

        if (!skillsInput || !skillsHidden) {
            return;
        }

        const raw =
            skillsHidden.value.trim();

        if (!raw) return;

        try {

            const parsed =
                JSON.parse(raw);

            if (Array.isArray(parsed)) {

                skillsInput.value =
                    parsed
                        .map(
                            s =>
                                typeof s === "string"
                                    ? s
                                    : s.name
                        )
                        .filter(Boolean)
                        .join(", ");
            }

        } catch (e) {

            console.warn(
                "Existing skills could not be parsed."
            );
        }
    }

    function validateSkills() {

        if (!skillsInput || !skillsHidden) {
            return true;
        }

        const raw =
            skillsInput.value.trim();

        if (!raw) {

            skillsHidden.value = "[]";

            clearError(
                skillsInput,
                errors.skills
            );

            return true;
        }

        const parts =
            raw.split(",")
                .map(s => s.trim())
                .filter(Boolean);

        for (const skill of parts) {

            if (/\d/.test(skill)) {

                error(
                    skillsInput,
                    errors.skills,
                    `Skill '${skill}' should not contain numbers.`
                );

                return false;
            }

            if (!/^[A-Za-z\s.+#-]+$/.test(skill)) {

                error(
                    skillsInput,
                    errors.skills,
                    `Skill '${skill}' contains invalid characters.`
                );

                return false;
            }
        }

        const skills = parseTypedSkills(raw);

        skillsHidden.value =
            JSON.stringify(skills);

        clearError(
            skillsInput,
            errors.skills
        );

        return true;
    }

    if (skillsInput) {

        skillsInput.addEventListener(
            "input",
            function () {

                skillsInput.value =
                    skillsInput.value.replace(
                        /[^A-Za-z\s,.+#-]/g,
                        ""
                    );

                validateSkills();
                checkChanges();
            }
        );

        skillsInput.addEventListener(
            "blur",
            validateSkills
        );

        skillsInput.addEventListener("keydown", (e) => {
            if (/^[0-9]$/.test(e.key)) {
                e.preventDefault();
            }
        });

        skillsInput.addEventListener("paste", (e) => {
            e.preventDefault();
            const text = (e.clipboardData || window.clipboardData).getData("text");
            const cleaned = text.replace(/[^A-Za-z\s,.+#-]/g, "");
            const start = skillsInput.selectionStart;
            const end = skillsInput.selectionEnd;
            skillsInput.value =
                skillsInput.value.substring(0, start) + cleaned + skillsInput.value.substring(end);
            skillsInput.dispatchEvent(new Event("input"));
        });
    }

    loadSkills();

    // ========================================================
    // MONTHLY TARGET
    // ========================================================

    const MAX_MONTHLY_TARGET = 1000000;

    const monthlyGroup =
        $("monthlyTargetGroup");

    const targetRoles = [
        "manager",
        "sales exec",
        "sales exec lead"
    ];

    function isTargetRole() {

        return targetRoles.includes(
            getRoleText()
                .toLowerCase()
                .trim()
        );
    }

    function toggleMonthlyTarget() {

        if (!monthlyGroup || !monthlyTarget) {
            return;
        }

        if (isTargetRole()) {

            monthlyGroup.style.display = "";
            monthlyTarget.disabled = false;
            monthlyTarget.required = true;
            monthlyTarget.setAttribute("required", "required");

        } else {

            monthlyGroup.style.display = "none";
            monthlyTarget.value = "";
            monthlyTarget.disabled = true;
            monthlyTarget.required = false;
            monthlyTarget.removeAttribute("required");
            clearError(monthlyTarget, errors.monthlyTarget);
        }
    }

    function sanitizeMonthlyTargetInput() {
        if (!monthlyTarget) return;

        let val = monthlyTarget.value;
        val = val.replace(/[^0-9.]/g, "");

        const parts = val.split(".");
        if (parts.length > 2) val = parts[0] + "." + parts.slice(1).join("");

        if (val.includes(".")) {
            const [whole, decimal] = val.split(".");
            val = whole + "." + decimal.substring(0, 2);
        }

        monthlyTarget.value = val;
    }

    function validateMonthlyTarget() {

        if (!monthlyTarget) {
            return true;
        }

        if (!isTargetRole()) {
            clearError(monthlyTarget, errors.monthlyTarget);
            return true;
        }

        const val = value(monthlyTarget);

        if (!val) {

            error(
                monthlyTarget,
                errors.monthlyTarget,
                "Monthly target is required."
            );

            return false;
        }

        const validAmountPattern = /^\d+(\.\d{1,2})?$/;

        if (!validAmountPattern.test(val)) {

            error(
                monthlyTarget,
                errors.monthlyTarget,
                "Monthly target must contain only numbers."
            );

            return false;
        }

        const amount =
            Number(val);

        if (amount <= 0) {

            error(
                monthlyTarget,
                errors.monthlyTarget,
                "Monthly target must be greater than 0."
            );

            return false;
        }

        if (amount > MAX_MONTHLY_TARGET) {

            error(
                monthlyTarget,
                errors.monthlyTarget,
                "Monthly target must not exceed \u20B910,00,000."
            );

            return false;
        }

        clearError(
            monthlyTarget,
            errors.monthlyTarget
        );

        return true;
    }

    if (monthlyTarget) {

        monthlyTarget.addEventListener(
            "input",
            function () {

                sanitizeMonthlyTargetInput();
                validateMonthlyTarget();
                checkChanges();
            }
        );

        monthlyTarget.addEventListener(
            "blur",
            validateMonthlyTarget
        );

        monthlyTarget.addEventListener("keydown", (e) => {
            const blockedKeys = ["e", "E", "+", "-"];
            if (blockedKeys.includes(e.key)) e.preventDefault();
        });
    }

    // ========================================================
    // PERFORMANCE
    // ========================================================

    function validatePerformance() {

        if (!performanceRating) {
            return true;
        }

        const rating =
            Number(performanceRating.value);

        if (
            !performanceRating.value ||
            rating < 1 ||
            rating > 5
        ) {

            error(
                performanceRating,
                errors.performance,
                "Performance rating must be between 1 and 5."
            );

            return false;
        }

        clearError(
            performanceRating,
            errors.performance
        );

        return true;
    }

    if (performanceRating) {

        performanceRating.addEventListener(
            "change",
            function () {

                validatePerformance();
                checkChanges();
            }
        );
    }

    // ========================================================
    // PASSPORT PHOTO UPLOAD
    // ========================================================

    if (photoInput) {

        photoBox?.addEventListener("click", () => photoInput.click());

        photoInput.addEventListener("change", () => {

            const file = photoInput.files[0];

            if (!file) return;

            if (!file.type.startsWith("image/")) {

                if (photoError) photoError.textContent = "Please select a valid image file.";
                photoInput.value = "";
                return;
            }

            if (file.size > 2 * 1024 * 1024) {

                if (photoError) photoError.textContent = "Photo must be less than 2 MB.";
                photoInput.value = "";
                return;
            }

            if (photoError) photoError.textContent = "";
            if (photoProgress) photoProgress.style.width = "100%";
            if (photoText) photoText.textContent = "\u2713 New photo selected: " + file.name;
            if (removePhotoBtn) removePhotoBtn.style.display = "flex";

            checkChanges();
        });

        removePhotoBtn?.addEventListener("click", (e) => {

            e.stopPropagation();

            photoInput.value = "";

            if (photoProgress) photoProgress.style.width = "0%";
            if (photoText) photoText.textContent = "No new file selected";
            if (photoError) photoError.textContent = "";
            if (removePhotoBtn) removePhotoBtn.style.display = "none";

            checkChanges();
        });
    }

    // ========================================================
    // DOCUMENTS (optional — only if the edit form has this field)
    // ========================================================

    let selectedDocFiles = new DataTransfer();
    const allowedDocExtensions = ["pdf", "jpg", "jpeg", "png"];

    function isAllowedDocument(file) {
        const fileName = file.name.toLowerCase();
        const extension = fileName.split(".").pop();
        return allowedDocExtensions.includes(extension);
    }

    function updateDocumentUI() {
        if (!documentProgress || !documentText || !removeDocBtn) return;

        const fileCount = selectedDocFiles.files.length;

        if (fileCount > 0) {
            removeDocBtn.style.display = "flex";
            documentProgress.style.width = "100%";
            documentText.textContent = `${fileCount} document(s) selected`;
        } else {
            removeDocBtn.style.display = "none";
            documentProgress.style.width = "0%";
            documentText.textContent = "No file selected";
        }
    }

    if (documentInput) {

        documentInput.addEventListener("change", () => {

            if (documentInput.files.length === 0) {
                documentInput.files = selectedDocFiles.files;
                updateDocumentUI();
                return;
            }

            let hasInvalidFile = false;

            Array.from(documentInput.files).forEach(file => {

                if (!isAllowedDocument(file)) {
                    hasInvalidFile = true;
                    return;
                }

                const alreadyExists = Array.from(selectedDocFiles.files).some(
                    existingFile =>
                        existingFile.name === file.name &&
                        existingFile.size === file.size &&
                        existingFile.lastModified === file.lastModified
                );

                if (!alreadyExists) selectedDocFiles.items.add(file);
            });

            documentInput.files = selectedDocFiles.files;
            updateDocumentUI();

            if (hasInvalidFile && documentError) {
                documentError.textContent = "Only PDF and image files are allowed.";
                return;
            }

            if (documentError) documentError.textContent = "";

            checkChanges();
        });

        removeDocBtn?.addEventListener("click", () => {

            selectedDocFiles = new DataTransfer();
            documentInput.value = "";
            documentInput.files = selectedDocFiles.files;

            if (documentProgress) documentProgress.style.width = "0%";
            if (documentText) documentText.textContent = "No file selected";
            if (removeDocBtn) removeDocBtn.style.display = "none";
            if (documentError) documentError.textContent = "";

            checkChanges();
        });
    }

    // ========================================================
    // CHANGE DETECTION
    // ========================================================

    function checkChanges() {

        if (!updateBtn) return;

        const changed =
            value(firstName) !== original.firstName ||
            value(lastName) !== original.lastName ||
            value(email) !== original.email ||
            value(phone) !== original.phone ||

            (dob && dob.value !== original.dob) ||
            (doj && doj.value !== original.doj) ||

            (gender && gender.value !== original.gender) ||
            (bloodGroup &&
                bloodGroup.value !== original.bloodGroup) ||

            value(emergencyName) !==
                original.emergencyName ||

            value(emergencyPhone) !==
                original.emergencyPhone ||

            (role &&
                role.value !== original.role) ||

            (department &&
                department.value !== original.department) ||

            (status &&
                status.value !== original.status) ||

            (reportingManager &&
                reportingManager.value !==
                    original.reportingManager) ||

            (monthlyTarget &&
                monthlyTarget.value !==
                    original.monthlyTarget) ||

            (performanceRating &&
                performanceRating.value !==
                    original.performanceRating) ||

            (password &&
                password.value !== "") ||

            (confirmPassword &&
                confirmPassword.value !== "") ||

            (skillsHidden &&
                skillsHidden.value !== "") ||

            (photoInput &&
                photoInput.files &&
                photoInput.files.length > 0) ||

            (documentInput &&
                documentInput.files &&
                documentInput.files.length > 0);

        updateBtn.disabled = !changed;
    }

    window.checkChanges =
        checkChanges;

    // ========================================================
    // SUBMIT
    // ========================================================

    let submitting = false;

    form.addEventListener(
        "submit",
        async function (event) {

            event.preventDefault();

            if (submitting) return;

            const results = [

                validateName(
                    firstName,
                    errors.firstName,
                    "First name"
                ),

                validateName(
                    lastName,
                    errors.lastName,
                    "Last name"
                ),

                validateEmail(),

                validatePhone(),

                validateEmergencyName(),

                validateEmergencyPhone(),

                validatePassword(),

                validateDates(),

                validateRole(),

                validateStatus(),

                validateSkills(),

                validateMonthlyTarget(),

                validatePerformance()
            ];

            if (results.includes(false)) {

                const firstError =
                    form.querySelector(
                        ".error-input"
                    );

                if (firstError) {

                    firstError.scrollIntoView({
                        behavior: "smooth",
                        block: "center"
                    });

                    firstError.focus();
                }

                return;
            }

            const emailOK =
                await duplicateEmail();

            const phoneOK =
                await duplicatePhone();

            if (!emailOK || !phoneOK) {
                return;
            }

            // Reporting Manager is optional — no forced check here.

            if (
                updateBtn &&
                updateBtn.disabled
            ) {
                return;
            }

            submitting = true;

            if (updateBtn) {

                updateBtn.disabled = true;

                updateBtn.innerHTML =
                    '<i class="fa-solid fa-spinner fa-spin"></i> Updating...';
            }

            HTMLFormElement.prototype.submit.call(
                form
            );
        }
    );

    // ========================================================
    // INITIALIZE
    // ========================================================

    setDepartmentFromRole();

    filterReportingManagers();

    toggleMonthlyTarget();

    validateEmail();
    validatePhone();

    validateName(
        firstName,
        errors.firstName,
        "First name"
    );

    validateName(
        lastName,
        errors.lastName,
        "Last name"
    );

    validateEmergencyName();
    validateEmergencyPhone();

    validatePassword();
    validateDates();
    validateRole();
    validateStatus();
    validateSkills();
    validateMonthlyTarget();
    validatePerformance();

    checkChanges();

});