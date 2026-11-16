from django.contrib import admin
from .models import Department, StaffRole, Staff


# ===================== DEPARTMENT ADMIN =====================

class DepartmentAdmin(admin.ModelAdmin):
    list_display = (
        'dept_name',
        'description',
        'created_at',
        'updated_at'
    )
    search_fields = ('dept_name',)
    list_filter = ('dept_name',)
    ordering = ('dept_name',)


# ===================== STAFF ROLE ADMIN =====================

class StaffRoleAdmin(admin.ModelAdmin):
    list_display = (
        'role_name',
        'can_manage_leads',
        'can_manage_staff',
        'can_view_reports',
        'can_mark_attendance',
        'created_at'
    )
    search_fields = ('role_name',)
    list_filter = ('role_name',)
    ordering = ('role_name',)


# ===================== STAFF ADMIN =====================

class StaffAdmin(admin.ModelAdmin):
    list_display = (
        'employee_id',
        'full_name',
        'email',
        'phone',
        'role',
        'department',
        'status',
        'performance_rating',
        'monthly_target',
        'date_of_joining',
        'last_login'
    )

    search_fields = (
        'employee_id',
        'first_name',
        'last_name',
        'email',
        'phone'
    )

    list_filter = (
        'status',
        'department',
        'role',
        'date_of_joining'
    )

    ordering = ('-created_at',)

    readonly_fields = (
        'created_at',
        'updated_at',
        'last_login',
        'last_login_ip'
    )

    fieldsets = (
        ('Basic Information', {
            'fields': (
                'employee_id',
                'first_name',
                'last_name',
                'email',
                'phone'
            )
        }),

        ('Role & Department', {
            'fields': (
                'role',
                'department'
            )
        }),

        ('Performance', {
            'fields': (
                'monthly_target',
                'performance_rating'
            )
        }),

        ('Status & Dates', {
            'fields': (
                'status',
                'date_of_joining',
                'date_of_birth'
            )
        }),

        ('Login Tracking', {
            'fields': (
                'last_login',
                'last_login_ip'
            )
        }),

        ('Timestamps', {
            'fields': (
                'created_at',
                'updated_at'
            )
        }),
    )


admin.site.register(Department, DepartmentAdmin)
admin.site.register(StaffRole, StaffRoleAdmin)
admin.site.register(Staff, StaffAdmin)