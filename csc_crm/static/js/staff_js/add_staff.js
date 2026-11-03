// ===================== GLOBAL ERROR HELPERS (shared by everything below) =============================

function showFieldError(input, errorElement, message) {
    if (errorElement) errorElement.textContent = message;
    if (input) input.classList.add('error-input');
}

function clearFieldError(input, errorElement) {
    if (errorElement) errorElement.textContent = '';
    if (input) input.classList.remove('error-input');
}

// ===================== EMAIL + PHONE VALIDATION =============================

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('staffMgmtForm');

    const emailInput = document.getElementById('emailInput');
    const emailError = document.getElementById('emailError');

    const phoneInput = document.getElementById('phoneInput');
    const phoneError = document.getElementById('phoneError');

    console.log('Phone validation init:', { phoneInput, phoneError });

    if (!form || !emailInput || !emailError || !phoneInput || !phoneError) {
        console.warn('Email / Phone validation elements missing:', {
            form, emailInput, emailError, phoneInput, phoneError
        });
        return;
    }

    let allowFinalSubmit = false;

    const allowedDomainEndings = [
        '.com', '.in', '.co.in', '.org', '.org.in',
        '.net', '.edu', '.edu.in', '.ac.in'
    ];

    function validateEmailFormat() {
        const email = emailInput.value.trim().toLowerCase();

        if (email === '') {
            showFieldError(emailInput, emailError, 'Email is required.');
            return false;
        }

        const basicEmailPattern = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
        if (!basicEmailPattern.test(email)) {
            showFieldError(emailInput, emailError, 'Please enter a valid email address.');
            return false;
        }

        const domain = email.substring(email.lastIndexOf('@') + 1);
        const isAllowedDomain = allowedDomainEndings.some(ending => domain.endsWith(ending));

        if (!isAllowedDomain) {
            showFieldError(
                emailInput, emailError,
                'Please enter an email with a valid domain like .com, .in, .co.in, .org, .net, .edu, or .ac.in.'
            );
            return false;
        }

        clearFieldError(emailInput, emailError);
        return true;
    }

    async function checkDuplicateEmail() {
        if (!validateEmailFormat()) return false;

        const email = emailInput.value.trim();

        try {
            const response = await fetch(`/staff/check-email/?email=${encodeURIComponent(email)}`);
            const data = await response.json();

            if (data.exists) {
                showFieldError(emailInput, emailError, 'This email already exists!');
                return false;
            }

            clearFieldError(emailInput, emailError);
            return true;
        } catch (error) {
            console.log('Email check error:', error);
            showFieldError(emailInput, emailError, 'Unable to check email right now. Please try again.');
            return false;
        }
    }

    // ---- EMPLOYEE ID: entered manually, must be unique ----
    const employeeIdInput = document.getElementById('employeeIdInput');
    const employeeIdError = document.getElementById('employeeIdError');

    function validateEmployeeIdFormat() {
        if (!employeeIdInput) return true;

        const value = employeeIdInput.value.trim();

        if (value === '') {
            showFieldError(employeeIdInput, employeeIdError, 'Employee ID is required.');
            return false;
        }

        if (/\s/.test(value)) {
            showFieldError(employeeIdInput, employeeIdError, 'Employee ID cannot contain spaces.');
            return false;
        }

        clearFieldError(employeeIdInput, employeeIdError);
        return true;
    }

    async function checkDuplicateEmployeeId() {
        if (!employeeIdInput) return true;
        if (!validateEmployeeIdFormat()) return false;

        const value = employeeIdInput.value.trim();

        try {
            const response = await fetch(`/staff/check-employee-id/?employee_id=${encodeURIComponent(value)}`);
            const data = await response.json();

            if (data.exists) {
                showFieldError(employeeIdInput, employeeIdError, 'This employee ID already exists!');
                return false;
            }

            clearFieldError(employeeIdInput, employeeIdError);
            return true;
        } catch (error) {
            console.log('Employee ID check error:', error);
            showFieldError(employeeIdInput, employeeIdError, 'Unable to check employee ID right now.');
            return false;
        }
    }

    if (employeeIdInput) {
        employeeIdInput.addEventListener('input', () => {
            // no spaces while typing
            employeeIdInput.value = employeeIdInput.value.replace(/\s/g, '');
            validateEmployeeIdFormat();
        });
        employeeIdInput.addEventListener('blur', async () => { await checkDuplicateEmployeeId(); });
    }

    // ---- PHONE: 10-digit Indian mobile (6/7/8/9 start), no +91 ----
    function validatePhoneFormat() {
        const message = CSCPhone.error(phoneInput.value);

        if (message) {
            showFieldError(phoneInput, phoneError, message);
            return false;
        }

        clearFieldError(phoneInput, phoneError);
        return true;
    }

    async function checkDuplicatePhone() {
        if (!validatePhoneFormat()) return false;

        const phone = phoneInput.value.trim();

        try {
            const response = await fetch(`/staff/check-phone/?phone=${encodeURIComponent(phone)}`);
            const data = await response.json();

            if (data.exists) {
                showFieldError(phoneInput, phoneError, 'This phone number already exists!');
                return false;
            }

            clearFieldError(phoneInput, phoneError);
            return true;
        } catch (error) {
            console.log('Phone check error:', error);
            showFieldError(phoneInput, phoneError, 'Unable to check phone number right now.');
            return false;
        }
    }

    emailInput.addEventListener('input', () => validateEmailFormat());
    emailInput.addEventListener('blur', async () => { await checkDuplicateEmail(); });

    // Run validation immediately on every keystroke — sanitize then validate
    phoneInput.addEventListener('input', () => {
        // digits only, max 10 (so "+91" can never be typed or pasted in)
        phoneInput.value = CSCPhone.sanitize(phoneInput.value);

        validatePhoneFormat();
    });

    phoneInput.addEventListener('blur', async () => { await checkDuplicatePhone(); });
    phoneInput.addEventListener('focus', () => validatePhoneFormat());

    // Validate once on load in case of prefilled/invalid value
    if (phoneInput.value.trim() !== '') {
        validatePhoneFormat();
    }

    let isChecking = false;

    form.addEventListener('submit', async function (e) {
        if (e.defaultPrevented) return;
        if (allowFinalSubmit) return;

        e.preventDefault();

        if (isChecking) return;
        if (!form.reportValidity()) return;

        isChecking = true;

        const submitBtn = form.querySelector('button[type="submit"], input[type="submit"]');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.dataset.originalText = submitBtn.innerText;
            submitBtn.innerText = 'Checking...';
        }

        const isEmployeeIdValid = await checkDuplicateEmployeeId();
        const isEmailValid = await checkDuplicateEmail();
        const isPhoneValid = await checkDuplicatePhone();

        // Run the extra field validators (emergency name/phone, password, skills)
        let extraValid = true;
        if (typeof window.__validateEmergencyName === 'function') {
            if (!window.__validateEmergencyName()) extraValid = false;
        }
        if (typeof window.__validateEmergencyPhone === 'function') {
            if (!window.__validateEmergencyPhone()) extraValid = false;
        }
        if (typeof window.__validatePasswordFields === 'function') {
            if (!window.__validatePasswordFields()) extraValid = false;
        }
        if (typeof window.__validateSkillsField === 'function') {
            if (!window.__validateSkillsField()) extraValid = false;
        }

        if (!isEmployeeIdValid) {
            employeeIdInput.focus();
            isChecking = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = submitBtn.dataset.originalText || 'Add Staff';
            }
            return;
        }

        if (!isEmailValid) {
            emailInput.focus();
            isChecking = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = submitBtn.dataset.originalText || 'Add Staff';
            }
            return;
        }

        if (!isPhoneValid) {
            phoneInput.focus();
            isChecking = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = submitBtn.dataset.originalText || 'Add Staff';
            }
            return;
        }

        if (!extraValid) {
            isChecking = false;
            if (submitBtn) {
                submitBtn.disabled = false;
                submitBtn.innerText = submitBtn.dataset.originalText || 'Add Staff';
            }
            return;
        }

        allowFinalSubmit = true;
        form.requestSubmit();
    });
});

// ======================== FIRST NAME AND LAST NAME CONTAINS ONLY STRINGS =======================

document.addEventListener('DOMContentLoaded', () => {
    const firstNameInput = document.getElementById('firstNameInput');
    const firstNameInputError = document.getElementById('firstNameError');
    if (!firstNameInput) return;

    function firstNameValidate() {
        if (firstNameInput.value.trim() === '') {
            firstNameInputError.textContent = 'First name is required.';
            firstNameInput.classList.add('error-input');
            return false;
        } else {
            firstNameInputError.textContent = '';
            firstNameInput.classList.remove('error-input');
            return true;
        }
    }

    firstNameInput.addEventListener('input', () => {
        firstNameInput.value = firstNameInput.value.replace(/[^a-zA-Z\s]/g, '');
        firstNameValidate();
    });

    firstNameInput.addEventListener('blur', () => firstNameValidate());
});

document.addEventListener('DOMContentLoaded', () => {
    const lastNameInput = document.getElementById('lastNameInput');
    const lastNameInputError = document.getElementById('lastNameError');
    if (!lastNameInput) return;

    function lastNameValidation() {
        if (lastNameInput.value.trim() === '') {
            lastNameInputError.textContent = 'Last name is required';
            lastNameInput.classList.add('error-input');
            return false;
        } else {
            lastNameInputError.textContent = '';
            lastNameInput.classList.remove('error-input');
            return true;
        }
    }

    lastNameInput.addEventListener('input', () => {
        lastNameInput.value = lastNameInput.value.replace(/[^a-zA-Z\s]/g, '');
        lastNameValidation();
    });

    lastNameInput.addEventListener('blur', () => lastNameValidation());
});

// =========================== EMERGENCY CONTACT NAME (letters only, max 40) ============================

document.addEventListener('DOMContentLoaded', () => {
    const emergencyNameInput = document.getElementById('emergencyContactNameInput');
    const emergencyNameError = document.getElementById('emergencyContactNameError');

    if (!emergencyNameInput) {
        console.warn('emergencyContactNameInput not found in DOM.');
        return;
    }
    if (!emergencyNameError) {
        console.warn('emergencyContactNameError span not found — add <span class="form-error" id="emergencyContactNameError"></span> in HTML.');
    }

    function validateEmergencyName() {
        emergencyNameInput.value = emergencyNameInput.value
            .replace(/[^a-zA-Z\s]/g, '')
            .substring(0, 40);

        const value = emergencyNameInput.value.trim();

        if (value === '') {
            clearFieldError(emergencyNameInput, emergencyNameError);
            return true; // optional field
        }

        if (value.length > 40) {
            showFieldError(emergencyNameInput, emergencyNameError, 'Emergency contact name cannot exceed 40 characters.');
            return false;
        }

        clearFieldError(emergencyNameInput, emergencyNameError);
        return true;
    }

    emergencyNameInput.addEventListener('input', validateEmergencyName);
    emergencyNameInput.addEventListener('blur', validateEmergencyName);

    window.__validateEmergencyName = validateEmergencyName;
});

// ======================================================
// EMERGENCY CONTACT PHONE
// Same behavior as Main Phone field
// ======================================================

document.addEventListener('DOMContentLoaded', function () {

    const input = document.getElementById('emergencyContactPhoneInput');
    const error = document.getElementById('emergencyContactPhoneError');

    if (!input) {
        console.warn('Emergency Contact Phone input not found.');
        return;
    }

    // 10-digit Indian mobile number (6/7/8/9 start), no +91 - see phone_validation.js


    // ==================================================
    // SHOW ERROR
    // ==================================================

    function showError(message) {

        input.classList.add('error-input');

        if (error) {
            error.textContent = message;
        }
    }


    // ==================================================
    // CLEAR ERROR
    // ==================================================

    function clearError() {

        input.classList.remove('error-input');

        if (error) {
            error.textContent = '';
        }
    }


    // ==================================================
    // VALIDATE
    // ==================================================

    function validateEmergencyPhone() {

        const value = input.value.trim();

        const message = CSCPhone.error(value);

        if (message) {
            showError(message);
            return false;
        }

        // Valid
        clearError();
        return true;
    }


    // ==================================================
    // FOCUS
    // Click field -> show message
    // ==================================================

    input.addEventListener('focus', function () {

        if (this.value.trim() === '') {

            showError('Phone number is required.');

        } else {

            validateEmergencyPhone();
        }
    });


    // ==================================================
    // INPUT
    // ==================================================

    input.addEventListener('input', function () {

        // digits only, max 10 (no +91)
        this.value = CSCPhone.sanitize(this.value);

        validateEmergencyPhone();
    });


    // ==================================================
    // BLUR
    // ==================================================

    input.addEventListener('blur', function () {

        validateEmergencyPhone();

    });


    // ==================================================
    // KEYBOARD
    // ==================================================

    input.addEventListener('keydown', function (e) {

        const allowedKeys = [
            'Backspace',
            'Delete',
            'ArrowLeft',
            'ArrowRight',
            'ArrowUp',
            'ArrowDown',
            'Tab',
            'Home',
            'End'
        ];

        if (allowedKeys.includes(e.key) || e.ctrlKey || e.metaKey) {
            return;
        }

        // Numbers allowed
        if (/^[0-9]$/.test(e.key)) {
            return;
        }

        // Block everything else
        e.preventDefault();
    });


    // ==================================================
    // PASTE
    // ==================================================

    input.addEventListener('paste', function (e) {

        e.preventDefault();

        let pasted =
            (e.clipboardData || window.clipboardData)
                .getData('text');

        // digits only (so a pasted "+91..." loses the symbols)
        pasted = pasted.replace(/\D/g, '');

        const start = this.selectionStart;
        const end = this.selectionEnd;

        this.value = CSCPhone.sanitize(
            this.value.substring(0, start) +
            pasted +
            this.value.substring(end)
        );

        validateEmergencyPhone();
    });


    // ==================================================
    // FORM SUBMIT
    // ==================================================

    const form = input.closest('form');

    if (form) {

        form.addEventListener('submit', function (e) {

            if (!validateEmergencyPhone()) {

                e.preventDefault();

                input.focus();

                return false;
            }

        });

    }


    // ==================================================
    // GLOBAL VALIDATION
    // ==================================================

    window.validateEmergencyPhone = validateEmergencyPhone;

});
// =========================== PASSWORD / CONFIRM PASSWORD (max 20 chars) ============================

document.addEventListener('DOMContentLoaded', () => {

    const passwordInput = document.querySelector('[name="password"]');
    const confirmPasswordInput = document.querySelector('[name="confirm_password"]');

    const passwordError = document.getElementById('passwordError');
    const confirmPasswordError = document.getElementById('confirmPasswordError');

    if (!passwordInput || !confirmPasswordInput) return;

    passwordInput.setAttribute('maxlength', '20');
    confirmPasswordInput.setAttribute('maxlength', '20');

    function validatePassword() {

        if (passwordInput.value.length > 20) {
            passwordInput.value = passwordInput.value.substring(0, 20);
        }

        const password = passwordInput.value;

        if (password === '') {
            if (passwordError)
                passwordError.textContent = 'Password is required.';

            passwordInput.classList.add('error-input');
            return false;
        }

        if (password.length > 20) {
            if (passwordError)
                passwordError.textContent = 'Password cannot exceed 20 characters.';

            passwordInput.classList.add('error-input');
            return false;
        }

        if (passwordError)
            passwordError.textContent = '';

        passwordInput.classList.remove('error-input');

        return true;
    }


    function validateConfirmPassword() {

        if (confirmPasswordInput.value.length > 20) {
            confirmPasswordInput.value =
                confirmPasswordInput.value.substring(0, 20);
        }

        const password = passwordInput.value;
        const confirm = confirmPasswordInput.value;

        if (confirm === '') {
            if (confirmPasswordError)
                confirmPasswordError.textContent =
                    'Please confirm your password.';

            confirmPasswordInput.classList.add('error-input');
            return false;
        }

        if (confirm.length > 20) {
            if (confirmPasswordError)
                confirmPasswordError.textContent =
                    'Password cannot exceed 20 characters.';

            confirmPasswordInput.classList.add('error-input');
            return false;
        }

        if (password !== confirm) {
            if (confirmPasswordError)
                confirmPasswordError.textContent =
                    'Passwords do not match.';

            confirmPasswordInput.classList.add('error-input');
            return false;
        }

        if (confirmPasswordError)
            confirmPasswordError.textContent = '';

        confirmPasswordInput.classList.remove('error-input');

        return true;
    }


    passwordInput.addEventListener('input', () => {
        validatePassword();
        validateConfirmPassword();
    });

    confirmPasswordInput.addEventListener(
        'input',
        validateConfirmPassword
    );

    passwordInput.addEventListener(
        'blur',
        validatePassword
    );

    confirmPasswordInput.addEventListener(
        'blur',
        validateConfirmPassword
    );


    window.__validatePasswordFields = function () {

        const pwOk = validatePassword();
        const cpOk = validateConfirmPassword();

        return pwOk && cpOk;
    };

});

// =========================== DOB & DOJ DATE PICKER UX ============================

document.addEventListener('DOMContentLoaded', () => {
    const dateOfBirthInput = document.getElementById('dateOfBirthInput');
    const dateOfBirthError = document.getElementById('dateOfBirthError');
    const dateOfJoiningInput = document.getElementById('dateOfJoiningInput');
    const dateOfJoiningError = document.getElementById('dateOfJoiningError');

    if (!dateOfBirthInput || !dateOfJoiningInput) return;

    function dobValidation() {
        if (dateOfBirthInput.value.trim() === '') {
            return false;
        } else {
            dateOfBirthError.textContent = '';
            dateOfBirthInput.classList.remove('error-input');
            return false;
        }
    }

    function dojValidation() {
        if (dateOfJoiningInput.value.trim() === '') {
            dateOfJoiningError.textContent = 'Date of joining is required.';
            dateOfJoiningInput.classList.add('error-input');
            return false;
        } else {
            dateOfJoiningError.textContent = '';
            dateOfJoiningInput.classList.remove('error-input');
            return false;
        }
    }

    function enableFullDatePicker(input) {
        input.addEventListener('click', () => {
            if (input.showPicker) input.showPicker();
        });
    }
    enableFullDatePicker(dateOfBirthInput);
    enableFullDatePicker(dateOfJoiningInput);

    dateOfBirthInput.addEventListener('blur', () => dobValidation());
    dateOfJoiningInput.addEventListener('blur', () => dojValidation());
});

// ======================== DOB + DOJ AGE VALIDATION ============================

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('staffMgmtForm');
    const dateOfBirthInput = document.getElementById('dateOfBirthInput');
    const dateOfJoiningInput = document.getElementById('dateOfJoiningInput');
    const dateOfBirthError = document.getElementById('dateOfBirthError');
    const dateOfJoiningError = document.getElementById('dateOfJoiningError');

    if (!form || !dateOfBirthInput || !dateOfJoiningInput) return;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayString =
        today.getFullYear() + '-' +
        String(today.getMonth() + 1).padStart(2, '0') + '-' +
        String(today.getDate()).padStart(2, '0');

    dateOfBirthInput.setAttribute('max', todayString);
    dateOfJoiningInput.removeAttribute('max');

    function parseDate(value) {
        if (!value) return null;
        const parts = value.split('-');
        if (parts.length !== 3) return null;

        let day, month, year;
        if (parts[0].length === 4) {
            year = Number(parts[0]); month = Number(parts[1]); day = Number(parts[2]);
        } else {
            day = Number(parts[0]); month = Number(parts[1]); year = Number(parts[2]);
        }

        const date = new Date(year, month - 1, day);
        if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
            return null;
        }
        date.setHours(0, 0, 0, 0);
        return date;
    }

    function calculateAge(dob, doj) {
        let age = doj.getFullYear() - dob.getFullYear();
        const monthDiff = doj.getMonth() - dob.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && doj.getDate() < dob.getDate())) age--;
        return age;
    }

    function validateDobAndDoj() {
        let isValid = true;

        dateOfBirthError.textContent = '';
        dateOfJoiningError.textContent = '';
        dateOfBirthInput.classList.remove('error-input');
        dateOfJoiningInput.classList.remove('error-input');

        const dob = parseDate(dateOfBirthInput.value);
        const doj = parseDate(dateOfJoiningInput.value);

        if (dateOfBirthInput.value && !dob) {
            dateOfBirthError.textContent = 'Invalid date of birth';
            dateOfBirthInput.classList.add('error-input');
            isValid = false;
        }

        if (dob && dob > today) {
            dateOfBirthError.textContent = 'Date of birth cannot be in the future';
            dateOfBirthInput.classList.add('error-input');
            isValid = false;
        }

        if (!dateOfJoiningInput.value) {
            dateOfJoiningError.textContent = 'Date of joining is required';
            dateOfJoiningInput.classList.add('error-input');
            isValid = false;
        }

        if (dateOfJoiningInput.value && !doj) {
            dateOfJoiningError.textContent = 'Invalid date of joining';
            dateOfJoiningInput.classList.add('error-input');
            isValid = false;
        }

        if (dob && doj) {
            const ageAtJoining = calculateAge(dob, doj);

            if (doj < dob) {
                dateOfJoiningError.textContent = 'Date of joining cannot be before date of birth';
                dateOfBirthInput.classList.add('error-input');
                dateOfJoiningInput.classList.add('error-input');
                isValid = false;
            } else if (ageAtJoining < 18) {
                dateOfJoiningError.textContent = 'Employee must be at least 18 years old on date of joining';
                dateOfBirthInput.classList.add('error-input');
                dateOfJoiningInput.classList.add('error-input');
                isValid = false;
            }
        }

        return isValid;
    }

    dateOfBirthInput.addEventListener('change', validateDobAndDoj);
    dateOfJoiningInput.addEventListener('change', validateDobAndDoj);

    form.addEventListener('submit', (e) => {
        if (!validateDobAndDoj()) {
            e.preventDefault();
            e.stopImmediatePropagation();
            dateOfJoiningInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            dateOfJoiningInput.focus();
            return false;
        }
    }, true);
});

// ============================== DEPARTMENT & ROLE AUTOMATICALLY SELECTED ==============================

document.addEventListener('DOMContentLoaded', () => {
    const roleInput = document.getElementById('roleInput');
    const roleError = document.getElementById('roleError');
    const departmentInput = document.getElementById('departmentInput');

    if (!roleInput || !departmentInput) return;

    function roleValidation() {
        if (roleInput.value.trim() === '') {
            roleInput.classList.add('error-input');
            roleError.textContent = 'Role is required';
            return false;
        } else {
            roleInput.classList.remove('error-input');
            roleError.textContent = '';
            return true;
        }
    }

    const roleDepartmentMap = {
        'Developer': 'Technical', 'Trainer': 'Technical',
        'Admin': 'Management', 'Manager': 'Management', 'HR': 'Management',
        'Sales Exec': 'Sales Department', 'Sales Exec Lead': 'Sales Department',
        'Digital Marketing': 'Marketing', 'Content Creator': 'Marketing', 'Marketing Lead': 'Marketing',
    };

    function autoSelectDepartment() {
        const selectedRoleText = roleInput.options[roleInput.selectedIndex].text.trim();
        const departmentName = roleDepartmentMap[selectedRoleText];

        if (!departmentName) {
            departmentInput.value = '';
            return;
        }

        for (let option of departmentInput.options) {
            if (option.text.trim() === departmentName) {
                departmentInput.value = option.value;
                break;
            }
        }
    }

    roleInput.addEventListener('change', autoSelectDepartment);

    departmentInput.addEventListener('mousedown', (e) => e.preventDefault());
    departmentInput.addEventListener('keydown', (e) => e.preventDefault());
    departmentInput.addEventListener('focus', () => departmentInput.blur());

    roleInput.addEventListener('blur', () => roleValidation());
    roleInput.addEventListener('input', () => roleValidation());

    autoSelectDepartment();
});

// ============================= DISABLE TERMINATED STATUS IN ADD STAFF =============================

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('staffMgmtForm');
    const statusInput = document.getElementById('statusInput');
    const statusError = document.getElementById('statusError');

    if (!form || !statusInput || !statusError) return;

    Array.from(statusInput.options).forEach(option => {
        const optionValue = option.value.trim().toLowerCase();
        const optionText = option.textContent.trim().toLowerCase();

        if (optionValue === 'terminated' || optionText === 'terminated') {
            option.disabled = true;
            option.textContent = 'Terminated - Not allowed while adding staff';
        }
    });

    function showStatusError(message) {
        statusError.textContent = message;
        statusInput.classList.add('error-input');
    }

    function clearStatusError() {
        statusError.textContent = '';
        statusInput.classList.remove('error-input');
    }

    function validateStatus() {
        const status = statusInput.value.trim().toLowerCase();

        if (status === '') {
            showStatusError('Status is required.');
            return false;
        }

        if (status === 'terminated') {
            showStatusError('You cannot create a new staff record with Terminated status.');
            return false;
        }

        clearStatusError();
        return true;
    }

    statusInput.addEventListener('change', validateStatus);
    statusInput.addEventListener('blur', validateStatus);

    form.addEventListener('submit', function (e) {
        const isStatusValid = validateStatus();
        if (!isStatusValid) {
            e.preventDefault();
            statusInput.focus();
            return;
        }
    });
});

// ================= PASSPORT PHOTO =================

document.addEventListener('DOMContentLoaded', () => {

    const input = document.getElementById('profilePhotoInput');
    const box = document.getElementById('photoDropzone');
    const remove = document.getElementById('removePhotoBtn');
    const progress = document.getElementById('photoProgressBar');
    const text = document.getElementById('progressText');
    const error = document.getElementById('profilePhotoError');

    if (!input) return;

    // Open file picker
    box?.addEventListener('click', () => input.click());

    // File select
    input.addEventListener('change', () => {

        const file = input.files[0];

        if (!file) return;

        if (!file.type.startsWith('image/')) {
            error.textContent = 'Please select a valid image file.';
            input.value = '';
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            error.textContent = 'Photo must be less than 2 MB.';
            input.value = '';
            return;
        }

        error.textContent = '';
        progress.style.width = '100%';
        text.textContent = '✓ Image Uploaded';
        remove.style.display = 'flex';
    });

    // Remove photo
    remove?.addEventListener('click', (e) => {

        e.stopPropagation();

        input.value = '';
        progress.style.width = '0%';
        text.textContent = 'No file selected';
        error.textContent = '';
        remove.style.display = 'none';
    });

});
// ============================= DOCUMENT VALIDATION =============================

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('staffMgmtForm');
    const documentInput = document.getElementById('documentInput');
    const removeDocBtn = document.getElementById('removeDocumentBtn');
    const progressBar = document.getElementById('documentProgressBar');
    const progressText = document.getElementById('documentprogressText');
    const documentError = document.getElementById('documentError');

    if (!form || !documentInput || !removeDocBtn || !progressBar || !progressText || !documentError) return;

    let selectedFiles = new DataTransfer();
    const allowedExtensions = ['pdf', 'jpg', 'jpeg', 'png'];

    function showDocumentError(message) {
        documentError.textContent = message;
        documentInput.classList.add('error-input');
    }

    function clearDocumentError() {
        documentError.textContent = '';
        documentInput.classList.remove('error-input');
    }

    function isAllowedDocument(file) {
        const fileName = file.name.toLowerCase();
        const extension = fileName.split('.').pop();
        return allowedExtensions.includes(extension);
    }

    function validateDocument() {
        if (selectedFiles.files.length === 0) {
            showDocumentError('Please upload at least one document.');
            return false;
        }

        const invalidFile = Array.from(selectedFiles.files).find(file => !isAllowedDocument(file));

        if (invalidFile) {
            showDocumentError('Only PDF and image files are allowed.');
            return false;
        }

        clearDocumentError();
        return true;
    }

    function updateDocumentUI() {
        const fileCount = selectedFiles.files.length;

        if (fileCount > 0) {
            removeDocBtn.style.display = 'flex';
            progressBar.style.width = '100%';
            progressText.textContent = `${fileCount} document(s) selected`;
        } else {
            removeDocBtn.style.display = 'none';
            progressBar.style.width = '0%';
            progressText.textContent = 'No file selected';
        }
    }

    documentInput.addEventListener('change', () => {
        if (documentInput.files.length === 0) {
            documentInput.files = selectedFiles.files;
            updateDocumentUI();
            return;
        }

        let hasInvalidFile = false;

        Array.from(documentInput.files).forEach(file => {
            if (!isAllowedDocument(file)) {
                hasInvalidFile = true;
                return;
            }

            const alreadyExists = Array.from(selectedFiles.files).some(
                existingFile =>
                    existingFile.name === file.name &&
                    existingFile.size === file.size &&
                    existingFile.lastModified === file.lastModified
            );

            if (!alreadyExists) selectedFiles.items.add(file);
        });

        documentInput.files = selectedFiles.files;
        updateDocumentUI();

        if (hasInvalidFile) {
            showDocumentError('Only PDF and image files are allowed.');
            return;
        }

        validateDocument();
    });

    removeDocBtn.addEventListener('click', () => {
        selectedFiles = new DataTransfer();
        documentInput.value = '';
        documentInput.files = selectedFiles.files;

        progressBar.style.width = '0%';
        progressText.textContent = 'No file selected';
        removeDocBtn.style.display = 'none';

        showDocumentError('Please upload at least one document.');
    });

    form.addEventListener('submit', (e) => {
        if (!validateDocument()) {
            e.preventDefault();
            e.stopImmediatePropagation();
            documentInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            documentInput.focus();
            return false;
        }
    }, true);
});

// ====================== SHOW / HIDE MONTHLY TARGET BASED ON ROLE ======================

document.addEventListener('DOMContentLoaded', () => {
    const MAX_MONTHLY_TARGET = 1000000;

    const form = document.getElementById('staffMgmtForm');
    const roleInput = document.getElementById('roleInput');

    const monthlyTargetGroup = document.getElementById('monthlyTargetGroup');
    const monthlyTargetInput = document.getElementById('monthlyTargetInput');
    const monthlyTargetError = document.getElementById('monthlyTargetError');

    if (!form || !roleInput || !monthlyTargetGroup || !monthlyTargetInput || !monthlyTargetError) return;

    const rolesNeedMonthlyTarget = ['manager', 'sales exec', 'sales exec lead'];

    function sanitizeMonthlyTargetInput() {
        let value = monthlyTargetInput.value;
        value = value.replace(/[^0-9.]/g, '');

        const parts = value.split('.');
        if (parts.length > 2) value = parts[0] + '.' + parts.slice(1).join('');

        if (value.includes('.')) {
            const [whole, decimal] = value.split('.');
            value = whole + '.' + decimal.substring(0, 2);
        }

        monthlyTargetInput.value = value;
    }

    function normalizeRole(role) {
        return role.trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');
    }

    function getSelectedRoleText() {
        const selectedOption = roleInput.options[roleInput.selectedIndex];
        return selectedOption ? normalizeRole(selectedOption.textContent) : '';
    }

    function showMonthlyTargetError(message) {
        monthlyTargetError.textContent = message;
        monthlyTargetInput.classList.add('error-input');
    }

    function clearMonthlyTargetError() {
        monthlyTargetError.textContent = '';
        monthlyTargetInput.classList.remove('error-input');
    }

    function isMonthlyTargetRequired() {
        return rolesNeedMonthlyTarget.includes(getSelectedRoleText());
    }

    function toggleMonthlyTarget() {
        if (isMonthlyTargetRequired()) {
            monthlyTargetGroup.style.display = '';
            monthlyTargetInput.disabled = false;
            monthlyTargetInput.required = true;
            monthlyTargetInput.setAttribute('required', 'required');
        } else {
            monthlyTargetGroup.style.display = 'none';
            monthlyTargetInput.value = '';
            monthlyTargetInput.disabled = true;
            monthlyTargetInput.required = false;
            monthlyTargetInput.removeAttribute('required');
            clearMonthlyTargetError();
        }
    }

    function validateMonthlyTarget() {
        if (!isMonthlyTargetRequired()) {
            clearMonthlyTargetError();
            return true;
        }

        const value = monthlyTargetInput.value.trim();

        if (value === '') {
            showMonthlyTargetError('Monthly target is required.');
            return false;
        }

        const validAmountPattern = /^\d+(\.\d{1,2})?$/;
        if (!validAmountPattern.test(value)) {
            showMonthlyTargetError('Monthly target must contain only numbers.');
            return false;
        }

        const target = Number(value);

        if (target <= 0) {
            showMonthlyTargetError('Monthly target must be greater than 0.');
            return false;
        }

        if (target > MAX_MONTHLY_TARGET) {
            showMonthlyTargetError('Monthly target must not exceed ₹10,00,000.');
            return false;
        }

        clearMonthlyTargetError();
        return true;
    }

    roleInput.addEventListener('change', () => {
        toggleMonthlyTarget();
        validateMonthlyTarget();
    });

    monthlyTargetInput.addEventListener('input', () => {
        sanitizeMonthlyTargetInput();
        validateMonthlyTarget();
    });
    monthlyTargetInput.addEventListener('blur', validateMonthlyTarget);

    monthlyTargetInput.addEventListener('keydown', (e) => {
        const blockedKeys = ['e', 'E', '+', '-'];
        if (blockedKeys.includes(e.key)) e.preventDefault();
    });

    form.addEventListener('submit', function (e) {
        toggleMonthlyTarget();
        const isMonthlyTargetValid = validateMonthlyTarget();

        if (!isMonthlyTargetValid) {
            e.preventDefault();
            e.stopImmediatePropagation();
            monthlyTargetInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
            monthlyTargetInput.focus();
            return false;
        }
    }, true);

    toggleMonthlyTarget();
});

// ================= REPORTING MANAGER — ROLE-BASED FILTER =================
//
// RULE:
//  - "Lead" roles (Sales Exec Lead / Marketing Lead) -> Reporting Manager
//    dropdown la Admin + Manager rendume kaatanum.
//  - "Employee" roles (Sales Exec / Digital Marketing / Content Creator)
//    -> Reporting Manager la avangaloda department Lead mattum kaatanum.
//  - Admin -> Reporting Manager field-e venaam (hidden).
//  - Manager, Developer, Trainer, HR -> existing rule padi (Admin / Manager).
//
document.addEventListener('DOMContentLoaded', () => {
    const roleInput = document.getElementById('roleInput');
    const reportingManagerGroup = document.getElementById('reportingManagerGroup');
    const reportingManagerInput = document.getElementById('reportingManagerInput');

    if (!roleInput || !reportingManagerGroup || !reportingManagerInput) return;

    const staffRolesDataEl = document.getElementById('staffRolesData');
    const staffRoles = staffRolesDataEl ? JSON.parse(staffRolesDataEl.textContent) : {};

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

    const allOptions = Array.from(reportingManagerInput.options).filter(opt => opt.value !== '');
    const placeholderOption = Array.from(reportingManagerInput.options).find(opt => opt.value === '')
        || new Option('---------', '');

    function filterReportingManagers() {
        const selectedRoleText = roleInput.options[roleInput.selectedIndex]
            ? roleInput.options[roleInput.selectedIndex].text.trim()
            : '';

        const allowedRoles = REPORTING_MANAGER_RULES.hasOwnProperty(selectedRoleText)
            ? REPORTING_MANAGER_RULES[selectedRoleText]
            : 'ANY';

        if (allowedRoles === null || !selectedRoleText) {
            reportingManagerGroup.style.display = 'none';
            reportingManagerInput.value = '';
            reportingManagerInput.required = false;
            if (typeof checkChanges === 'function') checkChanges();
            return;
        }

        reportingManagerGroup.style.display = '';
        reportingManagerInput.innerHTML = '';
        reportingManagerInput.appendChild(placeholderOption.cloneNode(true));

        allOptions.forEach(opt => {
            const staffRole = staffRoles[opt.value];
            if (allowedRoles === 'ANY' || (staffRole && allowedRoles.includes(staffRole))) {
                reportingManagerInput.appendChild(opt.cloneNode(true));
            }
        });

        reportingManagerInput.value = '';
        if (typeof checkChanges === 'function') checkChanges();
    }

    roleInput.addEventListener('change', filterReportingManagers);
    filterReportingManagers();
});

// ================= SKILLS — TYPED INPUT (letters only, no numbers) =================

document.addEventListener('DOMContentLoaded', () => {
    const skillsTypedInput = document.getElementById('skillsTypedInput');
    const skillsHiddenInput = document.getElementById('skillsInput');
    const skillsError = document.getElementById('skillsError');

    if (!skillsTypedInput || !skillsHiddenInput) return;

    const MAX_SKILL_LENGTH = 30;

    // Pre-fill typed input from existing hidden JSON (edit page)
    try {
        if (skillsHiddenInput.value) {
            const existing = JSON.parse(skillsHiddenInput.value);
            if (Array.isArray(existing) && existing.length > 0) {
                const names = existing.map(s => (typeof s === 'string' ? s : s.name));
                skillsTypedInput.value = names.join(', ');
            }
        }
    } catch (e) {
        // ignore, start blank
    }

    function parseTypedSkills(raw) {
        const skills = raw
            .split(',')
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

    function validateSkillsField() {
        const raw = skillsTypedInput.value.trim();

        if (!raw) {
            if (skillsError) skillsError.textContent = '';
            skillsTypedInput.classList.remove('error-input');
            skillsHiddenInput.value = '[]';
            return true; // optional
        }

        const parts = raw.split(',').map(s => s.trim()).filter(s => s.length > 0);

        for (let skill of parts) {
            if (/\d/.test(skill)) {
                if (skillsError) skillsError.textContent = `Skill '${skill}' should not contain numbers.`;
                skillsTypedInput.classList.add('error-input');
                return false;
            }
            if (!/^[A-Za-z\s.+#-]+$/.test(skill)) {
                if (skillsError) skillsError.textContent = `Skill '${skill}' contains invalid characters.`;
                skillsTypedInput.classList.add('error-input');
                return false;
            }
        }

        if (skillsError) skillsError.textContent = '';
        skillsTypedInput.classList.remove('error-input');
        return true;
    }

    // Block digit characters from being typed at all
    skillsTypedInput.addEventListener('input', () => {
        // Strip digits immediately — allow letters, spaces, commas, and a few symbols
        skillsTypedInput.value = skillsTypedInput.value.replace(/[^A-Za-z\s,.+#-]/g, '');

        const raw = skillsTypedInput.value.trim();

        if (!raw) {
            skillsHiddenInput.value = '[]';
            if (skillsError) skillsError.textContent = '';
            skillsTypedInput.classList.remove('error-input');
            if (typeof checkChanges === 'function') checkChanges();
            return;
        }

        const skills = parseTypedSkills(raw);
        skillsHiddenInput.value = JSON.stringify(skills);

        validateSkillsField();

        if (typeof checkChanges === 'function') checkChanges();
    });

    skillsTypedInput.addEventListener('blur', validateSkillsField);

    skillsTypedInput.addEventListener('keydown', (e) => {
        // Block digit keys outright
        if (/^[0-9]$/.test(e.key)) {
            e.preventDefault();
        }
    });

    skillsTypedInput.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = (e.clipboardData || window.clipboardData).getData('text');
        const cleaned = text.replace(/[^A-Za-z\s,.+#-]/g, '');
        const start = skillsTypedInput.selectionStart;
        const end = skillsTypedInput.selectionEnd;
        skillsTypedInput.value =
            skillsTypedInput.value.substring(0, start) + cleaned + skillsTypedInput.value.substring(end);
        skillsTypedInput.dispatchEvent(new Event('input'));
    });

    // On page load — sync hidden field from existing value (edit mode)
    (function initialSync() {
        const raw = skillsTypedInput.value.trim();

        if (!raw) {
            skillsHiddenInput.value = '[]';
            return;
        }

        const skills = parseTypedSkills(raw);
        skillsHiddenInput.value = JSON.stringify(skills);
    })();

    window.__validateSkillsField = validateSkillsField;
});