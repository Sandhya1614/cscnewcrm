// JS for the View Student page: delete confirmation popup and the
// tab-switching UI (Personal / Guardian / Academic / Other / Documents / Payment).
function confirmDelete(event, url) {
    event.preventDefault();

    Swal.fire({
        title: "Are you sure?",
        text: "This student will be deleted permanently!",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Yes, delete it!"
    }).then((result) => {
        if (result.isConfirmed) {
            window.location.href = url;
        }
    });
}
    
    // Purely front-end tab switching for the redesigned layout — no backend/logic changes.
    document.addEventListener('DOMContentLoaded', function () {
        var tabButtons = document.querySelectorAll('.tabs-nav .tab-btn');
        tabButtons.forEach(function (btn) {
            btn.addEventListener('click', function () {
                var target = btn.getAttribute('data-tab');

                tabButtons.forEach(function (b) { b.classList.remove('active'); });
                btn.classList.add('active');

                document.querySelectorAll('.tabs-card .tab-content').forEach(function (tc) {
                    tc.classList.remove('active');
                });
                document.getElementById('tab-' + target).classList.add('active');
            });
        });
    });