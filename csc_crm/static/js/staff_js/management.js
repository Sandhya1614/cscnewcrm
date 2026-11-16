
document.addEventListener('DOMContentLoaded', ()=>{
    const departmentFilter = document.getElementById('departmentFilter');
    const roleFilter = document.getElementById('roleFilter');
    const searchForm = document.getElementById('searchForm');
    const searchInput = document.getElementById('staffSearch')

    // ================== FORM VALIDATION (PAGE LOADING BUG) =======================

    function applyFilters(){
        const department = departmentFilter.value;
        const role = roleFilter.value;

        const params = new URLSearchParams();

        const search = searchInput.value.trim();

        if(search){
            params.append('search', search);
        }

        if(department){
            params.append('department', department);
        }

        if(role){
            params.append('role', role)
        }

        window.location.href = `?${params.toString()}`;
    }

    departmentFilter.addEventListener('change', applyFilters);
    roleFilter.addEventListener('change', applyFilters);

    // ============================ PAGINATION WITH SEARCH & FILTER ============================

    document.querySelectorAll('.pagination-link').forEach(link => {

        link.addEventListener('click', function(e){

            e.preventDefault();

            const url = new URL(this.href);

            const search = searchInput.value.trim();
            const department = departmentFilter.value;
            const role = roleFilter.value;

            if(search){
                url.searchParams.set('search', search);
            }

            if(department){
                url.searchParams.set('department', department);
            }

            if(role){
                url.searchParams.set('role', role);
            }

            window.location.href = url.toString();

        });

    });

    // ============================= SEARCH & FILTER VALIDATION =============================

    searchForm.addEventListener('submit', function(e){
        const searchValue = searchInput.value.trim();

        e.preventDefault();

        const department = departmentFilter.value;
        const role = roleFilter.value;

        const params = new URLSearchParams();

        if(searchValue){
            params.append('search', searchValue)
        }
        if(department){
            params.append('department', department)
        }
        if(role){
            params.append('role', role)
        }

        window.location.href = `?${params.toString()}`;
    })

})
